import { makeAutoObservable, toJS } from "mobx";

import { SerializedGraphStore, SerializedRelation } from "@/app/persistence/SerializedData";
import { serializeMap, serializeMapWithArrayValues } from "@/app/persistence/serialization";
import { uuid } from "@/app/util";
import logger from "@/lib/logger";

import { FractionalPositionedList } from "./FractionalPositionedList";
import { GraphNode, GraphNodeProps } from "./GraphNode";
import { GraphObject } from "./GraphObject";
import {
  GraphRelation,
  GraphRelationProps,
  GraphRelationPropsWithoutTargets,
  GraphRelationType,
} from "./GraphRelation";
import {
  Positioner,
  TxAddChildNode,
  TxAddNode,
  TxAddRelation,
  TxCombined,
  TxRemoveNode,
  TxRemoveRelation,
  TxReplaceRelationLink,
} from "./GraphTransactionTypes";
import { isPlaceholder } from "./PlaceholderGraphObject";
import { SettingsStore } from "./SettingsStore";

export const defaultRelationTypes = {
  child: { id: "child", label: "child", reverseLabel: "parent" },
  author: { id: "author", label: "author", reverseLabel: "authored" },
  empty: { id: "empty", label: "", reverseLabel: "" },
};

const USER_ROOT_ID = "user-root-id";
const OUTLINE_ROOT_ID = "outline-root-id";
const THOUGHTSTREAM_ROOT_ID = "thoughtstream-root-id";

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

/**
 * GraphStore is a collection of nodes and relations.
 *
 * All public methods are either:
 * - read-only (e.g. getters, assertions, etc)
 * - asynchronous and transactional (i.e. they return a new state of the graph)
 */
export class GraphStore {
  private settingsStore: SettingsStore;

  // TODO: make all properties private
  nodesById: Map<string, GraphNode> = new Map();
  relationsById: Map<string, GraphRelation> = new Map();
  relationTypesById: Record<string, GraphRelationType> = {};

  relationsByNodeId: Map<string, FractionalPositionedList<GraphRelation>> = new Map();
  pinnedRelationsByNodeId: Map<string, FractionalPositionedList<GraphRelation>> = new Map();

  /** Relation id to list of bundle-nodes that contain it */
  relationToBundles: Map<string, GraphNode[]> = new Map();

  // Default nodes and relations
  userRoot: GraphNode;
  outlineRoot: GraphNode;
  thoughtstreamRoot: GraphNode;
  outlineRootRelationFromUserRoot: GraphRelation;
  thoughtstreamRootRelationFromUserRoot: GraphRelation;

