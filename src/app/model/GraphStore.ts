import { PersistedGraphNode, PersistedGraphRelation } from "@/db/schema";
import { BaseSelection, LexicalNode } from "lexical";
import { makeAutoObservable } from "mobx";
import { relationsToNodes, uuid } from "../util";
import { FractionalPositionedList } from "./FractionalPositionedList";
import { Chip, GraphNode, GraphNodeProps } from "./GraphNode";
import { GraphRelation, GraphRelationProps, GraphRelationType } from "./GraphRelation";
import { RemoteGraphStore } from "./RemoteGraphStore";

export const defaultRelationTypes = {
  child: { id: "child", label: "child", reverseLabel: "parent" },
  author: { id: "author", label: "author", reverseLabel: "authored" },
  reference: { id: "reference", label: "reference", reverseLabel: "referenced by" },
  relatesTo: { id: "relatesTo", label: "relates to", reverseLabel: "relates to" },
};

export const USER_ROOT_ID = "user-root-id";
export const OUTLINE_ROOT_ID = "outline-root-id";
export const THOUGHTSTREAM_ROOT_ID = "thoughtstream-root-id";

/**
 * Forward slash delimited relation ids.
 * Needs to be relation ids, not node ids, cause you can have multiple instances of
 * the same node related to the same parent, so node paths are not unique.
 *
 * Example:
 * - A
 *   - child: B
 *   - author: B
 */
export type Path = string;

export class GraphStore {
  nodesById: Map<string, GraphNode> = new Map();
  relationsById: Map<string, GraphRelation> = new Map();
  relationTypesById: Record<string, GraphRelationType> = {};

  relationsByNodeId: Map<string, FractionalPositionedList<GraphRelation>> = new Map();
  pinnedRelationsByNodeId: Map<string, FractionalPositionedList<GraphRelation>> = new Map();

  pathData: Map<Path, { isExpanded: boolean }> = new Map();

  // Default nodes and relations
  userRoot: GraphNode;
  outlineRoot: GraphNode;
  thoughtstreamRoot: GraphNode;
  outlineRootRelationFromUserRoot: GraphRelation;
  thoughtstreamRootRelationFromUserRoot: GraphRelation;

  isLoading = false;

  /** Add outline descendants which are direct children of outline to outline */
  addThoughstreamDirectChildrenToOutline = true;
  /** Add thoughtstream descendants which are direct children of thoughtstream to thoughtstream */
  addAllOutlineDescendantsToThoughtstream = true;
  /** Add thoughtstream descendants which are not direct children of thoughtstream as direct children of thoughtstream */
  addThoughtstreamNestedChildrenToThoughtstream = false;
  /** When enabled, removing a node as a direct child of a thoughtstream will delete it */
  removingNodeAsDirectChildOfThoughtstreamDeletesIt = false;

  constructor() {
    Object.values(defaultRelationTypes).forEach((rt) => this.createRelationType(rt, true));
    makeAutoObservable(this);
    this.outlineRoot = this.createNode({ id: OUTLINE_ROOT_ID, content: [{ type: "text", value: "Root" }] });
    this.userRoot = this.createNode({ id: USER_ROOT_ID, content: [{ type: "text", value: "User" }] });
    this.thoughtstreamRoot = this.createNode({
      id: THOUGHTSTREAM_ROOT_ID,
      content: [{ type: "text", value: "Thoughtstream" }],
    });
    this.outlineRootRelationFromUserRoot = this.createRelation({
      from: this.userRoot,
      to: this.outlineRoot,
      type: this.relationTypesById.child,
    });
    this.thoughtstreamRootRelationFromUserRoot = this.createRelation({
      from: this.userRoot,
      to: this.thoughtstreamRoot,
      type: this.relationTypesById.child,
    });
  }

  isPathExpanded(path: Path): boolean {
    return this.pathData.get(path)?.isExpanded || false;
  }

  togglePathExpanded(path: Path) {
    const oldData = this.pathData.get(path);
    this.pathData.set(path, {
      ...oldData,
      isExpanded: !oldData?.isExpanded,
    });
  }

  setPathExpanded(path: Path, isExpanded: boolean) {
    this.pathData.set(path, { isExpanded });
  }

  setAddThoughtstreamDirectChildrenToOutline(value: boolean) {
    this.addThoughstreamDirectChildrenToOutline = value;
  }

