import { captureException } from "@sentry/nextjs";
import { observer } from "mobx-react-lite";
import { Search } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { useTree } from "@/app/tree/TreeContext";
import { useViewStore } from "@/app/view/useViewStore";
import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import ApiClient from "@/app/api/utils/client/ApiClient";

import styles from "./AiSearchSidebar.module.css";
const AiSearchSidebar = observer(function AiSearchSidebar() {
  const viewStore = useViewStore();
  const tree = useTree();
  const graphStore = useGraphStore();

  useEffect(() => {}, []);

  if (!viewStore.aiSearchStore.isSidebarOpen) return <></>;

  const resetState = () => {
    viewStore.setAiSearchState({
      wasQueried: false,
      aiResponse: "",
      relevancyMap: {},
      unconfirmedNodeIds: [],
      unconfirmedRelationIds: [],
      stats: {
        existingConnectionCount: 0,
        existingNodesCount: 0,
        metaIdsInserted: { nodeIds: [], relationIds: [] },
        newConnectionsCount: 0,
        newNodesCount: 0,
        nodeIdsInserted: [],
        nodeIdsExisting: [],
        queryNodeId: "",
        relationIdsInserted: [],
        nodeIdToRelevancy: {},
      },
      aiNodes: [],
      aiRelations: [],
    });
  };

  const persistAllUnconfirmed = async () => {
    await Promise.all(
      viewStore.aiSearchStore.unconfirmedNodeIds.map((id) => {
        return graphStore.updateNode({
          nodeId: id,
          nodeProps: {
            attributes: {
              isConfirmed: true,
            },
          },
        });
      }),
    );
    resetState();
  };

  const deleteAllUnconfirmed = async () => {
    await Promise.all(
      viewStore.aiSearchStore.unconfirmedNodeIds.map((id) => {
        return graphStore.removeNode({ nodeId: id });
      }),
    );
    resetState();
  };

  const handleSearch = async () => {
    viewStore.setAiSearchState({ wasQueried: true, isLoading: true });
    try {
      const response = await ApiClient.aiSearch.search({
        query: viewStore.aiSearchStore.query,
        rootNodeId: tree.rootObjectId,
        createQueryNode: viewStore.aiSearchStore.createQueryNode,
      });

      const unconfirmedNodeIds: string[] = Array.from(
        new Set([...viewStore.aiSearchStore.unconfirmedNodeIds, ...response.data.stats.nodeIdsInserted]),
      );
      await graphStore.layerManager.loadWithIds([
        response.data.stats.queryNodeId,
        ...response.data.stats.nodeIdsExisting,
        ...unconfirmedNodeIds,
      ]);

      //Todo: Expand the query tree
      //Todo: Ask Hari (indicate unconfirmed)
      const relevancyMap: Record<string, string[]> = {};

      [...response.data.stats.nodeIdsExisting, ...response.data.stats.nodeIdsInserted].forEach((nodeId) => {
        const node = graphStore.getNode(nodeId);
        const whyRelevant = node && (node.attributes.whyRelevant as string);
        if (!whyRelevant) {
          console.log("Not found for", {
            nodeId,
            nodeIdFromNode: node ? node.id : null,
            whyRelevant: node ? node.attributes.whyRelevant : null,
          });
          captureException("Weird edge case, missing relevancy", {
            extra: {
              createQueryNode: viewStore.aiSearchStore.createQueryNode,
              query: viewStore.aiSearchStore.query,
              nodeId: nodeId,
            },
          });
          return;
        }
        if (relevancyMap[whyRelevant] === undefined) {
          relevancyMap[whyRelevant] = [];
        }
        relevancyMap[whyRelevant].push(node?.text);
      });

      console.log(relevancyMap, "RM");

      viewStore.setAiSearchState({
        relevancyMap,
      });

      console.log(unconfirmedNodeIds, relevancyMap);

      viewStore.setAiSearchState({
        aiNodes: response.data.aiGraph.nodes,
        stats: response.data.stats,
        aiRelations: response.data.aiGraph.edges,
        relevancyMap,
        unconfirmedNodeIds: Array.from(
          new Set([...viewStore.aiSearchStore.unconfirmedNodeIds, ...response.data.stats.nodeIdsInserted]),
        ),
        unconfirmedRelationIds: Array.from(
          new Set([...viewStore.aiSearchStore.unconfirmedRelationIds, ...response.data.stats.relationIdsInserted]),
        ),
      });
    } catch (e) {
      console.log("Something went wrong", e);
    } finally {
      viewStore.setAiSearchState({
        isLoading: false,
      });
    }
  };

  const acceptUnconfirmedNode = async (nodeId: string) => {
    await graphStore.updateNode({
      nodeId,
      nodeProps: {
        attributes: {
          isConfirmed: true,
        },
      },
    });
    viewStore.setAiSearchState({
      unconfirmedNodeIds: viewStore.aiSearchStore.unconfirmedNodeIds.filter((id) => id !== nodeId),
    });
  };
  const deleteUnconfirmedNode = async (nodeId: string) => {
    await graphStore.removeNode({ nodeId });
    viewStore.setAiSearchState({
      unconfirmedNodeIds: viewStore.aiSearchStore.unconfirmedNodeIds.filter((id) => id !== nodeId),
    });
  };

  return (
    <div className={styles.Container}>
      <div className={styles.SearchContainer}>
        <div className={styles.SearchIconWrapper}>
          <Search size={14} strokeWidth={1.5} />
        </div>
        <input
          className={styles.SearchContent}
          value={viewStore.aiSearchStore.query}
          onChange={(e) => viewStore.setAiSearchState({ query: e.target.value })}
          type={"text"}
        />
      </div>
      <div className={styles.CheckboxContainer}>
        <input
          type={"checkbox"}
          checked={viewStore.aiSearchStore.createQueryNode}
          onChange={(e) => {
            viewStore.setAiSearchState({ createQueryNode: e.target.checked });
          }}
        />
        <label>Create query node</label>
      </div>
      {!viewStore.aiSearchStore.isLoading && (
        <Button size="sm" onClick={handleSearch}>
          Search
        </Button>
      )}
      {viewStore.aiSearchStore.isLoading && <Loader />}

      {!viewStore.aiSearchStore.isLoading && viewStore.aiSearchStore.aiNodes.length > 0 && (
        <div className={styles.StagingContainer}>
          <hr style={{ width: "100%", margin: "10px 0" }} />
          <p style={{ fontSize: "15px", margin: "10px 0px", marginTop: "0" }}>
            {viewStore.aiSearchStore.aiNodes.length} nodes found and {viewStore.aiSearchStore.aiRelations.length}{" "}
            connections found
          </p>
          <table className={styles.RelevancyList}>
            <tbody>
              <tr>
                <th>Relevancy</th>
                <th>Node</th>
              </tr>
              {Object.keys(viewStore.aiSearchStore.relevancyMap).map((whyRelevant, index) => {
                return (
                  <tr key={index}>
                    <td>{whyRelevant}</td>
                    <td>{viewStore.aiSearchStore.relevancyMap[whyRelevant].join(", ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <hr style={{ width: "100%", margin: "10px 0" }} />
          <details className={styles.GlobalStagingControls}>
            <summary>Item By Item</summary>
            <table className={styles.RelevancyList}>
              <tbody>
                <tr>
                  <th>Title</th>
                  <th>Accept</th>
                  <th>Reject</th>
                </tr>
                {viewStore.aiSearchStore.unconfirmedNodeIds.map((nodeId, id) => {
                  const node = graphStore.getNode(nodeId);
                  if (!node) return <></>;
                  return (
                    <tr key={id}>
                      <td>{node.text}</td>
                      <td>
                        <Button size={"sm"} onClick={() => acceptUnconfirmedNode(nodeId)}>
                          Accept
                        </Button>
                      </td>
                      <td>
                        <Button size={"sm"} onClick={() => deleteUnconfirmedNode(nodeId)}>
                          Reject
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </details>
          {viewStore.aiSearchStore.unconfirmedNodeIds.length > 0 && (
            <div className={styles.StagingButtons}>
              <Button size={"sm"} onClick={() => persistAllUnconfirmed()}>
                Accept All ({viewStore.aiSearchStore.unconfirmedNodeIds.length})
              </Button>
              <Button size={"sm"} onClick={() => deleteAllUnconfirmed()}>
                Delete all ({viewStore.aiSearchStore.unconfirmedNodeIds.length})
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

function Loader() {
  const [textIndex, setTextIndex] = useState<number>(0);
  const timer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timer.current && textIndex >= messages.length) {
      clearInterval(timer.current);
      return undefined;
    }
    timer.current = setInterval(() => {
      setTextIndex((prev) => prev + 1);
    }, 1200);
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
      }
    };
  }, [textIndex]);

  return (
    <div className={styles.LoadingContainer}>
      {messages.slice(0, textIndex).map((message, index) => {
        return (
          <span className={styles.EllipsisAnimation} key={index}>
            {message}
          </span>
        );
      })}
    </div>
  );
}

const messages = [
  "Analyzing your search query",
  "Searching across 1M nodes and edges",
  "Profiling",
  "Applying metadata filters",
  "Collating results",
  "Cleaning up",
];

export default AiSearchSidebar;
