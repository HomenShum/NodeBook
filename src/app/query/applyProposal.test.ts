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
      relationsById: new Map([[missingClusterRelation.id, missingClusterRelation]]),
    } as unknown as GraphStore;
    const inverse = [
      {
        operation: "updateRelation",
        oldProps: relation(originalRelation.id, "missing-cluster", "reviewed-note"),
        newProps: originalRelation,
      },
      { operation: "deleteRelation", deleted: { relation: missingClusterRelation, relationsList: [] } },
      { operation: "deleteNode", node: { id: "missing-cluster" } },
      { operation: "deleteNode", node: { id: "knowledge-map" } },
    ] as GraphUpdate[];

    const reconciled = reconcileInverseUpdates(graphStore, inverse);

    expect(reconciled.map((update) => update.operation)).toEqual(["addRelation", "deleteRelation", "deleteNode"]);
    expect(reconciled[0]).toEqual({ operation: "addRelation", relation: originalRelation });
    expect(reconciled.at(-1)).toMatchObject({ operation: "deleteNode", node: { id: "knowledge-map" } });
  });

  test("a rollback fails honestly when an original note parent was actually deleted", () => {
    const graphStore = {
      nodesById: new Map([["reviewed-note", node("reviewed-note")]]),
      relationsById: new Map(),
    } as unknown as GraphStore;
    const inverse = [{
      operation: "updateRelation",
      oldProps: relation("note-parent", "missing-cluster", "reviewed-note"),
      newProps: relation("note-parent", "deleted-original-parent", "reviewed-note"),
    }] as GraphUpdate[];

    expect(() => reconcileInverseUpdates(graphStore, inverse)).toThrow("an original endpoint is missing");
  });
});
