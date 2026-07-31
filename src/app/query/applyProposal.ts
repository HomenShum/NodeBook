import { GraphStore } from "@/app/graph/GraphStore";
import { GraphUpdate, generateInverseUpdates } from "@/app/graph/GraphUpdate";
import { defaultRelationTypes } from "@/app/graph/constants";

import { AgentOperation } from "./types";

const MAX_CLONED_NODES = 100;

function resolveId(id: string | null, temporaryIds: Map<string, string>) {
  if (!id) throw new Error("The proposal is missing a required node ID.");
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
  if (operations.length > 30) throw new Error("Proposal exceeds the 30-operation safety limit.");
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
  } catch (error) {
    const partial = graphStore.updateManager.sessionUpdates.slice(firstTransaction).flat();
    if (partial.length) await graphStore.updateManager.applyDurableTransaction(generateInverseUpdates(partial));
    throw error;
  }

  const appliedUpdates = graphStore.updateManager.sessionUpdates.slice(firstTransaction).flat();
  const inverseUpdates = generateInverseUpdates(appliedUpdates);
  return { appliedUpdates, inverseUpdates };
}

export async function undoAgentOperations(graphStore: GraphStore, inverseUpdates: GraphUpdate[]) {
  await graphStore.updateManager.applyDurableTransaction(inverseUpdates);
}
