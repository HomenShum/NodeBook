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
export type LoadingMatch = { key: string; type: "loading" };

export type Match = GraphNodeMatch | GraphRelationMatch | GraphRelationTypeMatch | LoadingMatch;

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

export type TemplateDropdown = {
  type: "template";
  search: string;
  matches: Match[];
};

export type Dropdown = MentionDropdown | SearchAndReplaceDropdown | TemplateDropdown | null;
