import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_NORMAL, KEY_DOWN_COMMAND, LexicalCommand, createCommand } from "lexical";
import { nanoid } from "nanoid";
import { useEffect, useRef, useState } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { DescendantTreeNode } from "@/app/tree/nodes";

// Command to start contextual generation
export const CONTEXTUAL_GENERATION_COMMAND: LexicalCommand<string> = createCommand();

// Type for tracking generations in progress
type GenerationStatus = {
  nodeId: string;
  generationId: string;
  streamController: AbortController | null;
};

export const ContextualGenerationPlugin = ({ treeNode }: { treeNode: DescendantTreeNode }) => {
  const [editor] = useLexicalComposerContext();
  const graphStore = useGraphStore();

  // Keep track of all ongoing generations
  const [activeGenerations, setActiveGenerations] = useState<GenerationStatus[]>([]);
  const activeGenerationsRef = useRef<GenerationStatus[]>([]);

  // Update the ref when the state changes
  useEffect(() => {
    activeGenerationsRef.current = activeGenerations;
  }, [activeGenerations]);

  // Generate ASCII tree with the current position marked
  const generateTreeWithPosition = (currentNodeId: string) => {
    const generateTreeText = (node: any, depth: number = 0, visited = new Set<string>(), maxDepth = 7): string => {
      if (visited.has(node.id) || depth > maxDepth) return "";
      visited.add(node.id);

      const indent = "  ".repeat(depth);
      const bar = depth > 0 ? "- " : "";

      // Mark the current node where generation should happen
      const isCurrentNode = node.id === currentNodeId;
      let nodeText = node.text || "Untitled";

      // let result = `${indent}${bar}${nodeText}${isCurrentNode ? " <|generate_here|>" : ""} (${node.id})\n`;
      let result = `${indent}${nodeText}${isCurrentNode ? " <|generate_here|>" : ""} (${node.id})\n`;

      const maxHorizRelations = 30;
      if (depth < maxDepth) {
        const childRelations = node.relations.filter((r: any) => r.from.id === node.id);
        for (const relation of childRelations.slice(0, maxHorizRelations)) {
          const childNode = relation.to;
          if (childNode && typeof childNode === "object") {
            result += generateTreeText(childNode, depth + 1, visited, maxDepth);
          }
        }
      }

      return result;
    };

    return generateTreeText(graphStore.userRoot);
  };

  // Handle the streaming API response
  const handleStreamResponse = async (response: Response, nodeId: string, generationId: string) => {
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = ""; // Buffer to handle partial messages

    try {
      while (true) {
        // Check if this generation was cancelled
        const isActive = activeGenerationsRef.current.some((gen) => gen.generationId === generationId);

        if (!isActive) {
          console.log(`Generation ${generationId} was cancelled, stopping stream`);
          // Ensure the stream is actually cancelled on the server-side if possible
          // reader.cancel() might be needed depending on the stream implementation
          break;
        }

        const { done, value } = await reader.read();

        if (done) {
          // Process any remaining data in the buffer when the stream ends
          if (buffer.length > 0) {
            console.warn("Stream ended with unprocessed data in buffer:", buffer);
            // Optionally, try to process the last chunk if it might be valid
          }
          break;
        }

        // Add new data to the buffer
        buffer += decoder.decode(value, { stream: true });

        // Process messages based on prefixes
        let currentPosition = 0;
        while (currentPosition < buffer.length) {
          const remainingBuffer = buffer.substring(currentPosition);
          let messagePrefix: string | null = null;
          let messageType: string | null = null;

          // Find the start of the next message
          if (remainingBuffer.startsWith("f:")) {
            messagePrefix = "f:";
            messageType = "info";
          } else if (remainingBuffer.startsWith("0:")) {
            messagePrefix = "0:";
            messageType = "text";
          } else if (remainingBuffer.startsWith("e:")) {
            messagePrefix = "e:";
            messageType = "end";
          } else if (remainingBuffer.startsWith("d:")) {
            messagePrefix = "d:";
            messageType = "data"; // Or another appropriate type
          }

          if (!messagePrefix) {
            // If the remaining buffer doesn't start with a known prefix,
            // it might be incomplete data or noise. Stop processing for now.
            // console.warn("Buffer does not start with known prefix:", remainingBuffer);
            break;
          }

          const payloadStartPosition = currentPosition + messagePrefix.length;

          // Find the start of the *next* message prefix to determine the end of the current payload
          let nextPrefixPosition = -1;
          const searchStartPosition = payloadStartPosition; // Start search after the current prefix

          // Find the minimum index of the next prefix
          const prefixes = ["f:", "0:", "e:", "d:"];
          for (const prefix of prefixes) {
            const pos = buffer.indexOf(prefix, searchStartPosition);
            if (pos !== -1) {
              if (nextPrefixPosition === -1 || pos < nextPrefixPosition) {
                nextPrefixPosition = pos;
              }
            }
          }

          // If no next prefix is found, the payload might run to the end of the buffer (potentially incomplete)
          const payloadEndPosition = nextPrefixPosition === -1 ? buffer.length : nextPrefixPosition;
          const jsonPayload = buffer.substring(payloadStartPosition, payloadEndPosition);

          // Attempt to parse the payload only if we found a next prefix or the stream is done
          // If we didn't find a next prefix AND the stream is not done, the message might be incomplete
          const canProcess = nextPrefixPosition !== -1 || done;

          if (canProcess) {
            try {
              const parsedData = JSON.parse(jsonPayload);

              if (messageType === "text") {
                if (typeof parsedData === "string") {
                  // Update node text with the extracted text content
                  editor.update(() => {
                    const node = graphStore.getNode(nodeId);
                    if (node) {
                      const updatedContent = [...node.content];
                      if (updatedContent.length > 0) {
                        const lastChip = updatedContent[updatedContent.length - 1];
                        if (lastChip.type === "text") {
                          updatedContent[updatedContent.length - 1] = {
                            ...lastChip,
                            value: lastChip.value + parsedData, // Append extracted text
                          };
                        } else {
                          updatedContent.push({ type: "text", value: parsedData });
                        }
                      } else {
                        updatedContent.push({ type: "text", value: parsedData });
                      }
                      graphStore.updateNode({
                        nodeId: nodeId,
                        nodeProps: { content: updatedContent },
                      });
                    }
                  });
                } else {
                  console.warn("Parsed non-string content for 0: prefix:", parsedData);
                }
              } else if (messageType === "end" || messageType === "data") {
                console.log(`Received ${messageType} message:`, parsedData);
                // Handle end/data messages if needed
              } else if (messageType === "info") {
                console.log("Received info message:", parsedData);
                // Handle info messages if needed
              }

              // Move position past the processed message
              currentPosition = payloadEndPosition;
            } catch (e) {
              // If JSON parsing fails here, it likely means the message is incomplete
              // console.warn("Failed to parse potential JSON payload, might be incomplete:", jsonPayload, e);
              // Stop processing the current buffer and wait for more data
              break;
            }
          } else {
            // Message is potentially incomplete, wait for more data
            // console.log("Potential incomplete message, waiting for more data:", jsonPayload);
            break;
          }
        }

        // Remove the processed part from the buffer
        if (currentPosition > 0) {
          buffer = buffer.substring(currentPosition);
        }
      }

      // After the loop, handle any final processing if needed
      // (The 'done' condition in the main loop already handles final buffer state)
    } catch (error: any) {
      // Check if the error is due to the stream being aborted
      if (error.name === "AbortError") {
        console.log(`Stream reading aborted for generation ${generationId}.`);
      } else {
        console.error("Error reading stream:", error);
      }
    } finally {
      // Clean up this generation from the active list
      setActiveGenerations((prev) => prev.filter((gen) => gen.generationId !== generationId));
    }
  };

  // Start a new contextual generation
  const startContextualGeneration = async (nodeId: string) => {
    try {
      // Get current node
      const node = graphStore.getNode(nodeId);
      if (!node) {
        console.error("Node not found:", nodeId);
        return;
      }

      // Generate unique ID for this generation
      const generationId = nanoid();

      // Create abort controller for this stream
      const controller = new AbortController();

      // Add to active generations
      setActiveGenerations((prev) => [
        ...prev,
        {
          nodeId,
          generationId,
          streamController: controller,
        },
      ]);

      // Generate tree with current position marked
      const treeText = generateTreeWithPosition(nodeId);

      // Call the API with streaming enabled
      const response = await fetch("/api/contextual-generation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          treeText,
          nodeId,
        }),
        signal: controller.signal,
      });

      // Handle the streaming response
      await handleStreamResponse(response, nodeId, generationId);
    } catch (error) {
      console.error("Error in contextual generation:", error);
      // Remove from active generations on error
      setActiveGenerations((prev) => prev.filter((gen) => gen.nodeId !== nodeId));
    }
  };

  // Cancel all active generations
  const cancelAllGenerations = () => {
    activeGenerations.forEach((gen) => {
      if (gen.streamController) {
        gen.streamController.abort();
      }
    });
    setActiveGenerations([]);
  };

  // Register keyboard shortcut to trigger generation
  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        if (!event) return false;

        // Ctrl+G or Cmd+G to trigger generation
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === "g") {
          console.log("Generating...");
          event.preventDefault();

          // Start generation for this node
          startContextualGeneration(treeNode.object.id);
          return true;
        }

        // Escape key to cancel all generations
        if (event.key === "Escape" && activeGenerations.length > 0) {
          event.preventDefault();
          cancelAllGenerations();
          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor, activeGenerations]);

  // Register command handler
  useEffect(() => {
    return editor.registerCommand(
      CONTEXTUAL_GENERATION_COMMAND,
      (nodeId) => {
        if (!nodeId) return false;
        startContextualGeneration(nodeId);
        return true;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor]);

  return null;
};
