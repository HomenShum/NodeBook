import { MOCK_NODEBOOK_USER } from "@/app/auth/NodeBookUser";
import { GraphStore } from "@/app/graph/GraphStore";
import { GraphUpdate } from "@/app/graph/GraphUpdate";

import { applyAgentOperations, reconcileInverseUpdates, undoAgentOperations } from "./applyProposal";

const node = (id: string) => ({ id });
const relation = (id: string, fromId: string, toId: string) => ({
  id,
  authorId: "auth0|owner-a",
  version: 1,
  createdAt: new Date("2026-08-02T00:00:00.000Z"),
  updatedAt: new Date("2026-08-02T00:00:00.000Z"),
  isPublic: false,
  canonicalRelationId: null,
  fromId,
  toId,
  relationTypeId: "child",
});

describe("durable agent rollback reconciliation", () => {
  test("an organizer can create one folder, move three siblings, and restore the exact original hierarchy", async () => {
    const graphStore = new GraphStore(MOCK_NODEBOOK_USER);
    const { node: fixture } = await graphStore.addChildNode({ parentId: graphStore.userRoot.id, nodeProps: { content: "QA Fixture" } });
    const meetings = await Promise.all(["Alpha", "Beta", "Gamma"].map(async (suffix) => (
      await graphStore.addChildNode({ parentId: fixture.id, nodeProps: { content: `QA Meeting ${suffix}` } })
    ).node));
    const { node: control } = await graphStore.addChildNode({ parentId: fixture.id, nodeProps: { content: "QA Grocery Control" } });
    graphStore.updateManager.cleanup();
    jest.spyOn(graphStore.updateManager, "beginDurableWork").mockResolvedValue(false);
    jest.spyOn(graphStore.updateManager, "flushDurableUpdates").mockResolvedValue(undefined);

    const receipt = await applyAgentOperations(graphStore, [
      {
        kind: "create_node", nodeId: null, parentId: fixture.id, newParentId: null, fromNodeId: null, toNodeId: null,
        relationType: null, tempId: "meeting-folder", content: "QA Project Meetings", newContent: null, reason: "Create exact folder.",
      },
      ...meetings.map((meeting) => ({
        kind: "move_node" as const, nodeId: meeting.id, parentId: null, newParentId: "meeting-folder", fromNodeId: null, toNodeId: null,
        relationType: null, tempId: null, content: null, newContent: null, reason: "Move exact meeting.",
      })),
    ]);

    expect(fixture.children.map((child) => child.id)).toEqual(expect.arrayContaining([control.id]));
    expect(fixture.children).toHaveLength(2);

    const reloadedInverse = JSON.parse(JSON.stringify(receipt.inverseUpdates)) as GraphUpdate[];
    await undoAgentOperations(graphStore, reloadedInverse);

    expect(fixture.children.map((child) => child.id)).toEqual(expect.arrayContaining([control.id, ...meetings.map((meeting) => meeting.id)]));
    expect(fixture.children).toHaveLength(4);
  });

  test("a returning organizer restores the exact hierarchy from a persisted graph and receipt", async () => {
    const graphStore = new GraphStore(MOCK_NODEBOOK_USER);
    const { node: fixture } = await graphStore.addChildNode({ parentId: graphStore.userRoot.id, nodeProps: { content: "QA Fixture" } });
    const meetings = await Promise.all(["Alpha", "Beta", "Gamma"].map(async (suffix) => (
      await graphStore.addChildNode({ parentId: fixture.id, nodeProps: { content: `QA Meeting ${suffix}` } })
    ).node));
    const { node: control } = await graphStore.addChildNode({ parentId: fixture.id, nodeProps: { content: "QA Grocery Control" } });
    const originalFixture = fixture.serialize();
    const originalMeetings = meetings.map((meeting) => meeting.serialize());
    graphStore.updateManager.cleanup();
    jest.spyOn(graphStore.updateManager, "beginDurableWork").mockResolvedValue(false);
    jest.spyOn(graphStore.updateManager, "flushDurableUpdates").mockResolvedValue(undefined);

    const receipt = await applyAgentOperations(graphStore, [
      {
        kind: "create_node", nodeId: null, parentId: fixture.id, newParentId: null, fromNodeId: null, toNodeId: null,
        relationType: null, tempId: "meeting-folder", content: "QA Project Meetings", newContent: null, reason: "Create exact folder.",
      },
      ...meetings.map((meeting) => ({
        kind: "move_node" as const, nodeId: meeting.id, parentId: null, newParentId: "meeting-folder", fromNodeId: null, toNodeId: null,
        relationType: null, tempId: null, content: null, newContent: null, reason: "Move exact meeting.",
      })),
    ]);

    const reloadedStore = new GraphStore(MOCK_NODEBOOK_USER);
    reloadedStore.resetAndLoad(JSON.parse(JSON.stringify(graphStore.serialize())));
    reloadedStore.updateManager.cleanup();
    jest.spyOn(reloadedStore.updateManager, "beginDurableWork").mockResolvedValue(false);
    jest.spyOn(reloadedStore.updateManager, "flushDurableUpdates").mockResolvedValue(undefined);

    await undoAgentOperations(
      reloadedStore,
      JSON.parse(JSON.stringify(receipt.inverseUpdates)) as GraphUpdate[],
    );

    const restoredFixture = reloadedStore.getNode(fixture.id);
    expect(restoredFixture?.children.map((child) => child.id)).toEqual(
      expect.arrayContaining([control.id, ...meetings.map((meeting) => meeting.id)]),
    );
    expect(restoredFixture?.children).toHaveLength(4);
    expect(restoredFixture?.serialize()).toMatchObject({
      relationCount: originalFixture.relationCount,
      canonicalRelationId: originalFixture.canonicalRelationId,
    });
    for (const originalMeeting of originalMeetings) {
      expect(reloadedStore.getNode(originalMeeting.id)?.serialize()).toMatchObject({
        relationCount: originalMeeting.relationCount,
        canonicalRelationId: originalMeeting.canonicalRelationId,
      });
    }
  });

  test("a partially synced knowledge map restores an absent moved relation and skips an already absent cluster", () => {
    const originalRelation = relation("note-parent", "original-parent", "reviewed-note");
    const missingClusterRelation = relation("map-to-missing-cluster", "knowledge-map", "missing-cluster");
    const graphStore = {
      nodesById: new Map([
        ["original-parent", node("original-parent")],
        ["reviewed-note", node("reviewed-note")],
        ["knowledge-map", node("knowledge-map")],
      ]),
      relationsById: new Map([
        [missingClusterRelation.id, missingClusterRelation],
        [originalRelation.id, relation(originalRelation.id, "missing-cluster", "reviewed-note")],
      ]),
      userRoot: { id: "user-root" },
    } as unknown as GraphStore;
    const inverse = [
      {
        operation: "updateRelation",
        oldProps: relation(originalRelation.id, "missing-cluster", "reviewed-note"),
        newProps: originalRelation,
      },
      {
        operation: "updateRelationList",
        authorId: "auth0|owner-a",
        nodeId: "missing-cluster",
        type: "all",
        relationId: originalRelation.id,
        oldPosition: "a0",
        newPosition: "a1",
        oldIsPublic: false,
        newIsPublic: false,
      },
      { operation: "deleteRelation", deleted: { relation: missingClusterRelation, relationsList: [] } },
      { operation: "deleteNode", node: { id: "missing-cluster" } },
      { operation: "deleteNode", node: { id: "knowledge-map" } },
    ] as GraphUpdate[];

    const reconciled = reconcileInverseUpdates(graphStore, inverse);

    expect(reconciled.map((update) => update.operation)).toEqual(["addNode", "updateRelation", "deleteRelation", "deleteNode", "deleteNode"]);
    expect(reconciled[0]).toMatchObject({ operation: "addNode", node: { id: "missing-cluster" } });
    expect(reconciled[1]).toMatchObject({ operation: "updateRelation", newProps: originalRelation });
    expect(reconciled.at(-1)).toMatchObject({ operation: "deleteNode", node: { id: "knowledge-map" } });
  });

  test("a rollback fails honestly when an original note parent was actually deleted", () => {
    const graphStore = {
      nodesById: new Map(),
      relationsById: new Map(),
      userRoot: { id: "user-root" },
    } as unknown as GraphStore;
    const inverse = [{
      operation: "updateRelation",
      oldProps: relation("note-parent", "missing-cluster", "reviewed-note"),
      newProps: relation("note-parent", "deleted-original-parent", "also-deleted-note"),
    }] as GraphUpdate[];

    expect(() => reconcileInverseUpdates(graphStore, inverse)).toThrow("an original endpoint is missing");
  });

  test("a retry skips a relation that production already restored in an earlier partial rollback", () => {
    const originalRelation = relation("note-parent", "original-parent", "reviewed-note");
    const legacyStoredRelation = {
      ...originalRelation,
      createdAt: null,
      updatedAt: null,
      relationCount: undefined,
    };
    const graphStore = {
      nodesById: new Map([
        ["original-parent", node("original-parent")],
        ["reviewed-note", node("reviewed-note")],
      ]),
      relationsById: new Map([[originalRelation.id, legacyStoredRelation]]),
      userRoot: { id: "user-root" },
    } as unknown as GraphStore;
    const inverse = [{
      operation: "updateRelation",
      oldProps: relation("note-parent", "missing-cluster", "reviewed-note"),
      newProps: originalRelation,
    }] as GraphUpdate[];

    expect(reconcileInverseUpdates(graphStore, inverse)).toEqual([]);
  });

  test("a retry fails closed when a reviewed relation changed after the checkpoint", () => {
    const graphStore = {
      nodesById: new Map([
        ["original-parent", node("original-parent")],
        ["reviewed-note", node("reviewed-note")],
        ["other-parent", node("other-parent")],
      ]),
      relationsById: new Map([["note-parent", relation("note-parent", "other-parent", "reviewed-note")]]),
      userRoot: { id: "user-root" },
    } as unknown as GraphStore;
    const inverse = [{
      operation: "updateRelation",
      oldProps: relation("note-parent", "missing-cluster", "reviewed-note"),
      newProps: relation("note-parent", "original-parent", "reviewed-note"),
    }] as GraphUpdate[];

    expect(() => reconcileInverseUpdates(graphStore, inverse)).toThrow("changed after the checkpoint");
  });

  test("a legacy child relation with one dangling parent is restored to the notebook root with disclosure", () => {
    const graphStore = {
      nodesById: new Map([["reviewed-note", node("reviewed-note")], ["user-root", node("user-root")]]),
      relationsById: new Map([["note-parent", relation("note-parent", "cluster", "reviewed-note")]]),
      userRoot: { id: "user-root" },
    } as unknown as GraphStore;
    const warnings: string[] = [];
    const inverse = [{
      operation: "updateRelation",
      oldProps: relation("note-parent", "cluster", "reviewed-note"),
      newProps: relation("note-parent", "dangling-parent", "reviewed-note"),
    }] as GraphUpdate[];

    const reconciled = reconcileInverseUpdates(graphStore, inverse, warnings);

    expect(reconciled[0]).toMatchObject({ operation: "updateRelation", newProps: { fromId: "user-root", toId: "reviewed-note" } });
    expect(warnings).toEqual(["Original endpoint dangling-parent no longer exists; restored relation note-parent to the notebook root."]);
  });
});
