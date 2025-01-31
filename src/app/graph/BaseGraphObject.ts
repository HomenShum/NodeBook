import { FractionalPositionedList } from "@/app/graph/FractionalPositionedList";
import { PositionedRelation } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphStore } from "@/app/graph/GraphStore";
import { Positioner } from "@/app/graph/GraphTransactionTypes";
import { comparePositions } from "@/app/util";
import { GLOBAL_ROOT_ID, USER_MY_HASHTAGS_NODE_ID_PREFIX, USER_ROOT_ID_PREFIX } from "@/lib/constants";

export abstract class BaseGraphObject {
  abstract readonly objectType: string;
  abstract id: string;
  abstract authorId: string;
  abstract createdAt: Date;
  abstract updatedAt: Date;
  abstract text: string;
  abstract searchText: string;
  abstract isPublic: boolean;
  protected store: GraphStore;
  allRelationsList: FractionalPositionedList<GraphRelation>;
  pinnedRelationsList: FractionalPositionedList<GraphRelation>;
  pointerRelationsList: FractionalPositionedList<GraphRelation>;
  noteContentRelationsList: FractionalPositionedList<GraphRelation>;
  /**
   * The canonical relation for this object.
   *
   * This is the relation that is used to determine the path to this object.
   * It's analogous to the parent directory in a file system.
   */
  canonicalRelation: GraphRelation | null = null;

  protected constructor(store: GraphStore) {
    this.store = store;
    this.allRelationsList = new FractionalPositionedList();
    this.pinnedRelationsList = new FractionalPositionedList();
    this.pointerRelationsList = new FractionalPositionedList();
    this.noteContentRelationsList = new FractionalPositionedList();
  }

  get children(): GraphObject[] {
    return this.relations.filter((r) => r.from.id === this.id).map((r) => r.to);
  }

  connectedObjects(): GraphObject[] {
    return this.relations.map((r) => (r.from.id === this.id ? r.to : r.from));
  }

  get isRoot() {
    return (
      this.id === this.store.userRootId ||
      this.id === this.store.globalRoot.id ||
      this.id === this.store.usersToUserRelationId ||
      this.id === this.store.globalToUsersRelation.id ||
      this.id === this.store.usersNode.id
    );
  }

  get isUserNode() {
    return this.id.startsWith(USER_ROOT_ID_PREFIX);
  }

  get relationsWithPositions(): PositionedRelation[] {
    return this.allRelationsList.values().map(({ position, item }) => ({ position, relation: item }));
  }

  get relations(): GraphRelation[] {
    return this.relationsWithPositions.map(({ relation }) => relation);
  }

  get relationsSortedByPosition(): GraphRelation[] {
    return this.relationsWithPositions
      .sort((a, b) => comparePositions(a.position, b.position))
      .map(({ relation }) => relation);
  }

  get pinnedRelationsWithPositions(): PositionedRelation[] {
    return this.pinnedRelationsList.values().map(({ position, item }) => ({ position, relation: item }));
  }

  get pointerRelationsWithPositions(): PositionedRelation[] {
    return this.pointerRelationsList.values().map(({ position, item }) => ({ position, relation: item }));
  }

  get noteContentRelationsWithPositions(): PositionedRelation[] {
    return this.noteContentRelationsList.values().map(({ position, item }) => ({ position, relation: item }));
  }

  /**
   * Returns true if this is a special object that should not be user-deletable.
   *
   * Examples: the global graph root, the user root, the user's "My Hashtags" node.
   */
  get isDeleteRestricted(): boolean {
    if (this.id === GLOBAL_ROOT_ID) {
      return true;
    }
    if (this.id.startsWith(USER_ROOT_ID_PREFIX)) {
      return true;
    }
    if (this.id.startsWith(USER_MY_HASHTAGS_NODE_ID_PREFIX)) {
      return true;
    }
    return false;
  }

  /**
   * Returns true if this is a special object that should not be user-editable.
   *
   * Examples: the global graph root, the user's "My Hashtags" node.
   *
   * Does NOT include a user's own root node because that's populated semi-arbitrarily with Auth0 data and
   * we want to allow users to potentially change it to something more meaningful.
   */
  get isEditRestricted(): boolean {
    if (this.id === GLOBAL_ROOT_ID) {
      return true;
    }
    if (this.id.startsWith(USER_MY_HASHTAGS_NODE_ID_PREFIX)) {
      return true;
    }
    return false;
  }

  pinChildRelation(childRelation: GraphRelation | GraphRelation[], after?: Positioner<GraphRelation>) {
    const relationIds = Array.isArray(childRelation) ? childRelation.map((r) => r.id) : [childRelation.id];
    this.store.pinRelations(this.id, relationIds, after);
  }

  unpinChildRelation(childRelation: GraphRelation) {
    this.store.unpinRelations(this.id, [childRelation.id]);
  }

  isRelationPinned(childRelation: GraphRelation) {
    return this.pinnedRelationsList.has(childRelation.id);
  }

  addRelationToNoteContent(childRelation: GraphRelation, after?: Positioner<GraphRelation>) {
    this.noteContentRelationsList.add(childRelation, after);
  }

  removeRelationFromNoteContent(childRelation: GraphRelation) {
    this.noteContentRelationsList.delete(childRelation.id);
  }
}
