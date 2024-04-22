import { PersistedGraphNode, PersistedGraphRelation } from "@/db/schema";
import { BaseSelection, LexicalNode } from "lexical";
import { makeAutoObservable } from "mobx";
import { comparePositions, relationsPathToParentChild, uuid } from "../util";
import { FractionalPositionedList } from "./FractionalPositionedList";
import { Chip, GraphNode, GraphNodeProps } from "./GraphNode";
import { GraphObject } from "./GraphObject";
import { GraphRelation, GraphRelationProps, GraphRelationType } from "./GraphRelation";
import { RemoteGraphStore } from "./RemoteGraphStore";
import { serializeMap } from "./serialization";

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
export type PathData = { isExpanded: boolean };

export class GraphStore {
  nodesById: Map<string, GraphNode> = new Map();
  relationsById: Map<string, GraphRelation> = new Map();
  relationTypesById: Record<string, GraphRelationType> = {};

  relationsByNodeId: Map<string, FractionalPositionedList<GraphRelation>> = new Map();
  pinnedRelationsByNodeId: Map<string, FractionalPositionedList<GraphRelation>> = new Map();

  correspondingObjectsForPinned: Map<string, GraphRelation> = new Map();
  correspondingPinnedForObjects: Map<string, GraphRelation> = new Map();

