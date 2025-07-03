import { $insertDataTransferForRichText } from "@lexical/clipboard";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import axios from "axios";
import { $getSelection, COMMAND_PRIORITY_LOW, KEY_DOWN_COMMAND, PASTE_COMMAND } from "lexical";
import { useEffect, useRef } from "react";

import ApiClient from "@/app/api/utils/client/ApiClient";
import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useOutlineParent } from "@/app/contexts/OutlineContentContext";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { transformTextToChips } from "@/app/editor/utils/links";
import { $getChipsAroundSelection } from "@/app/editor/utils/selection";
import { Chip, GraphNode } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";
import { GraphStore } from "@/app/graph/GraphStore";
import { TxCombined } from "@/app/graph/GraphTransactionTypes";
import { useToast } from "@/app/hooks/useToast";
import { ChipsWithContext, MEW_CLIPBOARD_MIMETYPE } from "@/app/tree/clipboard";
import { TreeNodeContentSelectionPosition, TreeSelection } from "@/app/tree/selection";
import { getAuthFetch, toast, uuid } from "@/app/util";
import { useViewStore } from "@/app/view/useViewStore";
import { PasteLinksOption } from "@/db/schema";
import { HASHTAG_SYMBOL } from "@/lib/utils";

// Helper function to extract hashtags from text content
const extractHashtags = (chips: Chip[]): string[] => {
  const hashtags: string[] = [];
  let currentHashtag = "";
  let isInHashtag = false;

  for (const chip of chips) {
    if (chip.type !== "text") continue;

    const text = chip.value;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (char === HASHTAG_SYMBOL) {
        if (currentHashtag) hashtags.push(currentHashtag);
        currentHashtag = "";
        isInHashtag = true;
        continue;
      }

      if (isInHashtag) {
        if (/[a-zA-Z0-9_-]/.test(char)) {
          currentHashtag += char;
        } else {
          if (currentHashtag) hashtags.push(currentHashtag);
          currentHashtag = "";
          isInHashtag = false;
        }
      }
    }

    if (isInHashtag && currentHashtag) {
      hashtags.push(currentHashtag);
    }
  }

  return hashtags;
};

type HashtagProcessingResult = {
  linkedCount: number;
  createdCount: number;
};

// Helper function to process hashtags after paste
const processHashtags = async (
  pastedNodeIds: string[],
  graphStore: GraphStore,
): globalThis.Promise<HashtagProcessingResult> => {
  const txs: TxCombined = [];
  const hashtagsByText = new Map<string, string>(); // text -> nodeId
  let linkedCount = 0;
  let createdCount = 0;

  // First pass: collect all hashtags and create/find nodes for them
  for (const nodeId of pastedNodeIds) {
    const node = graphStore.getNode(nodeId);
    if (!node) continue;

    const hashtags = extractHashtags(node.content);
    for (const hashtagText of hashtags) {
      if (hashtagsByText.has(hashtagText)) continue;

      // Check if hashtag exists in myHashtags. Sort by the hashtags with the largest
      //  number of relations to the node
      const existingHashtag = Array.from(graphStore.getNode(graphStore.myHashtagsNodeId)?.children ?? [])
        .sort((a: GraphObject, b: GraphObject) => {
          const aRelations = a.relations.length;
          const bRelations = b.relations.length;
          return bRelations - aRelations;
        })
        .find((node) => node.text === `#${hashtagText}`);

      if (existingHashtag) {
        hashtagsByText.set(hashtagText, existingHashtag.id);
      } else {
        const newNodeId = uuid();
        hashtagsByText.set(hashtagText, newNodeId);

        // Create new hashtag node
        txs.push({
          type: "addChildNode",
          transaction: {
            parentId: graphStore.myHashtagsNodeId,
            nodeProps: {
              id: newNodeId,
              content: [{ type: "text", value: `#${hashtagText}` }],
            },
            after: -1,
          },
        });
        createdCount++;
      }
    }
  }

  // Second pass: create relations and convert hashtags to mention chips
  for (const nodeId of pastedNodeIds) {
    const node = graphStore.getNode(nodeId);
    if (!node) continue;

    const newContent: Chip[] = [];
    let currentText = "";
    let isInHashtag = false;
    let currentHashtag = "";

    // Process each chip and convert hashtags to mention chips
    for (const chip of node.content) {
      if (chip.type !== "text") {
        if (currentText) {
          newContent.push({ type: "text", value: currentText });
          currentText = "";
        }
        newContent.push(chip);
        continue;
      }

      const text = chip.value;
      for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (char === HASHTAG_SYMBOL) {
          if (currentText) {
            newContent.push({ type: "text", value: currentText });
            currentText = "";
          }
          if (currentHashtag) {
            const hashtagNodeId = hashtagsByText.get(currentHashtag);
            if (hashtagNodeId) {
              newContent.push({ type: "mention", value: hashtagNodeId, mentionTrigger: HASHTAG_SYMBOL });
              linkedCount++;
            }
          }
          currentHashtag = "";
          isInHashtag = true;
          continue;
        }

        if (isInHashtag) {
          if (/[a-zA-Z0-9_-]/.test(char)) {
            currentHashtag += char;
          } else {
            if (currentHashtag) {
              const hashtagNodeId = hashtagsByText.get(currentHashtag);
              if (hashtagNodeId) {
                newContent.push({ type: "mention", value: hashtagNodeId, mentionTrigger: HASHTAG_SYMBOL });
                linkedCount++;
              }
            }
            currentHashtag = "";
            isInHashtag = false;
            currentText += char;
          }
        } else {
          currentText += char;
        }
      }
    }

    // Handle any remaining text or hashtag
    if (currentText) {
      newContent.push({ type: "text", value: currentText });
    }
    if (currentHashtag) {
      const hashtagNodeId = hashtagsByText.get(currentHashtag);
      if (hashtagNodeId) {
        newContent.push({ type: "mention", value: hashtagNodeId, mentionTrigger: HASHTAG_SYMBOL });
        linkedCount++;
      }
    }

    if (newContent.some((chip) => chip.type === "mention" && chip.mentionTrigger === HASHTAG_SYMBOL)) {
      // Update node content with new chips
      txs.push({
        type: "updateNode",
        transaction: {
          nodeId: node.id,
          nodeProps: {
            content: newContent,
          },
        },
      });
    }

    // Create relations between the node and hashtags
    for (const hashtagText of extractHashtags(node.content)) {
      const hashtagNodeId = hashtagsByText.get(hashtagText);
      if (!hashtagNodeId) continue;

      txs.push({
        type: "addRelation",
        transaction: {
          fromId: nodeId,
          toId: hashtagNodeId,
          relationTypeId: graphStore.relationTypesById.relatedTo.id,
        },
      });
    }
  }

  if (txs.length > 0) {
    await graphStore.applyCombinedTransaction(txs);
  }

  return { linkedCount, createdCount };
};

