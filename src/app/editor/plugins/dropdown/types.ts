import { GraphNode } from "@/app/graph/GraphNode";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphRelationType } from "@/app/graph/types";

export type Match =
  | { key: string; type: "node"; object: GraphNode; score: number }
  | { key: string; type: "relation"; object: GraphRelation; score: number }
  | { key: string; type: "relationType"; object: GraphRelationType; isForward: boolean; score: number };

export type MentionDropdown = {
  type: "mention";
  search: string;
  matches: Match[];
};

export type Dropdown =
  | MentionDropdown
  | {
      type: "searchAndReplace";
      search: string;
      matches: Match[];
      initiatedManually: boolean;
    }
  | null;
