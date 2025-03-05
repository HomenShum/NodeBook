import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, COMMAND_PRIORITY_LOW, KEY_DOWN_COMMAND, PASTE_COMMAND } from "lexical";
import { useEffect, useRef } from "react";

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
import { getAuthFetch, uuid } from "@/app/util";
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
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        const shiftKey = shiftWasPressed.current;
        shiftWasPressed.current = false;
        if (!(object instanceof GraphNode) || !event.clipboardData) return false;

        const clipboardData = event.clipboardData;

        // Handle the paste operation in an async IIFE
        (async () => {
          // Collect all the new node IDs created during pasting
          // and the ID of the first existing node in-which the paste event occurs
          const pastedNodeIds = [object.id];

          const mewData = clipboardData.getData(MEW_CLIPBOARD_MIMETYPE);
          const lines = normalizeDepth(
            mewData
              ? getLinesFromMewData(mewData, shiftKey)
              : getLinesFromPlainText(clipboardData.getData("text/plain"), shiftKey),
          );

          // Store original node IDs if they exist
          const originalNodeIds = lines
            .filter((line) => line.nodeId !== undefined)
            .map((line) => line.nodeId as string);

          // Check if we have node IDs and if all nodes are at the same level
          const canConvertToReferences = hasPastedNodeIdsAndSingleLevel(lines);

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

              // Depth is ignored for the first line, since we just add it to the current node
              txs.push({
                type: "updateNode",
                transaction: {
                  nodeId: object.id,
                  nodeProps: {
                    content: newChips,
                    isChecked: firstLine.isChecked !== undefined ? firstLine.isChecked : null,
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

            let createSiblingUnder = lines.length > 0;

            // Then for the remaining lines, create children positioned after the correct parent
            lines.forEach(({ chips, depth, isChecked }) => {
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
            });

            let siblingRelId = uuid();
            if (createSiblingUnder) {
              txs.push({
                type: "addChildNode",
                transaction: {
                  parentId: treeNode.parent.object.id,
                  relationProps: {
                    id: siblingRelId,
                  },
                  after: relationsAtDepth[0] === "UNUSED" ? relationsAtDepth[1] : relationsAtDepth[0],
                },
              });
            }

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

            tree.setFocusedNode(
              createSiblingUnder ? treeNode.parent.path + `/${groupId}/` + siblingRelId : path,
              "end",
            );

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
    .map((chip) => chip.value)
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
      slicedColonChip.value = slicedColonChip.value.slice(slicedColonChip.value.indexOf("::") + 2);
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
  if (trimmedText.startsWith("[x] ") || trimmedText.startsWith("[X] ")) {
    return { isChecked: true, remainingText: trimmedText.substring(4) };
  }
  if (trimmedText.startsWith("[ ] ")) {
    return { isChecked: false, remainingText: trimmedText.substring(4) };
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

export const getLinesFromPlainText = (text: string, shiftKey: boolean): ChipsWithContext[] => {
  return shiftKey
    ? [{ chips: transformTextToChips(text), depth: 0 }]
    : text
        .split("\n")
        .filter((l) => l.length > 0)
        .map((value) => {
          const { remainingText: textAfterDepth, depth } = getDepthFromTextOffset(value);
          const { isChecked, remainingText } = getTodoStatus(textAfterDepth);
          return { chips: transformTextToChips(remainingText), depth, isChecked: isChecked ?? null };
        }) ?? [];
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
