import { action, isObservable, makeObservable, observable, toJS } from "mobx";

import { MewUser, UNLOGGED_USER } from "@/app/auth/MewUser";
import { GraphUpdate } from "@/app/graph/GraphUpdate";
import { UpdateManager } from "@/app/graph/UpdateManager";
import { serializeMap, serializeMapWithArrayValues } from "@/app/persistence/serialization";
import {
  DeletedRelationData,
  SerializedGraphStore,
  SerializedNode,
  SerializedPositionList,
  SerializedRelation,
} from "@/app/persistence/SerializedData";
import { DescendantTreeNode, PinnedGroup } from "@/app/tree/nodes";
import { Position, uuid } from "@/app/util";
import logger from "@/lib/logger";
import { CappedKeywordIndex } from "@/lib/trie";
import { scoreMatch } from "@/lib/utils";

import { FractionalPositionedList, ItemWithPosition } from "./FractionalPositionedList";
import { GraphNode, GraphNodeProps } from "./GraphNode";
import { GraphObject } from "./GraphObject";
import { GraphRelation, GraphRelationProps, GraphRelationType, isGraphRelationType } from "./GraphRelation";
import {
  Positioner,
  TxAddChildNode,
  TxAddNode,
  TxAddRelation,
  TxAddRelationType,
  TxCombined,
  TxRemoveNode,
  TxRemoveRelation,
  TxReplaceRelationLink,
  TxUpdateNode,
  TxUpdateRelation,
  TxUpdateRelationPositionsList,
} from "./GraphTransactionTypes";
import { PlaceholderGraphObject } from "./PlaceholderGraphObject";

const TEMP_USER_ID = UNLOGGED_USER.id; // TODO: This is simply to satisfy the type checker, we should change this
export const defaultRelationTypes: Record<string, GraphRelationType> = {
  child: { version: 1, id: "child", authorId: TEMP_USER_ID, label: "child", reverseLabel: "parent" },
  relatedTo: { version: 1, id: "relatedTo", authorId: TEMP_USER_ID, label: "relates to", reverseLabel: "relates to" },
  author: { version: 1, id: "author", authorId: TEMP_USER_ID, label: "author", reverseLabel: "authored" },
  sublist: { version: 1, id: "sublist", authorId: TEMP_USER_ID, label: "sublist", reverseLabel: "parent list" },
  empty: { version: 1, id: "empty", authorId: TEMP_USER_ID, label: "", reverseLabel: "" },
};

const USER_ROOT_ID = "user-root-id";
const OUTLINE_ROOT_ID = "outline-root-id";
const THOUGHTSTREAM_ROOT_ID = "thoughtstream-root-id";
const OUTLINE_USER_ROOT_REL_ID = "outline-to-user-root-relation-id";
const THOUGHTSTREAM_USER_ROOT_REL_ID = "thoughtstream-to-user-root-relation-id";

/**
 * GraphStore is a collection of nodes and relations.
 *
 * All public methods are either:
 * - read-only (e.g. getters, assertions, etc)
 * - asynchronous and transactional (i.e. they return a new state of the graph)
 */
export class GraphStore {
  cappedKeywordIndex = new CappedKeywordIndex(3);

  user: MewUser;
  updateManager: UpdateManager;

  nodesById: Map<string, GraphNode> = new Map();
  relationsById: Map<string, GraphRelation> = new Map();
  relationToBundles: Map<string, GraphNode[]> = new Map(); // Relation id to list of bundle-nodes that contain it
  relationTypesById: Record<string, GraphRelationType> = {};

  constructor(user: MewUser = UNLOGGED_USER, authedFetch?: typeof fetch) {
    this.user = user;
    this.updateManager = new UpdateManager(
      user.id,
      authedFetch ?? fetch,
      (data: SerializedGraphStore) => this.load(data),
      (updates) => this.applyUpdates(updates),
    );
    this.ensureDefaultObjectsCreated();
    this.makeObservable();
  }

  makeObservable() {
    if (!isObservable(this)) {
      makeObservable(this, {
        user: observable,
        nodesById: observable.shallow,
        relationsById: observable.shallow,
        relationTypesById: observable,
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
        // relation type
        addRelationType: action,
        // misc
        addChildNode: action,
        addToBundle: action,
        removeFromBundle: action,
        applyUpdates: action,
        load: action,
        cleanup: action,
        resetAndLoad: action,
      });
    }
  }

  // Default nodes and relations
  get userRoot(): GraphNode {
    const node = this.nodesById.get(USER_ROOT_ID);
    if (!node) {
      throw new Error("User root node not found");
    }
    return node;
  }

  get outlineRoot(): GraphNode {
    const node = this.nodesById.get(OUTLINE_ROOT_ID);
    if (!node) {
      throw new Error("Outline root node not found");
    }
    return node;
  }

  get thoughtstreamRoot(): GraphNode {
    const node = this.nodesById.get(THOUGHTSTREAM_ROOT_ID);
    if (!node) {
      throw new Error("Thoughtstream root node not found");
    }
    return node;
  }

  get outlineRootRelationFromUserRoot(): GraphRelation {
    const relation = this.relationsById.get(OUTLINE_USER_ROOT_REL_ID);
    if (!relation) {
      throw new Error("User Root -> Outline Root relation not found");
    }
    return relation;
  }

  get thoughtstreamRootRelationFromUserRoot(): GraphRelation {
    const relation = this.relationsById.get(THOUGHTSTREAM_USER_ROOT_REL_ID);
    if (!relation) {
      throw new Error("User Root -> Thoughtstream Root relation not found");
    }
    return relation;
  }

