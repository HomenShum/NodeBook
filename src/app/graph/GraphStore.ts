import { action, isObservable, makeObservable, observable, toJS } from "mobx";

import { MewUser, UNLOGGED_USER } from "@/app/auth/MewUser";
import { NodeType } from "@/app/editor/plugins/dropdown/utils";
import { env } from "@/app/envFrontend";
import {
  ALL_LIST_TYPES,
  defaultRelationTypes,
  getRelationTypeReverseLabel,
  ListType,
  MAX_PREFIX_LENGTH,
} from "@/app/graph/constants";
import { GraphUpdate, PartialUpdateRelationList } from "@/app/graph/GraphUpdate";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { GraphRelationType } from "@/app/graph/types";
import { UpdateManager } from "@/app/graph/UpdateManager";
import { getCanonicalPath, getNextCanonicalRelation } from "@/app/graph/utils";
import { LayerManager } from "@/app/persistence/loadGraphData";
import { serializeMap } from "@/app/persistence/serialization";
import {
  DeletedRelationData,
  MewUserPublic,
  SerializedGraphStore,
  SerializedNode,
  SerializedPositionList,
  SerializedRelation,
} from "@/app/persistence/SerializedData";
import { getAuthFetch, ObjectPath, Position, uuid } from "@/app/util";
import {
  DEFAULT_CARD_STATUSES,
  GLOBAL_ADMIN_USER_ID,
  GLOBAL_HASHTAGS_NODE_ID,
  GLOBAL_HASHTAGS_TO_USER_HASHTAGS_RELATION_ID_PREFIX,
  GLOBAL_RELATION_TYPES_NODE_ID,
  GLOBAL_ROOT_ID,
  GLOBAL_ROOT_TO_GLOBAL_TYPES_RELATION_ID,
  GLOBAL_ROOT_TO_HASHTAGS_RELATION_ID,
  GLOBAL_TO_USER_TYPES_RELATION_ID_PREFIX,
  GLOBAL_USERS_NODE_ID,
  GLOBAL_USERS_RELATION_ID,
  USER_CARD_STATUSES_NODE_ID,
  USER_MY_FAVORITES_NODE_ID_PREFIX,
  USER_MY_HASHTAGS_NODE_ID_PREFIX,
  USER_MY_STREAM_NODE_ID_PREFIX,
  USER_MY_TEMPLATES_NODE_ID_PREFIX,
  USER_RELATION_TYPES_NODE_ID_PREFIX,
  USER_ROOT_ID_PREFIX,
  USERS_TO_USER_RELATION_ID_PREFIX,
} from "@/lib/constants";
import logger from "@/lib/logger";
import { getInverseRelation } from "@/lib/relation-inverter";
import { CappedKeywordIndex, KeywordTrieIndex } from "@/lib/trie";
import { MentionTrigger, scoreMatch } from "@/lib/utils";

