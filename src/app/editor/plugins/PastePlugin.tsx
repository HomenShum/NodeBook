import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, COMMAND_PRIORITY_LOW, KEY_DOWN_COMMAND, PASTE_COMMAND } from "lexical";
import Promise from "lie";
import { useEffect, useRef } from "react";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { transformTextToChips } from "@/app/editor/utils/links";
import { $getChipsAroundSelection } from "@/app/editor/utils/selection";
import { Chip, GraphNode } from "@/app/graph/GraphNode";
import { GraphStore } from "@/app/graph/GraphStore";
import { TxCombined } from "@/app/graph/GraphTransactionTypes";
import { ChipsWithContext, MEW_CLIPBOARD_MIMETYPE } from "@/app/tree/clipboard";
import { getAuthFetch, uuid } from "@/app/util";
import { useViewStore } from "@/app/view/useViewStore";
import { PasteLinksOption } from "@/db/schema";

/**
 * Plugin that allows pasting multiple lines of text into a node.
 */
export const PastePlugin = () => {
  const graphStore = useGraphStore();
  const settingsStore = useSettingsStore();
  const viewStore = useViewStore();
  const [editor] = useLexicalComposerContext();
  const { treeNode } = useTreeNode();
  const tree = treeNode.tree;
  const { object, relationWithParent, path } = treeNode;
  const shiftWasPressed = useRef<boolean>(false);

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

        // Collect all the new node IDs created during pasting
        // and the ID of the first existing node in-which the paste event occurs
        const pastedNodeIds = [object.id];

        const mewData = event.clipboardData.getData(MEW_CLIPBOARD_MIMETYPE);
        const lines = normalizeDepth(
          mewData
            ? getLinesFromMewData(mewData, shiftKey)
            : getLinesFromPlainText(event.clipboardData.getData("text/plain"), shiftKey),
        );

        let txs: TxCombined = [];
        let convertToNote = false;
        const newRootId = uuid();
        // If there are multiple lines and viewType is note, convert the node to note
        if (lines.length > 1 && viewStore.viewType === "note" && treeNode.parentGroup.id !== "noteContent") {
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

          graphStore.applyCombinedTransaction(txs);

          tree.setFocusedNode(createSiblingUnder ? treeNode.parent.path + `/${groupId}/` + siblingRelId : path, "end");

          // Retreive all new node paths from tree.state using the list of all new relations.
          // We require that treeNode's path is a prefix.
          // const allPaths = tree.state.descendantTreeNodesById.keys();
          // const prefix = treeNode.path;
          // const newPaths = Array.from(allPaths).filter((path) => path.startsWith(prefix));
          // for (const path of newPaths) {
          //   tree.setPathExpanded(path, true);
          // }
          !shiftKey && unfurlLinks(pastedNodeIds, graphStore);
          return true;
        }
        return false;
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

  graphStore.applyCombinedTransaction(txs);
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

  return lines.map(({ chips, depth, isChecked }) => {
    let newDepth: number;

    if (depth - lastDepth > 1 && !depthsMap.has(depth)) {
      newDepth = lastDepth + 1;
      depthsMap.set(depth, newDepth);
    } else {
      newDepth = depthsMap.get(depth) ?? depth;
    }

    lastDepth = newDepth;
    return { chips, depth: newDepth, isChecked: isChecked ?? null };
  });
};
