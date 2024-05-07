import { BaseSelection, LexicalNode } from "lexical";
import { makeAutoObservable, toJS } from "mobx";
import { nodeToChip } from "../editor/utils";
import { comparePositions, relationsPathToParentChild, uuid } from "../util";
import { FractionalPositionedList } from "./FractionalPositionedList";
import { Chip, GraphNode, GraphNodeProps } from "./GraphNode";
import { GraphObject } from "./GraphObject";
import { GraphRelation, GraphRelationProps, GraphRelationType } from "./GraphRelation";
import { serializeMap } from "./serialization";

export const defaultRelationTypes = {
  child: { id: "child", label: "child", reverseLabel: "parent" },
  author: { id: "author", label: "author", reverseLabel: "authored" },
  reference: { id: "reference", label: "reference", reverseLabel: "referenced by" },
  relatesTo: { id: "relatesTo", label: "relates to", reverseLabel: "relates to" },
  empty: { id: "empty", label: "", reverseLabel: "" },
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
  /** Relation id to list of bundle-nodes that contain it */
  relationToBundles: Map<string, GraphNode[]> = new Map();

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
    this.outlineRoot = this.createNode({ id: OUTLINE_ROOT_ID, content: [{ type: "text", value: "My Lists" }] });
    this.userRoot = this.createNode({ id: USER_ROOT_ID, content: [{ type: "text", value: "User" }] });
    this.thoughtstreamRoot = this.createNode({
      id: THOUGHTSTREAM_ROOT_ID,
      content: [{ type: "text", value: "Stream" }],
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

  addToBundle(relation: GraphRelation, bundle: GraphNode) {
    if (!bundle.isBundle) {
      throw new Error("Node must be a bundle");
    }
    const relationToBundle = this.createRelation({ from: bundle, to: relation });
    const bundles = this.relationToBundles.get(relation.id) || [];
    this.relationToBundles.set(relation.id, [...bundles, bundle]);
    return relationToBundle;
  }

  removeFromBundle(relation: GraphRelation, bundle: GraphNode) {
    if (!bundle.isBundle) {
      throw new Error("Node must be a bundle");
    }

    // Delete relation from bundle to relation
    const relationFromRelationToBundle = this.getRelationList(bundle)
      .values()
      .map((v) => v.item)
      .find((r) => r.to.id === relation.id);
    if (relationFromRelationToBundle) {
      this.deleteRelation(relationFromRelationToBundle);
    }

    // If bundle is empty after removing relation, delete it
    // (Bundle is empty if it only has relation to Thoughtstream)
    if (this.getRelationList(bundle).values().length === 1) {
      this.deleteNode(bundle.id);
    }

    // Update relation to bundles map
    const bundles = this.relationToBundles.get(relation.id) || [];
    const newBundles = bundles.filter((b) => b.id !== bundle.id);
    this.relationToBundles.set(relation.id, newBundles);
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

  /**
   * Create a new node, with child relation to thoughtstream, and a new bundle
   * which contains it.
   */
  createThoughtstreamChild(props: GraphNodeProps = {}) {
    const node = this.createNode(props);
    return { node, ...this.addToThoughtstream(node) };
  }

  /**
   * Add a node to the thoughtstream, with a new bundle containing it.
   */
  addToThoughtstream(obj: GraphObject) {
    // add to thoughtstream
    const relationToThoughtstream = this.createRelation({
      from: this.thoughtstreamRoot,
      to: obj,
    });
    // within a new bundle
    const bundle = this.createChildNode(this.thoughtstreamRoot).node;
    bundle.setIsBundle(true);
    const relationToBundle = this.addToBundle(relationToThoughtstream, bundle);
    return { bundle, relationToThoughtstream, relationToBundle };
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
    let pinnedRelation = this.getCorrespondingRelation(relation);

    if (!pinnedRelation) {
      pinnedRelation = new GraphRelation(this, {
        from: relation.from,
        to: relation.to,
        relationType: relation.relationType,
      });
      this.correspondingObjectsForPinned.set(pinnedRelation.id, relation);
      this.correspondingPinnedForObjects.set(relation.id, pinnedRelation);
      this.relationsById.set(pinnedRelation.id, pinnedRelation);
      const newList = new FractionalPositionedList<GraphRelation>();
      this.pinnedRelationsByNodeId.set(pinnedRelation.id, newList);
    }

    if (direction === "from") {
      this.getPinnedRelationList(relation.from).add(pinnedRelation);
    } else {
      this.getPinnedRelationList(relation.to).add(pinnedRelation);
    }

    return relation;
  }

  /**
   * Finds the first relation type whose label (or reverseLabel) matches the provided text.
   *
   * TODO: think about how this should be handled long term.
   */
  getOrCreateRelationTypeByLabel(labelText: string): GraphRelationType {
    for (const [_, type] of Object.entries(this.relationTypesById)) {
      if (type.label === labelText || type.reverseLabel === labelText) {
        return type;
      }
    }
    return this.createRelationType({ label: labelText });
  }

  unpinRelation(relation: GraphRelation, direction: "from" | "to") {
    let baseRelation: GraphRelation;
    let pinnedRelation: GraphRelation;
    if (this.correspondingObjectsForPinned.has(relation.id)) {
      baseRelation = this.correspondingObjectsForPinned.get(relation.id)!;
      pinnedRelation = relation;
    } else {
      baseRelation = relation;
      pinnedRelation = this.correspondingPinnedForObjects.get(relation.id)!;
    }

    if (this.getPinnedRelationList(relation.from).has(pinnedRelation.id) && direction === "from") {
      // unpin from the "from" node
      this.getPinnedRelationList(relation.from).delete(pinnedRelation.id);
    } else if (this.getPinnedRelationList(relation.to).has(pinnedRelation.id) && direction === "to") {
      // unpin from the "to" node
      this.getPinnedRelationList(relation.to).delete(pinnedRelation.id);
    }

    if (
      !this.getPinnedRelationList(relation.to).has(pinnedRelation.id) &&
      !this.getPinnedRelationList(relation.from).has(pinnedRelation.id)
    ) {
      // delete the pinned relation if it's no longer referenced anywhere
      this.pinnedRelationsByNodeId.delete(pinnedRelation.id);
      this.relationsById.delete(pinnedRelation.id);
    }
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

  getCorrespondingRelation(relation: GraphRelation): GraphRelation | null {
    if (this.correspondingObjectsForPinned.has(relation.id)) {
      return this.correspondingObjectsForPinned.get(relation.id)!;
    } else if (this.correspondingPinnedForObjects.has(relation.id)) {
      return this.correspondingPinnedForObjects.get(relation.id)!;
    }
    return null;
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

    // Remove relation from all bundles
    const bundles = this.relationToBundles.get(relation.id) || [];
    bundles.forEach((bundle) => {
      this.removeFromBundle(relation, bundle);
    });

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
    if (this.getPinnedRelationList(oldFrom).has(relation.id)) {
      this.unpinRelation(relation, "from");
    }
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
    if (this.getPinnedRelationList(oldTo).has(relation.id)) {
      this.unpinRelation(relation, "to");
    }
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

    const correspondingRelation = this.getCorrespondingRelation(relation);
    if (correspondingRelation) {
      correspondingRelation.to = from;
      correspondingRelation.from = to;
    }
    return relation;
  }

  updateRelationsType(relation: GraphRelation, newType: GraphRelationType): GraphRelation {
    relation.relationType = newType;
    const correspondingRelation = this.getCorrespondingRelation(relation);
    if (correspondingRelation) {
      correspondingRelation.relationType = newType;
    }

    return relation;
  }

  createRelationType(
    props: { id?: string; label: string; reverseLabel?: string },
    fromServer = false,
  ): GraphRelationType {
    const id = props.id || uuid();
    if (this.relationTypesById[id] && !fromServer) {
      throw new Error(`Relation type with id ${props.id} already exists`);
    }
    this.relationTypesById[id] = {
      id,
      label: props.label,
      reverseLabel: props.reverseLabel || `is ${props.label} of`,
    };
    return this.relationTypesById[id];
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

  splitRelatedNode(relation: GraphRelation, nodeToSplit: GraphNode, selection: BaseSelection) {
    const parent = relation.to.id === nodeToSplit.id ? relation.from : relation.to;
    const unpinnedRelation = this.correspondingObjectsForPinned.has(relation.id)
      ? this.correspondingObjectsForPinned.get(relation.id)!
      : relation;
    const pinnedRelation = this.correspondingPinnedForObjects.get(unpinnedRelation.id);

    // Get selection start and end points
    const points = selection?.getStartEndPoints();
    if (!points) {
      throw new Error("No selection points");
    }
    const selectionNodes = selection.getNodes();
    const firstNode = selectionNodes[0];
    const lastNode = selectionNodes[selectionNodes.length - 1];

    const paragraphNode = firstNode.getParent();
    const nodes: LexicalNode[] = paragraphNode.getChildren();

    const firstNodeIndexInParagraph = nodes.findIndex((node) => node === firstNode);
    const lastNodeIndexInParagraph = nodes.findIndex((node) => node === lastNode);

    const selectionEnds = [
      { index: firstNodeIndexInParagraph, offset: points[0].offset },
      { index: lastNodeIndexInParagraph, offset: points[1].offset },
    ];
    const start = selection.isBackward() ? selectionEnds[1] : selectionEnds[0];
    const end = selection.isBackward() ? selectionEnds[0] : selectionEnds[1];

    let child: { node: GraphNode; relation: GraphRelation };
    const isCollapsedAndAtStart =
      start.index === end.index && start.offset === end.offset && start.index === 0 && start.offset === 0;
    if (isCollapsedAndAtStart && nodeToSplit.content.length > 0) {
      // Insert a new blank node just above the current node
      // (we do this by getting the sibling above and moving the new node after it,
      // because FractionalPositionedList.move can only place nodes after another node.
      // TODO: add a moveBefore method or something to FractionalPositionedList)
      child = this.createChildNode(parent);
      const relationsList = this.getRelationList(parent);
      const relations = Array.from(relationsList.values())
        .sort((a, b) => comparePositions(a.position, b.position))
        .map((v) => v.item);
      const relationIndex = relations.findIndex((r) => r.id === unpinnedRelation.id);
      const siblingAbove = relations[relationIndex - 1];
      if (siblingAbove) relationsList.move([child.relation], siblingAbove);
      if (pinnedRelation && relation === pinnedRelation) {
        parent.pinChildRelation(child.relation);
        const newPinnedRelation = this.correspondingPinnedForObjects.get(child.relation.id)!;

        const pinnedRelationsList = this.getPinnedRelationList(parent);
        pinnedRelationsList.move([newPinnedRelation], this.correspondingPinnedForObjects.get(siblingAbove.id)!);
      }
    } else {
      const chipsBefore: Chip[] = [];
      // Collect nodes before the selection
      chipsBefore.push(...nodes.slice(0, start.index).map(nodeToChip));
      // and the first part of the node the selection start
      if (start.offset < nodes[start.index].getTextContent().length) {
        chipsBefore.push({ type: "text", value: nodes[start.index].getTextContent().substring(0, start.offset) });
      } else {
        chipsBefore.push(nodeToChip(nodes[start.index]));
      }

      const chipsAfter: Chip[] = [];
      // Collect the last part of the node after the selection end
      if (end.offset < nodes[end.index].getTextContent().length) {
        chipsAfter.push({ type: "text", value: nodes[end.index].getTextContent().substring(end.offset) });
      }
      // and all the nodes after that
      chipsAfter.push(...nodes.slice(end.index + 1).map(nodeToChip));

      nodeToSplit.setContent(chipsBefore);
      // Create a new related node below the current one with the text after the cursor
      child = this.createChildNode(parent, { content: chipsAfter });
      const relationsList = this.getRelationList(parent);
      relationsList.move([child.relation], unpinnedRelation);

      if (pinnedRelation && relation === pinnedRelation) {
        parent.pinChildRelation(child.relation);
        const newPinnedRelation = this.correspondingPinnedForObjects.get(child.relation.id)!;

        const pinnedRelationsList = this.getPinnedRelationList(parent);
        pinnedRelationsList.move([newPinnedRelation], pinnedRelation);
      }
    }

    // Add new node to the same bundles as the original
    const bundles = this.relationToBundles.get(unpinnedRelation.id);
    bundles?.forEach((bundle) => {
      this.createRelation({ from: bundle, to: child.relation });
      const existingBundles = this.relationToBundles.get(child.relation.id) || [];
      this.relationToBundles.set(child.relation.id, [...existingBundles, bundle]);
    });

    return child;
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
    const relationTypesById = toJS(this.relationTypesById);

    return {
      nodesById,
      relationsById,
      relationTypesById,
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

    const relationTypesById: Record<string, GraphRelationType> = {};
    for (const [key, value] of Object.entries(data.relationTypesById)) {
      relationTypesById[key] = value;
    }

    const relationsById = new Map<string, GraphRelation>();
    const getObjectById = (id: string) => nodesById.get(id) || relationsById.get(id);
    const getRelationTypeById = (id: string) => relationTypesById[id];
    const failed = new Set<string>();
    for (const [key, value] of Object.entries(data.relationsById)) {
      try {
        relationsById.set(key, GraphRelation.deserialize(value, this, getObjectById, getRelationTypeById));
      } catch (e) {
        failed.add(key);
      }
    }
    // Relations can point to relations, so sometimes deserialization fails because we don't have the needed
    // relations yet. We retry deserializing the failed relations after all relations have been deserialized.
    // TODO: This is a bit hacky, and doesn't address circular dependencies. We might need to do something
    // like allow null to/from fields in the relation, and then fill them in later.
    failed.forEach((key) => {
      const value = data.relationsById[key];
      relationsById.set(key, GraphRelation.deserialize(value, this, getObjectById, getRelationTypeById));
    });

    const relationsByNodeId = new Map<string, FractionalPositionedList<GraphRelation>>();
    for (const [key, value] of Object.entries(data.relationsByNodeId)) {
      relationsByNodeId.set(
        key,
        FractionalPositionedList.deserialize<GraphRelation>(value, (data) =>
          GraphRelation.deserialize(data, this, getObjectById, getRelationTypeById),
        ),
      );
    }

    const pinnedRelationsByNodeId = new Map<string, FractionalPositionedList<GraphRelation>>();
    for (const [key, value] of Object.entries(data.pinnedRelationsByNodeId)) {
      pinnedRelationsByNodeId.set(
        key,
        FractionalPositionedList.deserialize<GraphRelation>(value, (data) =>
          GraphRelation.deserialize(data, this, getObjectById, getRelationTypeById),
        ),
      );
    }

    const correspondingObjectsForPinned = new Map<string, GraphRelation>();
    for (const [key, value] of Object.entries(data.correspondingObjectsForPinned)) {
      correspondingObjectsForPinned.set(
        key,
        GraphRelation.deserialize(value, this, getObjectById, getRelationTypeById),
      );
    }

    const correspondingPinnedForObjects = new Map<string, GraphRelation>();
    for (const [key, value] of Object.entries(data.correspondingPinnedForObjects)) {
      correspondingPinnedForObjects.set(
        key,
        GraphRelation.deserialize(value, this, getObjectById, getRelationTypeById),
      );
    }

    const pathData = new Map<Path, PathData>();
    for (const [key, value] of Object.entries(data.pathData)) {
      pathData.set(key, value);
    }

    this.nodesById = nodesById;
    this.relationsById = relationsById;
    this.relationTypesById = relationTypesById;
    this.relationsByNodeId = relationsByNodeId;
    this.pinnedRelationsByNodeId = pinnedRelationsByNodeId;
    this.pathData = pathData;
    this.correspondingObjectsForPinned = correspondingObjectsForPinned;
    this.correspondingPinnedForObjects = correspondingPinnedForObjects;
  }
}
