"use client";

import { Check, ChevronDown, ChevronUp, Mic, RefreshCw } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { GraphNode } from "@/app/graph/GraphNode";
import { TxCombinedPart } from "@/app/graph/GraphTransactionTypes";
import { cn } from "@/lib/utils";

import styles from "./VoiceOperationsList.module.css";

type VoiceInput = {
  node: GraphNode;
  text: string;
  timestamp: string;
};

type OperationState = {
  isLoading: boolean;
  error: string | null;
  operations: {
    simpleOperations: TxCombinedPart[];
    complexOperations: TxCombinedPart[];
  } | null;
};

export const VoiceOperationsList = observer(() => {
  const graphStore = useGraphStore();
  const [voiceInputs, setVoiceInputs] = useState<VoiceInput[]>([]);
  const [operationsMap, setOperationsMap] = useState<Record<string, OperationState>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [expandedOperations, setExpandedOperations] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);

  // Function to generate tree text representation of the graph
  const generateTreeText = (node: any, depth: number = 0, visited = new Set<string>(), maxDepth = 5): string => {
    if (visited.has(node.id) || depth > maxDepth) return "";
    visited.add(node.id);

    const indent = "  ".repeat(depth);
    const bar = depth > 0 ? "- " : "";
    let result = `${indent}${bar}${node.text || "Untitled"} (${node.id})\n`;

    if (depth < maxDepth) {
      const childRelations = node.relations.filter((r: any) => r.from.id === node.id);
      for (const relation of childRelations) {
        const childNode = relation.to;
        if (childNode && typeof childNode === "object") {
          result += generateTreeText(childNode, depth + 1, visited, maxDepth);
        }
      }
    }

    return result;
  };

  const loadVoiceInputs = async () => {
    setIsLoading(true);
    try {
      const myStreamNode = graphStore.getNode(graphStore.myStreamNodeId);
      if (!myStreamNode) return;

      // Get all child relations from My Stream
      const childRelations = myStreamNode.relations.filter((r) => r.from.id === myStreamNode.id);

      // Filter for nodes that contain #voice-input
      const voiceInputNodes = childRelations
        .map((r) => r.to)
        .filter((node): node is GraphNode => node instanceof GraphNode && node.text.includes("#voice-input"));

      // Parse text and timestamp
      const inputs = voiceInputNodes.map((node) => {
        const text = node.text;
        const hashtagIndex = text.indexOf("#voice-input");
        const cleanText = hashtagIndex > 0 ? text.substring(0, hashtagIndex).trim() : text;
        const timestampMatch = text.match(/#voice-input (.*?)$/);
        const timestamp = timestampMatch ? timestampMatch[1] : new Date().toISOString();

        return {
          node,
          text: cleanText,
          timestamp,
        };
      });

      // Sort by timestamp (newest first)
      inputs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setVoiceInputs(inputs);
    } catch (error) {
      console.error("Error loading voice inputs:", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Load voice inputs from My Stream
  useEffect(() => {
    loadVoiceInputs();
  }, [graphStore]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadVoiceInputs();
  };

  const toggleExpand = (nodeId: string) => {
    setExpandedOperations((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  const generateOperations = async (voiceInput: VoiceInput) => {
    const nodeId = voiceInput.node.id;

    // Update operations state for this node
    setOperationsMap((prev) => ({
      ...prev,
      [nodeId]: {
        isLoading: true,
        error: null,
        operations: null,
      },
    }));

    // Automatically expand this item
    setExpandedOperations((prev) => ({
      ...prev,
      [nodeId]: true,
    }));

    try {
      // Generate tree text starting from user's root
      const treeText = generateTreeText(graphStore.userRoot);

      const response = await fetch("/api/operation-generator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: voiceInput.text,
          treeText,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || "Failed to generate operations");
      }

      // Update operations for this node
      setOperationsMap((prev) => ({
        ...prev,
        [nodeId]: {
          isLoading: false,
          error: null,
          operations: data,
        },
      }));
    } catch (err) {
      console.error("Operation generation error:", err);
      setOperationsMap((prev) => ({
        ...prev,
        [nodeId]: {
          isLoading: false,
          error: err instanceof Error ? err.message : "Failed to generate operations",
          operations: null,
        },
      }));
    }
  };

  const applyOperations = (nodeId: string) => {
    const operationState = operationsMap[nodeId];
    if (!operationState?.operations) return;

    try {
      // Combine simple and complex operations
      const allOperations = [
        ...operationState.operations.simpleOperations,
        ...operationState.operations.complexOperations,
      ];

      graphStore.applyCombinedTransaction(allOperations);

      // Clear operations after applying
      setOperationsMap((prev) => ({
        ...prev,
        [nodeId]: {
          ...prev[nodeId],
          operations: null,
        },
      }));

      // Refresh the list
      loadVoiceInputs();
    } catch (err) {
      console.error("Failed to apply operations:", err);
      setOperationsMap((prev) => ({
        ...prev,
        [nodeId]: {
          ...prev[nodeId],
          error: err instanceof Error ? err.message : "Failed to apply operations",
        },
      }));
    }
  };

  const renderOperation = (op: TxCombinedPart) => {
    const descriptions: Record<string, string> = {
      addNode: "Create new node",
      addChildNode: "Create new child node",
      updateNode: "Update node",
      removeNode: "Delete node",
      addRelationType: "Create new relation type",
      addRelation: "Create new relation",
      updateRelation: "Update relation",
      removeRelation: "Delete relation",
      replaceRelationLink: "Replace relation link",
      setIsPublic: "Change visibility",
      pinRelation: "Pin relation",
      updateRelationPositionsList: "Reorder relations",
      addRelationToList: "Add to relation list",
      removeRelationFromList: "Remove from relation list",
    };

    // Extract important information based on operation type
    const getSimplifiedDescription = () => {
      switch (op.type) {
        case "addNode":
          const nodeContent = op.transaction.nodeProps?.content?.[0];
          return `Create node "${
            typeof nodeContent === "string"
              ? nodeContent
              : nodeContent?.type === "text"
              ? nodeContent?.value || "Untitled"
              : "Untitled"
          }"`;
        case "addChildNode":
          const parentNode = graphStore.getNode(op.transaction.parentId);
          const childContent = op.transaction.nodeProps?.content?.[0];
          return `Create child node "${
            typeof childContent === "string"
              ? childContent
              : childContent?.type === "text"
              ? childContent?.value || "Untitled"
              : "Untitled"
          }" under "${parentNode?.text || "Unknown parent"}"`;
        case "updateNode":
          const updateContent = op.transaction.nodeProps?.content?.[0];
          return `Update node "${
            typeof updateContent === "string"
              ? updateContent
              : updateContent?.type === "text"
              ? updateContent?.value || "Untitled"
              : "Untitled"
          }"`;
        case "removeNode":
          const nodeToRemove = graphStore.getNode(op.transaction.nodeId);
          return `Delete node "${nodeToRemove?.text || op.transaction.nodeId}"`;
        case "setIsPublic":
          const obj = graphStore.getObject(op.transaction.objectId);
          return `${op.transaction.isPublic ? "Make public" : "Make private"}: "${
            obj?.text || op.transaction.objectId
          }"`;
        case "addRelation":
          const fromNode = graphStore.getNode(op.transaction.fromId);
          const toNode = graphStore.getNode(op.transaction.toId);
          return `Connect "${fromNode?.text || "Unknown"}" to "${toNode?.text || "Unknown"}"`;
        default:
          return descriptions[op.type] || op.type;
      }
    };

    return (
      <div className={styles.OperationItem}>
        <div className={styles.OperationDescription}>{getSimplifiedDescription()}</div>
        <div className={styles.OperationType}>Operation type: {op.type}</div>
      </div>
    );
  };

  if (isLoading && !refreshing) {
    return (
      <div className={styles.VoiceOperationsList}>
        <div className={styles.LoadingContainer}>
          <div className={styles.LoadingContent}>
            <div className={styles.LoadingAvatar}></div>
            <div className={styles.LoadingTitle}></div>
            <div className={styles.LoadingSubtitle}></div>
          </div>
        </div>
      </div>
    );
  }

  if (voiceInputs.length === 0) {
    return (
      <div className={styles.VoiceOperationsList}>
        <div className={styles.EmptyContainer}>
          <h1 className={styles.EmptyTitle}>No voice inputs yet</h1>
          <p className={styles.EmptyDescription}>
            Try using the voice input button in the top toolbar to create some voice notes.
          </p>
          <button onClick={handleRefresh} className={styles.EmptyButton}>
            <RefreshCw size={14} className={styles.IconLeft} />
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.VoiceOperationsList}>
      <div className={styles.FeedContainer}>
        <div className={styles.FeedHeader}>
          <div>
            <h1 className={styles.FeedTitle}>Voice Inputs</h1>
            <p className={styles.FeedSubtitle}>Generate graph operations from your voice notes</p>
          </div>
          <button
            onClick={handleRefresh}
            className={cn(styles.RefreshButton, refreshing && styles.Refreshing)}
            disabled={refreshing}
            aria-label="Refresh voice inputs"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        <div className={styles.FeedItems}>
          {voiceInputs.map((input) => {
            const nodeId = input.node.id;
            const operationState = operationsMap[nodeId] || {
              isLoading: false,
              error: null,
              operations: null,
            };

            const isExpanded = expandedOperations[nodeId] || false;
            const hasOperations =
              operationState.operations &&
              (operationState.operations.simpleOperations.length > 0 ||
                operationState.operations.complexOperations.length > 0);

            const formattedDate = new Date(input.timestamp).toLocaleString();

            return (
              <div key={nodeId} className={styles.FeedItem}>
                <div className={styles.FeedItemContent}>
                  <div className={styles.FeedItemIcon}>
                    <div className={styles.MicIconContainer}>
                      <Mic size={14} className={styles.MicIcon} />
                    </div>
                  </div>

                  <div className={styles.FeedItemBody}>
                    <div
                      className={cn(styles.VoiceCard, hasOperations && styles.Expandable)}
                      onClick={() => hasOperations && toggleExpand(nodeId)}
                    >
                      <div className={styles.VoiceCardHeader}>
                        <div>
                          <p className={styles.VoiceText}>{input.text}</p>
                          <span className={styles.VoiceTimestamp}>{formattedDate}</span>
                        </div>

                        {hasOperations && (
                          <button
                            className={styles.ExpandButton}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(nodeId);
                            }}
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        )}
                      </div>
                    </div>

                    {!operationState.operations && !operationState.isLoading && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          generateOperations(input);
                        }}
                        className={styles.GenerateButton}
                      >
                        Generate Operations
                      </button>
                    )}

                    {operationState.isLoading && (
                      <div className={styles.LoadingIndicator}>
                        <div className={styles.LoadingSpinner}></div>
                        <div className={styles.LoadingText}>Generating operations...</div>
                      </div>
                    )}

                    {operationState.error && (
                      <div className={styles.ErrorMessage}>
                        <p className={styles.ErrorTitle}>Error</p>
                        <p className={styles.ErrorDetails}>{operationState.error}</p>
                      </div>
                    )}

                    {operationState.operations &&
                      !operationState.isLoading &&
                      !operationState.error &&
                      operationState.operations.simpleOperations.length === 0 &&
                      operationState.operations.complexOperations.length === 0 && (
                        <div className={styles.NoOperationsMessage}>No operations generated</div>
                      )}

                    {hasOperations && isExpanded && (
                      <div className={styles.OperationsContainer}>
                        <div className={styles.OperationsList}>
                          <div className={styles.OperationsTitle}>Operations to apply:</div>

                          {operationState.operations && operationState.operations.simpleOperations.length > 0 && (
                            <div className={styles.OperationsGroup}>
                              <div className={styles.OperationsGroupTitle}>Simple Operations</div>
                              <div className={styles.OperationsItems}>
                                {operationState.operations.simpleOperations.map((op, i) => (
                                  <div key={i}>{renderOperation(op)}</div>
                                ))}
                              </div>
                            </div>
                          )}

                          {operationState.operations && operationState.operations.complexOperations.length > 0 && (
                            <div className={styles.OperationsGroup}>
                              <div className={styles.OperationsGroupTitle}>Complex Operations</div>
                              <div className={styles.OperationsItems}>
                                {operationState.operations.complexOperations.map((op, i) => (
                                  <div key={i}>{renderOperation(op)}</div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            applyOperations(nodeId);
                          }}
                          className={styles.ApplyButton}
                        >
                          <Check size={14} className={styles.IconLeft} />
                          Apply Operations
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

export default VoiceOperationsList;
