import { ParentRelationIcon, SublistIcon } from "@/app/components/CustomIcons";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphRelationType } from "@/app/graph/types";
import { GLOBAL_ADMIN_USER_ID } from "@/lib/constants";

export const ALL_LIST_TYPES = ["pinned", "noteContent", "all"] as const;
export type ListType = (typeof ALL_LIST_TYPES)[number];
export type DefaultRelationType = "child" | "relatedTo" | "author" | "sublist" | "empty" | "__type__" | "__reverse__";

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

export const graphNodeIsCustomRelType = (graphNode: GraphNode): boolean => {
  const reverseRelations = graphNode.relations.filter(
    (relation) => relation.relationTypeId === "__reverse__" && relation.from.id === graphNode.id,
  );
  if (reverseRelations.length === 1) {
    return true;
  } else if (reverseRelations.length > 1) {
    throw new Error(`Invalid number of reverse relations on graphNode ${graphNode.id} : ${reverseRelations.length}`);
  } else {
    return false;
  }
};

export const getReverseRelationOrThrow = (graphNode: GraphNode, from: boolean = false): GraphRelation => {
  const reverseRelations = graphNode.relations.filter(
    (relation) => relation.relationTypeId === "__reverse__" && (from ? relation.from.id === graphNode.id : true),
  );
  if (reverseRelations.length !== 1) {
    throw new Error(`Invalid number of reverse relations on graphNode ${graphNode.id} : ${reverseRelations.length}`);
  }
  return reverseRelations[0];
};

export const getRelationTypeReverseLabel = (relationType: GraphNode | GraphRelationType): string => {
  if (relationType instanceof GraphNode) {
    if (graphNodeIsCustomRelType(relationType)) {
      const reverseRelation = getReverseRelationOrThrow(relationType, true);
      return reverseRelation.to.text;
    } else {
      return relationType.text;
    }
  } else {
    return relationType.id === "child" ? "parent" : relationType.reverseLabel;
  }
};

export const defaultRelationTypes: Record<DefaultRelationType, GraphRelationType> = {
  child: {
    version: 1,
    id: "child",
    authorId: GLOBAL_ADMIN_USER_ID,
    label: "child",
    reverseLabel: "parent",
    isPublic: false,
  },
  relatedTo: {
    version: 1,
    id: "relatedTo",
    authorId: GLOBAL_ADMIN_USER_ID,
    label: "relates to",
    reverseLabel: "relates to",
    isPublic: false,
  },
  author: {
    version: 1,
    id: "author",
    authorId: GLOBAL_ADMIN_USER_ID,
    label: "author",
    reverseLabel: "authored",
    isPublic: false,
  },
  sublist: {
    version: 1,
    id: "sublist",
    authorId: GLOBAL_ADMIN_USER_ID,
    label: "sublist",
    reverseLabel: "sublist of",
    isPublic: false,
  },
  __type__: {
    version: 1,
    id: "__type__",
    authorId: GLOBAL_ADMIN_USER_ID,
    label: "__type__",
    reverseLabel: "__type_of__",
    isPublic: false,
  },
  __reverse__: {
    version: 1,
    id: "__reverse__",
    authorId: GLOBAL_ADMIN_USER_ID,
    label: "__reverse__",
    reverseLabel: "__forward__",
    isPublic: false,
  },
  empty: { version: 1, id: "empty", authorId: GLOBAL_ADMIN_USER_ID, label: "", reverseLabel: "", isPublic: false },
};

export const MAX_PREFIX_LENGTH = 3;
export const DELETED_NODE_TEXT = "Deleted Node";