  constructor(settingsStore: SettingsStore) {
    this.settingsStore = settingsStore;
    Object.values(defaultRelationTypes).forEach((rt) => this.createRelationType(rt, true));
    makeAutoObservable(this);
    this.userRoot = this.createNode({ id: USER_ROOT_ID, content: [{ type: "text", value: "User" }] });
    this.outlineRoot = this.createNode({ id: OUTLINE_ROOT_ID, content: [{ type: "text", value: "My Graph" }] });
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

  /**
   * Apply a combined transaction to the graph.
   *
   * If at some point the transaction start containing preparatory async logic
   * we should split them into prep and call methods, and for the combined ones,
   * execute first all the prep methods and then all the call ones.
   */
  async applyCombinedTransaction(txs: TxCombined): Promise<any[]> {
    const results = [];
    for (const { type, transaction } of txs) {
      switch (type) {
        // Checking for the async method but calling the corresponding sync one
        case "addChildNode":
          results.push(this._addChildNode(transaction));
          break;
        case "removeNode":
          results.push(this._removeNode(transaction));
          break;
        case "addRelation":
          results.push(this._addRelation(transaction));
          break;
        case "removeRelation":
          results.push(this._removeRelation(transaction));
          break;
        case "replaceRelationLink":
          results.push(this._replaceRelationLink(transaction));
          break;
        default:
          throw new Error(`Invalid transaction type: ${type}`);
      }
    }
    return results;
  }

  /**
   * Add a node with a child relation to some existing graph object.
   */
  addChildNode = async (tx: TxAddChildNode) => this._addChildNode(tx);
  private _addChildNode(tx: TxAddChildNode): { node: GraphNode; relation: GraphRelation } {
    const wannaBeParent = this.nodesById.get(tx.parentId);
    if (!wannaBeParent) {
      throw new Error(`Parent with id ${tx.parentId} does not exist`);
    }
    return this.createChildNode({ ...tx, parent: wannaBeParent });
  }

  async addNode(props: TxAddNode) {
    return this.createNode(props);
  }

  /**
   * Remove a node from the graph, then delete the object if it is no longer related to anything.
   */
  removeNode = async (tx: TxRemoveNode) => this._removeNode(tx);
  private _removeNode(tx: TxRemoveNode): void {
    const node = this.nodesById.get(tx.nodeId);
    if (!node) {
      throw new Error(`Node with id ${tx.nodeId} does not exist`);
    }

    this.deleteNode(node);
  }

  /**
   * Create a new relation between two existing objects.
   */
  addRelation = async (tx: TxAddRelation) => this._addRelation(tx);
  private _addRelation(tx: TxAddRelation) {
    const from = this.nodesById.get(tx.fromId);
    const to = this.nodesById.get(tx.toId);
    if (!from || !to) {
      throw new Error(`GraphObject with id ${from ? tx.toId : tx.fromId} does not exist`);
    }

    return this.createRelation({ from, to, relationType: tx.relationType });
  }

  /**
   * Remove a relation from the graph, then delete the objects if they are no longer related to anything.
   */
  removeRelation = async (tx: TxRemoveRelation) => this._removeRelation(tx);
  private _removeRelation(tx: TxRemoveRelation): void {
    const relation = this.relationsById.get(tx.relationId);
    if (!relation) {
      throw new Error(`Relation with id ${tx.relationId} does not exist`);
    }

    this.deleteRelation(relation);
  }

  /**
   * Replace a relation link with a new or existing graph object.
   */
  replaceRelationLink = async (tx: TxReplaceRelationLink) => this._replaceRelationLink(tx);
  private _replaceRelationLink(tx: TxReplaceRelationLink): { object: GraphObject; relation: GraphRelation } {
    const relation = this.relationsById.get(tx.relationId);
    if (!relation) {
      throw new Error(`Relation with id ${tx.relationId} does not exist`);
    }

    let newObject;
    if (tx.replaceWith.type === "new-node") {
      newObject = this.createNode(tx.replaceWith.nodeProps || {});
    } else {
      if (tx.replaceWith.type === "existing-node") {
        newObject = this.nodesById.get(tx.replaceWith.id);
      } else if (tx.replaceWith.type === "existing-relation") {
        newObject = this.relationsById.get(tx.replaceWith.id);
      }

      if (!newObject) throw new Error(`Object with id ${tx.replaceWith.id} does not exist`);
    }

    if (tx.direction === "from") {
      this.updateRelationFrom(relation, newObject);
    } else {
      this.updateRelationTo(relation, newObject);
    }

    return { object: newObject, relation };
  }

  private createNode(props: GraphNodeProps): GraphNode {
    let node;

    try {
      node = new GraphNode(this, {
        id: props.id || uuid(),
        content: props.content,
      });

      this.nodesById.set(node.id, node);
      this.relationsByNodeId.set(node.id, new FractionalPositionedList());
      this.pinnedRelationsByNodeId.set(node.id, new FractionalPositionedList());

      return node;
    } catch (e) {
      if (node) {
        this.nodesById.delete(node.id);
        this.relationsByNodeId.delete(node.id);
        this.pinnedRelationsByNodeId.delete(node.id);
      }
      throw e;
    }
  }

  private createChildNode({
    parent,
    nodeProps = {},
    relationProps = {},
    after,
  }: {
    parent: GraphObject;
    nodeProps?: GraphNodeProps;
    relationProps?: GraphRelationPropsWithoutTargets;
    after?: Positioner<GraphRelation>;
  }): { node: GraphNode; relation: GraphRelation } {
    let node;
    let relation;

    try {
      node = this.createNode(nodeProps);
      relation = this.createRelation({
        ...relationProps,
        from: parent,
        to: node,
        relationType: this.relationTypesById[relationProps?.relationTypeId ?? ""] || this.relationTypesById.child,
      });

      if (after) {
        this.getRelationList(parent).move([relation], after);
      }

      return { node, relation };
    } catch (e) {
      if (node) {
        this.nodesById.delete(node.id);
        this.relationsByNodeId.delete(node.id);
        this.pinnedRelationsByNodeId.delete(node.id);
      }
      if (relation) {
        this.relationsById.delete(relation.id);
      }
      throw e;
    }
  }

  private deleteNode(node: GraphNode) {
    if (!node) return;

    try {
      node.relations.forEach((r) => this.deleteRelation(r));
      this.nodesById.delete(node.id);
      this.relationsByNodeId.delete(node.id);
    } catch (e) {
      // TODO: implement rollback
      throw e;
    }
  }

  private createRelation(relationProps: GraphRelationProps): GraphRelation {
    let relation;

    try {
      relation = new GraphRelation(this, relationProps);
      if (this.relationsById.has(relation.id)) {
        const relationId = relation.id;
        relation = null; // So that it's not deleted in the catch block
        throw new Error(`Relation with id ${relationId} already exists`);
      }

      this.assertExists(relation.from, relation.to);
      this.relationsById.set(relation.id, relation);

      this.getRelationList(relation.from).add(relation);
      this.getRelationList(relation.to).add(relation);

      const newList = new FractionalPositionedList<GraphRelation>();
      this.pinnedRelationsByNodeId.set(relation.id, newList);

      return relation;
    } catch (e) {
      if (relation) {
        this.relationsById.delete(relation.id);
        this.getRelationList(relation.from).delete(relation.id);
        this.getRelationList(relation.to).delete(relation.id);
        this.pinnedRelationsByNodeId.delete(relation.id);
      }
      throw e;
    }
  }

  private deleteRelation(relation: GraphRelation) {
    try {
      const { from: fromNode, to: toNode } = relation;

      // Remove the relation from the nodes
      this.getRelationList(fromNode).delete(relation.id);
      this.getRelationList(toNode).delete(relation.id);
      this.getPinnedRelationList(fromNode).delete(relation.id);
      this.getPinnedRelationList(toNode).delete(relation.id);

      // Remove relation from all bundles
      const bundles = this.relationToBundles.get(relation.id) || [];
      bundles.forEach((bundle) => {
        this.removeFromBundle(relation, bundle);
      });

      // Delete the relation itself
      this.relationsById.delete(relation.id);

      this.deleteIfNoRelations(fromNode);
      this.deleteIfNoRelations(toNode);
    } catch (e) {
      // TODO: implement rollback
      throw e;
    }
  }

  /**
   * Update the `from` node of the given relations to the new node, and
   * also updates the list of relations on the old and new `from` nodes
   * to reflect the changes.
   */
  private updateRelationFrom(relation: GraphRelation, newFrom: GraphObject, after?: Positioner<GraphRelation>) {
    try {
      const oldFrom = relation.from;
      relation.setFrom(newFrom);
      this.deleteIfNoRelations(oldFrom);
    } catch (e) {
      // TODO: implement rollback
      // Phil: I don't like how this messes up with the `createNode` in the replaceRelationLink method
      throw e;
    }
  }

  /**
   * Update the `to` node of the given relations to the new node, and
   * also updates the list of relations on the old and new `to` nodes
   * to reflect the changes.
   */
  private updateRelationTo(relation: GraphRelation, newTo: GraphObject, after?: Positioner<GraphRelation>) {
    try {
      const oldTo = relation.to;
      relation.setTo(newTo, after);
      this.deleteIfNoRelations(oldTo);
    } catch (e) {
      // TODO: implement rollback
      // Phil: I don't like how this messes up with the `createNode` in the replaceRelationLink method
      throw e;
    }
  }

  private deleteIfNoRelations(object: GraphObject) {
    if (object.relations.length === 0 || this.doAllRelationsPointTo(object, this.thoughtstreamRoot)) {
      if (object instanceof GraphNode) {
        this.deleteNode(object);
      } else {
        logger.warn("Attempt to delete a GraphObject that is not a GraphNode", object);
      }
    }
  }

  // TODO: move to the graph utils library
  private doAllRelationsPointTo(object: GraphObject, pointTo: GraphObject): boolean {
    return object.relations.every((r) => {
      const other = r.from.id === object.id ? r.to : r.from;
      return other.id === pointTo.id;
    });
  }

  // --- ### ---

  // MOST THINGS ABOVE THIS LINE HAVE BEEN REFACTORED OR TRIAGED

  // --- ### ---

  clear() {
    this.nodesById.clear();
    this.relationsById.clear();
    this.relationTypesById = {};
    this.relationsByNodeId.clear();
    this.pinnedRelationsByNodeId.clear();
    this.relationToBundles.clear();

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
    const { node } = this.createChildNode({ parent: this.outlineRoot });
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
      this.deleteNode(bundle);
    }

    // Update relation to bundles map
    const bundles = this.relationToBundles.get(relation.id) || [];
    const newBundles = bundles.filter((b) => b.id !== bundle.id);
    this.relationToBundles.set(relation.id, newBundles);
  }