  setAddAllOutlineDescendantsToThoughtstream(value: boolean) {
    this.addAllOutlineDescendantsToThoughtstream = value;
  }

  setAddThoughtstreamNestedChildrenToThoughstream(value: boolean) {
    this.addThoughtstreamNestedChildrenToThoughtstream = value;
  }

  setRemovingNodeAsDirectChildOfThoughtstreamDeletesIt(value: boolean) {
    this.removingNodeAsDirectChildOfThoughtstreamDeletesIt = value;
  }

  get nodes(): GraphNode[] {
    return Array.from(this.nodesById.values());
  }

  get relations(): GraphRelation[] {
    return Array.from(this.relationsById.values());
  }

  get relationTypes(): GraphRelationType[] {
    return Object.values(this.relationTypesById);
  }

  getNodesFromPath(path: Path): GraphNode[] {
    const relationIds = path.split("/");
    const relations = relationIds.map((id) => this.relationsById.get(id)).filter((r) => r) as GraphRelation[];
    const nodes: GraphNode[] = [];
    relations.forEach((r, i) => {
      if (i === 0) {
        nodes.push(r.from);
      } else {
        const prevNode = nodes[i - 1];
        const nextNode = r.from.id === prevNode.id ? r.to : r.from;
        nodes.push(nextNode);
      }
    });
    return nodes;
  }

  getRelationsFromPath(path: Path): GraphRelation[] {
    const relationIds = path.split("/");
    return relationIds.map((id) => this.relationsById.get(id)).filter((r) => r) as GraphRelation[];
  }

  getNodesAndRelationsFromPath(path: Path): { node: GraphNode; relation: GraphRelation }[] {
    const relationIds = path.split("/");
    const relations = relationIds.map((id) => this.relationsById.get(id)).filter((r) => r) as GraphRelation[];
    const nodes = this.getNodesFromPath(path);
    return nodes.map((node, i) => ({ node, relation: relations[i] }));
  }

  createNode(props: GraphNodeProps = {}): GraphNode {
    const node = new GraphNode(this, {
      id: props.id || uuid(),
      content: props.content,
    });
    this.nodesById.set(node.id, node);
    this.relationsByNodeId.set(node.id, new FractionalPositionedList());
    if (node.id === OUTLINE_ROOT_ID) {
      this.outlineRoot = node;
    } else if (node.id === THOUGHTSTREAM_ROOT_ID) {
      this.thoughtstreamRoot = node;
    } else if (node.id === USER_ROOT_ID) {
      this.userRoot = node;
    }
    return node;
  }

  createChildNode(parent: GraphNode, props: GraphNodeProps = {}) {
    const node = this.createNode(props);
    const relation = this.createRelation({
      from: parent,
      to: node,
      type: defaultRelationTypes.child,
    });
    return { node, relation };
  }

  insertNode(node: GraphNode): GraphNode {
    if (this.nodesById.has(node.id)) {
      throw new Error(`Node with id ${node.id} already exists`);
    }
    this.nodesById.set(node.id, node);
    return node;
  }

  deleteNode(id: string) {
    const node = this.nodesById.get(id);
    if (!node) return;
    node.relations.forEach((r) => this.deleteRelation(r));
    this.nodesById.delete(node.id);
    this.relationsByNodeId.delete(node.id);
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodesById.get(id);
  }

  createRelation(props: GraphRelationProps): GraphRelation {
    return this.insertRelation(new GraphRelation(this, props));
  }

  insertRelation(relation: GraphRelation): GraphRelation {
    if (this.relationsById.has(relation.id)) {
      throw new Error(`Relation with id ${relation.id} already exists`);
    }
    this.assertNodeExists(relation.from, relation.to);
    this.relationsById.set(relation.id, relation);

    this.getRelationListForNode(relation.from).add(relation);
    this.getRelationListForNode(relation.to).add(relation);
    this.getPinnedRelationListForNode(relation.from).add(relation);
    this.getPinnedRelationListForNode(relation.to).add(relation);

    return relation;
  }

  getRelationListForNode(node: GraphNode): FractionalPositionedList<GraphRelation> {
    const list = this.relationsByNodeId.get(node.id);
    if (list) return list;
    const newList = new FractionalPositionedList<GraphRelation>();
    this.relationsByNodeId.set(node.id, newList);
    return newList;
  }

