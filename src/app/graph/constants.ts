import { UNLOGGED_USER } from "@/app/auth/MewUser";
import { ParentRelationIcon, SublistIcon } from "@/app/components/CustomIcons";
import { GraphRelationType } from "@/app/graph/types";

const TEMP_USER_ID = UNLOGGED_USER.id; // TODO: This is simply to satisfy the type checker, we should change this

export const ALL_LIST_TYPES = ["pinned", "noteContent", "all"] as const;
export type ListType = (typeof ALL_LIST_TYPES)[number];
type DefaultRelationType = "child" | "relatedTo" | "author" | "sublist" | "empty";

export const getRelationTypeIcon = (relationType: string): (() => JSX.Element) | undefined => {
  switch (relationType) {
    case "sublist":
      return SublistIcon;
    case "child":
      return ParentRelationIcon;
    default:
      return undefined;
  }
};

export const getRelationTypeReverseLabel = (relationType: GraphRelationType): string => {
  return relationType.id === "child" ? "parent" : relationType.reverseLabel;
};

export const defaultRelationTypes: Record<DefaultRelationType, GraphRelationType> = {
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