  isRoot(obj: GraphObject) {
    return obj.id === this.userRoot.id || obj.id === this.outlineRoot.id || obj.id === this.thoughtstreamRoot.id;
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
    const bundle = this.createChildNode({ parent: this.thoughtstreamRoot }).node;
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
      (this.settingsStore.addThoughtstreamNestedChildrenToThoughtstream && root.id === this.thoughtstreamRoot.id) ||
      (this.settingsStore.addThoughtstreamDirectChildrenToOutline && parent.id === this.thoughtstreamRoot.id)
    ) {
      this.createRelation({
        from: this.outlineRoot,
        to: obj,
        relationType: this.relationTypesById.child,
      });
    }
    // Add to thoughtstream if necessary
    if (this.settingsStore.addAllOutlineDescendantsToThoughtstream && root.id === this.outlineRoot.id) {
      this.addToThoughtstream(obj);
    }
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodesById.get(id);
  }

  getObject(id: string): GraphObject | undefined {
    return this.nodesById.get(id) || this.relationsById.get(id);
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

  updateRelationTarget(relation: GraphRelation, { from, to }: { from?: GraphObject; to?: GraphObject }) {
    if (from) {
      this.updateRelationFrom(relation, from);
    }
    if (to) {
      this.updateRelationTo(relation, to);
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

  serialize(): SerializedGraphStore {
    const nodesById = serializeMap(this.nodesById);
    const relationsById = serializeMap(this.relationsById);
    const relationTypesById = toJS(this.relationTypesById);

    const relationsByNodeId = serializeMap(this.relationsByNodeId);
    const pinnedRelationsByNodeId = serializeMap(this.pinnedRelationsByNodeId);

    const relationToBundles = serializeMapWithArrayValues(this.relationToBundles);

    return {
      nodesById,
      relationsById,
      relationTypesById,
      relationsByNodeId,
      pinnedRelationsByNodeId,
      relationToBundles,
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

    const serializedToRelation = (data: string | SerializedRelation) => {
      if (typeof data === "string") {
        return relationsById.get(data) ?? null;
      } else if (typeof data === "object") {
        return relationsById.get(data.id) ?? null;
      }
      return null;
    };
    const relationsByNodeId = new Map<string, FractionalPositionedList<GraphRelation>>();
    for (const [key, value] of Object.entries(data.relationsByNodeId)) {
      relationsByNodeId.set(key, FractionalPositionedList.deserialize<GraphRelation>(value, serializedToRelation));
    }

    const pinnedRelationsByNodeId = new Map<string, FractionalPositionedList<GraphRelation>>();
    for (const [key, value] of Object.entries(data.pinnedRelationsByNodeId)) {
      pinnedRelationsByNodeId.set(
        key,
        FractionalPositionedList.deserialize<GraphRelation>(value, serializedToRelation),
      );
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
    this.relationToBundles = relationToBundles;

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

  private gatherSubtree(root: GraphObject): GraphObject[] {
    const visited = new Set();
    const result: GraphObject[] = [];
    const queue: GraphObject[] = [root];
    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visited.has(node.id)) continue;
      visited.add(node.id);
      result.push(node);
      const relations = this.getRelationList(node)
        .values()
        .map((v) => v.item);
      for (const relation of relations) {
        if (relation.relationType.id === this.relationTypesById.child.id && relation.to.id === node.id) {
          // Don't expand parents
          continue;
        }
        queue.push(relation);
        queue.push(relation.from);
        queue.push(relation.to);
      }
    }
    return result;
  }

  serializeSubtree(root: GraphObject): SerializedGraphStore {
    const relationTypesById: Record<string, GraphRelationType> = {};
    const nodesById = new Map<string, GraphNode>();
    const relationsById = new Map<string, GraphRelation>();
    const relationsByNodeId = new Map<string, FractionalPositionedList<GraphRelation>>();
    const pinnedRelationsByNodeId = new Map<string, FractionalPositionedList<GraphRelation>>();
    const relationToBundles = new Map<string, GraphNode[]>();

    const subtreeObjects = this.gatherSubtree(root);

    for (const obj of subtreeObjects) {
      if (obj instanceof GraphNode) {
        nodesById.set(obj.id, obj);
        relationsByNodeId.set(obj.id, this.relationsByNodeId.get(obj.id) || new FractionalPositionedList());
        pinnedRelationsByNodeId.set(obj.id, new FractionalPositionedList());
      } else if (obj instanceof GraphRelation) {
        relationTypesById[obj.relationType.id] = obj.relationType;
        relationsById.set(obj.id, obj);
        relationToBundles.set(obj.id, this.relationToBundles.get(obj.id) || []);
      }
    }

    // Need a relation between the subtree root and outline root so it shows up after import
    const subtreeRootRelation = new GraphRelation(this, {
      from: this.outlineRoot,
      to: root,
      relationType: this.relationTypesById.child,
    });
    relationsById.set(subtreeRootRelation.id, subtreeRootRelation);
    relationsByNodeId.get(root.id)!.add(subtreeRootRelation);
    if (!nodesById.has(OUTLINE_ROOT_ID)) {
      nodesById.set(OUTLINE_ROOT_ID, this.outlineRoot);
      const newList = new FractionalPositionedList<GraphRelation>();
      newList.add(subtreeRootRelation);
      relationsByNodeId.set(OUTLINE_ROOT_ID, newList);
      pinnedRelationsByNodeId.set(OUTLINE_ROOT_ID, new FractionalPositionedList());
    } else {
      relationsByNodeId.get(OUTLINE_ROOT_ID)!.add(subtreeRootRelation);
    }

    return {
      relationTypesById: toJS(relationTypesById),
      nodesById: serializeMap(nodesById),
      relationsById: serializeMap(relationsById),
      relationsByNodeId: serializeMap(relationsByNodeId),
      pinnedRelationsByNodeId: serializeMap(pinnedRelationsByNodeId),
      relationToBundles: serializeMapWithArrayValues(relationToBundles),
    };
  }

  deleteSubtree(root: GraphObject) {
    const subtreeObjects = this.gatherSubtree(root);
    for (const obj of subtreeObjects) {
      if (obj instanceof GraphNode) {
        this.deleteNode(obj);
      } else if (obj instanceof GraphRelation) {
        this.deleteRelation(obj);
      }
    }
  }
}
