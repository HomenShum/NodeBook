import { GraphNode } from "@/app/graph/GraphNode";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphRelationType } from "@/app/graph/types";
import { MentionTrigger } from "@/lib/utils";

export type GraphNodeMatch = { key: string; type: "node"; object: GraphNode; score: number };
export type GraphRelationMatch = { key: string; type: "relation"; object: GraphRelation; score: number };
export type GraphRelationTypeMatch = {
  key: string;
  type: "relationType";
  object: GraphRelationType;
  isForward: boolean;
  score: number;
};

export type Match = GraphNodeMatch | GraphRelationMatch | GraphRelationTypeMatch;

export type MentionDropdown = {
  type: "mention";
  search: string;
  matches: Match[];
  mentionTrigger: MentionTrigger;
};

export type SearchAndReplaceDropdown = {
  type: "searchAndReplace";
  search: string;
  matches: Match[];
  initiatedManually: boolean;
};

export type Dropdown = MentionDropdown | SearchAndReplaceDropdown | null;
