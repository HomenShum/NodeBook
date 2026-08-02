import { GraphStore } from "@/app/graph/GraphStore";
import { GraphUpdate } from "@/app/graph/GraphUpdate";

import { reconcileInverseUpdates } from "./applyProposal";

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