  getPinnedRelationListForNode(node: GraphNode): FractionalPositionedList<GraphRelation> {
    const list = this.pinnedRelationsByNodeId.get(node.id);
    if (list) return list;
    const newList = new FractionalPositionedList<GraphRelation>();
    this.pinnedRelationsByNodeId.set(node.id, newList);
    return newList;
  }

  deleteRelation(relation: GraphRelation) {
    const { from: fromNode, to: toNode } = relation;

    // Remove the relation from the nodes
    this.getRelationListForNode(fromNode).delete(relation.id);
    this.getRelationListForNode(toNode).delete(relation.id);
    this.getPinnedRelationListForNode(fromNode).delete(relation.id);
    this.getPinnedRelationListForNode(toNode).delete(relation.id);

    // Delete the relation itself
    this.relationsById.delete(relation.id);

    this.deleteNodeIfEmptyAndUnrelated(fromNode, toNode);
  }

  /**
   * Update the `from` node of the given relations to the new node, and
   * also updates the list of relations on the old and new `from` nodes
   * to reflect the changes.
   */
  updateRelationFrom(relation: GraphRelation, newFrom: GraphNode) {
    // remove the relations from their old from nodes
    const oldFrom = relation.from;
    oldFrom.allRelationsList.delete(relation.id);
    oldFrom.pinnedRelationsList.delete(relation.id);
    // update the relations from property
    relation.setFrom(newFrom);
    // add the relations to the new from node
    newFrom.allRelationsList.add(relation);
    this.deleteNodeIfEmptyAndUnrelated(oldFrom);
  }

  /**
   * Update the `to` node of the given relations to the new node, and
   * also updates the list of relations on the old and new `to` nodes
   * to reflect the changes.
   */
  updateRelationTo(relation: GraphRelation, newTo: GraphNode) {
    // remove the relations from their old to nodes
    const oldTo = relation.to;
    oldTo.allRelationsList.delete(relation.id);
    oldTo.pinnedRelationsList.delete(relation.id);
    // update the relations to property
    relation.setTo(newTo);
    // add the relations to the new to node
    newTo.allRelationsList.add(relation);
    this.deleteNodeIfEmptyAndUnrelated(oldTo);
  }

  setGraphNodeAtPath(relation: GraphRelation, node: GraphNode, pathToParentRelation: GraphRelation[]) {
    const nodes = relationsToNodes([...pathToParentRelation, relation]);
    const oldNode = nodes[nodes.length - 1];
    if (relation.to.id === oldNode.id) {
      this.updateRelationTo(relation, node);
    } else {
      this.updateRelationFrom(relation, node);
    }
  }

  reverseRelation(relation: GraphRelation): GraphRelation {
    const { from, to } = relation;
    relation.from = to;
    relation.to = from;
    return relation;
  }

  updateRelationsType(relation: GraphRelation, newType: GraphRelationType): GraphRelation {
    relation.type = newType;
    return relation;
  }

  createRelationType(props: GraphRelationType, fromServer = false): GraphRelationType {
    if (this.relationTypesById[props.id] && !fromServer) {
      throw new Error(`Relation type with id ${props.id} already exists`);
    }
    this.relationTypesById[props.id] = { ...props };
    return this.relationTypesById[props.id];
  }

  updateRelationType(id: string, props: Partial<Omit<GraphRelationType, "id">>): GraphRelationType {
    if (!this.relationTypesById[id]) {
      throw new Error(`Relation type with id ${id} does not exist`);
    }
    Object.assign(this.relationTypesById[id], { ...props, id });
    return this.relationTypesById[id];
  }

  deleteRelationType(id: string) {
    // find all relations with this type and set them to a default type
    this.relations.forEach((r) => {
      r.updateType(this.relationTypesById.child);
    });
    delete this.relationTypesById[id];
  }

  private assertNodeExists(...nodes: (GraphNode | string)[]): void {
    nodes.forEach((node) => {
      const id = typeof node === "string" ? node : node.id;
      if (!this.nodesById.has(id)) {
        throw new Error(`Node with id ${id} does not exist`);
      }
    });
  }

  private deleteNodeIfEmptyAndUnrelated(...nodes: GraphNode[]) {
    nodes.forEach((node) => {
      if (node.text === "" && node.relations.length === 0) {
        this.deleteNode(node.id);
      }
    });
  }

