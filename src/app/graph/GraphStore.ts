import { action, isObservable, makeObservable, observable, toJS } from "mobx";

import { MewUser, UNLOGGED_USER } from "@/app/auth/MewUser";
import { defaultRelationTypes, MAX_PREFIX_LENGTH } from "@/app/graph/constants";
import { GraphUpdate } from "@/app/graph/GraphUpdate";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { GraphRelationType } from "@/app/graph/types";
import { UpdateManager } from "@/app/graph/UpdateManager";
import { serializeMap, serializeMapWithArrayValues } from "@/app/persistence/serialization";
import {
  DeletedRelationData,
  SerializedGraphStore,
  SerializedNode,
  SerializedPositionList,
  SerializedRelation,
} from "@/app/persistence/SerializedData";
import { ObjectPath, Position, uuid } from "@/app/util";
import {
  GLOBAL_ADMIN_USER_ID,
  GLOBAL_ROOT_ID,
  GLOBAL_TO_USER_RELATION_ID_PREFIX,
  USER_ROOT_ID_PREFIX,
} from "@/lib/constants";
import logger from "@/lib/logger";
import { CappedKeywordIndex } from "@/lib/trie";
import { scoreMatch } from "@/lib/utils";

import { FractionalPositionedList, ItemWithPosition } from "./FractionalPositionedList";
import { GraphNode, GraphNodeProps } from "./GraphNode";
import { GraphObject } from "./GraphObject";
import { GraphRelation, GraphRelationProps, isGraphRelationType } from "./GraphRelation";
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
  TxSetIsPublic,
  TxUpdateNode,
  TxUpdateRelation,
  TxUpdateRelationPositionsList,
} from "./GraphTransactionTypes";
import { PlaceholderGraphObject } from "./PlaceholderGraphObject";

/**
 * GraphStore is a collection of nodes and relations.
 *
 * All public methods are either:
 * - read-only (e.g. getters, assertions, etc)
 * - asynchronous and transactional (i.e. they return a new state of the graph)
 */
export class GraphStore {
  settings: SettingsStore | undefined;
  cappedKeywordIndex = new CappedKeywordIndex(MAX_PREFIX_LENGTH);

  user: MewUser;
  updateManager: UpdateManager;

  nodesById: Map<string, GraphNode> = new Map();
  relationsById: Map<string, GraphRelation> = new Map();
  relationToBundles: Map<string, GraphNode[]> = new Map(); // Relation id to list of bundle-nodes that contain it
  relationTypesById: Record<string, GraphRelationType> = {};

