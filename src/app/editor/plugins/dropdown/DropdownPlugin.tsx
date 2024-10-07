import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import { $getRoot, COMMAND_PRIORITY_NORMAL, KEY_DOWN_COMMAND } from "lexical";
import { useCallback, useEffect, useRef, useState } from "react";

import { MentionDropdown } from "@/app/editor/plugins/dropdown/MentionDropdown";
import { SearchAndReplaceDropdown } from "@/app/editor/plugins/dropdown/SearchAndReplaceDropdown";
import { Dropdown, Match } from "@/app/editor/plugins/dropdown/types";
import { $getText, getSelectionPositions } from "@/app/editor/utils";
import { defaultRelationTypes } from "@/app/graph/constants";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useSettingsStore } from "@/app/graph/useSettingsStore";
import { DescendantTreeNode, TreeNode } from "@/app/tree/nodes";
import { checkForMentionMatch } from "@/lib/utils";

const MAX_DROPDOWN_RESULTS = 20;

/**
 * This plugin handles the dropdowns that appear below the editor.
 *
 * There are two dropdowns:
 * - Mention dropdown: appears when the user types @ and contains possible nodes
 *   to mention.
 * - Search-and-replace dropdown: appears when the user types ; (or passively
 *   appears depending on context and user setting) and contains possible
 *   nodes/relations to replace the current object with or relation types to
 *   update the current relation with (unless the current relation is already
 *   labelled, in which case we don't show relation types).
 *
 * Details:
 * - Only one dropdown can be open at a time.
 * - Don't display a dropdown until the text has changed. This is to prevent
 *   the dropdown from popping in and out while navigating between objects.
 * - The @ mention dropdown takes priority over the search-and-replace dropdown.
 *   So if you type @ while the search-and-replace dropdown is showing, the @
 *   dropdown will be shown instead.
 *
 */