  pathData: Map<Path, PathData> = new Map();

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
      relationType: this.relationTypesById.child,
    });
    this.thoughtstreamRootRelationFromUserRoot = this.createRelation({
      from: this.userRoot,
      to: this.thoughtstreamRoot,
      relationType: this.relationTypesById.child,
    });
  }

  isRoot(obj: GraphObject) {
    return obj.id === this.userRoot.id || obj.id === this.outlineRoot.id || obj.id === this.thoughtstreamRoot.id;
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

  getRelationsFromPath(path: Path): GraphRelation[] {
    const relationIds = path.split("/");
    return relationIds.map((id) => this.relationsById.get(id)).filter((r) => r) as GraphRelation[];
  }

  createNode(props: GraphNodeProps = {}): GraphNode {
    const node = new GraphNode(this, {
      id: props.id || uuid(),
      content: props.content,
    });
    this.nodesById.set(node.id, node);
    this.relationsByNodeId.set(node.id, new FractionalPositionedList());
    this.pinnedRelationsByNodeId.set(node.id, new FractionalPositionedList());
    if (node.id === OUTLINE_ROOT_ID) {
      this.outlineRoot = node;
    } else if (node.id === THOUGHTSTREAM_ROOT_ID) {
      this.thoughtstreamRoot = node;
    } else if (node.id === USER_ROOT_ID) {
      this.userRoot = node;
    }
    return node;
  }

  createChildNode(parent: GraphObject, props: GraphNodeProps = {}) {
    const node = this.createNode(props);
    const relation = this.createRelation({
      from: parent,
      to: node,
      relationType: defaultRelationTypes.child,
    });
    return { node, relation };
  }

  insertNode(node: GraphNode): GraphNode {
    if (this.nodesById.has(node.id)) {
      throw new Error(`Node with id ${node.id} already exists`);
    }
    this.nodesById.set(node.id, node);

    const newList = new FractionalPositionedList<GraphRelation>();
    this.pinnedRelationsByNodeId.set(node.id, newList);

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
    this.assertExists(relation.from, relation.to);
    this.relationsById.set(relation.id, relation);

    this.getRelationList(relation.from).add(relation);
    this.getRelationList(relation.to).add(relation);

    const newList = new FractionalPositionedList<GraphRelation>();
    this.pinnedRelationsByNodeId.set(relation.id, newList);

    return relation;
  }

  createPinnedVersionOfRelation(relation: GraphRelation, direction: "from" | "to"): GraphRelation {
    const pinnedRelation = new GraphRelation(this, {
      from: relation.from,
      to: relation.to,
      relationType: relation.relationType,
    });
    this.correspondingObjectsForPinned.set(pinnedRelation.id, relation);
    this.correspondingPinnedForObjects.set(relation.id, pinnedRelation);
    this.relationsById.set(pinnedRelation.id, pinnedRelation);

    const newList = new FractionalPositionedList<GraphRelation>();
    this.pinnedRelationsByNodeId.set(pinnedRelation.id, newList);

    if (direction === "from") {
      this.getPinnedRelationList(relation.from).add(pinnedRelation);
    } else {
      this.getPinnedRelationList(relation.to).add(pinnedRelation);
    }

    return relation;
  }

  deletePinnedVersionOfRelation(relation: GraphRelation, direction: "from" | "to") {
    let pinnedRelation: GraphRelation;
    if (this.correspondingObjectsForPinned.has(relation.id)) {
      pinnedRelation = relation;
      const correspondingRelation = this.correspondingObjectsForPinned.get(relation.id)!;
      this.correspondingObjectsForPinned.delete(relation.id);
      this.correspondingPinnedForObjects.delete(correspondingRelation.id);
    } else {
      pinnedRelation = this.correspondingPinnedForObjects.get(relation.id)!;
      this.correspondingPinnedForObjects.delete(relation.id);
      this.correspondingObjectsForPinned.delete(pinnedRelation.id);
    }

    this.pinnedRelationsByNodeId.delete(pinnedRelation.id);
    if (direction === "from") {
      this.getPinnedRelationList(relation.from).delete(pinnedRelation.id);
    } else {
      this.getPinnedRelationList(relation.to).delete(pinnedRelation.id);
    }
    this.relationsById.delete(pinnedRelation.id);
  }

  // TODO: this is creating an observable, which might cause issues
  getRelationList(node: GraphObject): FractionalPositionedList<GraphRelation> {
    const list = this.relationsByNodeId.get(node.id);
    if (list) return list;
    const newList = new FractionalPositionedList<GraphRelation>();
    this.relationsByNodeId.set(node.id, newList);
    return newList;
  }

  getPinnedRelationList(node: GraphObject): FractionalPositionedList<GraphRelation> {
    return this.pinnedRelationsByNodeId.get(node.id)!;
  }

  deleteRelation(relation: GraphRelation) {
    const { from: fromNode, to: toNode } = relation;

    // Remove the relation from the nodes
    this.getRelationList(fromNode).delete(relation.id);
    this.getRelationList(toNode).delete(relation.id);
    this.getPinnedRelationList(fromNode).delete(relation.id);
    this.getPinnedRelationList(toNode).delete(relation.id);

    if (this.correspondingObjectsForPinned.has(relation.id)) {
      const correspondingRelation = this.correspondingObjectsForPinned.get(relation.id)!;
      this.correspondingObjectsForPinned.delete(relation.id);
      this.correspondingPinnedForObjects.delete(correspondingRelation.id);
      this.deleteRelation(correspondingRelation);
    } else if (this.correspondingPinnedForObjects.has(relation.id)) {
      const correspondingRelation = this.correspondingPinnedForObjects.get(relation.id)!;
      this.correspondingPinnedForObjects.delete(relation.id);
      this.correspondingObjectsForPinned.delete(correspondingRelation.id);
      this.deleteRelation(correspondingRelation);
    }

    // Delete the relation itself
    this.relationsById.delete(relation.id);

    this.deleteNodeIfEmptyAndUnrelated(fromNode, toNode);
  }

  /**
   * Update the `from` node of the given relations to the new node, and
   * also updates the list of relations on the old and new `from` nodes
   * to reflect the changes.
   */
  updateRelationFrom(relation: GraphRelation, newFrom: GraphObject) {
    // remove the relations from their old from nodes
    const oldFrom = relation.from;
    this.getRelationList(oldFrom).delete(relation.id);
    this.getPinnedRelationList(oldFrom).delete(relation.id);
    // update the relations from property
    relation.setFrom(newFrom);
    // add the relations to the new from node
    this.getRelationList(newFrom).add(relation);
    this.deleteNodeIfEmptyAndUnrelated(oldFrom);
  }

  /**
   * Update the `to` node of the given relations to the new node, and
   * also updates the list of relations on the old and new `to` nodes
   * to reflect the changes.
   */
  updateRelationTo(relation: GraphRelation, newTo: GraphObject) {
    // remove the relations from their old to nodes
    const oldTo = relation.to;
    this.getRelationList(oldTo).delete(relation.id);
    this.getPinnedRelationList(oldTo).delete(relation.id);
    // update the relations to property
    relation.setTo(newTo);
    // add the relations to the new to node
    this.getRelationList(newTo).add(relation);
    this.deleteNodeIfEmptyAndUnrelated(oldTo);
  }

  setGraphNodeAtPath(path: GraphRelation[], newGraphObject: GraphObject) {
    const { relation, child } = relationsPathToParentChild(path).slice(-1)[0];
    if (child.id === relation.to.id) {
      this.updateRelationTo(relation, newGraphObject);
    } else {
      this.updateRelationFrom(relation, newGraphObject);
    }
  }

  reverseRelation(relation: GraphRelation): GraphRelation {
    const { from, to } = relation;
    relation.from = to;
    relation.to = from;
    return relation;
  }

  updateRelationsType(relation: GraphRelation, newType: GraphRelationType): GraphRelation {
    relation.relationType = newType;
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

  private assertExists(...objects: GraphObject[]): void {
    objects.forEach((obj) => {
      if (obj instanceof GraphNode) {
        if (!this.nodesById.has(obj.id)) {
          throw new Error(`Node with id ${obj.id} does not exist`);
        }
      } else if (obj instanceof GraphRelation) {
        if (!this.relationsById.has(obj.id)) {
          throw new Error(`Relation with id ${obj.id} does not exist`);
        }
      } else {
        throw new Error("Invalid object type");
      }
    });
  }

  private deleteNodeIfEmptyAndUnrelated(...objects: GraphObject[]) {
    objects.forEach((obj) => {
      if (obj instanceof GraphNode && obj.text === "" && obj.relations.length === 0) {
        this.deleteNode(obj.id);
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
        this.createRelation({ from, to, relationType: type });
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

    if (start === 0 && end === 0) {
      // Insert a new blank node just above the current node
      // (we do this by getting the sibling above and moving the new node after it,
      // because FractionalPositionedList.move can only place nodes after another node.
      // TODO: add a moveBefore method or something to FractionalPositionedList)
      const child = this.createChildNode(parent);
      const relationsList = this.getRelationList(parent);
      const relations = Array.from(relationsList.values())
        .sort((a, b) => comparePositions(a.position, b.position))
        .map((v) => v.item);
      const relationIndex = relations.findIndex((r) => r.id === relation.id);
      const siblingAbove = relations[relationIndex - 1];
      if (siblingAbove) relationsList.move([child.relation], siblingAbove);
      return child;
    } else {
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
      const { node: newNode, relation: newRelation } = this.createChildNode(parent, { content: chipsAfter });
      const relationsList = this.getRelationList(parent);
      relationsList.move([newRelation], relation);
      return { node: newNode, relation: newRelation };
    }
  }

  moveRelationAfterSibling(node: GraphNode, relation: GraphRelation, sibling: GraphRelation) {
    const list = this.relationsByNodeId.get(node.id);
    list?.move([relation], sibling);
  }

  serialize() {
    const nodesById = serializeMap(this.nodesById);
    const relationsById = serializeMap(this.relationsById);
    const relationsByNodeId = serializeMap(this.relationsByNodeId);
    const pinnedRelationsByNodeId = serializeMap(this.pinnedRelationsByNodeId);
    const correspondingObjectsForPinned = serializeMap(this.correspondingObjectsForPinned);
    const correspondingPinnedForObjects = serializeMap(this.correspondingPinnedForObjects);

    return {
      nodesById,
      relationsById,
      relationTypesById: this.relationTypesById,
      relationsByNodeId,
      pinnedRelationsByNodeId,
      pathData: Object.fromEntries(this.pathData.entries()),
      correspondingObjectsForPinned,
      correspondingPinnedForObjects,
    };
  }

  deserializeInPlace(data: ReturnType<GraphStore["serialize"]>) {
    const nodesById = new Map<string, GraphNode>();
    for (const [key, value] of Object.entries(data.nodesById)) {
      nodesById.set(key, GraphNode.deserialize(value, this));
    }

    const relationsById = new Map<string, GraphRelation>();
    for (const [key, value] of Object.entries(data.relationsById)) {
      relationsById.set(key, GraphRelation.deserialize(value, this, nodesById));
    }

    const relationsByNodeId = new Map<string, FractionalPositionedList<GraphRelation>>();
    for (const [key, value] of Object.entries(data.relationsByNodeId)) {
      relationsByNodeId.set(
        key,
        FractionalPositionedList.deserialize<GraphRelation>(value, (data) =>
          GraphRelation.deserialize(data, this, nodesById),
        ),
      );
    }

    const pinnedRelationsByNodeId = new Map<string, FractionalPositionedList<GraphRelation>>();
    for (const [key, value] of Object.entries(data.pinnedRelationsByNodeId)) {
      pinnedRelationsByNodeId.set(
        key,
        FractionalPositionedList.deserialize<GraphRelation>(value, (data) =>
          GraphRelation.deserialize(data, this, nodesById),
        ),
      );
    }

    const correspondingObjectsForPinned = new Map<string, GraphRelation>();
    for (const [key, value] of Object.entries(data.correspondingObjectsForPinned)) {
      correspondingObjectsForPinned.set(key, GraphRelation.deserialize(value, this, nodesById));
    }

    const correspondingPinnedForObjects = new Map<string, GraphRelation>();
    for (const [key, value] of Object.entries(data.correspondingPinnedForObjects)) {
      correspondingPinnedForObjects.set(key, GraphRelation.deserialize(value, this, nodesById));
    }

    const pathData = new Map<Path, PathData>();
    for (const [key, value] of Object.entries(data.pathData)) {
      pathData.set(key, value);
    }

    this.nodesById = nodesById;
    this.relationsById = relationsById;
    this.relationTypesById = data.relationTypesById;
    this.relationsByNodeId = relationsByNodeId;
    this.pinnedRelationsByNodeId = pinnedRelationsByNodeId;
    this.pathData = pathData;
    this.correspondingObjectsForPinned = correspondingObjectsForPinned;
    this.correspondingPinnedForObjects = correspondingPinnedForObjects;
  }
}