  // TODO: Investigate why some operations don't have a transaction counterpart (and why some transactions don't have an operation counterpart)
  applyUpdates(updates: GraphUpdate[]) {
    for (const update of updates) {
      switch (update.operation) {
        case "addNode":
          this._addNode(update.node);
          break;
        case "updateNode":
          this._updateNode({ nodeId: update.oldProps.id, nodeProps: update.newProps });
          break;
        case "deleteNode":
          this._removeNode({ nodeId: update.node.id });
          break;
        case "addRelationType":
          this._addRelationType(update.relationType);
          break;
        case "updateRelationType":
          this._updateRelationType(update.oldProps.id, update.newProps);
          break;
        case "deleteRelationType":
          this._deleteRelationType(update.relationType.id);
          break;
        case "addRelation":
          const { relation } = this._addRelation(update.relation);
          this.setRelationPositions(relation, update);
          break;
        case "updateRelation":
          this._updateRelation(update.oldProps, update.newProps);
          break;
        case "deleteRelation":
          this.deleteRelation(update.deleted.relation.id); // TODO: Why not _removeRelation? The logic seems to differ slightly
          break;
        case "updateRelationList":
          this._updateRelationList(update.nodeId, update.pinned, update.listAfter);
          break;
        default:
          update satisfies never;
      }
    }
  }

  /**
   * Apply a combined transaction to the graph.
   *
   * If at some point the transaction start containing preparatory async logic
   * we should split them into prep and call methods, and for the combined ones,
   * execute first all the prep methods and then all the call ones.
   */
  async applyCombinedTransaction(txs: TxCombined): Promise<any[]> {
    const updatesArray: GraphUpdate[] = [];
    const results = [];
    for (const tx of txs) {
      switch (tx.type) {
        case "addNode": {
          const { node, updates } = this._addNode(tx.transaction.nodeProps);
          updatesArray.push(...updates);
          results.push(node);
          break;
        }
        case "addChildNode": {
          const { node, relation, updates } = this._addChildNode(tx.transaction);
          updatesArray.push(...updates);
          results.push({ node, relation });
          break;
        }
        case "updateNode": {
          const { updates } = this._updateNode(tx.transaction);
          updatesArray.push(...updates);
          break;
        }
        case "removeNode": {
          const { updates } = this._removeNode(tx.transaction);
          updatesArray.push(...updates);
          break;
        }
        case "addRelationType": {
          const { relationType, updates } = this._addRelationType(tx.transaction);
          updatesArray.push(...updates);
          results.push(relationType);
          break;
        }
        case "addRelation": {
          const { relation, updates } = this._addRelation(tx.transaction);
          updatesArray.push(...updates);
          results.push(relation);
          break;
        }
        case "updateRelation": {
          const { updates, oldProps, newProps } = this._prepareRelationUpdate(tx.transaction);
          updates.push(...this._updateRelation(oldProps, newProps));
          updatesArray.push(...updates);
          break;
        }
        case "removeRelation": {
          const { updates } = this._removeRelation(tx.transaction);
          updatesArray.push(...updates);
          break;
        }
        case "replaceRelationLink": {
          const { object, relation, updates } = this._replaceRelationLink(tx.transaction);
          updatesArray.push(...updates);
          results.push({ object, relation });
          break;
        }
        case "updateRelationPositionsList": {
          const { updates } = this._updateRelationPositionsList(tx.transaction);
          updatesArray.push(...updates);
          break;
        }
        default:
          tx satisfies never;
      }
    }
    this.updateManager.queueUpdates(updatesArray);
    return results;
  }

