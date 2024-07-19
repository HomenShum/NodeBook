import { action, isObservable, makeObservable, observable, toJS } from "mobx";

import { GraphUpdate } from "@/app/graph/GraphUpdate";
import { serializeMap, serializeMapWithArrayValues } from "@/app/persistence/serialization";
import {
  DeletedRelationData,
  SerializedGraphStore,
  SerializedNode,
  SerializedPositionList,
  SerializedRelation,
} from "@/app/persistence/SerializedData";
import { SyncQueue } from "@/app/sync/SyncQueue";
import { SyncData } from "@/app/sync/SyncTask";
import { uuid } from "@/app/util";
import logger from "@/lib/logger";

import { FractionalPositionedList, ItemWithPosition } from "./FractionalPositionedList";
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
    const defaults = this.ensureDefaultObjects();
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

  handleSyncData(data: SyncData) {
    if (this.syncQueue.isLocalTransaction(data.transactionId)) {
      // TODO: we probably want to delete the transaction from the localTransactions set here
      return;
    }
    this.applyUpdates(data.updates);
  }

  private applyUpdates(updates: GraphUpdate[]) {
    for (const update of updates) {
      switch (update.operation) {
        case "addNode":
          this._addNode(update.node);
          break;
        case "updateNode":
          this._updateNode({ nodeId: update.oldProps.id, nodeProps: update.newProps });
          break;
        case "deleteNode":
          this.deleteNode(update.node.id);
          break;
        case "addRelationType":
          this.createRelationType(update.relationType);
          break;
        case "updateRelationType":
          this.updateRelationType(update.oldProps.id, update.newProps);
          break;
        case "deleteRelationType":
          this.deleteRelationType(update.relationType.id);
          break;
        case "addRelation":
          this._addRelation(update.relation);
          break;
        case "updateRelation":
          this.updateRelation(update.oldProps, update.newProps);
          break;
        case "deleteRelation":
          this.deleteRelation(update.deleted.relation.id);
          break;
        case "updateRelationList":
          this.updateRelationList(update.nodeId, update.pinned, update.listAfter);
          break;
        default:
          const _exhaustiveCheck: never = update;
      }
    }
  }

  private undoUpdates(updates: GraphUpdate[]) {
    for (const update of [...updates].reverse()) {
      switch (update.operation) {
        case "addNode":
          this.deleteNode(update.node.id);
          break;
        case "updateNode":
          this._updateNode({ nodeId: update.newProps.id, nodeProps: update.oldProps });
          break;
        case "deleteNode":
          this.createNode(update.node);
          break;
        case "addRelationType":
          this.deleteRelationType(update.relationType.id);
          break;
        case "updateRelationType":
          this.updateRelationType(update.newProps.id, update.oldProps);
          break;
        case "deleteRelationType":
          this.createRelationType(update.relationType);
          break;
        case "addRelation":
          this.deleteRelation(update.relation.id);
          break;
        case "updateRelation":
          this.updateRelation(update.newProps, update.oldProps);
          break;
        case "deleteRelation":
          this.restoreRelation(update.deleted);
          break;
        case "updateRelationList":
          this.updateRelationList(update.nodeId, update.pinned, update.listBefore);
          break;
        default:
          const _exhaustiveCheck: never = update;
      }
    }
  }

  private queueUpdates(updates: GraphUpdate[]) {
    const undoFn = () => this.undoUpdates(updates);
    this.syncQueue.addUpdates(updates, undoFn);
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
    for (const tx of txs) {
      switch (tx.type) {
        case "addNode":
          results.push(await this.addNode(tx.transaction));
          break;
        case "removeNode":
          results.push(await this.removeNode(tx.transaction));
          break;
        case "addRelation":
          results.push(await this.addRelation(tx.transaction));
          break;
        case "removeRelation":
          results.push(await this.removeRelation(tx.transaction));
          break;
        case "addChildNode":
          results.push(await this.addChildNode(tx.transaction));
          break;
        case "replaceRelationLink":
          results.push(await this.replaceRelationLink(tx.transaction));
          break;
        case "updateNode":
          results.push(await this.updateNode(tx.transaction));
          break;
        default:
          const _exhaustiveCheck: never = tx;
      }
    }
    return results;
  }
  /**
   * Create a new node in the graph.
   */
  async addNode(tx: TxAddNode) {
    const { node, updates } = this._addNode(tx);
    this.queueUpdates(updates);
    return node;
  }
  private _addNode(tx: TxAddNode) {
    return this.createNode(tx);
  }

  /**
   * Remove a node from the graph, then delete the object if it is no longer related to anything.
   */
  async removeNode(tx: TxRemoveNode): Promise<void> {
    const updates = this._removeNode(tx);
    this.queueUpdates(updates);
  }
  private _removeNode(tx: TxRemoveNode): GraphUpdate[] {
    const node = this.nodesById.get(tx.nodeId);
    if (!node) {
      throw new Error(`Node with id ${tx.nodeId} does not exist`);
    }

    return this.deleteNode(node);
  }

  /**
   * Create a new relation between two existing objects.
   */
  async addRelation(tx: TxAddRelation) {
    const { newRelation, updates } = this._addRelation(tx);
    this.queueUpdates(updates);
    return newRelation;
  }
  private _addRelation(tx: TxAddRelation) {
    const from = this.getObject(tx.fromId);
    const to = this.getObject(tx.toId);
    if (!from || !to) {
      throw new Error(`GraphObject with id ${from ? tx.toId : tx.fromId} does not exist`);
    }

    const { relation: newRelation, updates } = this.createRelation({
      id: tx.id,
      from,
      to,
      relationType: tx.relationType,
    });
    return { newRelation, updates };
  }

  /**
   * Remove a relation from the graph, then delete the objects if they are no longer related to anything.
   */
  async removeRelation(tx: TxRemoveRelation) {
    const updates = this._removeRelation(tx);
    this.queueUpdates(updates);
  }
  private _removeRelation(tx: TxRemoveRelation): GraphUpdate[] {
    const relation = this.relationsById.get(tx.relationId);
    if (!relation) {
      throw new Error(`Relation with id ${tx.relationId} does not exist`);
    }

    const relData = this.deleteRelation(relation);
    const updates: GraphUpdate[] = [
      {
        operation: "deleteRelation",
        deleted: relData,
      },
    ];

    const { from, to } = relation;
    if (from instanceof GraphNode && this.hasNoRelations(from)) {
      updates.push(...this.deleteNode(from));
    }
    if (to instanceof GraphNode && this.hasNoRelations(to)) {
      updates.push(...this.deleteNode(to));
    }
    return updates;
  }

  /**
   * Add a node with a child relation to some existing graph object.
   */
  async addChildNode(tx: TxAddChildNode): Promise<{ node: GraphNode; relation: GraphRelation }> {
    const { newNode, newRelation, updates } = this._addChildNode(tx);
    this.queueUpdates(updates);
    return { node: newNode, relation: newRelation };
  }
  private _addChildNode(tx: TxAddChildNode): {
    newNode: GraphNode;
    newRelation: GraphRelation;
    updates: GraphUpdate[];
  } {
    const wannaBeParent = this.nodesById.get(tx.parentId);
    if (!wannaBeParent) {
      throw new Error(`Parent with id ${tx.parentId} does not exist`);
    }
    return this.createChildNode({
      parent: wannaBeParent,
      nodeProps: tx.nodeProps,
      relationProps: tx.relationProps,
      after: tx.after,
    });
  }

  /**
   * Replace a relation link with a new or existing graph object.
   */
  async replaceRelationLink(tx: TxReplaceRelationLink) {
    const { object, relation, updates } = this._replaceRelationLink(tx);
    this.queueUpdates(updates);
    return { object, relation };
  }
  private _replaceRelationLink(tx: TxReplaceRelationLink): {
    object: GraphObject;
    relation: GraphRelation;
    updates: GraphUpdate[];
  } {
    const relation = this.relationsById.get(tx.relationId);
    if (!relation) {
      throw new Error(`Relation with id ${tx.relationId} does not exist`);
    }

    const updates: GraphUpdate[] = [];

    let newObject;
    if (tx.replaceWith.type === "new-node") {
      const { node: newNode, updates: newNodeUpdates } = this.createNode(tx.replaceWith.nodeProps || {});
      newObject = newNode;
      updates.push(...newNodeUpdates);
    } else {
      if (tx.replaceWith.type === "existing-node") {
        newObject = this.nodesById.get(tx.replaceWith.id);
      } else if (tx.replaceWith.type === "existing-relation") {
        newObject = this.relationsById.get(tx.replaceWith.id);
      }

      if (!newObject) throw new Error(`Object with id ${tx.replaceWith.id} does not exist`);
    }

    if (tx.direction === "from") {
      updates.push(...this.updateRelationFrom(relation, newObject));
    } else {
      updates.push(...this.updateRelationTo(relation, newObject));
    }

    return { object: newObject, relation, updates };
  }

  // TODO: Make this async
  updateNode(tx: TxUpdateNode) {
    const updates = this._updateNode(tx);
    this.queueUpdates(updates);
  }
  private _updateNode(tx: TxUpdateNode): GraphUpdate[] {
    const node = this.nodesById.get(tx.nodeId);
    if (!node) {
      throw new Error(`Node with id ${tx.nodeId} does not exist`);
    }

    const oldProps = node.serialize();
    node.update(tx.nodeProps);

    return [
      {
        operation: "updateNode",
        oldProps,
        newProps: node.serialize(),
      },
    ];
  }

  private createNode(props: GraphNodeProps): { node: GraphNode; updates: GraphUpdate[] } {
    let node;

    try {
      node = new GraphNode(this, {
        version: props.version ?? 1,
        id: props.id ?? uuid(),
        content: props.content,
        isBundle: props.isBundle ?? false,
        isZone: props.isZone ?? false,
      });

      this.nodesById.set(node.id, node);
      this.relationsByNodeId.set(node.id, new FractionalPositionedList());
      this.pinnedRelationsByNodeId.set(node.id, new FractionalPositionedList());

      const updates: GraphUpdate[] = [
        {
          operation: "addNode",
          node: node.serialize(),
        },
      ];

      return { node, updates };
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
  private loadSerializedNode(props: SerializedNode): GraphNode {
    const existing = this.getNode(props.id);
    if (existing) {
      existing.update(props);
      return existing;
    } else {
      const { node } = this.createNode(props);
      return node;
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
  }): {
    newNode: GraphNode;
    newRelation: GraphRelation;
    updates: GraphUpdate[];
  } {
    let newNode;
    let newRelation;
    const updates: GraphUpdate[] = [];

    try {
      const { node, updates: newNodeUpdates } = this.createNode(nodeProps);
      newNode = node;
      updates.push(...newNodeUpdates);
      const { relation, updates: newRelationUpdates } = this.createRelation({
        ...relationProps,
        from: parent,
        to: newNode,
        relationType: this.relationTypesById[relationProps?.relationTypeId ?? ""] || this.relationTypesById.child,
      });
      newRelation = relation;
      updates.push(...newRelationUpdates);

      if (after) {
        const relListBefore = this.getRelationList(parent);
        this.getRelationList(parent).move([newRelation], after);
        updates.push({
          operation: "updateRelationList",
          nodeId: parent.id,
          pinned: false,
          listBefore: relListBefore.serialize(),
          listAfter: this.getRelationList(parent).serialize(),
        });
      }

      return { newNode, newRelation, updates };
    } catch (e) {
      if (newRelation) {
        this.relationsById.delete(newRelation.id);
      }
      if (newNode) {
        this.nodesById.delete(newNode.id);
        this.relationsByNodeId.delete(newNode.id);
        this.pinnedRelationsByNodeId.delete(newNode.id);
      }
      throw e;
    }
  }

  private deleteNode(nodeOrId: GraphNode | string): GraphUpdate[] {
    const node = typeof nodeOrId === "string" ? this.nodesById.get(nodeOrId) : nodeOrId;
    if (!node) {
      throw new Error("Node does not exist");
    }

    const relationsDeleted: DeletedRelationData[] = [];
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

    const updates: GraphUpdate[] = relationsDeleted.map((deletedData) => ({
      operation: "deleteRelation",
      deleted: deletedData,
    }));
    updates.push({
      operation: "deleteNode",
      node: node.serialize(),
    });

    return updates;
  }

  private createRelation(relationProps: GraphRelationProps): { relation: GraphRelation; updates: GraphUpdate[] } {
    let relation;
    const updates: GraphUpdate[] = [];

    try {
      relation = new GraphRelation(this, relationProps);
      if (this.relationsById.has(relation.id)) {
        const relationId = relation.id;
        relation = null; // So that it's not deleted in the catch block
        throw new Error(`Relation with id ${relationId} already exists`);
      }

      this.assertExists(relation.from, relation.to);
      this.relationsById.set(relation.id, relation);
      this.relationsByNodeId.set(relation.id, new FractionalPositionedList());
      this.pinnedRelationsByNodeId.set(relation.id, new FractionalPositionedList());

      updates.push({
        operation: "addRelation",
        relation: relation.serialize(),
      });

      const fromListBefore = this.getRelationList(relation.from).serialize();
      this.getRelationList(relation.from).add(relation);
      const fromListAfter = this.getRelationList(relation.from).serialize();
      updates.push({
        operation: "updateRelationList",
        nodeId: relation.from.id,
        pinned: false,
        listBefore: fromListBefore,
        listAfter: fromListAfter,
      });

      const toListBefore = this.getRelationList(relation.to).serialize();
      this.getRelationList(relation.to).add(relation);
      const toListAfter = this.getRelationList(relation.to).serialize();
      updates.push({
        operation: "updateRelationList",
        nodeId: relation.to.id,
        pinned: false,
        listBefore: toListBefore,
        listAfter: toListAfter,
      });

      return { relation, updates };
    } catch (e) {
      if (relation) {
        this.relationsById.delete(relation.id);
        this.relationsByNodeId.delete(relation.id);
        this.pinnedRelationsByNodeId.delete(relation.id);
        this.getRelationList(relation.from).delete(relation.id);
        this.getRelationList(relation.to).delete(relation.id);
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
      const { relation } = this.createRelation({ ...props, from, to });
      return relation;
    }
  }

  private deleteRelation(relationOrId: GraphRelation | string): DeletedRelationData {
    const relation = typeof relationOrId === "string" ? this.relationsById.get(relationOrId) : relationOrId;
    if (!relation) {
      throw new Error("Relation does not exist");
    }

    const deleted: DeletedRelationData = {
      relation: relation.serialize(),
      fromPos: this.getRelationList(relation.from).get(relation.id)?.position,
      fromPinnedPos: this.getPinnedRelationList(relation.from).get(relation.id)?.position,
      toPos: this.getRelationList(relation.to).get(relation.id)?.position,
      toPinnedPos: this.getPinnedRelationList(relation.to).get(relation.id)?.position,
      bundles: this.relationToBundles.get(relation.id) || [],
      relationsList: [],
    };
    try {
      // Delete relations to this relation
      for (const rel of relation.relations) {
        const deletedData = this.deleteRelation(rel);
        deleted.relationsList.push(deletedData);
      }

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
      if (deleted.fromPos) {
        this.getRelationList(relation.from).undoDelete({
          item: relation,
          position: deleted.fromPos,
        });
      }
      if (deleted.fromPinnedPos) {
        this.getPinnedRelationList(relation.from).undoDelete({
          item: relation,
          position: deleted.fromPinnedPos,
        });
      }
      if (deleted.toPos) {
        this.getRelationList(relation.to).undoDelete({
          item: relation,
          position: deleted.toPos,
        });
      }
      if (deleted.toPinnedPos) {
        this.getPinnedRelationList(relation.to).undoDelete({
          item: relation,
          position: deleted.toPinnedPos,
        });
      }
      deleted.relationsList.forEach((relData) => {
        this.restoreRelation(relData);
      });
      const nodeBundles = this.relationToBundles.get(relation.id) || [];
      deleted.bundles.forEach((serializedBundle) => {
        const bundle = this.nodesById.get(serializedBundle.id);
        if (bundle && !nodeBundles.includes(bundle)) {
          this.addToBundle(relation, bundle);
        }
      });
      throw e;
    }
    return deleted;
  }

  private restoreRelation({
    relation: serializedRelation,
    fromPos,
    fromPinnedPos,
    toPos,
    toPinnedPos,
    relationsList,
    bundles,
  }: DeletedRelationData) {
    const relation = this.loadSerializedRelation(serializedRelation);
    this.relationsById.set(relation.id, relation);
    if (fromPos) {
      this.getRelationList(relation.from).undoDelete({
        item: relation,
        position: fromPos,
      });
    }
    if (fromPinnedPos) {
      this.getPinnedRelationList(relation.from).undoDelete({
        item: relation,
        position: fromPinnedPos,
      });
    }
    if (toPos) {
      this.getRelationList(relation.to).undoDelete({
        item: relation,
        position: toPos,
      });
    }
    if (toPinnedPos) {
      this.getPinnedRelationList(relation.to).undoDelete({
        item: relation,
        position: toPinnedPos,
      });
    }
    for (const rel of relationsList) {
      this.restoreRelation(rel);
    }
    bundles.forEach((serializedBundle) => {
      const bundle = this.nodesById.get(serializedBundle.id);
      if (bundle) {
        this.addToBundle(relation, bundle);
      }
    });
  }

  private updateRelation(oldProps: SerializedRelation, newProps: SerializedRelation) {
    const relation = this.relationsById.get(oldProps.id);
    if (!relation) {
      throw new Error(`Relation with id ${oldProps.id} does not exist`);
    }

    const hydratedNew = {
      ...newProps,
      from: this.getObject(newProps.fromId),
      to: this.getObject(newProps.toId),
    };
    relation.update(hydratedNew);
  }

  /**
   * Update the `from` node of the given relations to the new node, and
   * also updates the list of relations on the old and new `from` nodes
   * to reflect the changes.
   */
  private updateRelationFrom(
    relation: GraphRelation,
    newFrom: GraphObject,
    after?: Positioner<GraphRelation>,
  ): GraphUpdate[] {
    const updates: GraphUpdate[] = [];
    try {
      const oldFrom = relation.from;

      const oldRelation = relation.serialize();
      relation.setFrom(newFrom);
      relation.incrementVersion();
      updates.push({
        operation: "updateRelation",
        oldProps: oldRelation,
        newProps: relation.serialize(),
      });

      updates.push(...this.deleteIfNoRelations(oldFrom));
    } catch (e) {
      // TODO: implement rollback
      // Phil: I don't like how this messes up with the `createNode` in the replaceRelationLink method
      throw e;
    }
    return updates;
  }

  /**
   * Update the `to` node of the given relations to the new node, and
   * also updates the list of relations on the old and new `to` nodes
   * to reflect the changes.
   */
  private updateRelationTo(
    relation: GraphRelation,
    newTo: GraphObject,
    after?: Positioner<GraphRelation>,
  ): GraphUpdate[] {
    const updates: GraphUpdate[] = [];
    try {
      const oldTo = relation.to;

      const oldRelation = relation.serialize();
      relation.setTo(newTo, after);
      relation.incrementVersion();
      updates.push({
        operation: "updateRelation",
        oldProps: oldRelation,
        newProps: relation.serialize(),
      });

      updates.push(...this.deleteIfNoRelations(oldTo));
    } catch (e) {
      // TODO: implement rollback
      // Phil: I don't like how this messes up with the `createNode` in the replaceRelationLink method
      throw e;
    }
    return updates;
  }

  private hasNoRelations(node: GraphNode) {
    return node.relations.length === 0 || this.doAllRelationsPointTo(node, this.thoughtstreamRoot);
  }

  private deleteIfNoRelations(object: GraphObject): GraphUpdate[] {
    if (object.relations.length === 0 || this.doAllRelationsPointTo(object, this.thoughtstreamRoot)) {
      if (object instanceof GraphNode) {
        return this.deleteNode(object);
      } else {
        logger.warn("Attempt to delete a GraphObject that is not a GraphNode", object);
      }
    }
    return [];
  }

  // TODO: move to the graph utils library
  private doAllRelationsPointTo(object: GraphObject, pointTo: GraphObject): boolean {
    return object.relations.every((r) => {
      const other = r.from.id === object.id ? r.to : r.from;
      return other.id === pointTo.id;
    });
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
    const list = this.pinnedRelationsByNodeId.get(node.id);
    if (list) return list;
    const newList = new FractionalPositionedList<GraphRelation>();
    this.pinnedRelationsByNodeId.set(node.id, newList);
    return newList;
  }

  updateRelationList(objectId: string, pinned: boolean, list: SerializedPositionList<GraphRelation>) {
    const newList = new FractionalPositionedList<GraphRelation>();
    for (const [relationId, position] of Object.entries(list)) {
      const relation = this.relationsById.get(relationId);
      if (!relation) continue;
      const relationWithPosition = {
        item: relation,
        position: position,
      };
      newList.undoDelete(relationWithPosition);
    }

    if (pinned) {
      this.pinnedRelationsByNodeId.set(objectId, newList);
    } else {
      this.relationsByNodeId.set(objectId, newList);
    }
  }

  deleteRelationList(objectId: string, pinned: boolean) {
    if (pinned) {
      this.pinnedRelationsByNodeId.delete(objectId);
    } else {
      this.relationsByNodeId.delete(objectId);
    }
  }

  clear() {
    this.nodesById.clear();
    this.relationsById.clear();
    this.relationsByNodeId.clear();
    this.pinnedRelationsByNodeId.clear();
    this.relationToBundles.clear();
    Object.keys(this.relationTypesById).forEach((key) => {
      delete this.relationTypesById[key];
    });
    this.syncQueue.clear();
  }

  ensureDefaultObjects() {
    const updates: GraphUpdate[] = [];

    for (const rt of Object.values(defaultRelationTypes)) {
      if (!this.relationTypesById[rt.id]) {
        const { updates: rtUpdates } = this.createRelationType(rt, true);
        updates.push(...rtUpdates);
      }
    }

    if (!this.nodesById.get(USER_ROOT_ID)) {
      const { node, updates: userRootUpdates } = this.createNode({
        id: USER_ROOT_ID,
        content: [{ type: "text", value: "User" }],
      });
      this.userRoot = node;
      updates.push(...userRootUpdates);
    }
    if (!this.nodesById.get(OUTLINE_ROOT_ID)) {
      const { node, updates: outlineRootUpdates } = this.createNode({
        id: OUTLINE_ROOT_ID,
        content: [{ type: "text", value: "My Graph" }],
      });
      this.outlineRoot = node;
      updates.push(...outlineRootUpdates);
    }
    if (!this.nodesById.get(THOUGHTSTREAM_ROOT_ID)) {
      const { node, updates: tsRootUpdates } = this.createNode({
        id: THOUGHTSTREAM_ROOT_ID,
        content: [{ type: "text", value: "Stream" }],
      });
      this.thoughtstreamRoot = node;
      updates.push(...tsRootUpdates);
    }
    if (!this.outlineRootRelationFromUserRoot) {
      const { relation, updates: userOutlineUpdates } = this.createRelation({
        from: this.userRoot,
        to: this.outlineRoot,
        relationType: this.relationTypesById.child,
      });
      this.outlineRootRelationFromUserRoot = relation;
      updates.push(...userOutlineUpdates);
    }
    if (!this.thoughtstreamRootRelationFromUserRoot) {
      const { relation, updates: userThoughtstreamUpdates } = this.createRelation({
        from: this.userRoot,
        to: this.thoughtstreamRoot,
        relationType: this.relationTypesById.child,
      });
      this.thoughtstreamRootRelationFromUserRoot = relation;
      updates.push(...userThoughtstreamUpdates);
    }
    this.queueUpdates(updates);

    return {
      userRoot: this.userRoot,
      outlineRoot: this.outlineRoot,
      thoughtstreamRoot: this.thoughtstreamRoot,
      outlineRootRelationFromUserRoot: this.outlineRootRelationFromUserRoot,
      thoughtstreamRootRelationFromUserRoot: this.thoughtstreamRootRelationFromUserRoot,
    };
  }

  reset() {
    this.clear();
    this.ensureDefaultObjects();
  }

  // --- ### ---
  // MOST THINGS ABOVE THIS LINE HAVE BEEN REFACTORED OR TRIAGED
  // --- ### ---

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
    const { relation: relationToThoughtstream } = this.createRelation({
      from: this.thoughtstreamRoot,
      to: obj,
    });
    // within a new bundle
    const { newNode: bundle } = this.createChildNode({ parent: this.thoughtstreamRoot, nodeProps: { isBundle: true } });
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
      const { relationType } = this.createRelationType({ label, reverseLabel });
      return [relationType, "reverse"];
    }
    const { relationType } = this.createRelationType({ label: labelText });
    return [relationType, "forward"];
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

  // TODO: Rename this to make it less confusing
  // TODO: Make this private
  updateRelationsType(relation: GraphRelation, newType: GraphRelationType): GraphUpdate[] {
    const oldRelation = relation.serialize();
    relation.relationType = newType;
    relation.incrementVersion();
    const updates: GraphUpdate[] = [
      {
        operation: "updateRelation",
        oldProps: oldRelation,
        newProps: relation.serialize(),
      },
    ];
    return updates;
  }

  // TODO: Expose this functionality in a transaction, make this function private
  createRelationType(
    props: { id?: string; label: string; reverseLabel?: string },
    fromServer = false,
  ): { relationType: GraphRelationType; updates: GraphUpdate[] } {
    const id = props.id || uuid();
    if (this.relationTypesById[id] && !fromServer) {
      throw new Error(`Relation type with id ${props.id} already exists`);
    }
    const newRelationType = {
      version: 1,
      id,
      label: props.label,
      reverseLabel: props.reverseLabel ?? `is ${props.label} of`,
    };
    this.relationTypesById[id] = newRelationType;
    const updates: GraphUpdate[] = [
      {
        operation: "addRelationType",
        relationType: newRelationType,
      },
    ];
    return { relationType: newRelationType, updates };
  }

  updateRelationType(
    id: string,
    props: { label?: string; reverseLabel?: string },
  ): { relationType: GraphRelationType; updates: GraphUpdate[] } {
    if (!this.relationTypesById[id]) {
      throw new Error(`Relation type with id ${id} does not exist`);
    }
    const oldProps = { ...this.relationTypesById[id] };
    const newProps = { ...oldProps, ...props, version: oldProps.version + 1 };
    this.relationTypesById[id] = newProps;
    const updates: GraphUpdate[] = [
      {
        operation: "updateRelationType",
        oldProps,
        newProps,
      },
    ];
    return { relationType: this.relationTypesById[id], updates };
  }

  deleteRelationType(id: string): GraphUpdate[] {
    const updates: GraphUpdate[] = [];
    // find all relations with this type and set them to a default type
    for (const rel of this.relations) {
      if (rel.relationType.id !== id) continue;
      updates.push(...this.updateRelationsType(rel, this.relationTypesById.child));
    }
    updates.push({
      operation: "deleteRelationType",
      relationType: { ...this.relationTypesById[id] },
    });
    delete this.relationTypesById[id];
    return updates;
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
    this.clear();
    this.load(data);
    this.ensureDefaultObjects();
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
