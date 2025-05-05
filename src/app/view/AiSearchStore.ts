import { makeAutoObservable } from "mobx";

import { AiEdge, AiNode, AiSearchStats } from "@/app/api/search/types";

export class AiSearchStore {
  public query: string = "";
  public wasQueried: boolean = false;
  public isLoading: boolean = false;
  public aiNodes: AiNode[] = [];
  public aiRelations: AiEdge[] = [];
  public createQueryNode = false;
  public aiResponse: string | null = null;
  public addNodesInQueryTermToGraph: boolean = false;
  public relevancyMap: Record<string, string[]> = {};
  public unconfirmedNodeIds: string[] = [];
  public unconfirmedRelationIds: string[] = [];
  public stats: AiSearchStats = {
    existingConnectionCount: 0,
    existingNodesCount: 0,
    metaIdsInserted: { nodeIds: [], relationIds: [] },
    newConnectionsCount: 0,
    newNodesCount: 0,
    nodeIdsInserted: [],
    queryNodeId: "",
    relationIdsInserted: [],
    nodeIdsExisting: [],
    nodeIdToRelevancy: {},
  };
  public isSidebarOpen: boolean = false;
  constructor() {
    makeAutoObservable(this);
  }
}