import { FractionalPositionedList, ItemWithPosition } from "./FractionalPositionedList";
import { AccessMode, Chip, GraphNode } from "./GraphNode";
import { GraphObject } from "./GraphObject";
import { GraphRelation, GraphRelationProps } from "./GraphRelation";
import {
  Positioner,
  TxAddChildNode,
  TxAddNode,
  TxAddRelation,
  TxAddRelationToList,
  TxAddRelationType,
  TxCombined,
  TxRemoveNode,
  TxRemoveRelation,
  TxRemoveRelationFromList,
  TxReplaceMentionChipWithTextChip,
  TxReplaceRelationLink,
  TxSetAccessMode,
  TxSetIsPublic,
  TxUpdateNode,
  TxUpdateRelation,
  TxUpdateRelationPositionsList,
} from "./GraphTransactionTypes";
import { isGraphRelationType } from "./isGraphRelationType";
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
  inFlightSearchCount: number = 0;
  user: MewUser;
  updateManager: UpdateManager;
  layerManager: LayerManager;
  refreshSearchTrigger: number = 0;
  usersById: Map<string, MewUserPublic> = new Map();
  nodesById: Map<string, GraphNode> = new Map();
  relationsById: Map<string, GraphRelation> = new Map();

  deletedNodes: Set<string> = new Set();
  deletedRelations: Set<string> = new Set();

  // This object is ONLY for the default relationtypes
  relationTypesById: Record<string, GraphRelationType> = { ...defaultRelationTypes };
  nodesInLayerLoading: Set<string> = new Set([]);

  cappedKeywordIndex: CappedKeywordIndex;
  addToast?: (toast: { title: string; description?: string; action?: { label: string; onClick: () => void } }) => void;

  constructor(
    user: MewUser = UNLOGGED_USER,
    settings?: SettingsStore,
    addToast?: (toast: {
      title: string;
      description?: string;
      action?: { label: string; onClick: () => void };
    }) => void,
  ) {
    this.user = user;
    this.settings = settings;
    this.addToast = addToast;
    this.updateManager = new UpdateManager(
      user.id,
      (data: SerializedGraphStore) => this.resetAndLoad(data),
      (updates) => this.applyUpdates(updates),
      (nodeId: string) => this.deletedNodes.delete(nodeId),
      (relationId: string) => this.deletedRelations.delete(relationId),
      env.isPersistenceEnabled && typeof fetch !== "undefined" ? getAuthFetch() : undefined,
    );
    this.layerManager = new LayerManager(this);
    this.cappedKeywordIndex = new KeywordTrieIndex(MAX_PREFIX_LENGTH);
    this.ensureDefaultObjectsCreated();
    this.makeObservable();
    // Load initial essential user objects with their first levels
    // This runs after basic setup to ensure all necessary objects are available
    if (!user.isAnonymous && env.isPersistenceEnabled) {
      this.layerManager.loadInitial().catch((e) => {
        logger.error("Failed to load initial user data", e);
      });
    }
  }

  makeObservable() {
    if (!isObservable(this)) {
      makeObservable(this, {
        refreshSearchTrigger: observable,
        inFlightSearchCount: observable,
        nodesInLayerLoading: observable,
        updateInFlightSearchCount: action,
        setNodeLayerLoadingStatus: action,
        incrementSearchTrigger: action,
        load: action,
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

  get homeRoot(): GraphNode {
    return this.user.isAnonymous ? this.globalRoot : this.userRoot;
  }

  get myHashtagsNodeId(): string {
    return USER_MY_HASHTAGS_NODE_ID_PREFIX + this.user.id;
  }

  get myHashtagsNode(): GraphNode {
    const node = this.nodesById.get(this.myHashtagsNodeId);
    if (!node) throw new Error(`My hashtags node with id ${this.myHashtagsNodeId} not found`);
    return node;
  }

  get myTemplatesNodeId(): string {
    return USER_MY_TEMPLATES_NODE_ID_PREFIX + this.user.id;
  }

  get myTemplatesNode(): GraphNode {
    const node = this.nodesById.get(this.myTemplatesNodeId);
    if (!node) throw new Error(`My templates node with id ${this.myTemplatesNodeId} not found`);
    return node;
  }

  get myFavoritesNodeId(): string {
    return USER_MY_FAVORITES_NODE_ID_PREFIX + this.user.id;
  }

  get myFavoritesNode(): GraphNode {
    const node = this.nodesById.get(this.myFavoritesNodeId);
    if (!node) {
      throw new Error("My favorites node not found");
    }
    return node;
  }

  get myStreamNodeId(): string {
    return USER_MY_STREAM_NODE_ID_PREFIX + this.user.id;
  }

  get myStreamNode(): GraphNode {
    const node = this.nodesById.get(this.myStreamNodeId);
    if (!node) {
      throw new Error("My stream node not found");
    }
    return node;
  }

  get relationTypesNodeId(): string {
    return USER_RELATION_TYPES_NODE_ID_PREFIX + this.user.id;
  }

  get relationTypesNode(): GraphNode {
    const node = this.nodesById.get(this.relationTypesNodeId);
    if (!node) {
      throw new Error("Relation types node not found");
    }
    return node;
  }

  get cardStatusesNodeId(): string {
    return USER_CARD_STATUSES_NODE_ID + this.user.id;
  }

  get cardStatusesNode(): GraphNode {
    const node = this.nodesById.get(this.cardStatusesNodeId);
    if (!node) {
      throw new Error("Card statuses node not found");
    }
    return node;
  }

  get usersNode(): GraphNode {
    const node = this.nodesById.get(GLOBAL_USERS_NODE_ID);
    if (!node) {
      throw new Error("Users node not found");
    }
    return node;
  }

  get globalToUsersRelation(): GraphRelation {
    const relation = this.relationsById.get(GLOBAL_USERS_RELATION_ID);
    if (!relation) {
      throw new Error("Global to users relation not found");
    }
    return relation;
  }

  get usersToUserRelationId(): string {
    return USERS_TO_USER_RELATION_ID_PREFIX + this.user.id;
  }

  get usersToUserRelation(): GraphRelation {
    const relation = this.relationsById.get(this.usersToUserRelationId);
    if (!relation) {
      throw new Error("Global to user relation not found");
    }
    return relation;
  }

  getAllUserNodes() {
    const nodes: GraphNode[] = [];
    for (const node of this.nodesById.values()) {
      if (node.isUserNode) {
        nodes.push(node);
      }
    }
    return nodes;
  }

  getUserNodeByAuthorId(authorId: string) {
    return this.nodesById.get(USER_ROOT_ID_PREFIX + authorId);
  }

  /**
   * The default place to put a user in the graph.
   */
  getDefaultRootForUser(): ObjectPath {
    if (this.user.isAnonymous) {
      // Send anonymous users to the global root
      return getCanonicalPath(this.globalRoot);
    }
    return getCanonicalPath(this.userRoot);
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
          this._updateRelationList(update.nodeId, update.type, update.relationId, update.newPosition);
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
  applyCombinedTransaction(txs: TxCombined) {
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
        case "addRelationToList": {
          const { updates } = this._addRelationToList(tx.transaction);
          updatesArray.push(...updates);
          break;
        }
        case "removeRelationFromList": {
          const { updates } = this._removeRelationFromList(tx.transaction);
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
  private _addNode(props: TxAddNode["nodeProps"] = {}): { node: GraphNode; updates: GraphUpdate[] } {
    let node: GraphNode | undefined;

    try {
      node = new GraphNode(this, {
        version: props.version ?? 1,
        id: props.id ?? uuid(),
        authorId: props.authorId ?? this.user.id,
        content: props.content,
        isPublic: !!(props.isPublic || (this.settings && this.settings.publicMode)),
        isNewRelatedObjectsPublic: !!props.isNewRelatedObjectsPublic,
        isChecked: props.isChecked ?? null,
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? new Date(),
        canonicalRelationId: props.canonicalRelationId,
        accessMode: props.accessMode ?? AccessMode.READ,
        attributes: props.attributes || {},
        relationCount: props.relationCount ?? 0,
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

    let isNewRelatedObjectsPublic =
      (tx.nodeProps && tx.nodeProps.isNewRelatedObjectsPublic) ||
      (wannaBeParent instanceof GraphNode && wannaBeParent.isNewRelatedObjectsPublic);

    try {
      const { node, updates: newNodeUpdates } = this._addNode({
        ...tx.nodeProps,
        isPublic: tx.nodeProps?.isPublic || isNewRelatedObjectsPublic,
        isNewRelatedObjectsPublic,
      });
      newNode = node;
      updates.push(...newNodeUpdates);

      const { relation, updates: newRelationUpdates } = this._addRelation({
        id: tx.relationProps?.id,
        fromId: wannaBeParent.id,
        toId: newNode.id,
        relationTypeId: tx.relationProps?.relationTypeId,
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
    const canonicalRelationId = tx.nodeProps.canonicalRelationId ?? node.canonicalRelationId;
    const updates: GraphUpdate[] = [];

    // If content is being updated, check for removed mention chips
    if (tx.nodeProps.content !== undefined) {
      const oldContent = node.content;
      const newContent =
        typeof tx.nodeProps.content === "string"
          ? [{ type: "text", value: tx.nodeProps.content }]
          : tx.nodeProps.content;

      // Find mention chips that were removed
      const oldMentionChips = oldContent.filter(
        (chip): chip is { type: "mention"; value: string; mentionTrigger?: MentionTrigger } => chip.type === "mention",
      );
      const newMentionChips = newContent.filter(
        (chip): chip is { type: "mention"; value: string; mentionTrigger?: MentionTrigger } => chip.type === "mention",
      );
      const replacedMentionChips = newContent.filter(
        (chip): chip is { type: "text"; value: string } => chip.type === "text" && chip.value[0] === "#",
      );

      // For each removed mention chip, delete its hashtag relation
      for (const oldChip of oldMentionChips) {
        if (!newMentionChips.some((newChip) => newChip.value === oldChip.value)) {
          const mentionNode = this.nodesById.get(oldChip.value);
          if (mentionNode && replacedMentionChips.some((newChip) => newChip.value === mentionNode.text)) {
            // If the mention chip was replaced with a text chip, don't delete the relation
            // because the relation will be deleted when the mention node is deleted in updateNode
            // We know when its replaced when the mention chip is replaced with a text chip with the same text
            continue;
          }
          // Find and delete the hashtag relation
          const hashtagRelations = node.relations.filter(
            (r) => r.to.id === oldChip.value && r.relationType.label.toLowerCase() === "has hashtag",
          );

          // Find and delete regular mention relations (relatedTo relations from mentioned node to current node)
          const mentionRelations = node.relations.filter(
            (r) => r.from.id === oldChip.value && r.relationType.label.toLowerCase() === "relates to",
          );

          const relations = [...hashtagRelations, ...mentionRelations];
          if (relations.length > 0) {
            const hashtagNode = this.nodesById.get(relations[0].to.id);
            if (hashtagNode && relations.length === hashtagNode.relationCount - 1) {
              // If the hashtag node has no relations left, notify the user with a toast that gives
              // them the option to delete it.
              this.addToast?.({
                title: `Hashtag node has no hashtag relations left`,
                description: `Would you like to delete ${hashtagNode.text}?`,
                action: {
                  label: "Delete",
                  onClick: () => {
                    this.removeNode({ nodeId: hashtagNode.id });
                  },
                },
              });
            }
          }

          for (const relation of relations) {
            if (this.relationsById.has(relation.id)) {
              const { updates: deleteUpdates } = this.deleteRelation(relation);
              updates.push(...deleteUpdates);
            }
          }
        }
      }
    }

    node.update({ ...tx.nodeProps, canonicalRelationId });

    updates.push({
      operation: "updateNode",
      oldProps,
      newProps: node.serialize(),
    });

    return { updates };
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

  async setAppendMode(tx: TxSetAccessMode): Promise<void> {
    const { updates } = this._setAppendMode(tx);
    this.updateManager.queueUpdates(updates);
  }

  private _setAppendMode({ objectId, accessMode }: TxSetAccessMode): { updates: GraphUpdate[] } {
    const object = this.getObject(objectId);
    if (!object) {
      throw new Error(`Object with id ${objectId} does not exist`);
    }
    // Don't try to set access mode for other people's objects
    if (object.authorId !== this.user.id) return { updates: [] };

    // Only update for GraphNode or when accessMode changes
    if (!(object instanceof GraphNode) || accessMode === object.accessMode) return { updates: [] };

    const updates: GraphUpdate[] = [];
    object.update({ accessMode });
    updates.push({
      operation: "updateNode",
      oldProps: object.serialize(),
      newProps: { ...object.serialize(), accessMode },
    });

    return { updates };
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
    isNewRelatedObjectsPublic,
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

    const { updates: objectUpdates } = this._setObjectIsPublic(object, isPublic, {
      isNewRelatedObjectsPublic,
    });
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
        if (rel.id === relationId) continue;
        // First set the value on the relation itself
        const { updates: relUpdates } = this._setObjectIsPublic(rel, isPublic);
        updates.push(...relUpdates);
        // Relation types are set by default since the relation types are just relations connected to nodes.

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

  private _setObjectIsPublic(
    object: GraphObject,
    isPublic: boolean,
    optionals: {
      isNewRelatedObjectsPublic?: boolean;
    } = {},
  ): { updates: GraphUpdate[] } {
    // Don't try to set public status for other people's objects
    if (object.authorId !== this.user.id) return { updates: [] };

    const isNewRelatedObjectsPublic: boolean = !!optionals.isNewRelatedObjectsPublic;

    // If object is already desired state, do nothing
    if (
      (object instanceof GraphNode &&
        object.isPublic === isPublic &&
        object.isNewRelatedObjectsPublic === isNewRelatedObjectsPublic) ||
      (!(object instanceof GraphNode) && object.isPublic === isPublic)
    )
      return { updates: [] };

    const updates: GraphUpdate[] = [];

    switch (object.objectType) {
      case "node":
        const nodeAtStart = object.serialize();
        object.update({ isPublic, isNewRelatedObjectsPublic });
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
        // If relation type is private and we're making the relation public, the relation type
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
    props: { id?: string; version?: number; label: string | Chip[]; reverseLabel?: string; isPublic?: boolean },
    fromServer = false,
  ): { relationType: GraphRelationType; updates: GraphUpdate[] } {
    // if (props.id && props.id in defaultRelationTypes) {
    //   const id = props.id ?? uuid();
    //   if (this.relationTypesById[id] && !fromServer) {
    //     throw new Error(`Relation type with id ${props.id} already exists`);
    //   }
    //   const version = props.version ?? 1;
    //   let label = props.label.trim().replace(/\s*\n\s*/g, " ");
    //   let reverseLabel = props.reverseLabel?.trim().replace(/\s*\n\s*/g, " ");
    //   if (!reverseLabel) {
    //     reverseLabel = getInverseRelation(label);
    //   }

    //   const newRelationType = {
    //     version,
    //     id,
    //     authorId: this.user.id,
    //     label,
    //     reverseLabel,
    //     isPublic: props.isPublic ?? true,
    //   };
    //   this.relationTypesById[id] = newRelationType;
    //   this.cappedKeywordIndex.add(newRelationType.id, () => newRelationType.label + " " + newRelationType.reverseLabel);
    //   const updates: GraphUpdate[] = [
    //     {
    //       operation: "addRelationType",
    //       relationType: newRelationType,
    //     },
    //   ];
    //   return { relationType: newRelationType, updates };
    // } else {
    const updates: GraphUpdate[] = [];
    // If it's not a default relationtype, then we instead add a child to the relationTypesNode
    const id = props.id ?? uuid();
    const relId = uuid();
    const authorId = this.user.id;

    let label = typeof props.label === "string" ? props.label.trim().replace(/\s*\n\s*/g, " ") : props.label;
    let reverseLabel: string | Chip[] | undefined = props.reverseLabel?.trim().replace(/\s*\n\s*/g, " ");
    if (!reverseLabel) {
      reverseLabel = getInverseRelation(label);
    }
    let { updates: relTypeUpdates } = this._addChildNode({
      parentId: this.relationTypesNodeId,
      nodeProps: {
        id,
        content: typeof label === "string" ? [{ type: "text", value: label }] : label,
        isPublic: props.isPublic ?? true,
      },
      relationProps: {
        id: relId,
        relationTypeId: defaultRelationTypes.sublist.id,
        isPublic: props.isPublic ?? true,
      },
    });
    updates.push(...relTypeUpdates);
    let { updates: revTypeUpdates } = this._addChildNode({
      parentId: id,
      relationProps: {
        relationTypeId: defaultRelationTypes.__reverse__.id,
        isPublic: props.isPublic ?? true,
      },
      nodeProps: {
        content: typeof reverseLabel === "string" ? [{ type: "text", value: reverseLabel }] : reverseLabel,
        isPublic: props.isPublic ?? true,
      },
    });
    updates.push(...revTypeUpdates);
    this.relationTypesById[id] = {
      id: id,
      version: 1,
      authorId: authorId,
      label:
        typeof label === "string" ? label : label.map((chip) => (chip.type === "image" ? "" : chip.value)).join(" "),
      reverseLabel:
        typeof reverseLabel === "string"
          ? reverseLabel
          : reverseLabel.map((chip) => (chip.type === "image" ? "" : chip.value)).join(" "),
      isPublic: props.isPublic ?? true,
    };

    return { relationType: this.relationTypesById[id], updates };
    // }
  }

  getRelationTypeFacing(direction: "forward" | "reverse", id?: string, node?: GraphNode) {
    const relTypeNode = id ? this.getNode(id) : node;
    if (relTypeNode) {
      const reverseRelations = relTypeNode.relations.filter(
        (relation) => relation.relationTypeId === defaultRelationTypes.__reverse__.id,
      );
      if (reverseRelations.length != 1) {
        throw new Error(`Relation type node with id ${id} has 0 or multiple reverse labelled relations`);
      }
      const reverseRelation = reverseRelations[0];
      if (direction === "forward") {
        return reverseRelation.from.id;
      } else {
        return reverseRelation.to.id;
      }
    } else {
      throw new Error(`Cannot find relation type node with id ${id}`);
    }
  }

  async renameRelationType(id: string, newLabel: string, newReverseLabel?: string) {
    // If newReverseLabel is null or undefined, default to `${newLabel} of`
    const newReverseLabelOrDefault = newReverseLabel ?? `${newLabel} of`;
    const { relationType, updates } = this._updateRelationType(id, {
      label: newLabel,
      reverseLabel: newReverseLabelOrDefault,
    });
    this.relationTypesById[id] = relationType;
    this.updateManager.queueUpdates(updates);
  }

  private _updateRelationType(
    id: string,
    props: { label?: string; reverseLabel?: string; isPublic?: boolean },
  ): { relationType: GraphRelationType; updates: GraphUpdate[] } {
    const maybeGraphNode = this.getNode(id);
    // if (!(maybeGraphNode && graphNodeIsCustomRelType(maybeGraphNode)) && id in defaultRelationTypes) {
    //   if (!this.relationTypesById[id]) {
    //     throw new Error(`Relation type with id ${id} does not exist`);
    //   }
    //   const oldProps = { ...this.relationTypesById[id] };
    //   const newProps = { ...oldProps, ...props, version: oldProps.version + 1 };
    //   this.relationTypesById[id] = newProps;
    //   this.cappedKeywordIndex.add(newProps.id, () => newProps.label + " " + newProps.reverseLabel);
    //   const updates: GraphUpdate[] = [
    //     {
    //       operation: "updateRelationType",
    //       oldProps,
    //       newProps,
    //     },
    //   ];
    //   return { relationType: this.relationTypesById[id], updates };
    // } else
    if (maybeGraphNode) {
      // id is the node id of the custom relation type
      const updates: GraphUpdate[] = [];
      const fwNodeId = this.getRelationTypeFacing("forward", id);
      const revNodeId = this.getRelationTypeFacing("reverse", id);

      if (props.label) {
        const { updates: labelNodeUpdates } = this._updateNode({
          nodeId: fwNodeId,
          nodeProps: {
            content: [{ type: "text", value: props.label }],
          },
        });
        updates.push(...labelNodeUpdates);
      }
      if (props.reverseLabel) {
        const { updates: revLabelNodeUpdates } = this._updateNode({
          nodeId: revNodeId,
          nodeProps: {
            content: [{ type: "text", value: props.reverseLabel }],
          },
        });
        updates.push(...revLabelNodeUpdates);
      }
      if (props.isPublic) {
        const { updates: publicFwUpdates } = this._updateNode({
          nodeId: fwNodeId,
          nodeProps: {
            isPublic: props.isPublic,
          },
        });
        const { updates: publicRevUpdates } = this._updateNode({
          nodeId: revNodeId,
          nodeProps: {
            isPublic: props.isPublic,
          },
        });
        updates.push(...publicFwUpdates);
        updates.push(...publicRevUpdates);
      }

      const origFwNode = this.getNodeOrThrow(fwNodeId);
      const origLabel = origFwNode.content[0].type === "image" ? "" : origFwNode.content[0].value;
      const origRevNode = this.getNodeOrThrow(revNodeId);
      const origRevLabel = origRevNode.content[0].type === "image" ? "" : origRevNode.content[0].value;
      const origPublic = origFwNode.isPublic;

      const relationType: GraphRelationType = {
        isPublic: props.isPublic !== undefined ? props.isPublic : origPublic,
        label: props.label ? props.label : origLabel,
        reverseLabel: props.reverseLabel ? props.reverseLabel : origRevLabel,
        authorId: origFwNode.authorId,
        version: origFwNode.version,
        id: id,
      };
      return { relationType, updates };
    } else {
      throw new Error("Unhandled case");
    }
  }

  // private _deleteRelationType(id: string): GraphUpdate[] {
  //   const updates: GraphUpdate[] = [];
  //   // find all relations with this type and set them to a default type
  //   for (const rel of this.relationsById.values()) {
  //     if (rel.relationType.id !== id) continue;
  //     updates.push(...this.setRelationType(rel, this.relationTypesById.child));
  //     if (rel.hasCustomTypeRelation && rel.customTypeRelation) {
  //       const { updates: removalUpdates } = this._removeRelation({ relationId: rel.customTypeRelation.id });
  //       updates.push(...removalUpdates);
  //     }
  //   }
  //   updates.push({
  //     operation: "deleteRelationType",
  //     relationType: { ...this.relationTypesById[id] },
  //   });
  //   delete this.relationTypesById[id];
  //   this.cappedKeywordIndex.delete(id);
  //   return updates;
  // }

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
    // Get the relation type. If they didn't specify a relation type, or we don't have it, use the child relation type.
    let relationType: GraphRelationType;
    if (tx.relationTypeId && !this.relationTypesById[tx.relationTypeId]) {
      logger.warn(`Relation type with id ${tx.relationTypeId} does not exist. Using child relation type instead.`);
      relationType = this.relationTypesById.child;
    } else if (!tx.relationTypeId) {
      relationType = this.relationTypesById.child;
    } else {
      relationType = this.relationTypesById[tx.relationTypeId];
    }

    // TODO: simplify further and make it similar to _addNode()
    return this.createRelation(
      {
        id: tx.id,
        from,
        to,
        relationType,
        relationCount: tx.relationCount ?? 0,
        retainRelationCount: tx.retainRelationCount ?? false,
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

    let oldRelationTypeId;
    if (relation.hasCustomTypeRelation) {
      oldRelationTypeId = relation.customTypeRelation?.to.id;
    } else {
      oldRelationTypeId = oldProps.relationTypeId;
    }

    if (oldRelationTypeId) {
      oldProps.relationTypeId = oldRelationTypeId;
    }

    let newRelationTypeId;
    if (tx.relationProps?.relationType?.id !== undefined) {
      newRelationTypeId = tx.relationProps?.relationType?.id;
    } else if (oldRelationTypeId) {
      newRelationTypeId = oldRelationTypeId;
    } else {
      newRelationTypeId = oldProps.relationTypeId;
    }

    const newProps = {
      ...oldProps,
      isPublic: tx.relationProps?.isPublic ?? oldProps.isPublic,
      relationTypeId: newRelationTypeId, //tx.relationProps?.relationType?.id ?? oldProps.relationTypeId,
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
          label: tx.relationProps.relationTypeChips
            ? tx.relationProps.relationTypeChips
            : tx.relationProps.relationTypeLabel,
          isPublic: true,
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

    const updates: GraphUpdate[] = [];
    const isReversal = oldFrom && oldTo && newFrom && newTo && oldFrom.id === newTo.id && oldTo.id === newFrom.id;

    const newRelTypeIsDefault = newProps.relationTypeId in defaultRelationTypes;
    const oldRelTypeWasDefault = oldProps.relationTypeId in defaultRelationTypes;
    if (newRelTypeIsDefault && oldRelTypeWasDefault) {
      const newRelationType = this.relationTypesById[newProps.relationTypeId];
      if (!newRelationType) {
        throw new Error(
          `Error setting "relationTypeId" property of ${relation.id}: relation type with id ${newProps.relationTypeId} does not exist`,
        );
      }

      propsForUpdate.relationType = newRelationType;
    } else if (!newRelTypeIsDefault && oldRelTypeWasDefault) {
      // Create a new relation from the relation to-be-updated to the relationType node
      const relationTypeNode = this.getNodeOrThrow(newProps.relationTypeId);
      const { updates: newRelationUpdates } = this._addRelation({
        fromId: newProps.id,
        toId: relationTypeNode.id,
        relationTypeId: defaultRelationTypes.__type__.id,
      });
      propsForUpdate.relationType = this.relationTypesById["child"];

      updates.push(...newRelationUpdates);
    } else if (newRelTypeIsDefault && !oldRelTypeWasDefault) {
      // Remove the __type__ relation
      const typeRelation = relation.customTypeRelation;
      if (!typeRelation) {
        throw new Error("customTypeRelation not found");
      }
      const { updates: removeRelUpdates } = this._removeRelation({ relationId: typeRelation.id });
      updates.push(...removeRelUpdates);
      // Business as usual
      const newRelationType = this.relationTypesById[newProps.relationTypeId];
      if (!newRelationType) {
        throw new Error(
          `Error setting "relationTypeId" property of ${relation.id}: relation type with id ${newProps.relationTypeId} does not exist`,
        );
      }
      propsForUpdate.relationType = newRelationType;
    } else if (!newRelTypeIsDefault && !oldRelTypeWasDefault) {
      // Update the __type__ relation to point to the new relationType node

      if (newProps.relationTypeId !== oldProps.relationTypeId) {
        const typeRelation = relation.customTypeRelation;
        if (!typeRelation) {
          throw new Error("customTypeRelation not found");
        }
        const newTypeNode = this.getNodeOrThrow(newProps.relationTypeId);
        const { updates: relationTypeUpdates } = this._replaceRelationLink({
          direction: "to",
          relationId: typeRelation.id,
          replaceWith: { type: "existing-object", id: newTypeNode.id },
        });

        updates.push(...relationTypeUpdates);
      }
    }

    if (isReversal || (newRelTypeIsDefault && oldRelTypeWasDefault)) {
      updates.push({
        operation: "updateRelation",
        oldProps,
        newProps,
      });
    }

    relation.update(propsForUpdate);

    // In case we're calling this method from `undo` or `redo` (but probably better to rewrite this)
    if (noUpdatesNeeded) return [];

    if (newFrom && !isReversal) {
      if (!oldFrom || !oldFromPositionBefore) throw new Error("oldFrom should be defined if newFrom is defined");

      const newFromPosition = this.getRelationList(newFrom).get(relation.id)?.position;
      if (!newFromPosition) throw new Error("newFromPosition should be defined");

      updates.push({
        operation: "updateRelationList",
        authorId: this.user.id,
        nodeId: oldFrom.id,
        type: "all",
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
        type: "all",
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
        type: "all",
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
        type: "all",
        relationId: relation.id,
        oldPosition: newToPositionBefore ?? null,
        newPosition: newToPosition,
        oldIsPublic: oldProps.isPublic,
        newIsPublic: newProps.isPublic,
      });
    }

    if (!isReversal && newProps.isPublic !== oldProps.isPublic) {
      const fromPos = this.getRelationList(relation.from.id).get(relation.id)?.position;
      const toPos = this.getRelationList(relation.to.id).get(relation.id)?.position;
      updates.push({
        operation: "updateRelationList",
        authorId: this.user.id,
        nodeId: relation.from.id,
        type: "all",
        relationId: relation.id,
        oldPosition: fromPos ?? null,
        newPosition: fromPos ?? null,
        oldIsPublic: oldProps.isPublic,
        newIsPublic: newProps.isPublic,
      });
      updates.push({
        operation: "updateRelationList",
        authorId: this.user.id,
        nodeId: relation.to.id,
        type: "all",
        relationId: relation.id,
        oldPosition: toPos ?? null,
        newPosition: toPos ?? null,
        oldIsPublic: oldProps.isPublic,
        newIsPublic: newProps.isPublic,
      });
    }

    // Update relation counts when from or to objects change
    if (oldFrom && newFrom && oldFrom !== newFrom) {
      if (oldFrom instanceof GraphNode || oldFrom instanceof GraphRelation) {
        oldFrom.decrementRelationCount();
      }
      if (newFrom instanceof GraphNode || newFrom instanceof GraphRelation) {
        newFrom.incrementRelationCount();
      }
    }
    if (oldTo && newTo && oldTo !== newTo) {
      if (oldTo instanceof GraphNode || oldTo instanceof GraphRelation) {
        oldTo.decrementRelationCount();
      }
      if (newTo instanceof GraphNode || newTo instanceof GraphRelation) {
        newTo.incrementRelationCount();
      }
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

    const updates: GraphUpdate[] = [...this.deleteRelation(relation).updates];

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
    relationListType: ListType,
    relationId: string,
    newPosition: Position | null,
  ): void {
    const object = this.getObject(objectId);
    if (!object) throw new Error(`Object with id ${objectId} does not exist`);
    const relation = this.getRelation(relationId);
    if (!relation) throw new Error(`Relation with id ${relationId} does not exist`);

    const list = this.getRelationList(object, relationListType);
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
    if (node.isDeleteRestricted) {
      throw new Error("Cannot delete special node");
    }

    const updates: GraphUpdate[] = [];

    const relationsDeleted: DeletedRelationData[] = [];
    try {
      node.relations.forEach((r) => {
        const { updates: deletedUpdates, deleted } = this.deleteRelation(r);
        updates.push(...deletedUpdates);
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

    updates.push({
      operation: "deleteNode",
      node: node.serialize(),
    });

    this.deletedNodes.add(node.id);

    return updates;
  }

  private createRelation(
    relationProps: GraphRelationProps,
    after?: Positioner<GraphRelation>,
  ): { relation: GraphRelation; updates: GraphUpdate[] } {
    let relation: GraphRelation | null = null;
    let updates: GraphUpdate[] = [];

    // TODO: this is probably not as simple as relation and relation list can be authored by different users
    const authorId = relationProps.authorId || this.user.id;

    try {
      if (relationProps.id && this.relationsById.has(relationProps.id)) {
        throw new Error(`Relation with id ${relationProps.id} already exists`);
      }
      this.assertExists(relationProps.from, relationProps.to);

      const isPublic = !!(
        relationProps.isPublic ||
        this.settings?.publicMode ||
        (relationProps.from instanceof GraphNode && relationProps.from.isNewRelatedObjectsPublic) ||
        (relationProps.to instanceof GraphNode && relationProps.to.isNewRelatedObjectsPublic)
      );
      relation = new GraphRelation(this, {
        ...relationProps,
        isPublic,
        authorId,
      });
      this.setRelationsById(relation.id, relation);
      this.cappedKeywordIndex.add(relation.id, () => relation!.searchText);

      if (!relationProps.retainRelationCount) {
        // Update relation counts for both from and to objects
        if (relation.from instanceof GraphNode || relation.from instanceof GraphRelation) {
          relation.from.incrementRelationCount();
        }
        if (relation.to instanceof GraphNode || relation.to instanceof GraphRelation) {
          relation.to.incrementRelationCount();
        }
      }

      // Add relation to the `from` node's relation list
      const commonUpdatePart = { authorId, type: "all" as const, oldIsPublic: false, newIsPublic: relation.isPublic };
      const fromId = relation.from.id;
      const partialFromUpdates = relation.from.allRelationsList.add(relation);
      updates.push(...partialFromUpdates.map((update) => ({ ...update, ...commonUpdatePart, nodeId: fromId })));
      // Assign the relation as the canonical relation for the `from` node
      if (relation.from.canonicalRelationId === null) {
        const { updates: canonicalUpdates } = this.updateCanonicalRelation(relation.from, relation);
        updates.push(...canonicalUpdates);
      }

      const toId = relation.to.id;
      let partialToUpdates: PartialUpdateRelationList[] = [];
      if (fromId !== toId) {
        // Add relation to the `to` node's relation list
        partialToUpdates = relation.to.allRelationsList.add(relation);
        updates.push(...partialToUpdates.map((update) => ({ ...update, ...commonUpdatePart, nodeId: toId })));
        // Assign the relation as the canonical relation for the `to` node
        if (relation.to.canonicalRelationId === null) {
          const { updates: canonicalUpdates } = this.updateCanonicalRelation(relation.to, relation);
          updates.push(...canonicalUpdates);
        }
      }

      // We add to the start, since the update happened first, but don't create the operation
      // until now because we need the from/to positions to be set
      updates.unshift({
        operation: "addRelation",
        relation: relation.serialize(),
        fromPos: relation.fromPosition,
        toPos: relation.toPosition,
      });

      if (
        !relationProps.to.isPublic &&
        relationProps.to instanceof GraphNode &&
        relationProps.from.isPublic &&
        relationProps.from instanceof GraphNode &&
        relationProps.from.isNewRelatedObjectsPublic
      ) {
        const nodeUpdates = this._updateNode({
          nodeId: relationProps.to.id,
          nodeProps: {
            isPublic: true,
            isNewRelatedObjectsPublic: true,
          },
        });
        for (const nodeUpdate of nodeUpdates.updates) {
          updates.push(nodeUpdate);
        }
      }

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

        // Rollback relation count changes
        if (relation.from instanceof GraphNode || relation.from instanceof GraphRelation) {
          relation.from.decrementRelationCount();
        }
        if (relation.to instanceof GraphNode || relation.to instanceof GraphRelation) {
          relation.to.decrementRelationCount();
        }

        if (relation.from.canonicalRelation === relation) {
          const { updates: canonicalUpdates } = this.updateCanonicalRelation(relation.from);
          updates.push(...canonicalUpdates);
        }
        if (relation.to.canonicalRelation === relation) {
          const { updates: canonicalUpdates } = this.updateCanonicalRelation(relation.to);
          updates.push(...canonicalUpdates);
        }
      }
      throw e;
    }
  }

  deleteFromRelationsById(id: string): boolean {
    return this.relationsById.delete(id);
  }

  setRelationsById(id: string, relation: GraphRelation) {
    this.relationsById.set(id, relation);
  }

  private deleteRelation(relationOrId: GraphRelation | string): {
    updates: GraphUpdate[];
    deleted: DeletedRelationData;
  } {
    const relation = typeof relationOrId === "string" ? this.getRelation(relationOrId) : relationOrId;
    if (!relation) {
      throw new Error("Relation does not exist");
    }
    if (relation.id.startsWith(USERS_TO_USER_RELATION_ID_PREFIX)) {
      throw new Error("Cannot delete relation from users to user");
    }
    const updates: GraphUpdate[] = [];

    const deleted: DeletedRelationData = {
      relation: relation.serialize(),
      fromPos: relation.fromPosition,
      fromPinnedPos: relation.fromPinnedPosition,
      fromNoteContentPos: relation.fromNoteContentPosition,
      toPos: relation.toPosition,
      toPinnedPos: relation.toPinnedPosition,
      toNoteContentPos: relation.toNoteContentPosition,
      relationsList: [],
    };
    try {
      // Delete relations to this relation
      for (const rel of relation.relations) {
        const { deleted: deletedData, updates: deleteRelationUpdates } = this.deleteRelation(rel);
        deleted.relationsList.push(deletedData);
        updates.push(...deleteRelationUpdates);
      }

      const { from: fromNode, to: toNode } = relation;

      // Remove the relation from the nodes
      fromNode.allRelationsList.delete(relation.id);
      if (fromNode.canonicalRelationId === relation.id) {
        const { updates: canonicalUpdates } = this.updateCanonicalRelation(fromNode);
        updates.push(...canonicalUpdates);
      }
      toNode.allRelationsList.delete(relation.id);
      if (toNode.canonicalRelationId === relation.id) {
        const { updates: canonicalUpdates } = this.updateCanonicalRelation(toNode);
        updates.push(...canonicalUpdates);
      }

      // Replace mention chip with text chip if relation is a hashtag relation
      if (relation.relationType.label.toLowerCase() === "has hashtag") {
        const { updates: mentionUpdates } = this._replaceMentionChipWithTextChip({
          relationId: relation.id,
        });
        updates.push(...mentionUpdates);
      }
      let curUpdates = fromNode.pinnedRelationsList.delete(relation.id);
      if (curUpdates.length > 0) {
        updates.push({
          type: "pinned",
          nodeId: fromNode.id,
          authorId: relation.authorId,
          oldIsPublic: fromNode.isPublic,
          newIsPublic: fromNode.isPublic,
          ...curUpdates[0],
        });
      }

      curUpdates = toNode.pinnedRelationsList.delete(relation.id);
      if (curUpdates.length > 0) {
        updates.push({
          type: "pinned",
          nodeId: toNode.id,
          authorId: relation.authorId,
          oldIsPublic: toNode.isPublic,
          newIsPublic: toNode.isPublic,
          ...curUpdates[0],
        });
      }

      curUpdates = fromNode.noteContentRelationsList.delete(relation.id);
      if (curUpdates.length > 0) {
        updates.push({
          type: "noteContent",
          nodeId: fromNode.id,
          authorId: relation.authorId,
          oldIsPublic: fromNode.isPublic,
          newIsPublic: fromNode.isPublic,
          ...curUpdates[0],
        });
      }

      curUpdates = toNode.noteContentRelationsList.delete(relation.id);

      if (curUpdates.length > 0) {
        updates.push({
          type: "noteContent",
          nodeId: toNode.id,
          authorId: relation.authorId,
          oldIsPublic: toNode.isPublic,
          newIsPublic: toNode.isPublic,
          ...curUpdates[0],
        });
      }

      this.deletedRelations.add(relation.id);

      // Delete the relation itself
      this.deleteFromRelationsById(relation.id);
      this.cappedKeywordIndex.delete(relation.id);

      // Update relation counts for both from and to objects
      if (fromNode instanceof GraphNode || fromNode instanceof GraphRelation) {
        fromNode.decrementRelationCount();
      }
      if (toNode instanceof GraphNode || toNode instanceof GraphRelation) {
        toNode.decrementRelationCount();
      }
    } catch (e) {
      if (!this.relationsById.has(relation.id)) {
        this.relationsById.set(relation.id, relation);
        this.cappedKeywordIndex.add(relation.id, () => relation.searchText);
      }
      this.setRelationPositions(relation, deleted);
      deleted.relationsList.forEach((relData) => {
        this.restoreRelation(relData);
      });
      throw e;
    }
    updates.push({
      operation: "deleteRelation",
      deleted: deleted,
    });
    return { updates, deleted };
  }

  private restoreRelation({
    relation: serializedRelation,
    fromPos,
    fromPinnedPos,
    fromNoteContentPos,
    toPos,
    toPinnedPos,
    toNoteContentPos,
    relationsList,
  }: DeletedRelationData) {
    const relation = this.loadSerializedRelation(serializedRelation);
    this.setRelationsById(relation.id, relation);
    this.cappedKeywordIndex.add(relation.id, () => relation.searchText);

    // Restore relation counts for both from and to objects
    if (relation.from instanceof GraphNode || relation.from instanceof GraphRelation) {
      relation.from.incrementRelationCount();
    }
    if (relation.to instanceof GraphNode || relation.to instanceof GraphRelation) {
      relation.to.incrementRelationCount();
    }

    this.setRelationPositions(relation, {
      fromPos,
      fromPinnedPos,
      fromNoteContentPos,
      toPos,
      toPinnedPos,
      toNoteContentPos,
    });
    for (const rel of relationsList) {
      this.restoreRelation(rel);
    }
  }

  private setRelationPositions(
    relation: GraphRelation,
    positions: {
      fromPos?: Position;
      fromPinnedPos?: Position;
      fromNoteContentPos?: Position;
      toPos?: Position;
      toPinnedPos?: Position;
      toNoteContentPos?: Position;
    },
  ) {
    const { fromPos, fromPinnedPos, fromNoteContentPos, toPos, toPinnedPos, toNoteContentPos } = positions;
    if (fromPos) {
      relation.from.allRelationsList.undoDelete({
        item: relation,
        position: fromPos,
      });
    }
    if (fromPinnedPos) {
      relation.from.pinnedRelationsList.undoDelete({
        item: relation,
        position: fromPinnedPos,
      });
    }
    if (fromNoteContentPos) {
      relation.from.noteContentRelationsList.undoDelete({
        item: relation,
        position: fromNoteContentPos,
      });
    }
    if (toPos) {
      relation.to.allRelationsList.undoDelete({
        item: relation,
        position: toPos,
      });
    }
    if (toPinnedPos) {
      relation.to.pinnedRelationsList.undoDelete({
        item: relation,
        position: toPinnedPos,
      });
    }
    if (toNoteContentPos) {
      relation.to.noteContentRelationsList.undoDelete({
        item: relation,
        position: toNoteContentPos,
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
    if (relation.id.startsWith(USERS_TO_USER_RELATION_ID_PREFIX)) {
      throw new Error("Cannot replace relation from users to user");
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

    // Remove the relation from all the lists it shouldn't belong to anymore
    ALL_LIST_TYPES.forEach((listType) => {
      const { updates: removeListUpdates } = this._removeRelationFromList({
        objectId: tx.direction === "from" ? relation.from.id : relation.to.id,
        relationId: relation.id,
        listType: listType,
      });
      updates.push(...removeListUpdates);
    });

    if (tx.direction === "from") {
      updates.push(...this.setRelationFrom(relation, newObject, false, tx.after));
    } else {
      updates.push(...this.setRelationTo(relation, newObject, false, tx.after));
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

    let relationsList: FractionalPositionedList<GraphRelation> = withinNode.allRelationsList;
    switch (tx.groupId) {
      case "pinned":
        relationsList = withinNode.pinnedRelationsList;
        break;
      case "noteContent":
        relationsList = withinNode.noteContentRelationsList;
        break;
      case "all":
      case "pointer":
        break;
      default:
        tx.groupId satisfies never;
    }
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
          type: tx.groupId === "pinned" ? "pinned" : tx.groupId === "noteContent" ? "noteContent" : "all",
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
    retainRelationCount: boolean,
    after?: Positioner<GraphRelation>,
  ): GraphUpdate[] {
    if (relation.from === newFrom) {
      return [];
    }
    const updates: GraphUpdate[] = [];
    try {
      const oldRelation = relation.serialize();
      const oldFrom = relation.from;
      const oldFromPosition = this.getRelationList(oldFrom).get(relation.id)?.position ?? null;

      if (!retainRelationCount) {
        if (newFrom instanceof GraphNode) {
          updates.push({
            operation: "updateNode",
            oldProps: newFrom.serialize(),
            newProps: { ...newFrom.serialize(), relationCount: newFrom.relationCount + 1 },
          });
          newFrom.incrementRelationCount();
        } else if (newFrom instanceof GraphRelation) {
          updates.push({
            operation: "updateRelation",
            oldProps: newFrom.serialize(),
            newProps: { ...newFrom.serialize(), relationCount: newFrom.relationCount + 1 },
          });
          newFrom.incrementRelationCount();
        }

        if (oldFrom instanceof GraphNode) {
          updates.push({
            operation: "updateNode",
            oldProps: oldFrom.serialize(),
            newProps: { ...oldFrom.serialize(), relationCount: oldFrom.relationCount - 1 },
          });
          oldFrom.decrementRelationCount();
        } else if (oldFrom instanceof GraphRelation) {
          updates.push({
            operation: "updateRelation",
            oldProps: oldFrom.serialize(),
            newProps: { ...oldFrom.serialize(), relationCount: oldFrom.relationCount - 1 },
          });
          oldFrom.decrementRelationCount();
        }
      }
      // remove this relation from the current "from" node's relation list, unless it's a circular relation
      if (relation.to.id != relation.from.id) {
        relation.from.allRelationsList.delete(relation.id);
        if (relation.from.canonicalRelationId === relation.id) {
          const { updates: canonicalUpdates } = this.updateCanonicalRelation(relation.from);
          updates.push(...canonicalUpdates);
        }
        relation.from.pinnedRelationsList.delete(relation.id);
        relation.from.noteContentRelationsList.delete(relation.id);
      }
      relation.update({ from: newFrom, version: relation.version });

      relation.from.allRelationsList.add(relation, after);
      if (relation.from.canonicalRelationId === null) {
        const { updates: canonicalUpdates } = this.updateCanonicalRelation(relation.from, relation);
        updates.push(...canonicalUpdates);
      }

      updates.push({
        operation: "updateRelation",
        oldProps: oldRelation,
        newProps: relation.serialize(),
      });
      updates.push({
        operation: "updateRelationList",
        authorId: this.user.id,
        nodeId: oldFrom.id,
        type: "all",
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
        type: "all",
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
  private setRelationTo(
    relation: GraphRelation,
    newTo: GraphObject,
    retainRelationCount: boolean,
    after?: Positioner<GraphRelation>,
  ): GraphUpdate[] {
    if (relation.to === newTo) {
      return [];
    }
    const updates: GraphUpdate[] = [];
    try {
      const oldRelation = relation.serialize();
      const oldTo = relation.to;
      const oldToPosition = this.getRelationList(oldTo).get(relation.id)?.position ?? null;

      // remove this relation from the current "to" node's relation list, unless it's a circular relation
      if (relation.from.id != relation.to.id) {
        relation.to.allRelationsList.delete(relation.id);
        if (relation.to.canonicalRelationId === relation.id) {
          const { updates: canonicalUpdates } = this.updateCanonicalRelation(relation.to);
          updates.push(...canonicalUpdates);
        }
        relation.to.pinnedRelationsList.delete(relation.id);
        relation.to.noteContentRelationsList.delete(relation.id);
      }
      relation.update({ to: newTo, version: relation.version });

      if (!retainRelationCount) {
        if (newTo instanceof GraphNode) {
          updates.push({
            operation: "updateNode",
            oldProps: newTo.serialize(),
            newProps: { ...newTo.serialize(), relationCount: newTo.relationCount + 1 },
          });
          newTo.incrementRelationCount();
        } else if (newTo instanceof GraphRelation) {
          updates.push({
            operation: "updateRelation",
            oldProps: newTo.serialize(),
            newProps: { ...newTo.serialize(), relationCount: newTo.relationCount + 1 },
          });
          newTo.incrementRelationCount();
        }
        if (oldTo instanceof GraphNode) {
          updates.push({
            operation: "updateNode",
            oldProps: oldTo.serialize(),
            newProps: { ...oldTo.serialize(), relationCount: oldTo.relationCount - 1 },
          });
          oldTo.decrementRelationCount();
        } else if (oldTo instanceof GraphRelation) {
          updates.push({
            operation: "updateRelation",
            oldProps: oldTo.serialize(),
            newProps: { ...oldTo.serialize(), relationCount: oldTo.relationCount - 1 },
          });
          oldTo.decrementRelationCount();
        }
      }

      relation.to.allRelationsList.add(relation, after);
      if (relation.to.canonicalRelationId === null) {
        const { updates: canonicalUpdates } = this.updateCanonicalRelation(relation.to, relation);
        updates.push(...canonicalUpdates);
      }

      updates.push({
        operation: "updateRelation",
        oldProps: oldRelation,
        newProps: relation.serialize(),
      });

      updates.push({
        operation: "updateRelationList",
        authorId: this.user.id,
        nodeId: oldTo.id,
        type: "all",
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
        type: "all",
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
    relation.update({ relationType: newType });
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
      } else if (object instanceof GraphRelation) {
        return [];
      } else if (object instanceof PlaceholderGraphObject) {
        return [];
      }
    }
    return [];
  }

  getRelationList(
    nodeOrId: GraphObject | string,
    relationListType: ListType = "all",
  ): FractionalPositionedList<GraphRelation> {
    let node = typeof nodeOrId === "string" ? this.getNode(nodeOrId) : nodeOrId;
    if (!node) {
      node = this.getRelation(typeof nodeOrId === "string" ? nodeOrId : nodeOrId.id);
    }
    if (!node) {
      throw new Error(`Node or relation with id ${nodeOrId} does not exist`);
    }
    switch (relationListType) {
      case "pinned":
        return node.pinnedRelationsList;
      case "noteContent":
        return node.noteContentRelationsList;
      case "all":
        return node.allRelationsList;
      default:
        return relationListType satisfies never;
    }
  }

  nodeInLayerLoadingHasId(nodeId: string): boolean {
    return this.nodesInLayerLoading.has(nodeId);
  }

  getPinnedRelationList(nodeOrId: GraphObject | string): FractionalPositionedList<GraphRelation> {
    const node = typeof nodeOrId === "string" ? this.getNodeOrThrow(nodeOrId) : nodeOrId;
    return node.pinnedRelationsList;
  }

  private _addRelationToList(tx: TxAddRelationToList): { updates: GraphUpdate[] } {
    const list = this.getRelationList(tx.objectId, tx.listType);
    const relations = (Array.isArray(tx.relationId) ? tx.relationId : [tx.relationId]).map((id) =>
      this.getRelationOrThrow(id),
    );
    const partialUpdates = list.add(relations, tx.after);
    return {
      updates: partialUpdates.map((update) => ({
        ...update,
        authorId: this.user.id,
        nodeId: tx.objectId,
        type: tx.listType,
        oldIsPublic: this.relationsById.get(update.relationId)?.isPublic ?? false,
        newIsPublic: this.relationsById.get(update.relationId)?.isPublic ?? false,
      })),
    };
  }

  private _replaceMentionChipWithTextChip(tx: TxReplaceMentionChipWithTextChip): { updates: GraphUpdate[] } {
    const relation = this.relationsById.get(tx.relationId);
    if (!relation) {
      return { updates: [] };
    }
    const mentionNode = this.nodesById.get(relation.from.id);
    if (relation.relationType.label.toLowerCase() === "has hashtag" && mentionNode instanceof GraphNode) {
      let updated = false;
      const newContent = mentionNode.content.map((chip): Chip => {
        if (chip.type === "mention" && chip.value === relation.to.id) {
          updated = true; // Updated is true when we've found the matching mention chip
          const mentionedNode = this.nodesById.get(chip.value);
          const mentionText = mentionedNode ? mentionedNode.text : "";
          return { type: "text", value: mentionText } as Chip;
        }
        return chip;
      });
      if (updated) {
        const nodeUpdateResult = this._updateNode({
          nodeId: mentionNode.id,
          nodeProps: { content: newContent },
        });
        // When we convert a mention relation chip to text, it will trigger a deleteRelation event
        // which will trigger this method again
        // So we need to return the updates from the node update
        return { updates: nodeUpdateResult.updates };
      }
    }
    return { updates: [] };
  }

  private _removeRelationFromList(tx: TxRemoveRelationFromList): { updates: GraphUpdate[] } {
    // --- Begin: Mention relation chip replacement logic for when a relation is removed from the hidden relation list---
    const relation = this.relationsById.get(tx.relationId);
    if (!relation) {
      return { updates: [] };
    }
    const mentionNode = this.nodesById.get(relation.from.id);
    if (
      tx.listType === "all" && // Only do this for general relations, not pinned, nor noteContent
      relation.relationType.label.toLowerCase() === "has hashtag" &&
      mentionNode instanceof GraphNode
    ) {
      const { updates } = this._replaceMentionChipWithTextChip({
        relationId: tx.relationId,
      });
      if (updates.length > 0) {
        return { updates };
      }
    }
    // --- End: Mention relation chip replacement logic ---
    // If the mention relation chip is not found, we can just delete the relation from the list
    // and return the updates as it is
    const list = this.getRelationList(tx.objectId, tx.listType);
    const partialUpdates = list.delete(tx.relationId);
    const updates: GraphUpdate[] = partialUpdates.map((update) => ({
      ...update,
      authorId: this.user.id,
      nodeId: tx.objectId,
      type: tx.listType,
      oldIsPublic: this.relationsById.get(tx.relationId)?.isPublic ?? false,
      newIsPublic: this.relationsById.get(tx.relationId)?.isPublic ?? false,
    }));
    return { updates };
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
        type: "pinned",
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
        type: "pinned",
        relationId,
        oldPosition: oldPositions[relationIds.indexOf(relationId)] ?? null,
        newPosition: null, // TODO: should we preserve the old position from pinnedRelationsList?
        oldIsPublic: this.relationsById.get(relationId)?.isPublic ?? false,
        newIsPublic: this.relationsById.get(relationId)?.isPublic ?? false,
      })),
    };
  }

  updateCanonicalRelation(object: GraphObject, relation?: GraphRelation): { updates: GraphUpdate[] } {
    if (object instanceof PlaceholderGraphObject) {
      return { updates: [] };
    }
    // Global root node doesn't have a canonical relation, it's always the root
    if (object.id === GLOBAL_ROOT_ID) {
      return { updates: [] };
    }
    if (relation && !object.allRelationsList.keys.includes(relation.id)) {
      throw new Error(`Relation with id ${relation.id} does not exist on object ${object.id}`);
    }
    const oldCanonicalRelationId = object.canonicalRelationId;
    object.update({
      canonicalRelationId: relation?.id ?? getNextCanonicalRelation(object)?.id ?? null,
      version: object.version,
    });
    if (object instanceof GraphNode) {
      const serializedObject = object.serialize();
      return {
        updates: [
          {
            operation: "updateNode",
            oldProps: { ...serializedObject, canonicalRelationId: oldCanonicalRelationId },
            newProps: serializedObject,
          },
        ],
      };
    } else {
      const serializedObject = object.serialize();
      return {
        updates: [
          {
            operation: "updateRelation",
            oldProps: { ...serializedObject, canonicalRelationId: oldCanonicalRelationId },
            newProps: serializedObject,
          },
        ],
      };
    }
  }

  cleanup() {
    this.nodesById.clear();
    this.relationsById.clear();
    this.updateManager.cleanup();
    this.cappedKeywordIndex.clear();
    this.layerManager.clear();
    this.ensureDefaultObjectsCreated();
  }

  /**
   * Reset the graph and load the given data.
   */
  resetAndLoad(data: SerializedGraphStore) {
    let wasSyncing = this.updateManager.syncRunning;
    this.updateManager.stopSync();

    // Clear all local data
    this.usersById.clear();
    this.nodesById.clear();
    this.relationsById.clear();
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

    // Global root node
    let globalRoot = this.nodesById.get(GLOBAL_ROOT_ID);
    if (!globalRoot) {
      const { node } = this._addNode({
        id: GLOBAL_ROOT_ID,
        content: [{ type: "text", value: "Global Hub" }],
        isPublic: true,
        authorId: GLOBAL_ADMIN_USER_ID,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      });
      globalRoot = node;
      // Don't push the change. The global root already exists on the server.
    }

    // Global users node
    let usersNode = this.nodesById.get(GLOBAL_USERS_NODE_ID);
    if (!usersNode) {
      const { node } = this._addNode({
        id: GLOBAL_USERS_NODE_ID,
        content: [{ type: "text", value: "Users" }],
        isPublic: true,
        authorId: GLOBAL_ADMIN_USER_ID,
        createdAt: new Date(0),
      });
      usersNode = node;
      // Don't push the change. The users node already exists on the server.
    }

    // Global-[sublist]->Users
    let globalToUsersRelation = this.relationsById.get(GLOBAL_USERS_RELATION_ID);
    if (!globalToUsersRelation) {
      const { relation } = this.createRelation({
        id: GLOBAL_USERS_RELATION_ID,
        from: globalRoot,
        to: usersNode,
        relationType: defaultRelationTypes.sublist,
        isPublic: true,
        authorId: this.user.id,
      });
      globalToUsersRelation = relation;
      // Don't push the change. The global to users relation already exists on the server.
    }

    // Global Hashtags node
    let globalHashtagsNode = this.nodesById.get(GLOBAL_HASHTAGS_NODE_ID);
    if (!globalHashtagsNode) {
      const { node } = this._addNode({
        id: GLOBAL_HASHTAGS_NODE_ID,
        content: [{ type: "text", value: "Global Hashtags" }],
        isPublic: true,
        authorId: GLOBAL_ADMIN_USER_ID,
        createdAt: new Date(0),
      });
      globalHashtagsNode = node;
      // Don't push the change. The global hashtags node already exists on the server.
    }

    // Global-[sublist]->Global Hashtags
    let globalToHashtagsRelation = this.relationsById.get(GLOBAL_ROOT_TO_HASHTAGS_RELATION_ID);
    if (!globalToHashtagsRelation) {
      const { relation } = this.createRelation({
        id: GLOBAL_ROOT_TO_HASHTAGS_RELATION_ID,
        from: globalRoot,
        to: globalHashtagsNode,
        relationType: defaultRelationTypes.sublist,
        isPublic: true,
        authorId: this.user.id,
      });
      globalToHashtagsRelation = relation;
      // Don't push the change. The global to hashtags relation already exists on the server.
    }

    // User node
    let userRoot = this.nodesById.get(this.userRootId);
    if (!userRoot) {
      const { node, updates: userRootUpdates } = this._addNode({
        id: this.userRootId,
        content: [{ type: "text", value: this.user.name || this.user.id || "Untitled User" }],
        authorId: this.user.id,
      });
      userRoot = node;
      updates.push(...userRootUpdates);
    }

    // Users-[sublist]->User
    let usersToUserRelation = this.relationsById.get(this.usersToUserRelationId);
    if (!usersToUserRelation && userRoot) {
      const { relation, updates: usersToUserRelationUpdates } = this.createRelation({
        id: this.usersToUserRelationId,
        from: usersNode,
        to: userRoot,
        relationType: defaultRelationTypes.sublist,
      });
      usersToUserRelation = relation;
      updates.push(...usersToUserRelationUpdates);
    }

    // My Hashtags node for user
    let myHashtagsNode = this.nodesById.get(this.myHashtagsNodeId);
    if (!myHashtagsNode) {
      const { node, updates: myHashtagsNodeUpdates } = this._addNode({
        id: this.myHashtagsNodeId,
        content: [{ type: "text", value: "My Hashtags" }],
        authorId: this.user.id,
      });
      myHashtagsNode = node;
      updates.push(...myHashtagsNodeUpdates);
    }

    // User->My Hashtags
    let userToMyHashtagsRelation = userRoot?.relations.find((r) => r.to.id === this.myHashtagsNodeId);
    if (!userToMyHashtagsRelation && userRoot && myHashtagsNode) {
      const { relation, updates: newRelationUpdates } = this.createRelation({
        from: userRoot,
        to: myHashtagsNode,
      });
      userToMyHashtagsRelation = relation;
      updates.push(...newRelationUpdates);
      const { updates: pinUpdates } = this._pinRelations(userRoot.id, [userToMyHashtagsRelation.id]);
      updates.push(...pinUpdates);
    }

    // Global Hashtags->My Hashtags
    const globalHashtagsToUserHashtagsRelationId = GLOBAL_HASHTAGS_TO_USER_HASHTAGS_RELATION_ID_PREFIX + this.user.id;
    let globalHashtagsToUserHashtagsRelation = this.relationsById.get(globalHashtagsToUserHashtagsRelationId);
    if (!globalHashtagsToUserHashtagsRelation && globalHashtagsNode && myHashtagsNode) {
      const { relation, updates: newRelationUpdates } = this.createRelation({
        id: globalHashtagsToUserHashtagsRelationId,
        from: globalHashtagsNode,
        to: myHashtagsNode,
        relationType: defaultRelationTypes.sublist,
        isPublic: true,
        authorId: this.user.id,
      });
      globalHashtagsToUserHashtagsRelation = relation;
      updates.push(...newRelationUpdates);
    }

    // My Favorites node for user
    let myFavoritesNode = this.nodesById.get(this.myFavoritesNodeId);
    if (!myFavoritesNode) {
      const { node, updates: myFavoritesNodeUpdates } = this._addNode({
        id: this.myFavoritesNodeId,
        content: [{ type: "text", value: "My Favorites" }],
        authorId: this.user.id,
      });
      myFavoritesNode = node;
      updates.push(...myFavoritesNodeUpdates);
    }

    // User->My Favorites
    let userToMyFavoritesRelation = userRoot?.relations.find((r) => r.to.id === this.myFavoritesNodeId);
    if (!userToMyFavoritesRelation && userRoot && myFavoritesNode) {
      const { relation, updates: newRelationUpdates } = this.createRelation({
        from: userRoot,
        to: myFavoritesNode,
      });
      userToMyFavoritesRelation = relation;
      updates.push(...newRelationUpdates);
      const { updates: pinUpdates } = this._pinRelations(userRoot.id, [userToMyFavoritesRelation.id]);
      updates.push(...pinUpdates);
    }

    // My Stream node for user
    let myStreamNode = this.nodesById.get(this.myStreamNodeId);
    if (!myStreamNode) {
      const { node, updates: myStreamNodeUpdates } = this._addNode({
        id: this.myStreamNodeId,
        content: [{ type: "text", value: "My Stream" }],
        authorId: this.user.id,
      });
      myStreamNode = node;
      updates.push(...myStreamNodeUpdates);
    }

    // User->My Stream
    let userToMyStreamRelation = userRoot?.relations.find((r) => r.to.id === this.myStreamNodeId);
    if (!userToMyStreamRelation && userRoot && myStreamNode) {
      const { relation, updates: newRelationUpdates } = this.createRelation({
        from: userRoot,
        to: myStreamNode,
      });
      userToMyStreamRelation = relation;
      updates.push(...newRelationUpdates);
      const { updates: pinUpdates } = this._pinRelations(userRoot.id, [userToMyStreamRelation.id]);
      updates.push(...pinUpdates);
    }

    // My Templates node for user
    let myTemplatesNode = this.nodesById.get(this.myTemplatesNodeId);
    if (!myTemplatesNode) {
      const { node, updates: myTemplatesNodeUpdates } = this._addNode({
        id: this.myTemplatesNodeId,
        content: [{ type: "text", value: "My Templates" }],
        authorId: this.user.id,
      });
      myTemplatesNode = node;
      updates.push(...myTemplatesNodeUpdates);
    }

    // User->My Templates
    let userToMyTemplatesRelation = userRoot?.relations.find((r) => r.to.id === this.myTemplatesNodeId);
    if (!userToMyTemplatesRelation && userRoot && myTemplatesNode) {
      const { relation, updates: newRelationUpdates } = this.createRelation({
        from: userRoot,
        to: myTemplatesNode,
      });
      userToMyTemplatesRelation = relation;
      updates.push(...newRelationUpdates);
      const { updates: pinUpdates } = this._pinRelations(userRoot.id, [userToMyTemplatesRelation.id]);
      updates.push(...pinUpdates);
    }

    let relationTypesNode = userRoot?.children.find((n) => n.id === this.relationTypesNodeId);
    if (!relationTypesNode) {
      const { node, updates: relationTypesNodeUpdates } = this._addNode({
        id: this.relationTypesNodeId,
        content: [{ type: "text", value: "__user_relation_types__" }],
        authorId: this.user.id,
      });
      const { updates: newRelationUpdates } = this.createRelation({
        from: userRoot ? userRoot : usersNode,
        to: node,
      });
      relationTypesNode = node;
      updates.push(...relationTypesNodeUpdates);
      updates.push(...newRelationUpdates);
    }

    // Add __card_status__
    let cardStatusNode = userRoot?.children.find((n) => n.id === this.cardStatusesNodeId);

    if (!cardStatusNode) {
      const { node: typesNode, updates: typesNodeUpdates } = this._addNode({
        id: this.cardStatusesNodeId,
        content: [{ type: "text", value: "__card_statuses__" }],
        authorId: this.user.id,
      });
      const { updates: newRelationUpdates } = this.createRelation({
        from: userRoot ? userRoot : usersNode,
        to: typesNode,
      });
      updates.push(...typesNodeUpdates);
      updates.push(...newRelationUpdates);

      for (const status of DEFAULT_CARD_STATUSES) {
        const { node: statusValueNode, updates: statusValueNodeUpdates } = this._addNode({
          content: [{ type: "text", value: status }],
          authorId: this.user.id,
        });

        const { updates: statusValueRelationUpdates } = this.createRelation({
          from: typesNode,
          to: statusValueNode,
        });

        updates.push(...statusValueNodeUpdates);
        updates.push(...statusValueRelationUpdates);
      }
    }

    // Global relation types node
    let globalRelationTypesNode = this.nodesById.get(GLOBAL_RELATION_TYPES_NODE_ID);
    if (!globalRelationTypesNode) {
      const { node, updates: newNodeUpdates } = this._addNode({
        id: GLOBAL_RELATION_TYPES_NODE_ID,
        content: [{ type: "text", value: "__global_relation_types__" }],
        isPublic: true,
        authorId: this.user.id,
      });
      // Add relation from global root to global relation types node
      const { relation, updates: newRelationUpdates } = this.createRelation({
        id: GLOBAL_ROOT_TO_GLOBAL_TYPES_RELATION_ID,
        from: globalRoot,
        isPublic: true,
        to: node,
      });

      globalRelationTypesNode = node;
      updates.push(...newNodeUpdates);
      updates.push(...newRelationUpdates);
    }

    // Global Relation Types-[sublist]->User Relation Types
    let globalRelationTypesToUserRelationTypesRelation = this.relationsById.get(
      GLOBAL_TO_USER_TYPES_RELATION_ID_PREFIX + this.user.id,
    );
    if (!globalRelationTypesToUserRelationTypesRelation) {
      const { relation, updates: newRelationUpdates } = this.createRelation({
        id: GLOBAL_TO_USER_TYPES_RELATION_ID_PREFIX + this.user.id,
        from: globalRelationTypesNode,
        to: relationTypesNode,
        relationType: defaultRelationTypes.sublist,
        isPublic: true,
        authorId: this.user.id,
      });
      globalRelationTypesToUserRelationTypesRelation = relation;
      updates.push(...newRelationUpdates);
    }

    if (!this.user.isAnonymous && updates.length > 0) {
      this.updateManager.queueUpdates(updates);
    }
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
      } else {
        throw new Error("Invalid object type");
      }
    });
  }

  serialize(): SerializedGraphStore {
    const usersById = Object.fromEntries(this.usersById.entries());

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
    const noteContentRelationsByNodeId = Array.from(this.nodesById.values()).reduce(
      (acc, node) => {
        acc[node.id] = node.noteContentRelationsList.serialize();
        return acc;
      },
      {} as Record<string, SerializedPositionList<GraphRelation>>,
    );

    return {
      usersById,
      nodesById,
      relationsById,
      relationTypesById,
      relationsByNodeId,
      pinnedRelationsByNodeId,
      noteContentRelationsByNodeId,
    };
  }

  /**
   * Load the serialized data into the store. Existing data isn't cleared, but values
   * are overwritten if they already exist.
   */
  load(data: SerializedGraphStore) {
    for (const [id, user] of Object.entries(data.usersById)) {
      this.usersById.set(id, user);
    }

    // Nodes
    for (const props of Object.values(data.nodesById)) {
      if (this.deletedNodes.has(props.id)) {
        continue;
      }
      try {
        this.loadSerializedNode({ ...props });
      } catch (error) {
        logger.error(`Error loading serialized node`, error);
      }
    }

    // Relation Types
    for (const props of Object.values(data.relationTypesById)) {
      try {
        this.cappedKeywordIndex.add(props.id, () => props.label + " " + props.reverseLabel);
      } catch (error) {
        logger.error(`Error adding relation type`, error);
      }
    }

    for (const props of Object.values(defaultRelationTypes)) {
      try {
        this.cappedKeywordIndex.add(props.id, () => props.label + " " + props.reverseLabel);
      } catch (error) {
        logger.error(`Error adding relation type`, error);
      }
    }

    // Relations
    const loadedWithPlaceholders: GraphRelation[] = [];

    for (const props of Object.values(data.relationsById)) {
      if (this.deletedRelations.has(props.id)) {
        continue;
      }
      try {
        if (this.deletedNodes.has(props.fromId) || this.deletedNodes.has(props.toId)) {
          continue;
        }

        const rel = this.loadSerializedRelation(props);

        if (rel.from instanceof PlaceholderGraphObject || rel.to instanceof PlaceholderGraphObject) {
          loadedWithPlaceholders.push(rel);
        }
      } catch (error) {
        logger.error(`Error loading serialized relation`, error);
      }
    }
    // It's possible some of these relations were loaded with placeholders because their to or from objects
    // were other relations in this same batch of data. We try to resolve those now.
    for (const rel of loadedWithPlaceholders) {
      try {
        if (rel.from instanceof PlaceholderGraphObject) {
          const from = this.getObject(rel.from.id);
          if (from) {
            this.setRelationFrom(rel, from, true);
          }
        }
        if (rel.to instanceof PlaceholderGraphObject) {
          const to = this.getObject(rel.to.id);
          if (to) {
            this.setRelationTo(rel, to, true);
          }
        }
      } catch (error) {
        logger.error(`Error resolving placeholder`, error);
      }
      // Note: we might still have unresolved placeholders at this point for valid reasons, like if
      // a relation is pointing to a node that was shared by someone else at the time but was
      // subsequently made private.
    }

    // Relation positions
    for (const [nodeId, positionsByRelationId] of Object.entries(data.relationsByNodeId)) {
      try {
        this.loadSerializedRelationList("all", nodeId, positionsByRelationId);
      } catch (error) {
        logger.error(`Error loading serialized all relation list`, error);
      }
    }
    for (const [nodeId, positionsByRelationId] of Object.entries(data.pinnedRelationsByNodeId)) {
      try {
        this.loadSerializedRelationList("pinned", nodeId, positionsByRelationId);
      } catch (error) {
        logger.error(`Error loading serialized pinned relation list`, error);
      }
    }
    for (const [nodeId, positionsByRelationId] of Object.entries(data.noteContentRelationsByNodeId)) {
      try {
        this.loadSerializedRelationList("noteContent", nodeId, positionsByRelationId);
      } catch (error) {
        logger.error(`Error loading serialized note content relation list`, error);
      }
    }

    // Update relationTypesById with custom relation types.
    for (const [id, rel] of this.relationsById) {
      if (rel.relationTypeId === defaultRelationTypes.__reverse__.id) {
        if (rel.from instanceof GraphNode) {
          this.relationTypesById[rel.from.id] = {
            version: rel.from.version,
            id: rel.from.id,
            label: rel.from.text,
            reverseLabel: rel.to.text,
            authorId: rel.from.authorId,
            isPublic: rel.from.isPublic,
          };
        }
      }
    }
  }

  /**
   * Load a serialized graph into the store.
   * @see file://./design-notes.md#load-methods
   */
  private loadSerializedNode(props: SerializedNode): GraphNode {
    const existing = this.getNode(props.id);
    if (existing) {
      //Avoid loading stale data in-case we are editing a node and sync happens
      //after a layer is fetched. We do not want the layer to overwrite
      //the active editor content.
      if (existing.version > props.version || UpdateManager.isSyncing(props.id)) {
        return existing;
      }
      existing.update({ ...props, canonicalRelationId: props.canonicalRelationId });
      return existing;
    } else {
      const { node } = this._addNode({
        ...props,
        canonicalRelationId: props.canonicalRelationId,
      });

      return node;
    }
  }

  /**
   * Load the serialized data into the store. If there are conflicts of data
   * that isn't the relationType, it'll push it.
   */
  importData(data: SerializedGraphStore) {
    const allNodeUpdates = this.loadBatchedSerializedNode(
      Object.fromEntries(
        Object.entries(data.nodesById).map(([id, props]) => [id, { ...props, canonicalRelationId: null }]),
      ),
    );

    const allRelationUpdates = this.loadBatchedSerializedRelation(data.relationsById);

    // Because the nodes and loaded before relations, the canonical relations are not set yet.
    // We need to set them now once all relations are loaded.
    for (const props of Object.values(data.nodesById)) {
      if (!props.canonicalRelationId) continue;
      const canonicalRelation = this.getRelation(props.canonicalRelationId);
      if (!canonicalRelation) continue;
      const { updates } = this._updateNode({
        nodeId: props.id,
        nodeProps: { canonicalRelationId: canonicalRelation?.id },
      });
      allNodeUpdates.push(...updates);
    }

    return this.updateManager.syncImportUpdates(allNodeUpdates.concat(allRelationUpdates));
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
      const canonicalRelation = props.canonicalRelationId ? this.getRelation(props.canonicalRelationId) : null;
      const existing = this.getNode(props.id);
      if (!existing) {
        const { updates } = this._addNode({ ...props, canonicalRelation });
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
      if (existing.version > props.version || UpdateManager.isSyncing(props.id)) {
        return existing;
      }
      existing.update({ ...props, relationType });
      return existing;
    } else {
      const { relation } = this.createRelation({ ...props, from, to, relationType, retainRelationCount: true });
      return relation;
    }
  }

  /**
   * Load serialized positioned relations list into the store.
   * @see file://./design-notes.md#load-methods
   */
  private loadSerializedRelationList(
    listType: ListType,
    objectId: string,
    positionsByRelationId: SerializedPositionList<GraphRelation>,
  ) {
    const { object, relationsWithPositions } = this.resolveRelationListReferences(objectId, positionsByRelationId);
    const list = this.getRelationList(object, listType);

    if (UpdateManager.isSyncing(objectId)) {
      return;
    }

    list.load(relationsWithPositions);

    const relationsInListButNotLoaded = list
      .values()
      .map((v) => v.item)
      .filter((v) => !relationsWithPositions.map((loaded) => loaded.item.id).includes(v.id));
    const updates: GraphUpdate[] = [];
    for (const rel of relationsInListButNotLoaded) {
      return;
      logger.debug(
        `Relation ${rel.id} was present in "${listType}" list for ${objectId} but its position was missing in the data snapshot. ` +
          `Generating GraphUpdate to persist the automatically assigned position.`,
      );
      updates.push({
        operation: "updateRelationList",
        authorId: this.user.id,
        nodeId: objectId,
        type: listType,
        relationId: rel.id,
        oldPosition: null,
        newPosition: list.get(rel.id)!.position,
        oldIsPublic: rel.isPublic,
        newIsPublic: rel.isPublic,
      });
    }
    if (updates.length > 0) {
      this.updateManager.queueUpdates(updates);
    }
  }

  private gatherSubtree(root: GraphObject): GraphObject[] {
    const visited = new Set();
    const result: GraphObject[] = [];
    const queue: GraphObject[] = [root];
    while (queue.length > 0) {
      const node = queue.pop()!;
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
    const usersById = Object.fromEntries(this.usersById.entries());
    const relationTypesById: Record<string, GraphRelationType> = {};
    const nodesById = new Map<string, GraphNode>();
    const relationsById = new Map<string, GraphRelation>();
    const relationsByNodeId = new Map<string, FractionalPositionedList<GraphRelation>>();
    const pinnedRelationsByNodeId = new Map<string, FractionalPositionedList<GraphRelation>>();
    const noteContentRelationsByNodeId = new Map<string, FractionalPositionedList<GraphRelation>>();

    const subtreeObjects = this.gatherSubtree(root);

    for (const obj of subtreeObjects) {
      if (obj instanceof GraphNode) {
        nodesById.set(obj.id, obj);
        relationsByNodeId.set(obj.id, this.nodesById.get(obj.id)?.allRelationsList || new FractionalPositionedList());
        pinnedRelationsByNodeId.set(obj.id, new FractionalPositionedList());
      } else if (obj instanceof GraphRelation) {
        relationTypesById[obj.relationType.id] = obj.relationType;
        relationsById.set(obj.id, obj);
      }
    }

    return {
      usersById: usersById,
      relationTypesById: toJS(relationTypesById),
      nodesById: serializeMap(nodesById),
      relationsById: serializeMap(relationsById),
      relationsByNodeId: serializeMap(relationsByNodeId),
      pinnedRelationsByNodeId: serializeMap(pinnedRelationsByNodeId),
      noteContentRelationsByNodeId: serializeMap(noteContentRelationsByNodeId),
    };
  }

  // TODO: We should make this async ASAP
  search(query: Query): SearchResults {
    window !== undefined && this.layerManager.loadWithText(query.text);
    const results: SearchResults = { nodes: [], relations: [], relationTypes: [] };
    const { text, filters, sort } = query;
    const procText = text?.toLowerCase().trim();
    const keywords = procText.split(/\s+/);
    const include = {
      nodes: !filters?.types || filters.types.includes("node"),
      relations: !filters?.types || filters.types.includes("relation"),
      relationTypes: !filters?.types || filters.types.includes("relationType"),
    };

    // Todo: Move the search api here?
    // Can have a local search + api search

    // Use the keyword index to get an initial set of object ids
    const initialObjectIds = this.cappedKeywordIndex.getIds(procText);

    // Then do a local full text search on the results
    for (const id of initialObjectIds) {
      const object = this.getObjectOrType(id);
      if (include.nodes && object instanceof GraphNode) {
        const node = object;
        const searchText = node.searchText.toLocaleLowerCase();
        if (keywords.every((kw) => searchText.includes(kw))) {
          results.nodes.push({ node: object, score: scoreMatch(searchText, procText) * (node.isUserNode ? 1.3 : 1) });
        }
      } else if (include.relations && object instanceof GraphRelation) {
        const relation = object;
        const searchText = relation.searchText.toLocaleLowerCase();
        if (keywords.every((kw) => searchText.includes(kw))) {
          results.relations.push({ relation, score: scoreMatch(searchText, procText) });
        }
      }
      if (include.relationTypes && isGraphRelationType(object)) {
        if (object instanceof GraphNode) {
          const relationType = object;
          const label = relationType.text;
          const reverseLabel = getRelationTypeReverseLabel(relationType);
          if (keywords.some((kw) => label.includes(kw)) || keywords.some((kw) => reverseLabel.includes(kw))) {
            results.relationTypes.push({
              relationType: {
                label,
                reverseLabel,
                ...object,
              },
              score: scoreMatch(text, procText),
            });
          }
        } else if (!(object instanceof GraphRelation) && object) {
          const relationType = object;
          const label = relationType.label.toLocaleLowerCase();
          const reverseLabel = getRelationTypeReverseLabel(relationType);
          if (keywords.every((kw) => label.includes(kw)) || keywords.every((kw) => reverseLabel.includes(kw))) {
            results.relationTypes.push({ relationType, score: scoreMatch(text, procText) });
          }
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

  getRelationsFrom(node: GraphNode): GraphRelation[] {
    return Array.from(this.relationsById.values()).filter((r) => r.from.id === node.id);
  }

  getAllPaths(
    from: GraphNode,
    to: GraphNode[],
    exclude: Set<string> = new Set(),
    walkOnly: Set<string> = new Set(),
  ): Array<Array<string>> {
    // BFS from the one "from" node to find all shortest paths to the target "to" nodes
    // Caches current shortest paths so that we can use dynamic programming to find longer paths.
    // We only implement this for paths from nodes to nodes, so we must check that nextNode is a node.
    // Pays special attention to cycles and such.

    // NOTE: This is only optimal for unweighted edges. If in the future we want e.g. nonlocal edges
    //  to "cost" more, we should implement Dijkstra's algorithm instead.
    if (to.length === 0) {
      return [];
    }

    const userId = this.user.id;

    const paths: Array<Array<string>> = [];
    const queue: Array<[GraphNode, number, Array<string>, Array<string>, boolean]> = [[from, 0, [from.id], [], true]];
    const visited = new Set<string>();
    const lookupSet = new Set(to.map((node) => node.id));

    while (queue.length > 0) {
      const [node, depth, path, relationPath, walk] = queue.shift()!;
      if (visited.has(node.id) || depth > 10) continue;
      visited.add(node.id);

      // Check if this node is one of our targets
      if (lookupSet.has(node.id) && relationPath.length > 0) {
        paths.push(relationPath);

        if (paths.length > 40) {
          break;
        }
      }

      if (!walk) {
        continue;
      }

      const sz = walkOnly.size;
      for (const { item: relation } of node.allRelationsList.values()) {
        // Only walk down forward relations
        if (exclude && exclude.has(relation.id)) {
          continue;
        }
        const nextNode = relation.to.id === node.id ? relation.from : relation.to;

        const walk =
          sz === 0 ||
          (walkOnly.has("child") && relation.relationType.id === "child" && relation.from.id === node.id) ||
          (walkOnly.has("canonical") && relation.id === nextNode.canonicalRelation?.id && relation.from.id === node.id);

        if (
          nextNode instanceof GraphNode &&
          !visited.has(nextNode.id) &&
          (nextNode.isPublic || nextNode.authorId === userId)
        ) {
          queue.push([nextNode, depth + 1, [...path, nextNode.id], [...relationPath, relation.id], walk]);
        }
      }
    }
    return paths;
  }

  /**
   * Get the global hashtags node ID.
   */
  get globalHashtagsNodeId(): string {
    return GLOBAL_HASHTAGS_NODE_ID;
  }

  /**
   * Get the global hashtags node.
   */
  get globalHashtagsNode(): GraphNode {
    const node = this.nodesById.get(this.globalHashtagsNodeId);
    if (!node) throw new Error(`Global hashtags node with id ${this.globalHashtagsNodeId} not found`);
    return node;
  }

  /**
   * Get the global hashtags to user hashtags relation ID.
   */
  get globalHashtagsToUserHashtagsRelationId(): string {
    return GLOBAL_HASHTAGS_TO_USER_HASHTAGS_RELATION_ID_PREFIX + this.user.id;
  }

  get globalHashtagsToUserHashtagsRelation(): GraphRelation {
    const relation = this.relationsById.get(this.globalHashtagsToUserHashtagsRelationId);
    if (!relation) {
      throw new Error(
        `Global hashtags to user hashtags relation with id ${this.globalHashtagsToUserHashtagsRelationId} not found`,
      );
    }
    return relation;
  }

  /**
   * In search components, we need to render an indicator component to
   * indicate an "ongoing" backend search. When we send a
   * request we increment, when the request is over, we decrement.
   *
   * When `inFlightSearchCount` > 0, we render the the indicator,
   * else hide it.
   */
  updateInFlightSearchCount(direction: "increment" | "decrement"): void {
    if (direction === "increment") {
      this.inFlightSearchCount++;
    } else {
      this.inFlightSearchCount--;
    }
  }

  incrementSearchTrigger() {
    this.refreshSearchTrigger++;
  }

  setNodeLayerLoadingStatus(nodeId: string, isLoading: boolean): void {
    isLoading ? this.nodesInLayerLoading.add(nodeId) : this.nodesInLayerLoading.delete(nodeId);
  }
}

type Query = {
  text: string;
  filters?: {
    types?: NodeType[];
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