  loadFromServer(data: Awaited<ReturnType<RemoteGraphStore["load"]>>) {
    this.isLoading = true;
    try {
      const { nodes, relationTypes, relations } = data;
      nodes.forEach((n: PersistedGraphNode) => {
        this.createNode({ id: n.id, content: [{ type: "text", value: n.text }] });
      });
      relationTypes.forEach((rt: GraphRelationType) => this.createRelationType(rt, true));
      // TODO: clean up logic elsewhere so "child" type isn't hardcoded
      if (!this.relationTypesById.child) {
        this.createRelationType({ id: "child", label: "child", reverseLabel: "parent" });
      }
      relations.forEach((r: PersistedGraphRelation) => {
        const from = this.getNode(r.fromId);
        const to = this.getNode(r.toId);
        const type = this.relationTypesById[r.typeId as keyof typeof this.relationTypesById]; // TODO
        if (!from || !to || !type) {
          throw new Error("Invalid persisted relation");
        }
        this.createRelation({ from, to, type });
      });
    } catch (e) {
      console.error(e);
    }
    this.isLoading = false;
  }

  splitRelatedNode(relation: GraphRelation, nodeToSplit: GraphNode, selection: BaseSelection) {
    const parent = relation.to.id === nodeToSplit.id ? relation.from : relation.to;

    // Get text before and after the cursor
    const points = selection?.getStartEndPoints();
    if (!points) {
      throw new Error("No selection points");
    }
    const start = points[0].offset;
    const end = points[1].offset;

    const selectionNodes = selection.getNodes();
    const firstNode = selectionNodes[0];
    const lastNode = selectionNodes[selectionNodes.length - 1];

    const paragraphNode = firstNode.getParent();
    const paragraphChildren: LexicalNode[] = paragraphNode.getChildren();

    const firstNodeIndexInParagraph = paragraphChildren.findIndex((node) => node === firstNode);
    const lastNodeIndexInParagraph = paragraphChildren.findIndex((node) => node === lastNode);

    const startIndex = selection.isBackward() ? lastNodeIndexInParagraph : firstNodeIndexInParagraph;
    const endIndex = selection.isBackward() ? firstNodeIndexInParagraph : lastNodeIndexInParagraph;

    let chipsBefore: Chip[] = [];
    let chipsAfter: Chip[] = [];
    nodeToSplit.content.forEach((chip, idx) => {
      if (idx < startIndex) {
        // All chips before the start index are part of chipsBefore
        chipsBefore.push({ type: chip.type, value: chip.value });
      } else if (idx > endIndex) {
        // All chips after the end index are part of chipsAfter
        chipsAfter.push({ type: chip.type, value: chip.value });
      } else {
        // For chips within the selection range, split based on start and end offsets
        if (idx === startIndex) {
          // For the first node in the selection, add the text after the start offset to chipsAfter
          if (start < chip.value.length) {
            if (chip.type === "text") {
              chipsAfter.push({ type: "text", value: chip.value.substring(start) });
            } else {
              const mentionText = paragraphChildren[idx]?.getTextContent() || "";
              chipsAfter.push({ type: "text", value: mentionText.substring(start) });
            }
          }
        }
        if (idx === endIndex) {
          // For the last node in the selection, add the text before the end offset to chipsBefore
          if (end > 0) {
            if (chip.type === "text") {
              chipsBefore.push({ type: "text", value: chip.value.substring(0, end) });
            } else {
              const mentionText = paragraphChildren[idx]?.getTextContent() || "";
              chipsBefore.push({ type: "text", value: mentionText.substring(0, end) });
            }
          }
        }
        // Nodes between the start and end nodes are deleted by ignoring them
      }
    });
    nodeToSplit.setContent(chipsBefore);
    // Create a new related node below the current one with the text after the cursor
    const { node: newNode, relation: newRelation } = parent.createChild({ content: chipsAfter });
    const relationsList = this.getRelationListForNode(parent);
    relationsList.move([newRelation], relation);
    return { node: newNode, relation: newRelation };
  }

  moveRelationAfterSibling(node: GraphNode, relation: GraphRelation, sibling: GraphRelation) {
    const list = this.relationsByNodeId.get(node.id);
    list?.move([relation], sibling);
  }
}
