import { action, isObservable, makeObservable, observable, toJS } from "mobx";

import { serializeMap, serializeMapWithArrayValues } from "@/app/persistence/serialization";
import {
  SerializedGraphNode,
  SerializedGraphStore,
  SerializedPositionList,
  SerializedRelation,
} from "@/app/persistence/SerializedData";
import { SyncQueue } from "@/app/sync/SyncQueue";
import { uuid } from "@/app/util";
import logger from "@/lib/logger";

import { FractionalPositionedList, ItemWithPosition } from "./FractionalPositionedList";
import { GraphNode, GraphNodeProps } from "./GraphNode";
import { GraphObject } from "./GraphObject";
import {
  DeletedGraphRelationData,
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
  TxCombinedPart,
  TxRemoveNode,
  TxRemoveRelation,
  TxReplaceRelationLink,
  TxUpdateNode,
} from "./GraphTransactionTypes";
import { PlaceholderGraphObject } from "./PlaceholderGraphObject";
import { SettingsStore } from "./SettingsStore";

export const defaultRelationTypes: Record<string, GraphRelationType> = {
  child: { version: 1, id: "child", label: "child", reverseLabel: "parent" },
  relatedTo: { version: 1, id: "relatedTo", label: "relates to", reverseLabel: "relates to" },
  author: { version: 1, id: "author", label: "author", reverseLabel: "authored" },
  empty: { version: 1, id: "empty", label: "", reverseLabel: "" },
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

  private seenTransactions: Set<string> = new Set();
  syncQueue: SyncQueue = new SyncQueue(); // Only not private for ease of window.mew debugging right now

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
    const defaults = this.createDefaultObjects();
    this.userRoot = defaults.userRoot;
    this.outlineRoot = defaults.outlineRoot;
    this.thoughtstreamRoot = defaults.thoughtstreamRoot;
    this.outlineRootRelationFromUserRoot = defaults.outlineRootRelationFromUserRoot;
    this.thoughtstreamRootRelationFromUserRoot = defaults.thoughtstreamRootRelationFromUserRoot;
    this.makeObservable();
  }

  makeObservable() {
    if (!isObservable(this)) {
      makeObservable(this, {
        nodesById: observable.shallow,
        relationsById: observable.shallow,
        relationTypesById: observable,
        relationsByNodeId: observable.shallow,
        pinnedRelationsByNodeId: observable.shallow,
        relationToBundles: observable.shallow,
        // TODO: does the fact these are async mess up the action?
        // node
        addNode: action,
        removeNode: action,
        updateNode: action,
        // relation
        addRelation: action,
        removeRelation: action,
        replaceRelationLink: action,
        updateRelationTarget: action,
        reverseRelation: action,
        // relation type
        createRelationType: action,
        updateRelationType: action,
        deleteRelationType: action,
        // misc
        addChildNode: action,
        addToBundle: action,
        removeFromBundle: action,
        addToThoughtstream: action,
        load: action,
        clear: action,
        reset: action,
        resetAndLoad: action,
      });
    }
  }

  private isSyncing = false;

  startSync() {
    return setTimeout(async () => {
      if (this.isSyncing) return;
      this.isSyncing = true;
      await this.syncQueue.process();
      this.isSyncing = false;
      this.startSync();
    }, 500);
  }

  handleSyncTransactionAccepted(data: any) {
    console.log("Received sync data", data);
    if (this.seenTransactions.has(data.transactionId)) {
      console.log("Transaction is not new to this client, ignoring");
      // TODO: we probably want to delete the transaction from the seenTransactions set here
      return;
    }
    console.log("Applying transaction from remote data...");
    this.applyTransaction(data.transaction);
    console.log("Success?");
  }

  /**
   * Apply a combined transaction to the graph.
   *
   * If at some point the transaction start containing preparatory async logic
   * we should split them into prep and call methods, and for the combined ones,
   * execute first all the prep methods and then all the call ones.
   */
  async applyCombinedTransaction(txs: TxCombined): Promise<any[]> {
    const results = txs.map((tx) => this.applyTransaction(tx));
    return results;
  }

  private applyTransaction(tx: TxCombinedPart) {
    const { type, transaction } = tx;
    switch (type) {
      // Checking for the async method but calling the corresponding sync one
      case "addNode":
        return this._addNode(transaction);
      case "removeNode":
        return this._removeNode(transaction);
      case "addRelation":
        return this._addRelation(transaction);
      case "removeRelation":
        return this._removeRelation(transaction);
      case "addChildNode":
        return this._addChildNode(transaction);
      case "replaceRelationLink":
        return this._replaceRelationLink(transaction);
      case "updateNode":
        return this._updateNode(transaction);
      default:
        throw new Error(`Invalid transaction type: ${type}`);
    }
  }

  /**
   * Create a new node in the graph.
   */
  async addNode(tx: TxAddNode) {
    const node = this._addNode(tx);

    const transaction: TxCombinedPart = {
      type: "addNode",
      transaction: tx,
    };
    const dataToSync = {
      transactionId: uuid(),
      transaction,
      result: {
        nodes: [node],
        relationLists: { [node.id]: this.getRelationList(node) },
      },
    };
    this.seenTransactions.add(dataToSync.transactionId);
    const undo = () => this.deleteNode(node);
    const syncTask = {
      dataToSync,
      undo,
    };
    this.syncQueue.add(syncTask);

    return node;
  }
  private _addNode(tx: TxAddNode) {
    return this.createNode(tx);
  }

  /**
   * Remove a node from the graph, then delete the object if it is no longer related to anything.
   */
  async removeNode(tx: TxRemoveNode): Promise<void> {
    const { deletedNode, relationsDeleted } = this._removeNode(tx);

    const transaction: TxCombinedPart = {
      type: "removeNode",
      transaction: tx,
    };
    const dataToSync = {
      transactionId: uuid(),
      transaction,
      result: {
        nodesDeleted: [deletedNode],
        relationsDeleted: relationsDeleted.map((delData) => delData.relation),
      },
    };
    this.seenTransactions.add(dataToSync.transactionId);
    const undo = () => this.undoRemoveNode(deletedNode, relationsDeleted);
    const syncTask = {
      dataToSync,
      undo,
    };
    this.syncQueue.add(syncTask);
  }
  private _removeNode(tx: TxRemoveNode): {
    deletedNode: GraphNode;
    relationsDeleted: DeletedGraphRelationData[];
  } {
    const node = this.nodesById.get(tx.nodeId);
    if (!node) {
      throw new Error(`Node with id ${tx.nodeId} does not exist`);
    }

    return this.deleteNode(node);
  }
  private undoRemoveNode(deletedNode: GraphNode, relationsDeleted: DeletedGraphRelationData[]) {
    this.nodesById.set(deletedNode.id, deletedNode);
    this.relationsByNodeId.set(deletedNode.id, new FractionalPositionedList());
    this.pinnedRelationsByNodeId.set(deletedNode.id, new FractionalPositionedList());
    for (const relation of relationsDeleted) {
      this.restoreRelation(relation);
    }
  }

  /**
   * Create a new relation between two existing objects.
   */
  async addRelation(tx: TxAddRelation) {
    const relation = this._addRelation(tx);

    const transaction: TxCombinedPart = {
      type: "addRelation",
      transaction: tx,
    };
    const dataToSync = {
      transactionId: uuid(),
      transaction,
      result: {
        relations: [relation],
        relationLists: {
          [relation.from.id]: this.getRelationList(relation.from),
          [relation.to.id]: this.getRelationList(relation.to),
        },
      },
    };
    this.seenTransactions.add(dataToSync.transactionId);
    const undo = () => this.deleteRelation(relation);
    const syncTask = {
      dataToSync,
      undo,
    };
    this.syncQueue.add(syncTask);

    return relation;
  }
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
  async removeRelation(tx: TxRemoveRelation) {
    const { relData, nodesDeleted } = this._removeRelation(tx);

    const transaction: TxCombinedPart = {
      type: "removeRelation",
      transaction: tx,
    };
    const dataToSync = {
      transactionId: uuid(),
      transaction,
      result: {
        nodesDeleted,
        relationsDeleted: [relData.relation],
      },
    };
    this.seenTransactions.add(dataToSync.transactionId);
    console.log(dataToSync.transactionId, this.seenTransactions);
    const undo = () => this.undoRemoveRelation(relData, nodesDeleted);
    const syncTask = {
      dataToSync,
      undo,
    };
    this.syncQueue.add(syncTask);
  }
  private _removeRelation(tx: TxRemoveRelation) {
    const relation = this.relationsById.get(tx.relationId);
    if (!relation) {
      throw new Error(`Relation with id ${tx.relationId} does not exist`);
    }

    const relData = this.deleteRelation(relation);
    const nodesDeleted: GraphNode[] = [];

    const { from, to } = relation;
    if (from instanceof GraphNode && this.hasNoRelations(from)) {
      this.deleteNode(from);
      nodesDeleted.push(from);
    }
    if (to instanceof GraphNode && this.hasNoRelations(to)) {
      this.deleteNode(to);
      nodesDeleted.push(to);
    }
    return { relData, nodesDeleted };
  }
  private undoRemoveRelation(deletedRelation: DeletedGraphRelationData, deletedNodes: GraphNode[]) {
    for (const node of deletedNodes) {
      this.nodesById.set(node.id, node);
      this.relationsByNodeId.set(node.id, new FractionalPositionedList());
      this.pinnedRelationsByNodeId.set(node.id, new FractionalPositionedList());
    }
    this.restoreRelation(deletedRelation);
  }

  /**
   * Add a node with a child relation to some existing graph object.
   */
  async addChildNode(tx: TxAddChildNode): Promise<{ node: GraphNode; relation: GraphRelation }> {
    const { node, relation, parent } = this._addChildNode(tx);

    const transaction: TxCombinedPart = {
      type: "addChildNode",
      transaction: tx,
    };
    const dataToSync = {
      transactionId: uuid(),
      transaction,
      result: {
        nodes: [node],
        relations: [relation],
        relationLists: { [node.id]: this.getRelationList(node), [parent.id]: this.getRelationList(parent) },
      },
    };
    this.seenTransactions.add(dataToSync.transactionId);
    const undo = () => this.undoAddChildNode(node, relation);
    const syncTask = {
      dataToSync,
      undo,
    };
    this.syncQueue.add(syncTask);
    return { node, relation };
  }
  private _addChildNode(tx: TxAddChildNode): { node: GraphNode; relation: GraphRelation; parent: GraphNode } {
    const wannaBeParent = this.nodesById.get(tx.parentId);
    if (!wannaBeParent) {
      throw new Error(`Parent with id ${tx.parentId} does not exist`);
    }
    const { node, relation } = this.createChildNode({
      parent: wannaBeParent,
      nodeProps: tx.nodeProps,
      relationProps: tx.relationProps,
      after: tx.after,
    });
    return { node, relation, parent: wannaBeParent };
  }
  private undoAddChildNode(createdNode: GraphNode, createdRelation: GraphRelation) {
    this.deleteRelation(createdRelation);
    this.deleteNode(createdNode);
  }

  /**
   * Replace a relation link with a new or existing graph object.
   */
  async replaceRelationLink(tx: TxReplaceRelationLink) {
    return this._replaceRelationLink(tx);
  }
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
    relation.incrementVersion();

    return { object: newObject, relation };
  }

  // TODO: Make this async
  updateNode(tx: TxUpdateNode) {
    const oldValues = this._updateNode(tx);

    const transaction: TxCombinedPart = {
      type: "updateNode",
      transaction: tx,
    };
    const dataToSync = {
      transactionId: uuid(),
      transaction,
      result: {
        nodes: [this.nodesById.get(tx.nodeId)!],
      },
    };
    this.seenTransactions.add(dataToSync.transactionId);
    const undo = () => this._updateNode({ nodeId: tx.nodeId, nodeProps: oldValues });
    const syncTask = {
      dataToSync,
      undo,
    };
    this.syncQueue.add(syncTask);
  }
  private _updateNode(tx: TxUpdateNode) {
    const node = this.nodesById.get(tx.nodeId);
    if (!node) {
      throw new Error(`Node with id ${tx.nodeId} does not exist`);
    }

    return node.update(tx.nodeProps);
  }

  private createNode(props: GraphNodeProps): GraphNode {
    let node;

    try {
      node = new GraphNode(this, {
        id: props.id || uuid(),
        content: props.content,
        isBundle: props.isBundle ?? false,
        isZone: props.isZone ?? false,
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

  /**
   * Load a serialized graph into the store.
   * @see file://./design-notes.md#load-methods
   */
  private loadSerializedNode(props: SerializedGraphNode): GraphNode {
    const existing = this.getNode(props.id);
    if (existing) {
      existing.update(props);
      return existing;
    } else {
      return this.createNode(props);
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
    if (!node) {
      throw new Error("Node does not exist");
    }

    const relationsDeleted: DeletedGraphRelationData[] = [];
    try {
      node.relations.forEach((r) => {
        const deleted = this.deleteRelation(r);
        relationsDeleted.push(deleted);
      });
      this.nodesById.delete(node.id);
      this.relationsByNodeId.delete(node.id);
      this.pinnedRelationsByNodeId.delete(node.id);
    } catch (e) {
      if (!this.nodesById.has(node.id)) {
        this.nodesById.set(node.id, node);
      }
      if (!this.relationsByNodeId.has(node.id)) {
        this.relationsByNodeId.set(node.id, new FractionalPositionedList());
      }
      if (!this.pinnedRelationsByNodeId.has(node.id)) {
        this.pinnedRelationsByNodeId.set(node.id, new FractionalPositionedList());
      }
      for (const deletedData of relationsDeleted) {
        this.restoreRelation(deletedData);
      }
      throw e;
    }

    return { deletedNode: node, relationsDeleted };
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

  /**
   * Load a serialized graph into the store.
   * @see file://./design-notes.md#load-methods
   */
  private loadSerializedRelation(props: SerializedRelation): GraphRelation {
    const from = this.getObject(props.fromId) ?? new PlaceholderGraphObject(props.fromId);
    const to = this.getObject(props.toId) ?? new PlaceholderGraphObject(props.toId);
    const existing = this.getRelation(props.id);
    if (existing) {
      existing.update(props);
      return existing;
    } else {
      return this.createRelation({ ...props, from, to });
    }
  }

  private deleteRelation(relation: GraphRelation) {
    const deleted = {
      relation,
      fromPos: this.getRelationList(relation.from).get(relation.id),
      fromPinnedPos: this.getPinnedRelationList(relation.from).get(relation.id),
      toPos: this.getRelationList(relation.to).get(relation.id),
      toPinnedPos: this.getPinnedRelationList(relation.to).get(relation.id),
      bundles: this.relationToBundles.get(relation.id) || [],
    };
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
    } catch (e) {
      if (!this.relationsById.has(relation.id)) {
        this.relationsById.set(relation.id, relation);
      }
      this.getRelationList(relation.from).undoDelete(deleted.fromPos);
      this.getPinnedRelationList(relation.from).undoDelete(deleted.fromPinnedPos);
      this.getRelationList(relation.to).undoDelete(deleted.toPos);
      this.getPinnedRelationList(relation.to).undoDelete(deleted.toPinnedPos);
      const nodeBundles = this.relationToBundles.get(relation.id) || [];
      deleted.bundles.forEach((bundle) => {
        if (!nodeBundles.includes(bundle)) {
          this.addToBundle(relation, bundle);
        }
      });
      throw e;
    }
    return deleted;
  }

  private restoreRelation({ relation, fromPos, fromPinnedPos, toPos, toPinnedPos, bundles }: DeletedGraphRelationData) {
    this.relationsById.set(relation.id, relation);
    this.getRelationList(relation.from).undoDelete(fromPos);
    this.getPinnedRelationList(relation.from).undoDelete(fromPinnedPos);
    this.getRelationList(relation.to).undoDelete(toPos);
    this.getPinnedRelationList(relation.to).undoDelete(toPinnedPos);
    bundles.forEach((bundle) => {
      this.addToBundle(relation, bundle);
    });
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

  private hasNoRelations(node: GraphNode) {
    return node.relations.length === 0 || this.doAllRelationsPointTo(node, this.thoughtstreamRoot);
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
    this.relationsByNodeId.clear();
    this.pinnedRelationsByNodeId.clear();
    this.relationToBundles.clear();
    Object.keys(this.relationTypesById).forEach((key) => {
      delete this.relationTypesById[key];
    });
  }

  createDefaultObjects() {
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
    return {
      outlineRoot: this.outlineRoot,
      userRoot: this.userRoot,
      thoughtstreamRoot: this.thoughtstreamRoot,
      outlineRootRelationFromUserRoot: this.outlineRootRelationFromUserRoot,
      thoughtstreamRootRelationFromUserRoot: this.thoughtstreamRootRelationFromUserRoot,
    };
  }

  reset() {
    this.clear();
    this.createDefaultObjects();
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
    const bundle = this.createChildNode({ parent: this.thoughtstreamRoot, nodeProps: { isBundle: true } }).node;
    const relationToBundle = this.addToBundle(relationToThoughtstream, bundle);
    return { bundle, relationToThoughtstream, relationToBundle };
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodesById.get(id);
  }

  getNodeOrThrow(id: string): GraphNode {
    const node = this.getNode(id);
    if (!node) {
      throw new Error(`Node with id ${id} does not exist`);
    }
    return node;
  }

  getRelation(id: string): GraphRelation | undefined {
    return this.relationsById.get(id);
  }

  getObject(id: string): GraphNode | GraphRelation | undefined {
    return this.getNode(id) || this.getRelation(id);
  }

  getRelationType(id: string): GraphRelationType | undefined {
    return this.relationTypesById[id];
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

  /**
   * Load serialized positioned relations list into the store.
   * @see file://./design-notes.md#load-methods
   */
  loadSerializedAllRelationList(objectId: string, positionsByRelationId: SerializedPositionList<GraphRelation>) {
    const { object, relationsWithPositions } = this.resolveRelationListReferences(objectId, positionsByRelationId);
    const list = object.allRelationsList;
    list.load(relationsWithPositions);
  }

  /**
   * Load serialized pinned relations list into the store.
   * @see file://./design-notes.md#load-methods
   */
  loadSerializedPinnedRelationList(objectId: string, positionsByRelationId: SerializedPositionList<GraphRelation>) {
    const { object, relationsWithPositions } = this.resolveRelationListReferences(objectId, positionsByRelationId);
    const list = object.pinnedRelationsList;
    list.load(relationsWithPositions);
  }

  private resolveRelationListReferences(
    objectId: string,
    positionsByRelationId: SerializedPositionList<GraphRelation>,
  ) {
    const object = this.getObject(objectId) ?? new PlaceholderGraphObject(objectId); // TODO: what if it's a relation?
    const relationsWithPositions: ItemWithPosition<GraphRelation>[] = [];
    for (const [relationId, position] of Object.entries(positionsByRelationId)) {
      const relation = this.getRelation(relationId);
      if (!relation) {
        // TODO should create placeholder relation here
        logger.warn(`Relation with id ${relationId} does not exist`);
        continue;
      }
      relationsWithPositions.push({ item: relation, position });
    }
    return { object, relationsWithPositions };
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
      version: 1,
      id,
      label: props.label,
      reverseLabel: props.reverseLabel ?? `is ${props.label} of`,
    };
    return this.relationTypesById[id];
  }

  updateRelationType(id: string, props: { label?: string; reverseLabel?: string }): GraphRelationType {
    if (!this.relationTypesById[id]) {
      throw new Error(`Relation type with id ${id} does not exist`);
    }
    Object.assign(this.relationTypesById[id], { ...props, id });
    this.relationTypesById[id].version++;
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

  /**
   * {@link reset|Reset} the store and {@link load} the serialized data into it.
   */
  resetAndLoad(data: SerializedGraphStore) {
    this.reset();
    this.load(data);
  }

  /**
   * Load the serialized data into the store. Existing data isn't cleared, but values
   * are overwritten if they already exist.
   */
  load(data: SerializedGraphStore) {
    for (const props of Object.values(data.nodesById)) {
      this.loadSerializedNode(props);
    }
    for (const [key, value] of Object.entries(data.relationTypesById)) {
      this.relationTypesById[key] = value;
    }
    for (const props of Object.values(data.relationsById)) {
      this.loadSerializedRelation(props);
    }
    for (const [nodeId, positionsByRelationId] of Object.entries(data.relationsByNodeId)) {
      this.loadSerializedAllRelationList(nodeId, positionsByRelationId);
    }
    for (const [nodeId, positionsByRelationId] of Object.entries(data.pinnedRelationsByNodeId)) {
      this.loadSerializedPinnedRelationList(nodeId, positionsByRelationId);
    }
    if (data.relationToBundles) {
      // TODO: Implement this
      logger.error("relationToBundles not implemented");
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

  search(query: string): { object: GraphNode; score: number }[] {
    const procQuery = query.toLowerCase();
    return Array.from(this.nodesById.values())
      .filter((node) => node.text.toLocaleLowerCase().includes(procQuery))
      .map((node) => {
        const text = node.text.toLocaleLowerCase();
        return {
          object: node,
          score: (text.length - (text.indexOf(procQuery) + 1)) / text.length,
        };
      });
  }
}