  constructor(user: MewUser = UNLOGGED_USER, settings?: SettingsStore, authedFetch?: typeof fetch) {
    this.user = user;
    this.settings = settings;
    this.updateManager = new UpdateManager(
      user.id,
      authedFetch ?? fetch,
      (data: SerializedGraphStore) => this.resetAndLoad(data),
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
        relationTypesById: observable.shallow,
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
        setIsPublic: action,
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

  get userRootId(): string {
    return USER_ROOT_ID_PREFIX + this.user.id;
  }

  get userRoot(): GraphNode {
    const node = this.nodesById.get(this.userRootId);
    if (!node) {
      throw new Error("User root node not found");
    }
    return node;
  }

  get globalRoot(): GraphNode {
    const node = this.nodesById.get(GLOBAL_ROOT_ID);
    if (!node) {
      throw new Error("Global root node not found");
    }
    return node;
  }

  get globalToUserRelationId(): string {
    return GLOBAL_TO_USER_RELATION_ID_PREFIX + this.user.id;
  }

  get globalToUserRelation(): GraphRelation {
    const relation = this.relationsById.get(this.globalToUserRelationId);
    if (!relation) {
      throw new Error("Global to user relation not found");
    }
    return relation;
  }

  /**
   * The default place to put a user in the graph.
   */
  getDefaultRootForUser(): ObjectPath {
    return { object: this.userRoot, relations: [this.globalToUserRelation] };
  }

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
          this._updateRelation(update.oldProps, update.newProps, true);
          break;
        case "deleteRelation":
          this.deleteRelation(update.deleted.relation.id);
          break;
        case "updateRelationList":
          this._updateRelationList(update.nodeId, update.pinned, update.relationId, update.newPosition);
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
        case "setIsPublic": {
          const { updates } = this._setIsPublic(tx.transaction);
          updatesArray.push(...updates);
          break;
        }
        case "pinRelation": {
          const { updates } = this._pinRelations(
            tx.transaction.objectId,
            [tx.transaction.relationId],
            tx.transaction.after,
          );
          updatesArray.push(...updates);
          break;
        }
        case "unpinRelation": {
          const { updates } = this._unpinRelations(tx.transaction.objectId, [tx.transaction.relationId]);
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
        isPublic: props.isPublic ?? this.settings?.publicMode ?? false,
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

      if (this.settings?.addAllNewNodesAsChildrenOfUserNode) {
        if (wannaBeParent !== this.userRoot) {
          const { updates: userRelationUpdates } = this._addRelation({
            fromId: this.userRoot.id,
            toId: node.id,
          });
          updates.push(...userRelationUpdates);
        }
      }

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

  async setIsPublic(tx: TxSetIsPublic) {
    const { updates } = this._setIsPublic(tx);
    this.updateManager.queueUpdates(updates);
  }
  private _setIsPublic({
    objectId,
    relationId,
    isPublic,
    alsoSetRelatedObjects,
    alsoSetChildrenAndDescendants,
  }: TxSetIsPublic): { updates: GraphUpdate[] } {
    const object = this.getObject(objectId);
    if (!object) {
      throw new Error(`Object with id ${objectId} does not exist`);
    }

    let relation = relationId ? this.getRelation(relationId) : undefined;
    if (relationId && !relation) {
      throw new Error(`Relation with id ${relationId} does not exist`);
    }

    const updates: GraphUpdate[] = [];

    const { updates: objectUpdates } = this._setObjectIsPublic(object, isPublic);
    updates.push(...objectUpdates);

    if (relation) {
      const { updates: relationUpdates } = this._setObjectIsPublic(relation, isPublic);
      updates.push(...relationUpdates);
    }

    if (alsoSetRelatedObjects) {
      for (const rel of object.relations) {
        // Skip relations from other authors
        if (rel.authorId !== this.user.id) continue;
        // No updates to parents (and parent relations) of the specified object
        if (rel.relationType.id === "child" && rel.to.id === object.id) continue;
        // First set the value on the relation itself
        const { updates: relUpdates } = this._setObjectIsPublic(rel, isPublic);
        updates.push(...relUpdates);
        // ...then set the value for the other object in the relation
        const otherObject = rel.from.id === object.id ? rel.to : rel.from;
        const { updates: otherObjectUpdates } = this._setObjectIsPublic(otherObject, isPublic);
        updates.push(...otherObjectUpdates);
      }
    }

    if (alsoSetChildrenAndDescendants) {
      const toVisit = [
        ...object.relations.filter(
          (r) => r.authorId === this.user.id && r.relationType.id === "child" && r.from.id === object.id,
        ),
      ];
      const visited = new Set<string>();
      let childRelation = toVisit.shift();
      while (childRelation) {
        // First set the value on the relation itself
        const { updates: childRelationUpdates } = this._setObjectIsPublic(childRelation, isPublic);
        updates.push(...childRelationUpdates);
        // ...then set the value for the child object
        const { updates: childUpdates } = this._setObjectIsPublic(childRelation.to, isPublic);
        updates.push(...childUpdates);
        // Track that we've visited this relation, then recursively visit any descendants
        visited.add(childRelation.id);
        const child = childRelation.to;
        const descendants = child.relations.filter(
          (r) => r.authorId === this.user.id && r.relationType.id === "child" && r.from.id === child.id,
        );
        toVisit.push(...descendants.filter((r) => !toVisit.includes(r) && !visited.has(r.id)));
        childRelation = toVisit.shift();
      }
    }

    return { updates };
  }

  private _setObjectIsPublic(object: GraphObject, isPublic: boolean): { updates: GraphUpdate[] } {
    // Don't try to set public status for other people's objects
    if (object.authorId !== this.user.id) return { updates: [] };

    // If object is already desired state, do nothing
    if (object.isPublic === isPublic) return { updates: [] };

    const updates: GraphUpdate[] = [];

    switch (object.objectType) {
      case "node":
        const nodeAtStart = object.serialize();
        object.update({ isPublic });
        updates.push({
          operation: "updateNode",
          oldProps: nodeAtStart,
          newProps: object.serialize(),
        });
        break;
      case "relation":
        const relAtStart = object.serialize();
        object.update({ isPublic });
        updates.push({
          operation: "updateRelation",
          oldProps: relAtStart,
          newProps: object.serialize(),
        });
        // If relation type is private and we're making the relation public, update the relation type too
        if (!object.relationType.isPublic && isPublic) {
          const { updates: relTypeUpdates } = this._updateRelationType(object.relationType.id, {
            isPublic: true,
          });
          updates.push(...relTypeUpdates);
        }
        break;
      case "placeholder":
        // Do nothing
        break;
      default:
        object satisfies never;
    }

    return { updates };
  }

  async addRelationType(tx: TxAddRelationType) {
    const { relationType, updates } = this._addRelationType(tx);
    this.updateManager.queueUpdates(updates);
    return relationType;
  }

  private _addRelationType(
    props: { id?: string; version?: number; label: string; reverseLabel?: string },
    fromServer = false,
  ): { relationType: GraphRelationType; updates: GraphUpdate[] } {
    const id = props.id ?? uuid();
    if (this.relationTypesById[id] && !fromServer) {
      throw new Error(`Relation type with id ${props.id} already exists`);
    }
    const version = props.version ?? 1;
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
      version,
      id,
      authorId: this.user.id,
      label,
      reverseLabel,
      isPublic: false,
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
    props: { label?: string; reverseLabel?: string; isPublic?: boolean },
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
      isPublic: tx.relationProps?.isPublic ?? oldProps.isPublic,
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
  private _updateRelation(
    oldProps: SerializedRelation,
    newProps: SerializedRelation,
    noUpdatesNeeded = false,
  ): GraphUpdate[] {
    const relation = this.relationsById.get(oldProps.id);
    if (!relation) {
      throw new Error(`Relation with id ${oldProps.id} does not exist`);
    }

    let propsForUpdate: Partial<GraphRelationProps> = { ...newProps };

    let oldFrom;
    let oldFromPositionBefore;
    let newFrom;
    let newFromPositionBefore;
    if (oldProps.fromId !== newProps.fromId) {
      oldFrom = relation.from;
      newFrom = this.getObject(newProps.fromId);
      if (!newFrom) {
        throw new Error(
          `Error setting "from" property of ${relation.id}: object with id ${newProps.fromId} does not exist`,
        );
      }
      oldFromPositionBefore = this.getRelationList(oldFrom).get(relation.id)?.position;
      newFromPositionBefore = this.getRelationList(newFrom).get(relation.id)?.position;
      propsForUpdate.from = newFrom;
    }

    let oldTo;
    let oldToPositionBefore;
    let newTo;
    let newToPositionBefore;
    if (oldProps.toId !== newProps.toId) {
      oldTo = relation.to;
      newTo = this.getObject(newProps.toId);
      if (!newTo) {
        throw new Error(
          `Error setting "to" property of ${relation.id}: object with id ${newProps.toId} does not exist`,
        );
      }
      oldToPositionBefore = this.getRelationList(oldTo).get(relation.id)?.position;
      newToPositionBefore = this.getRelationList(newTo).get(relation.id)?.position;
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

    // In case we're calling this method from `undo` or `redo` (but probably better to rewrite this)
    if (noUpdatesNeeded) return [];

    const isReversal = oldFrom && oldTo && newFrom && newTo && oldFrom.id === newTo.id && oldTo.id === newFrom.id;

    if (isReversal) {
      if (!oldFrom || !oldTo || !newFrom || !newTo) throw new Error("oldFrom, oldTo, newFrom, newTo should be defined");
      if (!oldFromPositionBefore || !oldToPositionBefore) throw new Error("Both old positions should be defined");

      const newFromPosition = this.getRelationList(newFrom).get(relation.id)?.position;
      const newToPosition = this.getRelationList(newTo).get(relation.id)?.position;
      if (!newFromPosition || !newToPosition) throw new Error("Both new positions should be defined");

      updates.push({
        operation: "updateRelationList",
        authorId: this.user.id,
        nodeId: oldFrom.id,
        pinned: false,
        relationId: relation.id,
        oldPosition: oldFromPositionBefore,
        newPosition: newToPosition,
        oldIsPublic: oldProps.isPublic,
        newIsPublic: newProps.isPublic,
      });
      updates.push({
        operation: "updateRelationList",
        authorId: this.user.id,
        nodeId: oldTo.id,
        pinned: false,
        relationId: relation.id,
        oldPosition: oldToPositionBefore,
        newPosition: newFromPosition,
        oldIsPublic: oldProps.isPublic,
        newIsPublic: newProps.isPublic,
      });
    }

    if (newFrom && !isReversal) {
      if (!oldFrom || !oldFromPositionBefore) throw new Error("oldFrom should be defined if newFrom is defined");

      const newFromPosition = this.getRelationList(newFrom).get(relation.id)?.position;
      if (!newFromPosition) throw new Error("newFromPosition should be defined");

      updates.push({
        operation: "updateRelationList",
        authorId: this.user.id,
        nodeId: oldFrom.id,
        pinned: false,
        relationId: relation.id,
        oldPosition: oldFromPositionBefore,
        newPosition: null,
        oldIsPublic: oldProps.isPublic,
        newIsPublic: newProps.isPublic,
      });
      updates.push({
        operation: "updateRelationList",
        authorId: this.user.id,
        nodeId: newFrom.id,
        pinned: false,
        relationId: relation.id,
        oldPosition: newFromPositionBefore ?? null,
        newPosition: newFromPosition,
        oldIsPublic: oldProps.isPublic,
        newIsPublic: newProps.isPublic,
      });
    }

    if (newTo && !isReversal) {
      if (!oldTo || !oldToPositionBefore) throw new Error("oldTo should be defined if newTo is defined");

      const newToPosition = this.getRelationList(newTo).get(relation.id)?.position;
      if (!newToPosition) throw new Error("newToPosition should be defined");

      updates.push({
        operation: "updateRelationList",
        authorId: this.user.id,
        nodeId: oldTo.id,
        pinned: false,
        relationId: relation.id,
        oldPosition: oldToPositionBefore,
        newPosition: null,
        oldIsPublic: oldProps.isPublic,
        newIsPublic: newProps.isPublic,
      });
      updates.push({
        operation: "updateRelationList",
        authorId: this.user.id,
        nodeId: newTo.id,
        pinned: false,
        relationId: relation.id,
        oldPosition: newToPositionBefore ?? null,
        newPosition: newToPosition,
        oldIsPublic: oldProps.isPublic,
        newIsPublic: newProps.isPublic,
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
    relationId: string,
    newPosition: Position | null,
  ): void {
    const object = this.getObject(objectId);
    if (!object) throw new Error(`Object with id ${objectId} does not exist`);
    const relation = this.getRelation(relationId);
    if (!relation) throw new Error(`Relation with id ${relationId} does not exist`);

    const list = pinned ? object.pinnedRelationsList : object.allRelationsList;
    if (newPosition === null) {
      list.delete(relationId);
    } else {
      list.load([{ item: relation, position: newPosition }]);
    }
  }

  private deleteNode(nodeOrId: GraphNode | string): GraphUpdate[] {
    const node = typeof nodeOrId === "string" ? this.nodesById.get(nodeOrId) : nodeOrId;
    if (!node) {
      throw new Error("Node does not exist");
    }
    if (node.id.startsWith(USER_ROOT_ID_PREFIX)) {
      throw new Error("Cannot delete user root node");
    }
    if (node.id === this.globalRoot.id) {
      throw new Error("Cannot delete global root node");
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
        isPublic: relationProps.isPublic ?? this.settings?.publicMode ?? false,
        authorId,
      });
      this.relationsById.set(relation.id, relation);
      this.cappedKeywordIndex.add(relation.id, () => relation!.searchText);

      const commonUpdatePart = { authorId, pinned: false, oldIsPublic: false, newIsPublic: !!relationProps.isPublic };
      const fromId = relation.from.id;
      const partialFromUpdates = relation.from.allRelationsList.add(relation);
      const toId = relation.to.id;
      const partialToUpdates = relation.to.allRelationsList.add(relation);

      updates = [
        {
          operation: "addRelation",
          relation: relation.serialize(),
          fromPos: relation.fromPosition!,
          toPos: relation.toPosition!,
        },
        ...partialFromUpdates.map((update) => ({ ...update, ...commonUpdatePart, nodeId: fromId })),
        ...partialToUpdates.map((update) => ({ ...update, ...commonUpdatePart, nodeId: toId })),
      ];

      if (after) {
        const partialUpdates = relation.from.allRelationsList.move([relation], after);
        updates = [...updates, ...partialUpdates.map((update) => ({ ...update, ...commonUpdatePart, nodeId: fromId }))];
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
    if (relation.id.startsWith(GLOBAL_TO_USER_RELATION_ID_PREFIX)) {
      throw new Error("Cannot delete relation from global to user");
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
    if (relation.id.startsWith(GLOBAL_TO_USER_RELATION_ID_PREFIX)) {
      throw new Error("Cannot replace relation from global to user");
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
    const withinNode = this.getObject(tx.containingNodeId);
    if (!withinNode) {
      throw new Error(`Node with id ${tx.containingNodeId} does not exist`);
    }

    const objectRelationPairs = tx.objectAndRelationIds.map(({ objectId, relationId }) => {
      const object = this.getObject(objectId);
      const relation = this.getRelation(relationId);
      if (!object || !relation) {
        throw new Error(`GraphObject with id ${objectId} or ${relationId} does not exist`);
      }
      return { object, relationWithParent: relation };
    });

    const after = tx.afterObjectId ? this.getObject(tx.afterObjectId) : undefined;
    if (after && !(after instanceof GraphRelation)) {
      throw new Error("Invalid after relation");
    }

    const oldPositions = objectRelationPairs.map(({ object, relationWithParent }) => {
      return this.getRelationList(object).get(relationWithParent.id)?.position;
    });

    const relationsList = tx.groupId === "pinned" ? withinNode.pinnedRelationsList : withinNode.allRelationsList;
    relationsList.move(
      objectRelationPairs.map(({ relationWithParent }) => relationWithParent),
      after,
    );

    return {
      updates: objectRelationPairs.map(({ object, relationWithParent }, i) => {
        const nodeId = object.id === relationWithParent.from.id ? relationWithParent.to.id : relationWithParent.from.id;
        return {
          operation: "updateRelationList",
          authorId: this.user.id,
          nodeId: withinNode.id,
          pinned: tx.groupId === "pinned",
          relationId: relationWithParent.id,
          newPosition: relationsList.get(relationWithParent.id)?.position ?? null,
          oldPosition: oldPositions[i] ?? null,
          oldIsPublic: relationWithParent.isPublic,
          newIsPublic: relationWithParent.isPublic,
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
      const oldFromPosition = this.getRelationList(oldFrom).get(relation.id)?.position ?? null;

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
        relationId: relation.id,
        oldPosition: oldFromPosition,
        newPosition: null,
        oldIsPublic: relation.isPublic,
        newIsPublic: false,
      });
      updates.push({
        operation: "updateRelationList",
        authorId: this.user.id,
        nodeId: newFrom.id,
        pinned: false,
        relationId: relation.id,
        oldPosition: null,
        newPosition: this.getRelationList(newFrom).get(relation.id)?.position ?? null,
        oldIsPublic: false,
        newIsPublic: relation.isPublic,
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
      const oldToPosition = this.getRelationList(oldTo).get(relation.id)?.position ?? null;

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
        relationId: relation.id,
        oldPosition: oldToPosition,
        newPosition: null,
        oldIsPublic: relation.isPublic,
        newIsPublic: relation.isPublic,
      });
      updates.push({
        operation: "updateRelationList",
        authorId: this.user.id,
        nodeId: newTo.id,
        pinned: false,
        relationId: relation.id,
        oldPosition: null,
        newPosition: this.getRelationList(newTo).get(relation.id)?.position ?? null,
        oldIsPublic: relation.isPublic,
        newIsPublic: relation.isPublic,
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
    relation.setType(newType);
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
    return node.relations.length === 0;
  }

  private deleteIfNoRelations(object: GraphObject): GraphUpdate[] {
    if (object.relations.length === 0) {
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
    list.add(relations, after);

    return {
      updates: relationIds.map((relationId, i) => ({
        operation: "updateRelationList",
        authorId: this.user.id,
        nodeId: objectId,
        pinned: true,
        relationId,
        oldPosition: null, // TODO: should we preserve the old position from allRelationsList?
        newPosition: this.getPinnedRelationList(objectId).get(relationId)?.position ?? null,
        oldIsPublic: this.relationsById.get(relationId)?.isPublic ?? false,
        newIsPublic: this.relationsById.get(relationId)?.isPublic ?? false,
      })),
    };
  }

  unpinRelations(objectId: string, relationIds: string[]) {
    const { updates } = this._unpinRelations(objectId, relationIds);
    this.updateManager.queueUpdates(updates);
  }
  private _unpinRelations(objectId: string, relationIds: string[]): { updates: GraphUpdate[] } {
    const oldPositions = relationIds.map((id) => this.getPinnedRelationList(objectId).get(id)?.position);

    const list = this.getPinnedRelationList(objectId);
    relationIds.forEach((id) => {
      list.delete(id);
    });

    return {
      updates: relationIds.map((relationId) => ({
        operation: "updateRelationList",
        authorId: this.user.id,
        nodeId: objectId,
        pinned: true,
        relationId,
        oldPosition: oldPositions[relationIds.indexOf(relationId)] ?? null,
        newPosition: null, // TODO: should we preserve the old position from pinnedRelationsList?
        oldIsPublic: this.relationsById.get(relationId)?.isPublic ?? false,
        newIsPublic: this.relationsById.get(relationId)?.isPublic ?? false,
      })),
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

    let userRoot = this.nodesById.get(this.userRootId);
    if (!userRoot) {
      const { node, updates: userRootUpdates } = this._addNode({
        id: this.userRootId,
        content: [{ type: "text", value: this.user.name || this.user.id || "Untitled User" }],
      });
      userRoot = node;
      updates.push(...userRootUpdates);
    }

    let globalRoot = this.nodesById.get(GLOBAL_ROOT_ID);
    if (!globalRoot) {
      const { node } = this._addNode({
        id: GLOBAL_ROOT_ID,
        content: [{ type: "text", value: "Global Root" }],
        isPublic: true,
        authorId: GLOBAL_ADMIN_USER_ID,
        createdAt: new Date(0),
      });
      globalRoot = node;
      // Don't push the change. The global root already exists on the server.
    }

    let globalToUserRelation = this.relationsById.get(this.globalToUserRelationId);
    if (!globalToUserRelation) {
      const { relation, updates: globalToUserRelationUpdates } = this.createRelation({
        id: this.globalToUserRelationId,
        from: globalRoot,
        to: userRoot,
        relationType: defaultRelationTypes.sublist,
      });
      globalToUserRelation = relation;
      updates.push(...globalToUserRelationUpdates);
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

  hasNode(id: string): boolean {
    return this.nodesById.has(id);
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
    const object = this.getObject(objectId) ?? new PlaceholderGraphObject(this, objectId, this.user.id); // TODO: what if it's a relation?
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
    // Nodes
    for (const props of Object.values(data.nodesById)) {
      this.loadSerializedNode(props);
    }

    // Relation Types
    for (const props of Object.values(data.relationTypesById)) {
      this._addRelationType(props);
    }

    // Relations
    const loadedWithPlaceholders: GraphRelation[] = [];
    for (const props of Object.values(data.relationsById)) {
      const rel = this.loadSerializedRelation(props);
      if (rel.from instanceof PlaceholderGraphObject || rel.to instanceof PlaceholderGraphObject) {
        loadedWithPlaceholders.push(rel);
      }
    }
    // It's possible some of these relations were loaded with placeholders because their to or from objects
    // were other relations in this same batch of data. We try to resolve those now.
    for (const rel of loadedWithPlaceholders) {
      if (rel.from instanceof PlaceholderGraphObject) {
        const from = this.getObject(rel.from.id);
        if (from) {
          rel.setFrom(from);
        }
      }
      if (rel.to instanceof PlaceholderGraphObject) {
        const to = this.getObject(rel.to.id);
        if (to) {
          rel.setTo(to);
        }
      }
      // Note: we might still have unresolved placeholders at this point for valid reasons, like if
      // a relation is pointing to a node that was shared by someone else at the time but was
      // subsequently made private.
    }

    // Relation positions
    for (const [nodeId, positionsByRelationId] of Object.entries(data.relationsByNodeId)) {
      this.loadSerializedAllRelationList(nodeId, positionsByRelationId);
    }
    for (const [nodeId, positionsByRelationId] of Object.entries(data.pinnedRelationsByNodeId)) {
      this.loadSerializedPinnedRelationList(nodeId, positionsByRelationId);
    }

    // Bundles
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
   * Load the serialized data into the store. If there are conflicts of data
   * that isn't the relationType, it'll push it.
   */
  importData(data: SerializedGraphStore) {
    let allNodeUpdates = this.loadBatchedSerializedNode(data.nodesById);

    // cut out into its own load serialized relationtype function?
    let allRelationTypeUpdates: GraphUpdate[] = [];
    for (const [key, value] of Object.entries(data.relationTypesById)) {
      // check if it exists, if it does, don't push it to the array
      if (!this.relationTypesById[key]) {
        this.relationTypesById[key] = value;
        allRelationTypeUpdates.push({
          operation: "addRelationType",
          relationType: {
            version: value.version ?? 1,
            id: value.id ?? uuid(),
            authorId: value.authorId ?? this.user.id,
            isPublic: value.isPublic ?? this.settings?.publicMode ?? false,
            label: value.label ?? "",
            reverseLabel: value.reverseLabel ?? `is ${value.label} of`,
          },
        });
      }
    }

    let allRelationUpdates = this.loadBatchedSerializedRelation(data.relationsById);

    return this.updateManager.syncImportUpdates(allNodeUpdates.concat(allRelationUpdates, allRelationTypeUpdates));
  }

  /**
   * Load a batch of serialized graph relations into the store.
   */
  private loadBatchedSerializedRelation(relationsById: Object) {
    let allUpdates: GraphUpdate[] = [];
    for (const props of Object.values(relationsById)) {
      const from = this.getObject(props.fromId) ?? new PlaceholderGraphObject(this, props.fromId, this.user.id);
      const to = this.getObject(props.toId) ?? new PlaceholderGraphObject(this, props.toId, this.user.id);
      const existing = this.getRelation(props.id);
      const relationType = this.relationTypesById[props.relationTypeId] ?? defaultRelationTypes.child;
      if (!existing) {
        const { updates } = this.createRelation({ ...props, from, to, relationType });
        allUpdates.push(...updates);
      }
      // Existing is NOT handled!!!
    }
    return allUpdates;
  }

  /**
   * Load a batch of serialized graph nodes into the store.
   * @see file://./design-notes.md#load-methods
   */
  private loadBatchedSerializedNode(nodesById: Object) {
    let allUpdates: GraphUpdate[] = [];
    for (const props of Object.values(nodesById)) {
      const existing = this.getNode(props.id);
      if (!existing) {
        const { updates } = this._addNode(props);
        allUpdates.push(...updates);
      }
      // Existing is NOT handled!!!
    }
    return allUpdates;
  }

  /**
   * Load a serialized graph into the store.
   * @see file://./design-notes.md#load-methods
   */
  private loadSerializedRelation(props: SerializedRelation): GraphRelation {
    const from = this.getObject(props.fromId) ?? new PlaceholderGraphObject(this, props.fromId, this.user.id);
    const to = this.getObject(props.toId) ?? new PlaceholderGraphObject(this, props.toId, this.user.id);
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
