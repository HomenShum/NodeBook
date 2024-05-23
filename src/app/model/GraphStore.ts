import { BaseSelection, LexicalNode } from "lexical";
import { makeAutoObservable, toJS } from "mobx";
import { nodeToChip } from "../editor/utils";
import { comparePositions, relationsPathToParentChild, uuid } from "../util";
import { FractionalPositionedList } from "./FractionalPositionedList";
import { Chip, GraphNode, GraphNodeProps } from "./GraphNode";
import { GraphObject } from "./GraphObject";
import { GraphRelation, GraphRelationProps, GraphRelationType } from "./GraphRelation";
import { isPlaceholder } from "./PlaceholderGraphObject";
import { SerializedGraphStore } from "./SerializedData";
import { serializeMap, serializeMapWithArrayValues } from "./serialization";

export const defaultRelationTypes = {
  child: { id: "child", label: "child", reverseLabel: "parent" },
  author: { id: "author", label: "author", reverseLabel: "authored" },
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
  addThoughstreamDirectChildrenToOutline = false;
  /** Add thoughtstream descendants which are direct children of thoughtstream to thoughtstream */
  addAllOutlineDescendantsToThoughtstream = true;
  /** Add thoughtstream descendants which are not direct children of thoughtstream as direct children of thoughtstream */
  addThoughtstreamNestedChildrenToThoughtstream = false;
  /** When enabled, removing a node as a direct child of a thoughtstream will delete it */
  removingNodeAsDirectChildOfThoughtstreamDeletesIt = false;

  constructor() {
    Object.values(defaultRelationTypes).forEach((rt) => this.createRelationType(rt, true));
    makeAutoObservable(this);
    this.outlineRoot = this.createNode({ id: OUTLINE_ROOT_ID, content: [{ type: "text", value: "My Graph" }] });
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
    // Initialize with blank entries in thoughtstream and outline
    const { node } = this.createChildNode(this.outlineRoot);
    this.addToThoughtstream(node);
  }

  clear() {
    this.nodesById.clear();
    this.relationsById.clear();
    this.relationTypesById = {};
    this.relationsByNodeId.clear();
    this.pinnedRelationsByNodeId.clear();
    this.pathData.clear();
    this.relationToBundles.clear();
    this.correspondingObjectsForPinned.clear();
    this.correspondingPinnedForObjects.clear();

    Object.values(defaultRelationTypes).forEach((rt) => this.createRelationType(rt, true));
    this.outlineRoot = this.createNode({ id: OUTLINE_ROOT_ID, content: [{ type: "text", value: "My Graph" }] });
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
    // Initialize with blank entries in thoughtstream and outline
    const { node } = this.createChildNode(this.outlineRoot);
    this.addToThoughtstream(node);
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

  /**
   * Call this method after creating a new object. Depending on the settings, it
   * will add the object to the thoughtstream or outline as needed.
   */
  addElsewhereAfterCreate(obj: GraphObject, parent: GraphObject, root: GraphObject) {
    if (
      (this.addThoughtstreamNestedChildrenToThoughtstream && root.id === this.thoughtstreamRoot.id) ||
      (this.addThoughstreamDirectChildrenToOutline && parent.id === this.thoughtstreamRoot.id)
    ) {
      this.createRelation({
        from: this.outlineRoot,
        to: obj,
        relationType: this.relationTypesById.child,
      });
    }
    // Add to thoughtstream if necessary
    if (this.addAllOutlineDescendantsToThoughtstream && root.id === this.outlineRoot.id) {
      this.addToThoughtstream(obj);
    }
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
  getOrCreateRelationTypeByLabel(labelText: string): [GraphRelationType, "forward" | "reverse"] {
    for (const [_, type] of Object.entries(this.relationTypesById)) {
      if (type.label.toLowerCase() === labelText.toLowerCase()) {
        return [type, "forward"];
      }
      if (type.reverseLabel.toLowerCase() === labelText.toLowerCase()) {
        return [type, "reverse"];
      }
    }
    if (labelText.endsWith(" of")) {
      // Special case for "is X of" relations because the auto-generated reverse label will be "is X of" and
      // we don't want "is X of of"
      const reverseLabel = labelText;
      const label = labelText.replace(/^(is\s+)?(.+?)\s+of$/i, "$2");
      return [this.createRelationType({ label, reverseLabel }), "reverse"];
    }
    return [this.createRelationType({ label: labelText }), "forward"];
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
      this.correspondingObjectsForPinned.delete(pinnedRelation.id);
      this.correspondingPinnedForObjects.delete(baseRelation.id);
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
      reverseLabel: props.reverseLabel ?? `is ${props.label} of`,
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

  /**
   * Deletes a node if it is empty and not related to anything other than the thoughtstream root.
   */
  private deleteNodeIfEmptyAndUnrelated(...objects: GraphObject[]) {
    objects.forEach((obj) => {
      if (
        obj instanceof GraphNode &&
        obj.text === "" &&
        obj.relations.every((r) => r.from.id === this.thoughtstreamRoot.id)
      ) {
        this.deleteNode(obj.id);
      }
    });
  }

  splitRelatedNode(
    relation: GraphRelation,
    nodeToSplit: GraphNode,
    selection: BaseSelection,
    pathToNodeStr: string,
    { splitToNewBundle } = { splitToNewBundle: false },
  ) {
    const parent = relation.to.id === nodeToSplit.id ? relation.from : relation.to;
    const unpinnedRelation = this.correspondingObjectsForPinned.has(relation.id)
      ? this.correspondingObjectsForPinned.get(relation.id)!
      : relation;
    const pinnedRelation = this.correspondingPinnedForObjects.get(unpinnedRelation.id);

    // Get selection start and end points
    let start = { index: 0, offset: 0 };
    let end = { index: 0, offset: 0 };
    let nodes: LexicalNode[] = [];
    const nonEmptyEditor = selection.getNodes()[0]?.getParents()[0]?.getTextContent() !== "";
    if (nonEmptyEditor) {
      const points = selection?.getStartEndPoints();
      if (!points) {
        throw new Error("No selection points");
      }

      const selectionNodes = selection.getNodes();
      const firstNode = selectionNodes[0];
      const lastNode = selectionNodes[selectionNodes.length - 1];

      const paragraphNode = firstNode.getParent();
      nodes = paragraphNode.getChildren();

      const firstNodeIndexInParagraph = nodes.findIndex((node) => node === firstNode);
      const lastNodeIndexInParagraph = nodes.findIndex((node) => node === lastNode);

      const selectionEnds = [
        { index: firstNodeIndexInParagraph, offset: points[0].offset },
        { index: lastNodeIndexInParagraph, offset: points[1].offset },
      ];
      start = selection.isBackward() ? selectionEnds[1] : selectionEnds[0];
      end = selection.isBackward() ? selectionEnds[0] : selectionEnds[1];
    }

    const relationsList = this.getRelationList(parent);
    const relations = Array.from(relationsList.values())
      .sort((a, b) => comparePositions(a.position, b.position))
      .map((v) => v.item);
    const relationIndex = relations.findIndex((r) => r.id === unpinnedRelation.id);
    const siblingAbove = relations[relationIndex - 1];
    const siblingsBelow = relations.slice(relationIndex + 1);

    let child: { node: GraphNode; relation: GraphRelation };
    let nested = false;
    const isCollapsedAndAtStart =
      start.index === end.index && start.offset === end.offset && start.index === 0 && start.offset === 0;
    if (isCollapsedAndAtStart && nodeToSplit.content.length > 0) {
      // Insert a new blank node just above the current node
      // (we do this by getting the sibling above and moving the new node after it,
      // because FractionalPositionedList.move can only place nodes after another node.
      // TODO: add a moveBefore method or something to FractionalPositionedList)
      child = this.createChildNode(parent);
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
      if (nodes[start.index]) {
        if (start.offset < nodes[start.index].getTextContent().length) {
          chipsBefore.push({ type: "text", value: nodes[start.index].getTextContent().substring(0, start.offset) });
        } else {
          chipsBefore.push(nodeToChip(nodes[start.index]));
        }
      }

      const chipsAfter: Chip[] = [];
      // Collect the last part of the node after the selection end
      if (nodes[end.index] && end.offset < nodes[end.index].getTextContent().length) {
        chipsAfter.push({ type: "text", value: nodes[end.index].getTextContent().substring(end.offset) });
      }
      // and all the nodes after that
      chipsAfter.push(...nodes.slice(end.index + 1).map(nodeToChip));

      nodeToSplit.setContent(chipsBefore);
      if (this.isPathExpanded(pathToNodeStr)) {
        child = this.createChildNode(nodeToSplit, { content: chipsAfter });
        this.getRelationList(nodeToSplit).move([child.relation], "top");
        nested = true;
      } else {
        // Create a new related node below the current one with the text after the cursor
        child = this.createChildNode(parent, { content: chipsAfter });
        relationsList.move([child.relation], unpinnedRelation);

        if (pinnedRelation && relation === pinnedRelation) {
          parent.pinChildRelation(child.relation);
          const newPinnedRelation = this.correspondingPinnedForObjects.get(child.relation.id)!;

          const pinnedRelationsList = this.getPinnedRelationList(parent);
          pinnedRelationsList.move([newPinnedRelation], pinnedRelation);
        }
      }
    }

    if (splitToNewBundle) {
      // Make a new bundle
      const newBundle = this.createChildNode(this.thoughtstreamRoot).node;
      newBundle.setIsBundle(true);

      // Add the new node to the new bundle
      this.addToBundle(child.relation, newBundle);

      const oldBundles = this.relationToBundles.get(unpinnedRelation.id);
      for (const sibling of siblingsBelow) {
        const oldBundlesForSibling = (this.relationToBundles.get(sibling.id) || []).filter((b) =>
          oldBundles?.includes(b),
        );
        if (oldBundlesForSibling.length === 0) {
          // If the sibling is not in the same bundle as the split node, we've hit the end of the bundle we're splitting and can stop
          // TODO: this is hack-y because we don't have a concept of a "main" bundle that we're splitting here. Revisit at some point
          break;
        }
        // Add siblings below the split node to the new bundle and remove them from the old bundle
        this.addToBundle(sibling, newBundle);
        oldBundlesForSibling?.forEach((bundle) => {
          this.removeFromBundle(sibling, bundle);
        });
      }
    } else {
      // Add new node to the same bundles as the original
      const bundles = this.relationToBundles.get(unpinnedRelation.id);
      bundles?.forEach((bundle) => {
        this.createRelation({ from: bundle, to: child.relation });
        const existingBundles = this.relationToBundles.get(child.relation.id) || [];
        this.relationToBundles.set(child.relation.id, [...existingBundles, bundle]);
      });
    }

    return { child, nested };
  }

  moveRelationAfterSibling(node: GraphNode, relation: GraphRelation, sibling: GraphRelation) {
    const list = this.relationsByNodeId.get(node.id);
    list?.move([relation], sibling);
  }

  /**
   * By default, object renderings are treated as the object themselves, and
   * edits change the object's content. But in some cases, we want to treat them
   * more like a link to the object. This method determines if an object should
   * be treated as a link.
   *
   * Roughly speaking, if an object appears in multiple places, we treat it as a
   * link.
   *
   * More specifically, we treat an object as a link if it is involved in
   * multiple relations, excluding it's children. There's also a special case
   * where if there are exactly two relations to the object, and one of them is
   * from the thoughtstream, then we return false. If we don't do this, then
   * every node created gets treated as a link (since all nodes are added to the
   * thoughtstream) which is not what we want.
   *
   * @see
   * https://linear.app/ideaflow/issue/ENT-3404/update-to-blue-underline-logic
   *
   * TODO: This whole thing is conceptually messy and should be rethought.
   */
  shouldTreatObjectAsLink(obj: GraphObject): boolean {
    const relationsExceptChildren = obj.relations.filter(
      (r) => !(r.relationType.id === defaultRelationTypes.child.id && r.from.id === obj.id),
    );
    const fromStream = relationsExceptChildren.filter((r) => r.from.id === this.thoughtstreamRoot.id);
    if (relationsExceptChildren.length <= 1) {
      return false;
    } else if (relationsExceptChildren.length === 2 && fromStream.length === 1) {
      return false;
    } else {
      return true;
    }
  }

  serialize(): SerializedGraphStore {
    const nodesById = serializeMap(this.nodesById);
    const relationsById = serializeMap(this.relationsById);
    const relationTypesById = toJS(this.relationTypesById);

    const relationsByNodeId = serializeMap(this.relationsByNodeId);
    const pinnedRelationsByNodeId = serializeMap(this.pinnedRelationsByNodeId);

    const relationToBundles = serializeMapWithArrayValues(this.relationToBundles);

    const correspondingObjectsForPinned = serializeMap(this.correspondingObjectsForPinned);
    const correspondingPinnedForObjects = serializeMap(this.correspondingPinnedForObjects);

    return {
      nodesById,
      relationsById,
      relationTypesById,
      relationsByNodeId,
      pinnedRelationsByNodeId,
      pathData: Object.fromEntries(this.pathData.entries()),
      relationToBundles,
      correspondingObjectsForPinned,
      correspondingPinnedForObjects,
    };
  }

  deserializeInPlace(data: SerializedGraphStore) {
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
    for (const [key, value] of Object.entries(data.relationsById)) {
      // Placeholders set here should be cleaned up by subsequent relations in this loop
      relationsById.set(key, GraphRelation.deserialize(value, this, getObjectById, getRelationTypeById)!);
    }

    for (const [_, relation] of relationsById) {
      if (isPlaceholder(relation.from)) {
        // Do one last check to see if we can resolve the placeholder, log to console if not
        if (getObjectById(relation.from.id)) {
          relation.setFrom(getObjectById(relation.from.id)!);
        } else {
          console.warn("Deserialized relation with placeholder from", relation);
          // Delete the relation if we can't resolve the placeholder to prevent issues later
          relationsById.delete(relation.id);
        }
      }
      if (isPlaceholder(relation.to)) {
        if (getObjectById(relation.to.id)) {
          relation.setTo(getObjectById(relation.to.id)!);
        } else {
          console.warn("Deserialized relation with placeholder to", relation);
          relationsById.delete(relation.id);
        }
      }
    }

    const relationsByNodeId = new Map<string, FractionalPositionedList<GraphRelation>>();
    for (const [key, value] of Object.entries(data.relationsByNodeId)) {
      relationsByNodeId.set(
        key,
        FractionalPositionedList.deserialize<GraphRelation>(value, (data) =>
          GraphRelation.deserialize(data, this, getObjectById, getRelationTypeById, true),
        ),
      );
    }

    const pinnedRelationsByNodeId = new Map<string, FractionalPositionedList<GraphRelation>>();
    for (const [key, value] of Object.entries(data.pinnedRelationsByNodeId)) {
      pinnedRelationsByNodeId.set(
        key,
        FractionalPositionedList.deserialize<GraphRelation>(value, (data) =>
          GraphRelation.deserialize(data, this, getObjectById, getRelationTypeById, true),
        ),
      );
    }

    const correspondingObjectsForPinned = new Map<string, GraphRelation>();
    if (data.correspondingObjectsForPinned) {
      for (const [key, value] of Object.entries(data.correspondingObjectsForPinned)) {
        const rel = GraphRelation.deserialize(value, this, getObjectById, getRelationTypeById, true);
        if (rel) {
          correspondingObjectsForPinned.set(key, rel);
        }
      }
    }

    const correspondingPinnedForObjects = new Map<string, GraphRelation>();
    if (data.correspondingPinnedForObjects) {
      for (const [key, value] of Object.entries(data.correspondingPinnedForObjects)) {
        const rel = GraphRelation.deserialize(value, this, getObjectById, getRelationTypeById, true);
        if (rel) {
          correspondingPinnedForObjects.set(key, rel);
        }
      }
    }

    const pathData = new Map<Path, PathData>();
    if (data.pathData) {
      for (const [key, value] of Object.entries(data.pathData)) {
        pathData.set(key, value);
      }
    }

    const relationToBundles = new Map<string, GraphNode[]>();
    if (data.relationToBundles) {
      for (const [relationId, bundlesArray] of Object.entries(data.relationToBundles)) {
        if (!relationsById.has(relationId)) continue;
        relationToBundles.set(
          relationId,
          bundlesArray.map((bundle) => nodesById.get(bundle.id)).filter((b) => !!b) as GraphNode[],
        );
      }
    }

    this.nodesById = nodesById;
    this.relationsById = relationsById;
    this.relationTypesById = relationTypesById;
    this.relationsByNodeId = relationsByNodeId;
    this.pinnedRelationsByNodeId = pinnedRelationsByNodeId;
    this.pathData = pathData;
    this.relationToBundles = relationToBundles;
    this.correspondingObjectsForPinned = correspondingObjectsForPinned;
    this.correspondingPinnedForObjects = correspondingPinnedForObjects;

    const outlineRoot = this.nodesById.get(OUTLINE_ROOT_ID);
    if (outlineRoot) {
      this.outlineRoot = outlineRoot;
    } else {
      this.outlineRoot = this.createNode({ id: OUTLINE_ROOT_ID, content: [{ type: "text", value: "My Graph" }] });
    }

    const userRoot = this.nodesById.get(USER_ROOT_ID);
    if (userRoot) {
      this.userRoot = userRoot;
    } else {
      this.userRoot = this.createNode({ id: USER_ROOT_ID, content: [{ type: "text", value: "User" }] });
    }

    const thoughtstreamRoot = this.nodesById.get(THOUGHTSTREAM_ROOT_ID);
    if (thoughtstreamRoot) {
      this.thoughtstreamRoot = thoughtstreamRoot;
    } else {
      this.thoughtstreamRoot = this.createNode({
        id: THOUGHTSTREAM_ROOT_ID,
        content: [{ type: "text", value: "Stream" }],
      });
    }

    const outlineRootRelationFromUserRoot = this.getRelationList(this.outlineRoot)
      .values()
      .find((r) => r.item.from.id === this.userRoot.id);
    if (outlineRootRelationFromUserRoot) {
      this.outlineRootRelationFromUserRoot = outlineRootRelationFromUserRoot.item;
    } else {
      this.outlineRootRelationFromUserRoot = this.createRelation({
        from: this.userRoot,
        to: this.outlineRoot,
        relationType: this.relationTypesById.child,
      });
    }

    const thoughtstreamRootRelationFromUserRoot = this.getRelationList(this.thoughtstreamRoot)
      .values()
      .find((r) => r.item.from.id === this.userRoot.id);
    if (thoughtstreamRootRelationFromUserRoot) {
      this.thoughtstreamRootRelationFromUserRoot = thoughtstreamRootRelationFromUserRoot.item;
    } else {
      this.thoughtstreamRootRelationFromUserRoot = this.createRelation({
        from: this.userRoot,
        to: this.thoughtstreamRoot,
        relationType: this.relationTypesById.child,
      });
    }
  }

  deserializeAndMerge(data: SerializedGraphStore) {
    for (const [key, value] of Object.entries(data.nodesById)) {
      if (!this.nodesById.has(key)) {
        this.createNode(value);
      }
    }
    for (const [key, value] of Object.entries(data.relationTypesById)) {
      if (!this.relationTypesById[key]) {
        this.relationTypesById[key] = value;
      }
    }

    const getObjectById = (id: string) => this.nodesById.get(id) || this.relationsById.get(id);
    const getRelationTypeById = (id: string) => this.relationTypesById[id];
    for (const [key, value] of Object.entries(data.relationsById)) {
      if (this.relationsById.has(key)) continue;
      // Placeholders set here should be cleaned up by subsequent relations in this loop
      this.relationsById.set(key, GraphRelation.deserialize(value, this, getObjectById, getRelationTypeById)!);
    }

    for (const [_, relation] of this.relationsById) {
      if (isPlaceholder(relation.from)) {
        // Do one last check to see if we can resolve the placeholder, log to console if not
        if (getObjectById(relation.from.id)) {
          relation.setFrom(getObjectById(relation.from.id)!);
        } else {
          console.warn("Deserialized relation with placeholder from", relation);
          // Delete the relation if we can't resolve the placeholder to prevent issues later
          this.relationsById.delete(relation.id);
          continue;
        }
      }
      if (isPlaceholder(relation.to)) {
        if (getObjectById(relation.to.id)) {
          relation.setTo(getObjectById(relation.to.id)!);
        } else {
          console.warn("Deserialized relation with placeholder to", relation);
          this.relationsById.delete(relation.id);
          continue;
        }
      }
      if (!isPlaceholder(relation.from) && !isPlaceholder(relation.to)) {
        this.getRelationList(relation.from).add(relation);
        this.getRelationList(relation.to).add(relation);

        if (!this.pinnedRelationsByNodeId.has(relation.id)) {
          const newList = new FractionalPositionedList<GraphRelation>();
          this.pinnedRelationsByNodeId.set(relation.id, newList);
        }
      }
    }

    const pathData = new Map<Path, PathData>();
    if (data.pathData) {
      for (const [key, value] of Object.entries(data.pathData)) {
        if (!this.pathData.has(key)) {
          pathData.set(key, value);
        }
      }
    }

    if (data.relationToBundles) {
      for (const [relationId, bundlesArray] of Object.entries(data.relationToBundles)) {
        if (!this.relationsById.has(relationId)) continue;
        if (this.relationToBundles.has(relationId)) {
          // Add any new bundles to the existing list
          const existingBundles = this.relationToBundles.get(relationId)!;
          const newBundles = bundlesArray
            .map((bundle) => this.nodesById.get(bundle.id))
            .filter((b) => !!b) as GraphNode[];
          this.relationToBundles.set(relationId, [
            ...existingBundles,
            ...newBundles.filter((b) => !existingBundles.includes(b)),
          ]);
        } else {
          this.relationToBundles.set(
            relationId,
            bundlesArray.map((bundle) => this.nodesById.get(bundle.id)).filter((b) => !!b) as GraphNode[],
          );
        }
      }
    }
  }
}
