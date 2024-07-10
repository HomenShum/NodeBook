import { FractionalPositionedList } from "@/app/graph/FractionalPositionedList";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { TxCombinedPart } from "@/app/graph/GraphTransactionTypes";
import { SerializedSyncData } from "@/app/persistence/SerializedData";

export interface SyncData {
  transactionId: string;
  transaction: TxCombinedPart;
  result: {
    nodes?: GraphNode[];
    nodesDeleted?: GraphNode[];
    relations?: GraphRelation[];
    relationsDeleted?: GraphRelation[];
    relationLists?: Record<string, FractionalPositionedList<GraphRelation>>;
    pinnedRelationLists?: Record<string, FractionalPositionedList<GraphRelation>>;
  };
  serializedResult?: SerializedSyncData;
}

export interface SyncTask {
  dataToSync: SyncData;
  undo: () => void;
}