// Check if pasted content contains node IDs and is only one level deep
const hasPastedNodeIdsAndSingleLevel = (lines: ChipsWithContext[]): boolean => {
  // Check if there are any lines
  if (lines.length === 0) return false;
  // Check if all lines have nodeIds
  const allHaveNodeIds = lines.some((line) => line.nodeId !== undefined);
  if (!allHaveNodeIds) return false;
  // Check if all lines have the same depth (single level)
  const firstDepth = lines[0].depth;
  const allSameDepth = lines.every((line) => line.depth === firstDepth);

  return allSameDepth;
};

// Convert pasted nodes to references to original nodes
const convertPastedNodesToReferences = async (
  parentNodeId: string,
  pastedNodeIds: string[],
  originalNodeIds: string[],
  graphStore: GraphStore,
): globalThis.Promise<number> => {
  // Skip the first node as it's the target node where we're pasting
  // and not a newly created node from the paste operation
  if (pastedNodeIds.length < 1 || originalNodeIds.length === 0) return 0;

  const txs: TxCombined = [];
  let convertedCount = 0;

  // Map original node IDs to pasted node IDs
  const originalToPastedMap = new Map<string, string>();
  for (let i = 0; i < originalNodeIds.length; i++) {
    // Use i+1 for pastedNodeIds since the first pastedNodeId is the target node
    if (i < pastedNodeIds.length) {
      originalToPastedMap.set(originalNodeIds[i], pastedNodeIds[i]);
    }
  }

  // Get the parent node
  const parentNode = graphStore.getNode(parentNodeId);
  if (!parentNode) return 0;

  // Find all relations from the parent node
  for (const relation of parentNode.relations) {
    // Check if this relation points to one of our pasted nodes
    const toNodeId = relation.to.id;
    const fromNodeId = relation.from.id;

    // Find the corresponding original node for this pasted node
    // We need to find which pasted node this is, then look up its original node
    for (const [originalId, pastedId] of originalToPastedMap.entries()) {
      if (toNodeId === pastedId || fromNodeId === pastedId) {
        // This relation points to one of our pasted nodes
        // Replace it with a reference to the original node
        txs.push({
          type: "replaceRelationLink",
          transaction: {
            relationId: relation.id,
            direction: toNodeId === pastedId ? "to" : "from", // Replace the "to" side of the relation
            replaceWith: {
              type: "existing-object",
              id: originalId,
            },
          },
        });

        convertedCount++;
        break;
      }
    }
  }

  if (txs.length > 0) {
    await graphStore.applyCombinedTransaction(txs);
  }

  return convertedCount;
};

/**
 * Insert a ImageNode at the caret position with blob as source, upload
 * image to S3, after upload is successfully, replace blob with the
 * uploaded URL.
 */
const $handleImagePaste = async ({
  graphStore,
  nodeId,
  file,
}: {
  graphStore: GraphStore;
  nodeId: string;
  file: File;
}): Promise<void> => {
  const CLOUDFRONT_CDN_URL = "https://d3sffy99zp9cp0.cloudfront.net";
  const selection = $getSelection();

  if (!selection) return;

  //Todo: Move to constants file and export so server can use it too.
  const MAX_UPLOAD_IN_BYTES = 16777216; //16 MB (in binary)

  if (file.size > MAX_UPLOAD_IN_BYTES) {
    toast("We only support image uploads upto 16MB");
    return;
  }

  const { chipsBefore, chipsAfter } = $getChipsAroundSelection(selection);
  const mime = file.type;
  const imageChip: Chip = { type: "image", url: URL.createObjectURL(file) };

  const imageChipInsertIndex = chipsBefore.length;

  await graphStore.updateNode({
    nodeId,
    nodeProps: {
      content: [...chipsBefore, imageChip, ...chipsAfter],
    },
  });

  const node = graphStore.getNode(nodeId);

  if (!node) return;

  const { url, fields } = (await ApiClient.files.getPresignedData(mime)).data;

  const formData = new FormData();
  Object.keys(fields).forEach((key) => formData.append(key, fields[key]));
  formData.append("file", file);

  let newChips: Chip[] = [];

  try {
    await axios.post(url, formData, {
      transformRequest: (data, headers) => {
        delete headers.Authorization;
        return data;
      },
      headers: { "Content-Type": "multipart/form-data" },
    });
    newChips = node.content.map((chip, index) => {
      if (index === imageChipInsertIndex && chip.type === "image") {
        return {
          type: "image",
          url: `${CLOUDFRONT_CDN_URL}/${fields.key}`,
        };
      }
      return chip;
    });
  } catch (e) {
    //Delete ImageNode
    newChips = node.content.filter((chip, index) => {
      return !(index === imageChipInsertIndex && chip.type === "image");
    });
    toast("Error uploading image");
  }

  await graphStore.updateNode({
    nodeId: nodeId,
    nodeProps: {
      content: [...newChips],
    },
  });
};