export function DropdownPlugin({ treeNode }: { treeNode: TreeNode }): JSX.Element | null {
  const [dropdown, setDropdown] = useState<Dropdown>(null);
  const [editor] = useLexicalComposerContext();
  const graphStore = useGraphStore();
  const settingsStore = useSettingsStore();
  const textChanged = useRef(false);
  const isChild =
    treeNode.relationWithParent &&
    treeNode.relationWithParent.relationType.id === defaultRelationTypes.child.id &&
    treeNode.relationWithParent.to.id === treeNode.object.id;
  const labelledRelation = !isChild;
  const passiveAutocompleteActive =
    settingsStore.searchAndReplaceDropdown === "Always" ||
    (settingsStore.searchAndReplaceDropdown === "LabelledOnly" && labelledRelation);

  const getMatches = useCallback(
    (text: string, types?: ("node" | "relation" | "relationType")[]): Match[] => {
      text = text.toLocaleLowerCase().trim();
      let results = graphStore.search({ text, filters: { types }, sort: { by: "score" } });
      return [
        ...results.nodes
          .filter(({ node }) => node.id !== treeNode.object.id)
          .map(({ node, score }) => ({ key: node.id, type: "node" as const, object: node, score })),
        ...results.relations
          .filter(
            ({ relation }) =>
              relation.id !== treeNode.object.id &&
              relation.to.id !== treeNode.object.id &&
              relation.from.id !== treeNode.object.id,
          )
          .map(({ relation, score }) => ({ key: relation.id, type: "relation" as const, object: relation, score })),
        ...results.relationTypes.flatMap(({ relationType, score }) => {
          if (relationType.id === treeNode.relationWithParent?.relationType.id) {
            return [];
          }
          const res: Match[] = [];
          const label = relationType.label.toLocaleLowerCase();
          const reverseLabel = relationType.reverseLabel.toLocaleLowerCase();
          if (label.includes(text)) {
            res.push({
              key: relationType.id,
              type: "relationType" as const,
              object: relationType,
              score,
              isForward: true,
            });
          }
          if (label !== reverseLabel && reverseLabel.includes(text)) {
            res.push({
              key: relationType.id + "-rev",
              type: "relationType" as const,
              object: relationType,
              score,
              isForward: false,
            });
          }
          return res;
        }),
      ]
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_DROPDOWN_RESULTS);
    },
    [treeNode, graphStore],
  );

  const getRecentNodes = useCallback((): Match[] => {
    return Array.from(graphStore.nodesById.values())
      .filter((node) => treeNode.object.id !== node.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .filter((node) => node.id !== treeNode.object.id && node.text.length > 0)
      .slice(0, MAX_DROPDOWN_RESULTS)
      .map((node) => ({ key: node.id, type: "node" as const, object: node, score: 0 }));
  }, [graphStore, treeNode]);

  const clearDropdown = useCallback(() => {
    setDropdown((dropdown) => {
      if (dropdown?.type === "searchAndReplace" && dropdown.initiatedManually) {
        // The dropdown was initiated manually and then the user deleted the text.
        // In this case we want to hide the dropdown but we also want it to open up
        // again when the user starts typing again. We can achieve this by keeping
        // the dropdown type the same but clearing the search and matches.
        return { ...dropdown, search: "", matches: [] };
      } else {
        return null;
      }
    });
  }, []);

  /**
   * Handles the main dropdown state updates. It's registered by the
   * LexicalTypeaheadMenuPlugin and called on every editor update.
   *
   * @DesignNotes
   * - This handler is passed to LexicalTypeaheadMenuPlugin which uses it to
   * determine whether the mention dropdown should be shown. But we're also
   * using it to do our main dropdown state updates. We do this because we only
   * ever want one dropdown open at a time and that's easier to reason about if
   * the logic is all in one place.
   * - This function is called whenever the editor updates, *except* when
   * the editor text is empty. That's why clearing the dropdown is handled in a
   * separate listener below. You can see that here:
   * https://github.com/facebook/lexical/blob/main/packages/lexical-react/src/LexicalTypeaheadMenuPlugin.tsx#L242-L258
   * - The two points above makes it feel like the LexicalTypeaheadMenuPlugin
   * isn't the right fit for us. But it does a lot of things we want (like
   * positioning the @ dropdown which is tricky), so I'm reluctant to replace
   * it. If later we find we need to work around it too much, then we can try
   * to replace it then.
   */
  const triggerFn = useCallback(
    (textBeforeCursor: string) => {
      // Don't open any dropdowns until the text has changed after focus
      if (!textChanged.current) {
        return null;
      }

      // Open mention dropdown after @ match
      const match = checkForMentionMatch(textBeforeCursor);
      if (match) {
        const queryString = match.matchingString;
        if (queryString.length === 0) {
          setDropdown({
            type: "mention",
            search: queryString,
            matches: getRecentNodes(),
          });
        } else {
          setDropdown({
            type: "mention",
            search: queryString,
            matches: getMatches(queryString, ["node"]),
          });
        }
        return match;
      }

      // Open or update search-and-replace dropdown
      const editorText = editor.getEditorState().read(() => $getRoot().getTextContent());
      if (passiveAutocompleteActive || dropdown?.type === "searchAndReplace") {
        const matches = getMatches(
          editorText,
          labelledRelation ? ["node", "relation"] : ["node", "relation", "relationType"],
        );
        if (matches.length > 0) {
          setDropdown((prev) => {
            return {
              type: "searchAndReplace",
              search: editorText,
              matches,
              // If already open, keep the `initiatedManually` flag as-is.
              initiatedManually: prev?.type === "searchAndReplace" ? prev.initiatedManually : false,
            };
          });
          return null;
        }
      }

      // Clear
      clearDropdown();
      return null;
    },
    [
      dropdown?.type,
      editor,
      getMatches,
      getRecentNodes,
      passiveAutocompleteActive,
      textChanged,
      labelledRelation,
      clearDropdown,
    ],
  );

  // Handle state transitions which {@link triggerFn} can't handle
  useEffect(() => {
    return mergeRegister(
      // Open search-and-replace dropdown on semicolon
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          if (
            // On mod-semi-colon hotkey
            ((event.key === ";" && (event.metaKey || event.ctrlKey) && dropdown === null) ||
              // or just semi-colon if at start of line
              (event.key === ";" && $getText({ to: getSelectionPositions(editor)[0] }) === "")) &&
            // Usually this command is used when no dropdown is active and we're
            // triggering it open but there's also a case where passive
            // autocomplete is active, it's just not showing anything cause the
            // text is empty. In this case, we want to open the dropdown with
            // recent nodes.
            (dropdown === null || treeNode.object.text === "")
          ) {
            event.preventDefault();
            setDropdown({
              type: "searchAndReplace",
              search: treeNode.object.text,
              matches: treeNode.object.text === "" ? getRecentNodes() : getMatches(treeNode.object.text),
              initiatedManually: true,
            });
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
      // Clear dropdown on empty text
      editor.registerTextContentListener((text) => {
        textChanged.current = true;
        if (text === "") {
          clearDropdown();
        }
      }),
    );
  }, [editor, setDropdown, dropdown, treeNode, getMatches, getRecentNodes, clearDropdown]);

  return (
    <>
      {treeNode instanceof DescendantTreeNode ? (
        <SearchAndReplaceDropdown treeNode={treeNode} dropdown={dropdown} closeDropdown={() => setDropdown(null)} />
      ) : null}
      <MentionDropdown treeNode={treeNode} dropdown={dropdown} triggerFn={triggerFn} />
    </>
  );
}
