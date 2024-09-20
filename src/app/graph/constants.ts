import { UNLOGGED_USER } from "@/app/auth/MewUser";
import { GraphRelationType } from "@/app/graph/types";

const TEMP_USER_ID = UNLOGGED_USER.id; // TODO: This is simply to satisfy the type checker, we should change this
export const defaultRelationTypes: Record<string, GraphRelationType> = {
  child: { version: 1, id: "child", authorId: TEMP_USER_ID, label: "child", reverseLabel: "parent", isPublic: false },
  relatedTo: {
    version: 1,
    id: "relatedTo",
    authorId: TEMP_USER_ID,
    label: "relates to",
    reverseLabel: "relates to",
    isPublic: false,
  },
  author: {
    version: 1,
    id: "author",
    authorId: TEMP_USER_ID,
    label: "author",
    reverseLabel: "authored",
    isPublic: false,
  },
  sublist: {
    version: 1,
    id: "sublist",
    authorId: TEMP_USER_ID,
    label: "sublist",
    reverseLabel: "sublist of",
    isPublic: false,
  },
  empty: { version: 1, id: "empty", authorId: TEMP_USER_ID, label: "", reverseLabel: "", isPublic: false },
};

export const MAX_PREFIX_LENGTH = 3;
export const DELETED_NODE_TEXT = "Deleted Node";