  /**
   * Create a new node in the graph.
   */
  async addNode(tx: TxAddNode) {
    const { node, updates } = this._addNode(tx.nodeProps);
    this.updateManager.queueUpdates(updates);
    return node;
  }
  private _addNode(props: GraphNodeProps = {}): { node: GraphNode; updates: GraphUpdate[] } {
    let node: GraphNode | undefined;

    try {
      node = new GraphNode(this, {
        version: props.version ?? 1,
        id: props.id ?? uuid(),
        authorId: props.authorId ?? this.user.id,
        content: props.content,
        isBundle: props.isBundle ?? false,
        isZone: props.isZone ?? false,
      });

      this.nodesById.set(node.id, node);
      this.cappedKeywordIndex.add(node.id, () => node!.searchText);

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
        this.cappedKeywordIndex.delete(node.id);
      }
      throw e;
    }
  }

  /**
   * Add a node with a child relation to some existing graph object.
   */
  async addChildNode(tx: TxAddChildNode): Promise<{ node: GraphNode; relation: GraphRelation }> {
    const { node, relation, updates } = this._addChildNode(tx);
    this.updateManager.queueUpdates(updates);
    return { node, relation };
  }
  private _addChildNode(tx: TxAddChildNode): {
    node: GraphNode;
    relation: GraphRelation;
    updates: GraphUpdate[];
  } {
    const wannaBeParent = this.getObject(tx.parentId);
    if (!wannaBeParent) {
      throw new Error(`Parent with id ${tx.parentId} does not exist`);
    }

    let newNode;
    let newRelation;
    const updates: GraphUpdate[] = [];

    try {
      const { node, updates: newNodeUpdates } = this._addNode(tx.nodeProps);
      newNode = node;
      updates.push(...newNodeUpdates);

      const { relation, updates: newRelationUpdates } = this._addRelation({
        id: tx.relationProps?.id,
        fromId: wannaBeParent.id,
        toId: newNode.id,
        relationType: this.relationTypesById[tx.relationProps?.relationTypeId ?? ""] || defaultRelationTypes.child,
        after: tx.after,
      });
      newRelation = relation;
      updates.push(...newRelationUpdates);

      return { node: newNode, relation: newRelation, updates };
    } catch (e) {
      if (newRelation) {
        this.relationsById.delete(newRelation.id);
      }
      if (newNode) {
        this.nodesById.delete(newNode.id);
      }
      throw e;
    }
  }

  async updateNode(tx: TxUpdateNode): Promise<void> {
    const { updates } = this._updateNode(tx);
    this.updateManager.queueUpdates(updates);
  }
  private _updateNode(tx: TxUpdateNode): { updates: GraphUpdate[] } {
    const node = this.nodesById.get(tx.nodeId);
    if (!node) {
      throw new Error(`Node with id ${tx.nodeId} does not exist`);
    }

    const oldProps = node.serialize();
    node.update(tx.nodeProps);

    return {
      updates: [
        {
          operation: "updateNode",
          oldProps,
          newProps: node.serialize(),
        },
      ],
    };
  }

  /**
   * Remove a node from the graph, then delete the object if it is no longer related to anything.
   */
  async removeNode(tx: TxRemoveNode): Promise<void> {
    const { updates } = this._removeNode(tx);
    this.updateManager.queueUpdates(updates);
  }
  private _removeNode(tx: TxRemoveNode): { updates: GraphUpdate[] } {
    const node = this.nodesById.get(tx.nodeId);
    if (!node) {
      throw new Error(`Node with id ${tx.nodeId} does not exist`);
    }

    return { updates: this.deleteNode(node) };
  }

  async addRelationType(tx: TxAddRelationType) {
    const { relationType, updates } = this._addRelationType(tx);
    this.updateManager.queueUpdates(updates);
    return relationType;
  }
  private _addRelationType(
    props: { id?: string; label: string; reverseLabel?: string },
    fromServer = false,
  ): { relationType: GraphRelationType; updates: GraphUpdate[] } {
    const id = props.id || uuid();
    if (this.relationTypesById[id] && !fromServer) {
      throw new Error(`Relation type with id ${props.id} already exists`);
    }

    let label = props.label;
    let reverseLabel = props.reverseLabel;
    if (label.endsWith(" of") && !reverseLabel) {
      // Special case for "is X of" relations because the auto-generated reverse label will be "is X of" and
      // we don't want "is X of of"
      reverseLabel = label;
      label = label.replace(/^(is\s+)?(.+?)\s+of$/i, "$2");
    } else if (!reverseLabel) {
      reverseLabel = `is ${label} of`;
    }

    const newRelationType = {
      version: 1,
      id,
      authorId: this.user.id,
      label,
      reverseLabel,
    };
    this.relationTypesById[id] = newRelationType;
    this.cappedKeywordIndex.add(newRelationType.id, () => newRelationType.label);
    this.cappedKeywordIndex.add(newRelationType.id, () => newRelationType.reverseLabel);
    const updates: GraphUpdate[] = [
      {
        operation: "addRelationType",
        relationType: newRelationType,
      },
    ];
    return { relationType: newRelationType, updates };
  }

  private _updateRelationType(
    id: string,
    props: { label?: string; reverseLabel?: string },
  ): { relationType: GraphRelationType; updates: GraphUpdate[] } {
    if (!this.relationTypesById[id]) {
      throw new Error(`Relation type with id ${id} does not exist`);
    }
    const oldProps = { ...this.relationTypesById[id] };
    const newProps = { ...oldProps, ...props, version: oldProps.version + 1 };
    this.relationTypesById[id] = newProps;
    this.cappedKeywordIndex.add(newProps.id, () => newProps.label);
    this.cappedKeywordIndex.add(newProps.id, () => newProps.reverseLabel);
    const updates: GraphUpdate[] = [
      {
        operation: "updateRelationType",
        oldProps,
        newProps,
      },
    ];
    return { relationType: this.relationTypesById[id], updates };
  }

  private _deleteRelationType(id: string): GraphUpdate[] {
    const updates: GraphUpdate[] = [];
    // find all relations with this type and set them to a default type
    for (const rel of this.relationsById.values()) {
      if (rel.relationType.id !== id) continue;
      updates.push(...this.setRelationType(rel, this.relationTypesById.child));
    }
    updates.push({
      operation: "deleteRelationType",
      relationType: { ...this.relationTypesById[id] },
    });
    delete this.relationTypesById[id];
    this.cappedKeywordIndex.delete(id);
    return updates;
  }

  /**
   * Create a new relation between two existing objects.
   */
  async addRelation(tx: TxAddRelation) {
    const { relation, updates } = this._addRelation(tx);
    this.updateManager.queueUpdates(updates);
    return relation;
  }
  private _addRelation(tx: TxAddRelation): { relation: GraphRelation; updates: GraphUpdate[] } {
    const from = this.getObject(tx.fromId);
    const to = this.getObject(tx.toId);
    if (!from || !to) {
      throw new Error(`GraphObject with id ${from ? tx.toId : tx.fromId} does not exist`);
    }

    // TODO: simplify further and make it similar to _addNode()
    return this.createRelation(
      {
        id: tx.id,
        from,
        to,
        relationType: tx.relationType,
      },
      tx.after,
    );
  }

  async updateRelation(tx: TxUpdateRelation) {
    const { updates, oldProps, newProps } = this._prepareRelationUpdate(tx);
    updates.push(...this._updateRelation(oldProps, newProps));
    this.updateManager.queueUpdates(updates);
  }
  private _prepareRelationUpdate(tx: TxUpdateRelation): {
    updates: GraphUpdate[];
    oldProps: SerializedRelation;
    newProps: SerializedRelation;
  } {
    const relation = this.relationsById.get(tx.relationId);
    if (!relation) {
      throw new Error(`Relation with id ${tx.relationId} does not exist`);
    }

    const updates: GraphUpdate[] = [];
    const oldProps = relation.serialize();
    const newProps = {
      ...oldProps,
      isPrivate: tx.relationProps?.isPrivate ?? oldProps.isPrivate,
      relationTypeId: tx.relationProps?.relationType?.id ?? oldProps.relationTypeId,
      version: oldProps.version + 1,
    };

    let relTypeLabelImpliesReverse = false;
    if (tx.relationProps?.relationTypeLabel !== undefined) {
      if (tx.relationProps?.relationType) {
        throw new Error("Don't provide both relationType and relationTypeLabel in updateRelation");
      }
      const relTypeAndDirection = this.getRelationTypeByLabel(tx.relationProps.relationTypeLabel);
      if (!relTypeAndDirection) {
        const { relationType, updates: relTypeUpdates } = this._addRelationType({
          label: tx.relationProps.relationTypeLabel,
        });
        updates.push(...relTypeUpdates);
        newProps.relationTypeId = relationType.id;
      } else {
        const { relationType, direction } = relTypeAndDirection;
        newProps.relationTypeId = relationType.id;
        relTypeLabelImpliesReverse = direction === "reverse";
      }
    }

    if (
      tx.reverse ||
      (tx.reverse === undefined && relTypeLabelImpliesReverse) ||
      tx.relationProps?.isInitiallyReversed
    ) {
      newProps.fromId = oldProps.toId;
      newProps.toId = oldProps.fromId;
    }

    return { updates, oldProps, newProps };
  }
  private _updateRelation(oldProps: SerializedRelation, newProps: SerializedRelation): GraphUpdate[] {
    const relation = this.relationsById.get(oldProps.id);
    if (!relation) {
      throw new Error(`Relation with id ${oldProps.id} does not exist`);
    }

    let propsForUpdate: Partial<GraphRelationProps> = { ...newProps };

    let oldFrom;
    let oldFromListBefore;
    let newFrom;
    let newFromListBefore;
    if (oldProps.fromId !== newProps.fromId) {
      oldFrom = relation.from;
      newFrom = this.getObject(newProps.fromId);
      if (!newFrom) {
        throw new Error(
          `Error setting "from" property of ${relation.id}: object with id ${newProps.fromId} does not exist`,
        );
      }
      oldFromListBefore = this.getRelationList(oldFrom).serialize();
      newFromListBefore = this.getRelationList(newFrom).serialize();
      propsForUpdate.from = newFrom;
    }

    let oldTo;
    let oldToListBefore;
    let newTo;
    let newToListBefore;
    if (oldProps.toId !== newProps.toId) {
      oldTo = relation.to;
      newTo = this.getObject(newProps.toId);
      if (!newTo) {
        throw new Error(
          `Error setting "to" property of ${relation.id}: object with id ${newProps.toId} does not exist`,
        );
      }
      oldToListBefore = this.getRelationList(oldTo).serialize();
      newToListBefore = this.getRelationList(newTo).serialize();
      propsForUpdate.to = newTo;
    }

    if (oldProps.relationTypeId !== newProps.relationTypeId) {
      const newRelationType = this.relationTypesById[newProps.relationTypeId];
      if (!newRelationType) {
        throw new Error(
          `Error setting "relationTypeId" property of ${relation.id}: relation type with id ${newProps.relationTypeId} does not exist`,
        );
      }
      propsForUpdate.relationType = newRelationType;
    }

    const updates: GraphUpdate[] = [
      {
        operation: "updateRelation",
        oldProps,
        newProps,
      },
    ];
    relation.update(propsForUpdate);

    if (newFrom) {
      updates.push({
        operation: "updateRelationList",
        authorId: this.user.id,
        nodeId: oldFrom!.id,
        pinned: false,
        listBefore: oldFromListBefore!,
        listAfter: this.getRelationList(oldFrom!).serialize(),
      });
      updates.push({
        operation: "updateRelationList",
        authorId: this.user.id,
        nodeId: newFrom!.id,
        pinned: false,
        listBefore: newFromListBefore!,
        listAfter: this.getRelationList(newFrom!).serialize(),
      });
    }
    const isReversal = oldFrom && oldTo && newFrom && newTo && oldFrom.id === newTo.id && oldTo.id === newFrom.id;
    if (newTo && !isReversal) {
      updates.push({
        operation: "updateRelationList",
        authorId: this.user.id,
        nodeId: oldTo!.id,
        pinned: false,
        listBefore: oldToListBefore!,
        listAfter: this.getRelationList(oldTo!).serialize(),
      });
      updates.push({
        operation: "updateRelationList",
        authorId: this.user.id,
        nodeId: newTo!.id,
        pinned: false,
        listBefore: newToListBefore!,
        listAfter: this.getRelationList(newTo!).serialize(),
      });
    }
    return updates;
  }

  /**
   * Remove a relation from the graph, then delete the objects if they are no longer related to anything.
   */
  async removeRelation(tx: TxRemoveRelation) {
    const { updates } = this._removeRelation(tx);
    this.updateManager.queueUpdates(updates);
  }
  private _removeRelation(tx: TxRemoveRelation): { updates: GraphUpdate[] } {
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

    // TODO: write down all the steps, compare with deleteRelation, and decide on merging the two
    const { from, to } = relation;
    if (from instanceof GraphNode && this.hasNoRelations(from)) {
      updates.push(...this.deleteNode(from));
    }
    if (to instanceof GraphNode && this.hasNoRelations(to)) {
      updates.push(...this.deleteNode(to));
    }
    return { updates };
  }

  private _updateRelationList(
    objectId: string,
    pinned: boolean,
    serializedList: SerializedPositionList<GraphRelation>,
  ) {
    const object = this.getObject(objectId);
    if (!object) {
      throw new Error(`Object with id ${objectId} does not exist`);
    }
    const list = pinned ? object.pinnedRelationsList : object.allRelationsList;
    list.clear();
    const positionedRelations = Object.entries(serializedList).map(([relationId, position]) => {
      const relation = this.relationsById.get(relationId);
      if (!relation) throw new Error(`Relation with id ${relationId} does not exist`);
      return { item: relation, position };
    });
    list.load(positionedRelations);
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
      this.cappedKeywordIndex.delete(node.id);
    } catch (e) {
      if (!this.nodesById.has(node.id)) {
        this.nodesById.set(node.id, node);
        this.cappedKeywordIndex.add(node.id, () => node.searchText);
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

  private createRelation(
    relationProps: GraphRelationProps,
    after?: Positioner<GraphRelation>,
  ): { relation: GraphRelation; updates: GraphUpdate[] } {
    let relation: GraphRelation | null = null;
    let updates: GraphUpdate[];

    // TODO: this is probably not as simple as relation and relation list can be authored by different users
    const authorId = relationProps.authorId || this.user.id;

    try {
      if (relationProps.id && this.relationsById.has(relationProps.id)) {
        throw new Error(`Relation with id ${relationProps.id} already exists`);
      }
      this.assertExists(relationProps.from, relationProps.to);

      relation = new GraphRelation(this, {
        ...relationProps,
        authorId,
      });
      this.relationsById.set(relation.id, relation);
      this.cappedKeywordIndex.add(relation.id, () => relation!.searchText);

      const fromListBefore = relation.from.allRelationsList.serialize();
      relation.from.allRelationsList.add(relation);
      const fromListAfter = relation.from.allRelationsList.serialize();

      const toListBefore = relation.to.allRelationsList.serialize();
      relation.to.allRelationsList.add(relation);
      const toListAfter = relation.to.allRelationsList.serialize();

      updates = [
        {
          operation: "addRelation",
          relation: relation.serialize(),
          fromPos: relation.fromPosition!,
          toPos: relation.toPosition!,
        },
        {
          operation: "updateRelationList",
          authorId,
          nodeId: relation.from.id,
          pinned: false,
          listBefore: fromListBefore,
          listAfter: fromListAfter,
        },
        {
          operation: "updateRelationList",
          authorId,
          nodeId: relation.to.id,
          pinned: false,
          listBefore: toListBefore,
          listAfter: toListAfter,
        },
      ];

      if (after) {
        const listBefore = relation.from.allRelationsList.serialize();
        relation.from.allRelationsList.move([relation], after);
        const listAfter = relation.from.allRelationsList.serialize();
        updates.push({
          operation: "updateRelationList",
          authorId,
          nodeId: relation.from.id,
          pinned: false,
          listBefore,
          listAfter,
        });
      }

      return { relation, updates };
    } catch (e) {
      if (relation) {
        this.relationsById.delete(relation.id);
        this.cappedKeywordIndex.delete(relation.id);
        relation.from.allRelationsList.delete(relation.id);
        relation.to.allRelationsList.delete(relation.id);
      }
      throw e;
    }
  }

  private deleteRelation(relationOrId: GraphRelation | string): DeletedRelationData {
    const relation = typeof relationOrId === "string" ? this.getRelation(relationOrId) : relationOrId;
    if (!relation) {
      throw new Error("Relation does not exist");
    }

    const deleted: DeletedRelationData = {
      relation: relation.serialize(),
      fromPos: relation.fromPosition,
      fromPinnedPos: relation.fromPinnedPosition,
      toPos: relation.toPosition,
      toPinnedPos: relation.toPinnedPosition,
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
      this.cappedKeywordIndex.delete(relation.id);
    } catch (e) {
      if (!this.relationsById.has(relation.id)) {
        this.relationsById.set(relation.id, relation);
        this.cappedKeywordIndex.add(relation.id, () => relation.searchText);
      }
      this.setRelationPositions(relation, deleted);
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
    this.cappedKeywordIndex.add(relation.id, () => relation.searchText);
    this.setRelationPositions(relation, { fromPos, fromPinnedPos, toPos, toPinnedPos });
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

  private setRelationPositions(
    relation: GraphRelation,
    positions: {
      fromPos?: Position;
      fromPinnedPos?: Position;
      toPos?: Position;
      toPinnedPos?: Position;
    },
  ) {
    const { fromPos, fromPinnedPos, toPos, toPinnedPos } = positions;
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
  }

  /**
   * Replace a relation link with a new or existing graph object.
   */
  async replaceRelationLink(tx: TxReplaceRelationLink) {
    const { object, relation, updates } = this._replaceRelationLink(tx);
    this.updateManager.queueUpdates(updates);
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
      const { node: newNode, updates: newNodeUpdates } = this._addNode(tx.replaceWith.nodeProps || {});
      newObject = newNode;
      updates.push(...newNodeUpdates);
    } else {
      newObject = this.getObject(tx.replaceWith.id);
      if (!newObject) throw new Error(`Object with id ${tx.replaceWith.id} does not exist`);
    }

    if (tx.direction === "from") {
      updates.push(...this.setRelationFrom(relation, newObject, tx.after));
    } else {
      updates.push(...this.setRelationTo(relation, newObject, tx.after));
    }

    return { object: newObject, relation, updates };
  }

  async updateRelationPositionsList(tx: TxUpdateRelationPositionsList) {
    const { updates } = this._updateRelationPositionsList(tx);
    this.updateManager.queueUpdates(updates);
  }
  private _updateRelationPositionsList(tx: TxUpdateRelationPositionsList): { updates: GraphUpdate[] } {
    const __nodes = tx.nodes.map((n) => this.getObject(n.object.id));
    if (!__nodes.every((n) => n instanceof GraphNode)) {
      throw new Error("Invalid nodes");
    }

    if (tx.after) {
      const __after = this.getObject(tx.after.object.id);
      if (!__after || !(__after instanceof GraphNode)) {
        throw new Error("Invalid after node");
      }
    }

    const oldList = tx.group.relationsList.serialize();
    tx.group.relationsList.move(
      tx.nodes.map((n) => n.relationWithParent),
      tx.after instanceof DescendantTreeNode ? tx.after.relationWithParent : tx.after,
    );
    const newList = tx.group.relationsList.serialize();

    return {
      updates: tx.nodes.map(({ object, relationWithParent }) => {
        const nodeId = object.id === relationWithParent.from.id ? relationWithParent.to.id : relationWithParent.from.id;
        return {
          operation: "updateRelationList",
          authorId: this.user.id,
          nodeId,
          pinned: tx.group instanceof PinnedGroup,
          listBefore: oldList,
          listAfter: newList,
        };
      }),
    };
  }

  /**
   * Update the `from` node of the given relations to the new node, and
   * also updates the list of relations on the old and new `from` nodes
   * to reflect the changes.
   */
  private setRelationFrom(
    relation: GraphRelation,
    newFrom: GraphObject,
    after?: Positioner<GraphRelation>,
  ): GraphUpdate[] {
    const updates: GraphUpdate[] = [];
    try {
      const oldRelation = relation.serialize();
      const oldFrom = relation.from;
      const oldFromListBefore = this.getRelationList(oldFrom).serialize();
      const newFromListBefore = this.getRelationList(newFrom).serialize();

      relation.setFrom(newFrom, after);
      relation.incrementVersion();

      updates.push({
        operation: "updateRelation",
        oldProps: oldRelation,
        newProps: relation.serialize(),
      });
      updates.push({
        operation: "updateRelationList",
        authorId: this.user.id,
        nodeId: oldFrom.id,
        pinned: false,
        listBefore: oldFromListBefore,
        listAfter: this.getRelationList(oldFrom).serialize(),
      });
      updates.push({
        operation: "updateRelationList",
        authorId: this.user.id,
        nodeId: newFrom.id,
        pinned: false,
        listBefore: newFromListBefore,
        listAfter: this.getRelationList(newFrom).serialize(),
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
  private setRelationTo(relation: GraphRelation, newTo: GraphObject, after?: Positioner<GraphRelation>): GraphUpdate[] {
    const updates: GraphUpdate[] = [];
    try {
      const oldRelation = relation.serialize();
      const oldTo = relation.to;
      const oldToListBefore = this.getRelationList(oldTo).serialize();
      const newToListBefore = this.getRelationList(newTo).serialize();

      relation.setTo(newTo, after);
      relation.incrementVersion();
      updates.push({
        operation: "updateRelation",
        oldProps: oldRelation,
        newProps: relation.serialize(),
      });
      updates.push({
        operation: "updateRelationList",
        authorId: this.user.id,
        nodeId: oldTo.id,
        pinned: false,
        listBefore: oldToListBefore,
        listAfter: this.getRelationList(oldTo).serialize(),
      });
      updates.push({
        operation: "updateRelationList",
        authorId: this.user.id,
        nodeId: newTo.id,
        pinned: false,
        listBefore: newToListBefore,
        listAfter: this.getRelationList(newTo).serialize(),
      });

      updates.push(...this.deleteIfNoRelations(oldTo));
    } catch (e) {
      // TODO: implement rollback
      // Phil: I don't like how this messes up with the `createNode` in the replaceRelationLink method
      throw e;
    }
    return updates;
  }

  private setRelationType(relation: GraphRelation, newType: GraphRelationType): GraphUpdate[] {
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
  getRelationList(nodeOrId: GraphObject | string): FractionalPositionedList<GraphRelation> {
    const node = typeof nodeOrId === "string" ? this.getNodeOrThrow(nodeOrId) : nodeOrId;
    return node.allRelationsList;
  }

  getPinnedRelationList(nodeOrId: GraphObject | string): FractionalPositionedList<GraphRelation> {
    const node = typeof nodeOrId === "string" ? this.getNodeOrThrow(nodeOrId) : nodeOrId;
    return node.pinnedRelationsList;
  }

  pinRelations(objectId: string, relationIds: string[], after?: Positioner<GraphRelation>) {
    const { updates } = this._pinRelations(objectId, relationIds, after);
    this.updateManager.queueUpdates(updates);
  }

  private _pinRelations(
    objectId: string,
    relationIds: string[],
    after?: Positioner<GraphRelation>,
  ): { updates: GraphUpdate[] } {
    const relations = relationIds.map((id) => {
      const relation = this.relationsById.get(id);
      if (!relation) {
        throw new Error(`Relation with id ${id} does not exist`);
      }
      return relation;
    });
    const list = this.getPinnedRelationList(objectId);
    const listBefore = list.serialize();
    list.add(relations, after);
    const listAfter = list.serialize();
    return {
      updates: [
        {
          operation: "updateRelationList",
          authorId: this.user.id,
          nodeId: objectId,
          pinned: true,
          listBefore,
          listAfter,
        },
      ],
    };
  }

  unpinRelations(objectId: string, relationIds: string[]) {
    const { updates } = this._unpinRelations(objectId, relationIds);
    this.updateManager.queueUpdates(updates);
  }

  private _unpinRelations(objectId: string, relationIds: string[]): { updates: GraphUpdate[] } {
    const list = this.getPinnedRelationList(objectId);
    const listBefore = list.serialize();
    relationIds.forEach((id) => {
      list.delete(id);
    });
    const listAfter = list.serialize();
    return {
      updates: [
        {
          operation: "updateRelationList",
          authorId: this.user.id,
          nodeId: objectId,
          pinned: true,
          listBefore,
          listAfter,
        },
      ],
    };
  }

  cleanup() {
    this.nodesById.clear();
    this.relationsById.clear();
    this.relationToBundles.clear();
    Object.keys(this.relationTypesById).forEach((key) => {
      delete this.relationTypesById[key];
    });
    this.updateManager.cleanup();
    this.cappedKeywordIndex.clear();

    this.ensureDefaultObjectsCreated();
  }

  /**
   * Reset the graph and load the given data.
   */
  resetAndLoad(data: SerializedGraphStore) {
    let wasSyncing = this.updateManager.syncRunning;
    this.updateManager.stopSync();

    // Clear all local data
    this.nodesById.clear();
    this.relationsById.clear();
    this.relationToBundles.clear();
    Object.keys(this.relationTypesById).forEach((key) => {
      delete this.relationTypesById[key];
    });
    this.updateManager.cleanup();
    this.cappedKeywordIndex.clear();

    // Load data
    this.load(data);

    // Ensure default objects are present if they weren't created as part of load.
    // Important to call this *after* load, so that update manager is in a consistent state where it's queueing the correct
    // updates for the default objects.
    this.ensureDefaultObjectsCreated();

    if (wasSyncing) {
      this.updateManager.startSync();
    }
  }

  /**
   * Create default objects (e.g. User Root, Outline Root) if and only if they don't exist, and queue matching GraphUpdates.
   */
  private ensureDefaultObjectsCreated() {
    const updates: GraphUpdate[] = [];

    for (const rt of Object.values(defaultRelationTypes)) {
      if (!this.relationTypesById[rt.id]) {
        const { updates: rtUpdates } = this._addRelationType(rt, true);
        updates.push(...rtUpdates);
      }
    }

    if (!this.nodesById.get(USER_ROOT_ID)) {
      const { updates: userRootUpdates } = this._addNode({
        id: USER_ROOT_ID,
        content: [{ type: "text", value: "User" }],
      });
      updates.push(...userRootUpdates);
    }
    if (!this.nodesById.get(OUTLINE_ROOT_ID)) {
      const { updates: outlineRootUpdates } = this._addNode({
        id: OUTLINE_ROOT_ID,
        content: [{ type: "text", value: "My Graph" }],
      });
      updates.push(...outlineRootUpdates);
    }
    if (!this.nodesById.get(THOUGHTSTREAM_ROOT_ID)) {
      const { updates: tsRootUpdates } = this._addNode({
        id: THOUGHTSTREAM_ROOT_ID,
        content: [{ type: "text", value: "Stream" }],
      });
      updates.push(...tsRootUpdates);
    }
    if (!this.relationsById.get(OUTLINE_USER_ROOT_REL_ID)) {
      const { updates: userOutlineUpdates } = this.createRelation({
        id: OUTLINE_USER_ROOT_REL_ID,
        from: this.userRoot,
        to: this.outlineRoot,
        relationType: this.relationTypesById.child,
      });
      updates.push(...userOutlineUpdates);
    }
    if (!this.relationsById.get(THOUGHTSTREAM_USER_ROOT_REL_ID)) {
      const { updates: userThoughtstreamUpdates } = this.createRelation({
        id: THOUGHTSTREAM_USER_ROOT_REL_ID,
        from: this.userRoot,
        to: this.thoughtstreamRoot,
        relationType: this.relationTypesById.child,
      });
      updates.push(...userThoughtstreamUpdates);
    }

    this.updateManager.queueUpdates(updates);
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

  getNodes() {
    return this.nodesById.values();
  }

  getRelations() {
    return this.relationsById.values();
  }

  get relationTypes(): GraphRelationType[] {
    return Object.values(this.relationTypesById);
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

  getRelationOrThrow(id: string): GraphRelation {
    const relation = this.getRelation(id);
    if (!relation) {
      throw new Error(`Relation with id ${id} does not exist`);
    }
    return relation;
  }

  getRelation(id: string): GraphRelation | undefined {
    return this.relationsById.get(id);
  }

  getBundleRelation(id: string) {
    return this.relationToBundles.get(id);
  }

  getObject(id: string): GraphNode | GraphRelation | undefined {
    return this.getNode(id) || this.getRelation(id);
  }

  // TODO later graph relation type should be a graph object too, and this method should be merged with getObject
  getObjectOrType(id: string): GraphNode | GraphRelation | GraphRelationType | undefined {
    return this.getNode(id) || this.getRelation(id) || this.getRelationType(id);
  }

  getRelationType(id: string): GraphRelationType | undefined {
    return this.relationTypesById[id];
  }

  getRelationTypeByLabel(
    labelText: string,
  ): { relationType: GraphRelationType; direction: "forward" | "reverse" } | undefined {
    for (const [_, type] of Object.entries(this.relationTypesById)) {
      if (type.label.toLowerCase() === labelText.toLowerCase()) {
        return { relationType: type, direction: "forward" };
      }
      if (type.reverseLabel.toLowerCase() === labelText.toLowerCase()) {
        return { relationType: type, direction: "reverse" };
      }
    }
    return undefined;
  }

  private resolveRelationListReferences(
    objectId: string,
    positionsByRelationId: SerializedPositionList<GraphRelation>,
  ) {
    const object = this.getObject(objectId) ?? new PlaceholderGraphObject(objectId, this.user.id); // TODO: what if it's a relation?
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
      } else if (obj instanceof PlaceholderGraphObject) {
        logger.warn(`Placeholder object with id ${obj.id} is being used`);
      } else {
        throw new Error("Invalid object type");
      }
    });
  }

  serialize(): SerializedGraphStore {
    const nodesById = serializeMap(this.nodesById);
    const relationsById = serializeMap(this.relationsById);
    const relationTypesById = toJS(this.relationTypesById);

    const relationsByNodeId = Array.from(this.nodesById.values()).reduce(
      (acc, node) => {
        acc[node.id] = node.allRelationsList.serialize();
        return acc;
      },
      {} as Record<string, SerializedPositionList<GraphRelation>>,
    );
    const pinnedRelationsByNodeId = Array.from(this.nodesById.values()).reduce(
      (acc, node) => {
        acc[node.id] = node.pinnedRelationsList.serialize();
        return acc;
      },
      {} as Record<string, SerializedPositionList<GraphRelation>>,
    );

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
      const { node } = this._addNode(props);

      return node;
    }
  }

  /**
   * Load a serialized graph into the store.
   * @see file://./design-notes.md#load-methods
   */
  private loadSerializedRelation(props: SerializedRelation): GraphRelation {
    const from = this.getObject(props.fromId) ?? new PlaceholderGraphObject(props.fromId, this.user.id);
    const to = this.getObject(props.toId) ?? new PlaceholderGraphObject(props.toId, this.user.id);
    const existing = this.getRelation(props.id);
    const relationType = this.relationTypesById[props.relationTypeId] ?? defaultRelationTypes.child;
    if (existing) {
      existing.update({ ...props, relationType });
      return existing;
    } else {
      const { relation } = this.createRelation({ ...props, from, to, relationType });
      return relation;
    }
  }

  /**
   * Load serialized positioned relations list into the store.
   * @see file://./design-notes.md#load-methods
   */
  private loadSerializedAllRelationList(
    objectId: string,
    positionsByRelationId: SerializedPositionList<GraphRelation>,
  ) {
    const { object, relationsWithPositions } = this.resolveRelationListReferences(objectId, positionsByRelationId);
    object.allRelationsList.load(relationsWithPositions);
  }

  /**
   * Load serialized pinned relations list into the store.
   * @see file://./design-notes.md#load-methods
   */
  private loadSerializedPinnedRelationList(
    objectId: string,
    positionsByRelationId: SerializedPositionList<GraphRelation>,
  ) {
    const { object, relationsWithPositions } = this.resolveRelationListReferences(objectId, positionsByRelationId);
    object.pinnedRelationsList.load(relationsWithPositions);
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
        relationsByNodeId.set(obj.id, this.nodesById.get(obj.id)?.allRelationsList || new FractionalPositionedList());
        pinnedRelationsByNodeId.set(obj.id, new FractionalPositionedList());
      } else if (obj instanceof GraphRelation) {
        relationTypesById[obj.relationType.id] = obj.relationType;
        relationsById.set(obj.id, obj);
        relationToBundles.set(obj.id, this.relationToBundles.get(obj.id) || []);
      }
    }

    // Need a relation between the subtree root and outline root so it shows up after import
    const subtreeRootRelation = new GraphRelation(this, {
      authorId: this.user.id,
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

  // TODO: We should make this async ASAP
  search(query: Query): SearchResults {
    const results: SearchResults = { nodes: [], relations: [], relationTypes: [] };
    const { text, filters, sort } = query;
    const procText = text?.toLowerCase().trim();
    const keywords = procText.split(/\s+/);
    const include = {
      nodes: !filters?.types || filters.types.includes("node"),
      relations: !filters?.types || filters.types.includes("relation"),
      relationTypes: !filters?.types || filters.types.includes("relationType"),
    };

    // Use the keyword index to get an initial set of object ids
    const initialObjectIds = this.cappedKeywordIndex.getIds(procText);

    // Then do a full text search on the results
    for (const id of initialObjectIds) {
      const object = this.getObjectOrType(id);
      if (include.nodes && object instanceof GraphNode) {
        const node = object;
        const text = node.text.toLocaleLowerCase();
        if (keywords.every((kw) => text.includes(kw))) {
          results.nodes.push({ node: object, score: scoreMatch(text, procText) });
        }
      } else if (include.relations && object instanceof GraphRelation) {
        const relation = object;
        const text = relation.text.toLocaleLowerCase();
        if (keywords.every((kw) => text.includes(kw))) {
          results.relations.push({ relation, score: scoreMatch(text, procText) });
        }
      } else if (include.relationTypes && isGraphRelationType(object)) {
        const relationType = object;
        const label = relationType.label.toLocaleLowerCase();
        const reverseLabel = relationType.reverseLabel.toLocaleLowerCase();
        if (keywords.every((kw) => label.includes(kw)) || keywords.every((kw) => reverseLabel.includes(kw))) {
          results.relationTypes.push({ relationType, score: scoreMatch(text, procText) });
        }
      }
    }

    if (sort?.by === "score") {
      results.nodes.sort((a, b) => (sort.order === "asc" ? a.score - b.score : b.score - a.score));
      results.relations.sort((a, b) => (sort.order === "asc" ? a.score - b.score : b.score - a.score));
      results.relationTypes.sort((a, b) => (sort.order === "asc" ? a.score - b.score : b.score - a.score));
    }
    return results;
  }
}

type Query = {
  text: string;
  filters?: {
    types?: ("node" | "relation" | "relationType")[];
  };
  sort?: {
    by?: "score";
    order?: "asc" | "desc";
  };
};

type SearchResults = {
  nodes: { node: GraphNode; score: number }[];
  relations: { relation: GraphRelation; score: number }[];
  relationTypes: { relationType: GraphRelationType; score: number }[];
};
