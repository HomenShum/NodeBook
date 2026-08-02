import { GraphStore } from "@/app/graph/GraphStore";
import { GraphUpdate, generateInverseUpdates } from "@/app/graph/GraphUpdate";
import { defaultRelationTypes } from "@/app/graph/constants";

import { AgentOperation } from "./types";

const MAX_CLONED_NODES = 100;

function canonicalJson(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function serializedGraphObject(value: unknown) {
  if (value && typeof value === "object" && "serialize" in value && typeof value.serialize === "function") {
    return value.serialize();
  }
  return value;
}

function rollbackComparable(value: unknown) {
  const serialized = serializedGraphObject(value);
  if (!serialized || typeof serialized !== "object" || Array.isArray(serialized)) return serialized;
  const { createdAt, updatedAt, ...comparable } = serialized as Record<string, unknown>;
  void createdAt;
  void updatedAt;
  return comparable;
}

function isSameGraphEntity(current: unknown, expected: unknown) {
  return canonicalJson(rollbackComparable(current)) === canonicalJson(rollbackComparable(expected));
}

function resolveId(id: string | null, temporaryIds: Map<string, string>) {
  if (!id) throw new Error("The checkpoint is missing a required node ID.");
  return temporaryIds.get(id) ?? id;
}

async function cloneHierarchy(
  graphStore: GraphStore,
  sourceId: string,
  parentId: string,
  seen: Set<string>,
  budget: { remaining: number },
) {
  if (budget.remaining <= 0) throw new Error(`Clone exceeds the ${MAX_CLONED_NODES}-node safety limit.`);
  if (seen.has(sourceId)) throw new Error("Clone contains a cycle.");
  const source = graphStore.getNode(sourceId);
  if (!source) throw new Error(`Clone source ${sourceId} no longer exists.`);
  seen.add(sourceId);
  budget.remaining -= 1;
  const { node: clone } = await graphStore.addChildNode({
    parentId,
    nodeProps: { content: source.content.map((chip) => ({ ...chip })) },
  });
  for (const child of source.children) {
    if (child.objectType === "node" && child.canonicalRelation?.from.id === source.id) {
      await cloneHierarchy(graphStore, child.id, clone.id, seen, budget);
    }
  }
  seen.delete(sourceId);
  return clone;
}

export async function applyAgentOperations(graphStore: GraphStore, operations: AgentOperation[]) {
  if (operations.length > 30) throw new Error("Checkpoint exceeds the 30-operation safety limit.");
  const shouldResumeSync = await graphStore.updateManager.beginDurableWork();
  const firstTransaction = graphStore.updateManager.sessionUpdates.length;
  const temporaryIds = new Map<string, string>();

  try {
    for (const operation of operations) {
      if (operation.kind === "create_node") {
        const parentId = resolveId(operation.parentId, temporaryIds);
        const { node } = await graphStore.addChildNode({
          parentId,
          nodeProps: { content: operation.content ?? "" },
        });
        if (operation.tempId) temporaryIds.set(operation.tempId, node.id);
      } else if (operation.kind === "update_node_content") {
        await graphStore.updateNode({
          nodeId: resolveId(operation.nodeId, temporaryIds),
          nodeProps: { content: operation.newContent ?? "" },
        });
      } else if (operation.kind === "delete_node") {
        const nodeId = resolveId(operation.nodeId, temporaryIds);
        const node = graphStore.getNode(nodeId);
        if (!node) throw new Error(`Node ${nodeId} no longer exists.`);
        if (node.children.length) throw new Error("Nodes with children cannot be deleted by the agent.");
        await graphStore.removeNode({ nodeId });
      } else if (operation.kind === "move_node") {
        const nodeId = resolveId(operation.nodeId, temporaryIds);
        const node = graphStore.getNode(nodeId);
        const canonicalRelation = node?.canonicalRelation;
        if (!node || !canonicalRelation) throw new Error(`Node ${nodeId} has no movable parent relation.`);
        await graphStore.replaceRelationLink({
          direction: "from",
          relationId: canonicalRelation.id,
          replaceWith: { type: "existing-object", id: resolveId(operation.newParentId, temporaryIds) },
        });
      } else if (operation.kind === "add_relation") {
        await graphStore.addRelation({
          fromId: resolveId(operation.fromNodeId, temporaryIds),
          toId: resolveId(operation.toNodeId, temporaryIds),
          relationTypeId: operation.relationType
            ? defaultRelationTypes[operation.relationType].id
            : defaultRelationTypes.child.id,
        });
      } else if (operation.kind === "clone_node_hierarchy") {
        await cloneHierarchy(
          graphStore,
          resolveId(operation.nodeId, temporaryIds),
          resolveId(operation.newParentId, temporaryIds),
          new Set(),
          { remaining: MAX_CLONED_NODES },
        );
      }
    }
    await graphStore.updateManager.flushDurableUpdates();
  } catch (error) {
    if (!/^Graph sync failed|^Durable graph sync/.test(error instanceof Error ? error.message : "")) {
      const partial = graphStore.updateManager.sessionUpdates.slice(firstTransaction).flat();
      if (partial.length) {
        graphStore.updateManager.applyDurableTransaction(generateInverseUpdates(partial));
        await graphStore.updateManager.flushDurableUpdates();
      }
    }
    throw error;
  } finally {
    graphStore.updateManager.resumeAfterDurableWork(shouldResumeSync);
  }

  const appliedUpdates = graphStore.updateManager.sessionUpdates.slice(firstTransaction).flat();
  const inverseUpdates = generateInverseUpdates(appliedUpdates);
  return { appliedUpdates, inverseUpdates };
}

export function reconcileInverseUpdates(graphStore: GraphStore, inverseUpdates: GraphUpdate[], warnings: string[] = []) {
  const nodeIds = new Set(graphStore.nodesById.keys());
  const relationIds = new Set(graphStore.relationsById.keys());
  const objectIds = new Set([...nodeIds, ...relationIds]);
  const deletedRelationIds = new Set(inverseUpdates.flatMap((update) => update.operation === "deleteRelation" ? [update.deleted.relation.id] : []));
  const deletedNodes = new Map(inverseUpdates.flatMap((update) => update.operation === "deleteNode" ? [[update.node.id, update.node] as const] : []));
  const scaffoldedNodeIds = new Set<string>();
  const scaffoldUpdates: GraphUpdate[] = [];
  const entityUpdates: GraphUpdate[] = [];
  const listUpdates: GraphUpdate[] = [];
  const relationDeletes: GraphUpdate[] = [];
  const nodeDeletes: GraphUpdate[] = [];
  const virtualNodes = new Map<string, unknown>(graphStore.nodesById);
  const virtualRelations = new Map<string, unknown>(graphStore.relationsById);
  for (const update of inverseUpdates) {
    if (update.operation !== "updateRelation") continue;
    const current = graphStore.relationsById.get(update.newProps.id);
    if (current && isSameGraphEntity(current, update.newProps)) continue;
    for (const endpointId of [update.oldProps.fromId, update.oldProps.toId]) {
      const scaffold = deletedNodes.get(endpointId);
      if (!objectIds.has(endpointId) && scaffold) {
        scaffoldUpdates.push({ operation: "addNode", node: scaffold });
        scaffoldedNodeIds.add(endpointId);
        nodeIds.add(endpointId);
        objectIds.add(endpointId);
      }
    }
  }
  const repairMissingEndpoint = <T extends { id: string; fromId: string; toId: string; relationTypeId: string }>(relation: T) => {
    const missingFrom = !objectIds.has(relation.fromId);
    const missingTo = !objectIds.has(relation.toId);
    if (!missingFrom && !missingTo) return relation;
    if (missingFrom === missingTo || relation.relationTypeId !== defaultRelationTypes.child.id) {
      throw new Error(`Rollback cannot restore relation ${relation.id}; an original endpoint is missing.`);
    }
    const missingId = missingFrom ? relation.fromId : relation.toId;
    warnings.push(`Original endpoint ${missingId} no longer exists; restored relation ${relation.id} to the notebook root.`);
    return {
      ...relation,
      fromId: missingFrom ? graphStore.userRoot.id : relation.fromId,
      toId: missingTo ? graphStore.userRoot.id : relation.toId,
    };
  };

  for (const [updateIndex, update] of inverseUpdates.entries()) {
    if (update.operation === "addNode") {
      if (!nodeIds.has(update.node.id)) {
        entityUpdates.push(update);
        nodeIds.add(update.node.id);
        virtualNodes.set(update.node.id, update.node);
      }
    } else if (update.operation === "updateNode") {
      const current = virtualNodes.get(update.newProps.id);
      if (current && isSameGraphEntity(current, update.newProps)) {
        // Already restored by an earlier retry.
      } else if (current && isSameGraphEntity(current, update.oldProps)) {
        entityUpdates.push(update);
        virtualNodes.set(update.newProps.id, update.newProps);
      } else if (current && inverseUpdates.slice(updateIndex + 1).some((candidate) =>
        candidate.operation === "updateNode"
        && candidate.newProps.id === update.newProps.id
        && isSameGraphEntity(current, candidate.newProps))) {
        // A partial durable retry already advanced this entity beyond this step.
      } else if (current) {
        throw new Error(`Rollback cannot restore node ${update.newProps.id}; it changed after the checkpoint.`);
      }
    } else if (update.operation === "addRelation") {
      if (!relationIds.has(update.relation.id)) {
        const repaired = repairMissingEndpoint(update.relation);
        entityUpdates.push({ ...update, relation: repaired });
        relationIds.add(update.relation.id);
        virtualRelations.set(update.relation.id, repaired);
      }
    } else if (update.operation === "updateRelation") {
      const newProps = repairMissingEndpoint(update.newProps);
      const current = virtualRelations.get(update.newProps.id);
      if (current && isSameGraphEntity(current, newProps)) {
        // A previous durable retry already restored this relation. Replaying the
        // stale old -> new transition would correctly fail Convex CAS.
      } else if (current && isSameGraphEntity(current, update.oldProps)) {
        entityUpdates.push({ ...update, newProps });
        virtualRelations.set(update.newProps.id, newProps);
      } else if (current && inverseUpdates.slice(updateIndex + 1).some((candidate) =>
        candidate.operation === "updateRelation"
        && candidate.newProps.id === update.newProps.id
        && isSameGraphEntity(current, candidate.newProps))) {
        // A partial durable retry already advanced this entity beyond this step.
      } else if (current) {
        throw new Error(`Rollback cannot restore relation ${update.newProps.id}; it changed after the checkpoint.`);
      } else {
        entityUpdates.push({ operation: "addRelation", relation: newProps });
        relationIds.add(update.newProps.id);
        virtualRelations.set(update.newProps.id, newProps);
      }
    } else if (update.operation === "updateRelationList") {
      if (nodeIds.has(update.nodeId) && !scaffoldedNodeIds.has(update.nodeId) && relationIds.has(update.relationId) && !deletedRelationIds.has(update.relationId)) {
        listUpdates.push(update);
      }
    } else if (update.operation === "deleteRelation") {
      if (relationIds.has(update.deleted.relation.id)) {
        relationDeletes.push(update);
        relationIds.delete(update.deleted.relation.id);
        virtualRelations.delete(update.deleted.relation.id);
      }
    } else if (update.operation === "deleteNode") {
      if (nodeIds.has(update.node.id)) {
        nodeDeletes.push(update);
        nodeIds.delete(update.node.id);
        virtualNodes.delete(update.node.id);
      }
    }
  }

  return [...scaffoldUpdates, ...entityUpdates, ...listUpdates, ...relationDeletes, ...nodeDeletes];
}

export async function undoAgentOperations(graphStore: GraphStore, inverseUpdates: GraphUpdate[]) {
  const shouldResumeSync = await graphStore.updateManager.beginDurableWork();
  try {
    const warnings: string[] = [];
    const reconciled = reconcileInverseUpdates(graphStore, inverseUpdates, warnings);
    if (!reconciled.length) throw new Error("The rollback receipt is already fully applied.");
    graphStore.updateManager.applyDurableTransaction(reconciled);
    await graphStore.updateManager.flushDurableUpdates();
    return { warnings };
  } finally {
    graphStore.updateManager.resumeAfterDurableWork(shouldResumeSync);
  }
}