/**
 * Plugin that allows pasting multiple lines of text into a node.
 */
export const PastePlugin = () => {
  const graphStore = useGraphStore();
  const settingsStore = useSettingsStore();
  const viewStore = useViewStore();
  const [editor] = useLexicalComposerContext();
  const { treeNode } = useTreeNode();
  const { addToast } = useToast();
  const tree = treeNode.tree;
  const { object, relationWithParent, path } = treeNode;
  const shiftWasPressed = useRef<boolean>(false);

  const outlineParent = useOutlineParent();

  useEffect(() => {
    return editor.registerCommand<KeyboardEvent>(
      KEY_DOWN_COMMAND,
      (event) => {
        if (event.key.toLowerCase() === "v" && (event.ctrlKey || event.metaKey) && event.shiftKey) {
          shiftWasPressed.current = true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand<ClipboardEvent>(
      PASTE_COMMAND,
      (event: ClipboardEvent) => {
        event.preventDefault();
        event.stopPropagation();
        const shiftKey = shiftWasPressed.current;
        shiftWasPressed.current = false;
        if (!(object instanceof GraphNode) || !event.clipboardData) return false;

        const clipboardData = event.clipboardData;
        const file = clipboardData && clipboardData.files.length > 0 && clipboardData.files[0];

        if (file && file.type.startsWith("image/")) {
          $handleImagePaste({ graphStore, file, nodeId: object.id });
          return true;
        }

        // Handle the paste operation in an async IIFE
        (async () => {
          // Collect all the new node IDs created during pasting
          // and the ID of the first existing node in-which the paste event occurs
          const pastedNodeIds = [object.id];

          const rawTextContainsNewline = clipboardData.getData("text/plain").includes("\\n");
          const mewData = clipboardData.getData(MEW_CLIPBOARD_MIMETYPE);
          const htmlData = clipboardData.getData("text/html");
          const plainText = clipboardData.getData("text/plain");
          const lexicalData = clipboardData.getData("application/x-lexical-editor");

          let rawLines: ChipsWithContext[];
          const initialTreeSelection: TreeSelection = { ...tree.selection } as TreeSelection;

          if (mewData) {
            console.log("mewData");
            rawLines = getLinesFromMewData(mewData, shiftKey);
          } else if (lexicalData) {
            console.log("lexicalData");
            const selection = $getSelection();
            if (selection) {
              $insertDataTransferForRichText(clipboardData, selection, editor);
              return true;
            }
            return false;
          } else if (htmlData && rawTextContainsNewline) {
            console.log("htmlData");
            rawLines = getLinesFromHtmlList(htmlData, shiftKey);
          } else {
            rawLines = getLinesFromPlainText(plainText, shiftKey);
            if (rawLines.length <= 1) {
              const selection = $getSelection();
              if (selection) {
                $insertDataTransferForRichText(clipboardData, selection, editor);
                return true;
              }
            }
          }

          let lines: ChipsWithContext[];
          try {
            lines = normalizeDepth(rawLines);
          } catch (error) {
            console.error("Error processing pasted content:", error);
            // Fallback to plain text in case of any parse error
            const normalizedText = getLinesFromPlainText(plainText, shiftKey);
            lines = normalizeDepth(normalizedText);
          }

          // Store original node IDs if they exist
          const originalNodeIds = lines
            .filter((line) => line.nodeId !== undefined)
            .map((line) => line.nodeId as string);

          // Check if we have node IDs and if all nodes are at the same level
          const canConvertToReferences = hasPastedNodeIdsAndSingleLevel(lines);

          const isInlinePaste = !canConvertToReferences && lines.length === 1;

          let txs: TxCombined = [];
          let convertToNote = false;
          const newRootId = uuid();
          // If there are multiple lines and viewType is note, convert the node to note
          if (
            lines.length > 1 &&
            ((viewStore.viewType === "note" && outlineParent === "OutlineView") ||
              (viewStore.quickCaptureViewType === "note" && outlineParent === "QuickCapture")) &&
            treeNode.parentGroup.id !== "noteContent"
          ) {
            let noteConversion = tree.convertToNote(treeNode, false, true, newRootId);
            if (noteConversion instanceof Array) {
              txs.push(...noteConversion);
              convertToNote = true;
            }
          }

          // Get current relation types and create a map of relation type labels to ids so that we can easily
          // check if a relation type already exists and get the id of a relation type by its label to set a child node's
          // relation id.

          const newRelTypeIdByLabel = new Map();

          let allNewRelationIds: string[] = [];
          if (lines.length > 0) {
            // Insert the first line into the current node
            const firstLine = lines.shift();
            let groupId = treeNode.parentGroup.id;
            if (convertToNote) {
              groupId = "noteContent";
            }
            if (firstLine) {
              const selection = $getSelection();
              let newContent: Chip[];
              if (selection) {
                const { chipsBefore, chipsAfter } = $getChipsAroundSelection(selection);
                newContent = [...chipsBefore, ...firstLine.chips, ...chipsAfter];
              } else {
                // There *should* be a selection in the case where we're handling a paste, but if somehow
                // there isn't, we'll just append the first line to the current content.
                newContent = [...object.content, ...firstLine.chips];
              }

              // If the first line has a relation type, handle it accordingly.
              let {
                chips: newChips,
                relationTypeLabel,
                newRelationTypeId,
                txs: newTxs,
              } = getNewRelationType(graphStore, newContent, newRelTypeIdByLabel);

              txs.push(...newTxs);
              if (newRelationTypeId !== undefined) {
                // if there's a new relation Type id, add it to the map and set
                newRelTypeIdByLabel.set(relationTypeLabel, newRelationTypeId);
              }
              if (relationTypeLabel !== "child") {
                // If the relation type is child, we don't need to update the relation
                txs.push({
                  type: "updateRelation",
                  transaction: {
                    relationId: relationWithParent.id,
                    relationProps: {
                      relationTypeLabel: relationTypeLabel,
                    },
                  },
                });
              }

              // The key fix - only allow firstLine.isChecked to be used if it's a boolean (true/false)
              // This ensures that null/undefined values don't overwrite the existing checkbox
              const preserveExistingCheck = typeof firstLine.isChecked !== "boolean";
              const finalIsChecked = preserveExistingCheck ? object.isChecked : firstLine.isChecked;

              txs.push({
                type: "updateNode",
                transaction: {
                  nodeId: object.id,
                  nodeProps: {
                    content: newChips,
                    isChecked: finalIsChecked,
                  },
                },
              });

              txs.push(...getLinkAdditionTxs(newChips, object.id, settingsStore.pasteLinksDropdown));
            }

            // Add to this arrays as depth increases during iterating over lines, remove as it decreases
            const rootParent = convertToNote ? newRootId : treeNode.parent.object.id;
            const objectsAtDepth: string[] = [rootParent, object.id];
            const relationsAtDepth: string[] = ["UNUSED", relationWithParent.id];
            let lastDepth = 0;

            // Track the path of the last node for cursor positioning
            let lastNodePath = path;

            // Then for the remaining lines, create children positioned after the correct parent
            lines.forEach(({ chips, depth, isChecked }, index) => {
              const newNodeId = uuid();
              pastedNodeIds.push(newNodeId);
              const relationId = uuid();
              allNewRelationIds.push(relationId);

              let {
                chips: newChips,
                relationTypeLabel,
                newRelationTypeId,
                txs: newTxs,
              } = getNewRelationType(graphStore, chips, newRelTypeIdByLabel);

              chips = newChips;
              txs.push(...newTxs);
              if (newRelationTypeId !== undefined) {
                // if there's a new relation Type id, add it to the map and set
                newRelTypeIdByLabel.set(relationTypeLabel, newRelationTypeId);
              }
              const existingRelType = graphStore.getRelationTypeByLabel(relationTypeLabel);
              txs.push({
                type: "addChildNode",
                transaction: {
                  parentId: objectsAtDepth[depth],
                  nodeProps: { id: newNodeId, content: chips, isChecked },
                  relationProps: {
                    id: relationId,
                    relationTypeId: existingRelType
                      ? existingRelType.relationType.id
                      : newRelTypeIdByLabel.get(relationTypeLabel),
                  },
                  after: relationsAtDepth[depth + 1],
                },
              });

              txs.push(...getLinkAdditionTxs(chips, newNodeId, settingsStore.pasteLinksDropdown));

              // Add the newly created relations to the same group as this node's parent
              if (groupId === "pinned" || (groupId === "noteContent" && depth === 0)) {
                txs.push({
                  type: "addRelationToList",
                  transaction: {
                    objectId: objectsAtDepth[depth],
                    relationId: relationId,
                    listType: groupId,
                    after: relationsAtDepth[depth + 1],
                  },
                });
              }

              // When we go a level more shallow, remove the objects and relations up of the current level
              if (depth < lastDepth) {
                objectsAtDepth.splice(depth + 1);
                relationsAtDepth.splice(depth + 1);
              }
              lastDepth = depth;

              objectsAtDepth[depth + 1] = newNodeId;
              relationsAtDepth[depth + 1] = relationId;

              // Only update the last node path for cursor positioning if we're on the first level
              if (depth === 0) {
                lastNodePath = `${treeNode.parent.path}/${groupId}/${relationId}`;
              }
            });

            await graphStore.applyCombinedTransaction(txs);

            // Process hashtags after the paste transaction completes
            const { linkedCount, createdCount } = await processHashtags(pastedNodeIds, graphStore);

            // Show toast with conversion option if we have node IDs and single level
            if (canConvertToReferences && originalNodeIds.length > 0) {
              addToast({
                title: `Pasted ${originalNodeIds.length} nodes with existing IDs`,
                description: "Would you like to convert them to references to the original nodes?",
                duration: 10000, // 10 seconds
                action: {
                  label: "Convert to References",
                  onClick: async () => {
                    const convertedCount = await convertPastedNodesToReferences(
                      treeNode.parent.object.id,
                      pastedNodeIds,
                      originalNodeIds,
                      graphStore,
                    );
                    if (convertedCount > 0) {
                      setTimeout(() => {
                        addToast({
                          title: `Converted ${convertedCount} nodes to references`,
                          duration: 3000,
                        });
                      }, 400);
                    }
                  },
                },
              });
            }

            // Show hashtags toast if we processed any
            if (linkedCount > 0 || createdCount > 0) {
              addToast({
                title: "Hashtags processed",
                description: `${linkedCount} hashtag${
                  linkedCount !== 1 ? "s" : ""
                } linked, ${createdCount} new hashtag${createdCount !== 1 ? "s" : ""} created.`,
                action: {
                  label: "Undo",
                  onClick: () => {
                    graphStore.updateManager.undo();
                  },
                },
              });
            }

            if (
              isInlinePaste &&
              tree.selection &&
              initialTreeSelection &&
              initialTreeSelection.type === "editor" &&
              firstLine
            ) {
              const firstLineLength = firstLine.chips.reduce(
                (sum, chip) => sum + (chip.type !== "image" ? chip.value.length : 0),
                0,
              );
              let position: TreeNodeContentSelectionPosition = "end";
              console.log("initialTreeSelection", initialTreeSelection);
              if (initialTreeSelection.position === "start") {
                position = { anchorOffset: firstLineLength, focusOffset: firstLineLength };
              } else if (initialTreeSelection.position === "end") {
                position = "end";
              } else {
                const minOffset = Math.min(
                  initialTreeSelection.position.anchorOffset,
                  initialTreeSelection.position.focusOffset,
                );
                position = { anchorOffset: firstLineLength + minOffset, focusOffset: firstLineLength + minOffset };
              }
              tree.setFocusedNode(path, position);
            } else {
              // Set focus to the last pasted node instead of creating a new one
              tree.setFocusedNode(lines.length > 0 ? lastNodePath : path, "end");
            }

            !shiftKey && unfurlLinks(pastedNodeIds, graphStore);
          }
        })().catch(console.error); // Handle any async errors

        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [
    object,
    relationWithParent,
    graphStore,
    editor,
    path,
    tree,
    treeNode,
    viewStore.viewType,
    viewStore.activeTree,
    settingsStore,
    addToast,
    outlineParent,
    viewStore.quickCaptureViewType,
  ]);
  return null;
};

const unfurlLinks = async (nodeIds: string[], graphStore: GraphStore) => {
  const titleByNodeIds: Record<string, Promise<Response>> = {};
  const authFetch = getAuthFetch();

  nodeIds.forEach((id) => {
    const node = graphStore.getNode(id);
    if (!node) return;
    if (node.content[0].type === "link") {
      titleByNodeIds[node.id] = authFetch("/api/link", {
        method: "POST",
        body: JSON.stringify({
          url: node.content[0].value,
        }),
      });
    }
  });

  await Promise.all(Object.values(titleByNodeIds));

  const txs: TxCombined = [];

  for (const id of Object.keys(titleByNodeIds)) {
    const node = graphStore.getNode(id);
    const response = await titleByNodeIds[id];
    if (!response.ok || !node) continue;
    const { title } = (await response.json()) as { title: string };
    if (!title || title.length < 1) continue;

    txs.push({
      type: "updateNode",
      transaction: {
        nodeId: id,
        nodeProps: {
          content: [{ type: "text", value: `${title} — ` }, ...node.content],
        },
      },
    });
  }

  if (txs.length > 0) {
    graphStore.applyCombinedTransaction(txs);
  }
};

const getRelationTypeLabel = (chips: Chip[]) => {
  // assumes there is only one relation type label in the chips
  const indexOfColon = chips.findIndex((chip) => chip.type === "text" && chip.value.includes("::"));
  let relationTypeLabel = chips
    .slice(0, indexOfColon + 1)
    .map((chip) => (chip.type === "image" ? "" : chip.value))
    .join("");
  relationTypeLabel = relationTypeLabel.slice(0, relationTypeLabel.indexOf("::")).trim();
  return { relationTypeLabel, indexOfColon };
};

const hasDoubleColon = (chips: Chip[]) => {
  return chips.some((chip) => chip.type === "text" && chip.value.includes("::"));
};

const getNewRelationType = (graphStore: GraphStore, chips: Chip[], newRelationTypes: Map<string, string>) => {
  // Returns the new chips, relation type label and transactions to add the relation type if it doesn't exist
  let relationTypeLabel = "child";
  let newRelationTypeId = undefined;
  const txs: TxCombined = [];

  // If the text has two colons in it, assume this is a relation type being specified.
  // If it doesn't currently exist, create it.

  if (hasDoubleColon(chips)) {
    // Get the text up until the two colons
    let { relationTypeLabel: tmpRelLabel, indexOfColon } = getRelationTypeLabel(chips);
    relationTypeLabel = tmpRelLabel;
    // If the relation type label is valid, create a new relation type
    if (relationTypeLabel.length > 0 && relationTypeLabel.length < 40) {
      // 40 is an arbitrary maximum label length
      // 0 makes sure that the label isn't empty
      if (!graphStore.getRelationTypeByLabel(relationTypeLabel) && !newRelationTypes.has(relationTypeLabel)) {
        newRelationTypeId = uuid();
        txs.push({
          type: "addRelationType",
          transaction: {
            id: newRelationTypeId,
            label: relationTypeLabel,
          },
        });
      }
      // Slice the colon chip so that we get the text after the colon into the rest of the chip.
      let slicedColonChip = chips[indexOfColon];
      if (slicedColonChip.type !== "image") {
        slicedColonChip.value = slicedColonChip.value.slice(slicedColonChip.value.indexOf("::") + 2);
      }
      chips = chips.slice(indexOfColon + 1);
      chips.unshift(slicedColonChip);
    }
  }
  return { relationTypeLabel, txs, chips, newRelationTypeId };
};

const getLinkAdditionTxs = (chips: Chip[], parentId: string, mode: PasteLinksOption) => {
  // If the firstline consists of only a single link chip, return an empty array
  if (chips.length === 1 && chips[0].type === "link") {
    return [];
  }
  // This is just to get the unique links from the chips. Thank you Brendan Eich.
  const links = Array.from(new Set(chips.filter((chip) => chip.type === "link").map((chip) => chip.value)))
    .map((value) => {
      return chips.find((chip) => chip.type === "link" && chip.value === value);
    })
    .filter((chip) => chip !== undefined) as Chip[];
  const txs: TxCombined = [];

  switch (mode) {
    case "PopulateAsChildren":
      links.forEach((link) => {
        const newNodeId = uuid();
        const relationId = uuid();

        txs.push({
          type: "addChildNode",
          transaction: {
            parentId: parentId,
            nodeProps: { id: newNodeId, content: [link] },
            relationProps: { id: relationId },
          },
        });
      });
      break;
    case "PopulateAsOrphanedNodes":
      const linkTextToNodeId = new Map<string, string>();
      links.forEach((link) => {
        if (link.type !== "link") return;
        const newNodeId = uuid();

        txs.push({
          type: "addNode",
          transaction: {
            nodeProps: { id: newNodeId, content: [link] },
          },
        });

        if (!linkTextToNodeId.has(link.value)) {
          linkTextToNodeId.set(link.value, newNodeId);
          // Add relation between the mentioned node and the parent node
          txs.push({
            type: "addRelation",
            transaction: {
              fromId: newNodeId,
              toId: parentId,
            },
          });
        }
      });
      // Replace the link chips with mention chips
      chips = chips.map((chip) => {
        if (chip.type === "link" && linkTextToNodeId.has(chip.value)) {
          return { type: "mention", value: linkTextToNodeId.get(chip.value) ?? chip.value };
        }
        return chip;
      });
      txs.push({
        type: "updateNode",
        transaction: { nodeId: parentId, nodeProps: { content: chips } },
      });
      break;
  }
  return txs;
};

const getTodoStatus = (text: string): { isChecked: boolean | null; remainingText: string } => {
  const trimmedText = text.trimStart();

  // Match both standard and markdown-style to-do syntax with regex
  // For checked items: [x], - [x], * [x] (case insensitive for 'x'), ☑, ✅
  const checkedRegex = /^(?:(?:- |\* )?\[x\]\s?|[\u2611\u2612\u2705]\s?)/i;
  if (checkedRegex.test(trimmedText)) {
    const match = trimmedText.match(checkedRegex)![0];
    return { isChecked: true, remainingText: trimmedText.substring(match.length) };
  }

  // For unchecked items: [ ], - [ ], * [ ], ☐
  const uncheckedRegex = /^(?:(?:- |\* )?\[ \]\s?|[\u2610]\s?)/;
  if (uncheckedRegex.test(trimmedText)) {
    const match = trimmedText.match(uncheckedRegex)![0];
    return { isChecked: false, remainingText: trimmedText.substring(match.length) };
  }

  return { isChecked: null, remainingText: text };
};

const getLinesFromMewData = (mewData: string, shiftKey: boolean): ChipsWithContext[] => {
  const chipParts = JSON.parse(mewData) as ChipsWithContext[];
  return shiftKey
    ? [
        // Line-up the chips for one long node with a space between each constituent original node
        chipParts.reduce(
          (val: ChipsWithContext, acc: ChipsWithContext, i) => {
            acc.chips.push(...val.chips);
            if (i === 0) acc.chips.push({ type: "text", value: " " });
            // Preserve the nodeId when combining
            if (!acc.nodeId && val.nodeId) {
              acc.nodeId = val.nodeId;
            }
            return acc;
          },
          // Accumulate into a single object with a depth of 0
          { chips: [], depth: 0 } as ChipsWithContext,
        ),
      ]
    : chipParts; // Or just use the chips for the same number of nodes
};

/**
 * Parse clipboard HTML (Google Docs, Slack, ChatGPT/Claude, ProseMirror…) into
 * our internal `{ chips, depth, isChecked }[]` structure.
 *
 * Key improvements:
 * • Handles Google Docs malformed HTML where nested lists are siblings of LI
 * • Properly anchors root-level lists under previous content
 * • Respects data-indent/data-stringify-indent attributes
 * • Prevents duplicate content from nested lists
 * • Better GCD calculation for indent detection
 */
export const getLinesFromHtmlList = (html: string, shiftKey = false): ChipsWithContext[] => {
  // ── 0. Slack paragraph-break normalisation & "Shift-paste = raw" ───────────
  const normalisedHtml = html.replace(/<span[^>]*data-stringify-type=['"]paragraph-break['"][^>]*><\/span>/gi, "<br/>");

  if (shiftKey) {
    const raw = normalisedHtml.replace(/<(?:p|div|h[1-6]|li|tr|table)\b[^>]*>/gi, "\n").replace(/<br\s*\/?>/gi, "\n");
    const text = new DOMParser().parseFromString(raw, "text/html").body.textContent?.replace(/\n{3,}/g, "\n\n") ?? "";
    return [
      {
        chips: transformTextToChips(text),
        depth: 0,
        isChecked: null,
      },
    ];
  }

  // ── 1. Detect indent-step (px → levels) via GCD ─────────────────────────────
  const doc = new DOMParser().parseFromString(normalisedHtml, "text/html");
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const pxValues = Array.from(doc.querySelectorAll<HTMLElement>("[style]"))
    .flatMap((el) =>
      ["paddingLeft", "marginLeft", "paddingInlineStart", "marginInlineStart"].map(
        (k) => parseFloat((el.style as any)[k]) || 0,
      ),
    )
    .filter((v) => v > 0);
  const INDENT_PX = pxValues.length ? pxValues.reduce(gcd) : 24;

  // ── 2. Helpers ───────────────────────────────────────────────────────────────
  type BlockTags =
    | "DIV"
    | "P"
    | "UL"
    | "OL"
    | "LI"
    | "TABLE"
    | "BLOCKQUOTE"
    | "H1"
    | "H2"
    | "H3"
    | "H4"
    | "H5"
    | "H6"
    | "PRE"
    | "HR";
  const blockChildTags = new Set<BlockTags>([
    "DIV",
    "P",
    "UL",
    "OL",
    "LI",
    "TABLE",
    "BLOCKQUOTE",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "PRE",
    "HR",
  ]);

  const lines: ChipsWithContext[] = [];
  let currentSectionDepth: number | null = null;
  let headingBaseLevel: number | null = null;

  const pushLines = (raw: string, baseDepth: number) => {
    raw.split(/\r?\n/).forEach((lineText) => {
      // only emit a blank if raw was exactly whitespace, and not a multi-line split
      if (/^[\t ]*$/.test(lineText)) {
        if (raw.trim() === "" && !raw.includes("\n")) {
          lines.push({ chips: [], depth: baseDepth, isChecked: null });
        }
        return;
      }

      const { depth: extra, remainingText } = getDepthFromTextOffset(lineText);
      const trimmed = remainingText.trim();
      const { isChecked, remainingText: afterTodo } = getTodoStatus(trimmed);
      lines.push({
        chips: afterTodo ? transformTextToChips(afterTodo) : [],
        depth: baseDepth + extra,
        isChecked,
      });
    });
  };

  const cssDepth = (el: HTMLElement) => {
    const m = (el.getAttribute("style") || "").match(/(?:padding|margin)-(?:left|inline-start):\s*([\d.]+)px/i);
    return m && INDENT_PX > 0 ? Math.round(parseFloat(m[1]) / INDENT_PX) : 0;
  };

  const declaredLevel = (el: HTMLElement) => {
    const a = el.getAttribute("data-indent") ?? el.getAttribute("data-stringify-indent");
    return a !== null ? parseInt(a, 10) : null;
  };

  // ── 3. Single DOM-walk ───────────────────────────────────────────────────────
  const walk = (el: Element, currentDepth: number) => {
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        lines.push({
          chips: transformTextToChips(node.textContent || ""),
          depth: currentDepth,
          isChecked: null,
        });
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        continue;
      }
      const elem = node as HTMLElement;

      // Determines when a P or DIV should "anchor" under the last heading.
      const getAnchor = (depth: number) =>
        depth === 0 && currentSectionDepth !== null ? currentSectionDepth + 1 : depth;

      switch (elem.tagName) {
        // — LI —
        case "LI": {
          const clone = elem.cloneNode(true) as HTMLElement;
          clone.querySelectorAll("ul,ol").forEach((n) => n.remove());
          const htmlWithBreaks = clone.innerHTML.replace(/<br\s*\/?>/gi, "\n");
          const tmp = document.createElement("div");
          tmp.innerHTML = htmlWithBreaks;
          const text = tmp.textContent ?? "";

          const lvl = declaredLevel(elem);
          let itemDepth: number, nestedCtx: number;
          if (lvl !== null) {
            itemDepth = lvl; // In this model, LI's declaredLevel is its actual depth
            nestedCtx = lvl; // Nested lists start from this LI's depth
          } else {
            itemDepth = currentDepth + cssDepth(elem);
            nestedCtx = itemDepth;
          }

          pushLines(text, itemDepth);

          // Properly nested lists
          elem
            .querySelectorAll<HTMLElement>(":scope > ul, :scope > ol")
            .forEach((nested) => walk(nested, nestedCtx + 1)); // Nested lists are +1 depth

          // Handle malformed "sibling" lists (Google Docs style)
          let nextSibling = elem.nextElementSibling;
          while (nextSibling && (nextSibling.tagName === "UL" || nextSibling.tagName === "OL")) {
            walk(nextSibling as HTMLElement, nestedCtx + 1); // Treat as nested, so +1 depth
            const toRemove = nextSibling;
            nextSibling = nextSibling.nextElementSibling;
            // Mark the element as processed to avoid re-processing
            toRemove.setAttribute("data-processed", "true");
          }
          break;
        }

        // — UL/OL (anchored to last heading/paragraph when at root) —
        case "UL":
        case "OL": {
          // Skip if already processed as a sibling list
          if (elem.getAttribute("data-processed") === "true") break;

          const anchor = getAnchor(currentDepth);
          const lvl = declaredLevel(elem);
          const listDepth = lvl !== null ? lvl : anchor + cssDepth(elem);

          walk(elem, listDepth); // Children of UL/OL (i.e., LIs) will use this as their base depth
          break;
        }

        // — BLOCKQUOTE —
        case "BLOCKQUOTE":
          walk(elem, currentDepth + 1 + cssDepth(elem));
          break;

        // — HEADINGS —
        case "H1":
        case "H2":
        case "H3":
        case "H4":
        case "H5":
        case "H6": {
          const tagLevel = parseInt(elem.tagName.slice(1), 10);
          if (headingBaseLevel === null) headingBaseLevel = tagLevel;
          const rel = tagLevel - (headingBaseLevel || 1); // Ensure headingBaseLevel is not null
          const actual = Math.max(0, rel + cssDepth(elem)); // Ensure depth isn't negative
          pushLines(elem.textContent ?? "", actual);
          currentSectionDepth = actual;
          break;
        }

        // — P —
        /* ───────────────  P  (Google-Docs tabs + inline <br>)  ──────────────── */
        case "P": {
          /* 0 . ignore empty ProseMirror trailing breaks */
          if (elem.querySelector("br.ProseMirror-trailingBreak") && !elem.textContent?.trim()) break;

          /* 1 . depth = # of Apple-tab-spans that prefix this paragraph */
          const depthFromTabs = elem.querySelectorAll("span.Apple-tab-span").length;

          /* 2 . materialise every <br> in the paragraph as "\n" characters         */
          const htmlWithBreaks = elem.innerHTML.replace(/<br\s*\/?>/gi, "\n");

          /* 3 . strip span wrappers but keep the \n we just inserted               */
          const tmp = document.createElement("div");
          tmp.innerHTML = htmlWithBreaks;
          const fullText = tmp.textContent ?? "";

          /* 4 . each \n-separated chunk becomes *its own* outline line             */
          fullText.split(/\r?\n/).forEach((chunk) => {
            const text = chunk.replace(/\t/g, ""); // drop literal tabs

            const { isChecked, remainingText } = getTodoStatus(text);
            const { depth: extra, remainingText: tail } = getDepthFromTextOffset(remainingText); // spaces ⇒ extra depth

            lines.push({
              chips: transformTextToChips(tail.trim()),
              depth: getAnchor(currentDepth) + cssDepth(elem) + depthFromTabs + extra,
              isChecked,
            });
          });

          break; /* paragraph handled completely */
        }

        // — DIV —
        case "DIV": {
          if (
            elem.childElementCount === 1 &&
            elem.firstElementChild?.tagName === "BR" &&
            elem.firstElementChild.classList.contains("ProseMirror-trailingBreak") &&
            !elem.textContent?.trim()
          ) {
            break;
          }

          const hasBlocks = Array.from(elem.children).some((c) => blockChildTags.has(c.tagName as BlockTags));

          if (hasBlocks) {
            walk(elem, currentDepth + cssDepth(elem));
          } else {
            const htmlWithBreaks = elem.innerHTML.replace(/<br\s*\/?>/gi, "\n");
            const tmp = document.createElement("div");
            tmp.innerHTML = htmlWithBreaks;
            const text = tmp.textContent ?? "";
            if (text.trim()) {
              pushLines(text, getAnchor(currentDepth) + cssDepth(elem));
            }
          }
          break;
        }

        /* ───────────────  PRE  (fenced code - single node, keep \n)  ─────────────── */
        case "PRE": {
          /* 1.  Harvest the literal text inside <pre> … <code>  */
          const code = elem.textContent?.replace(/\r\n/g, "\n") ?? "";

          /* 2.  Fence only when it really is a code block                          */
          const fenced = elem.querySelector("code") ? `\`\`\`<code>\n${code}\n</code>\`\`\`` : code;

          /* 3.  Push ONE ChipsWithContext entry (don't use pushLines → no split)   */
          lines.push({
            chips: transformTextToChips(fenced),
            depth: getAnchor(currentDepth) + 1 + cssDepth(elem),
            isChecked: null,
          });
          break;
        }

        /* ───────────────  TABLE  ──────────────── */
        case "TABLE": {
          const base = getAnchor(currentDepth) + 1 + cssDepth(elem);
          const rows = Array.from(elem.querySelectorAll("tr"));
          if (!rows.length) break;

          const hdrs = Array.from(rows[0].querySelectorAll("th, td")).map(
            (c, i) => c.textContent?.trim() || `Col-${i + 1}`,
          );
          let dataRows = rows;
          if (rows[0].querySelector("th") || hdrs.some((h) => !h.startsWith("Col-"))) {
            dataRows = rows.slice(1);
          }

          dataRows.forEach((tr) => {
            const cells = Array.from(tr.cells).map((c) => c.textContent?.trim() || "");
            const obj: Record<string, string> = {};
            hdrs.forEach((h, i) => {
              obj[h] = cells[i] || "";
            });
            pushLines(JSON.stringify(obj), base);
          });
          break;
        }

        // — BR as blank line —
        case "BR":
          lines.push({
            chips: [],
            depth: currentDepth + cssDepth(el as HTMLElement),
            isChecked: null,
          });
          break;

        // — default recurse —
        default: // For other container tags like SPAN, B, I, etc.
          if (elem.childNodes.length > 0) {
            // Only recurse if it has children
            walk(elem, currentDepth + cssDepth(elem)); // CSS depth of inline elements is usually 0
          }
      }
    }
  };

  walk(doc.body, 0);
  return lines;
};

export const getLinesFromPlainText = (text: string, shiftKey: boolean): ChipsWithContext[] => {
  return shiftKey
    ? [{ chips: transformTextToChips(text), depth: 0 }]
    : (text.split("\n").map((value) => {
        const { remainingText: textAfterDepth, depth } = getDepthFromTextOffset(value);
        const { isChecked, remainingText } = getTodoStatus(textAfterDepth);
        return { chips: transformTextToChips(remainingText), depth, isChecked: isChecked ?? null };
      }) ?? []);
};

/** Add 1 depth for each tab or each 2 spaces at the beginning of the line */
export const getDepthFromTextOffset = (line: string): { depth: number; remainingText: string } => {
  let depth = 0;

  for (let i = 0; i < line.length; i++) {
    if (line[i] === "\t") {
      depth++;
    } else if (line[i] === " ") {
      let spaces = 1;
      while (line[i + 1] === " ") {
        spaces++;
        i++;
      }
      depth += Math.floor(spaces / 2);
    } else {
      break;
    }
  }

  return { depth, remainingText: line.replace(/^\s+/, "") };
};

/**
 * Make sure that any next line is at most 1 level deeper than the current line
 * That way, all nested nodes will have a parent
 */
export const normalizeDepth = (lines: ChipsWithContext[]): ChipsWithContext[] => {
  const depthsMap = new Map<number, number>();
  let lastDepth = 0;

  return lines.map(({ chips, depth, isChecked, nodeId }) => {
    let newDepth: number;

    if (depth - lastDepth > 1 && !depthsMap.has(depth)) {
      newDepth = lastDepth + 1;
      depthsMap.set(depth, newDepth);
    } else {
      newDepth = depthsMap.get(depth) ?? depth;
    }

    lastDepth = newDepth;
    return { chips, depth: newDepth, isChecked: isChecked ?? null, nodeId: nodeId ?? undefined };
  });
};
