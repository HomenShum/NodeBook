import { useRelationAtPath } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useViewController } from "@/app/controller/useViewController";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { compare } from "fast-json-patch";
import { $getRoot, $setSelection, EditorState, ParagraphNode } from "lexical";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect } from "react";
import { GraphNode } from "../../model/GraphNode";
import { useGraphStore } from "../../store/useGraphStore";
import {
  $getChips,
  createContentMatchingParagraph,
  createParagraphMatchingGraphNode,
  graphNodeMatchesParagraph,
} from "../utils";
import { checkForMentionMatch } from "./MentionPlugin";

function accessPropertyByPath(obj: any, path: string) {
  // Remove the initial slash and split the path into parts
  const parts = path.substring(1).split("/");
  // Traverse the object/array according to the path parts
  let current = obj;
  for (const part of parts) {
    // Convert part to a number if it's an index
    const index = isNaN(parseInt(part)) ? part : parseInt(part);
    current = current[index];
  }
  return current;
}

/**
 * When the graph object content changes, the editor content is updated to
 * match. It only applies a change if the new state is different from the
 * current state, to avoid infinite loops. (TODO: This way of avoiding infinite
 * loops feels a bit sketchy, but it works for now)
 *
 * When the editor content changes, it's a bit more complicated...:
 * - We sometimes render a node as itself, and sometimes more like a link.
 * - If the node is being rendered as itself, updates to the editor content
 *   should update the node's content.
 * - If the node is being rendered as a link, updates to the editor content
 *   should create a new node and update the relation to point to it. (Unless
 *   the change is mention-related or whitespace-related, in which case we
 *   always update the node's content)
 *
 * TODO: This spec matches Jacob's desires, but it's bad and we should change
 * it.
 */
export const SyncWithGraphPlugin = observer(({ node }: { node: GraphNode }) => {
  const [editor] = useLexicalComposerContext();
  const graphStore = useGraphStore();
  const viewController = useViewController();
  const { pathToParentRelations, pathToParentWithOrderedObjects, pathToNodeStr, relation } = useRelationAtPath();
  const root = pathToParentWithOrderedObjects[0].child;
  const parent = pathToParentWithOrderedObjects.slice(-1)[0].child;
  if (node.type !== "node") {
    throw new Error("Expected object to be a GraphNode");
  }

  const updateGraphOnEditorChange = useCallback(
    (editorState: EditorState, prevEditorState: EditorState) => {
      const editorHasFocus = editor.getRootElement()?.contains(document.activeElement);
      if (!editorHasFocus) {
        return;
      }

      // Get what changed in editor
      const chips = editorState.read($getChips);
      const prevChips = prevEditorState.read($getChips);
      const diff = compare(prevChips, chips);
      if (diff.length === 0) {
        return;
      }

      // Check for changes were mention-related
      const isAddMention = diff.some((d) => d.op === "add" && d.value.type === "mention");
      const isRemoveMention =
        diff.length === 1 &&
        diff[0].op === "remove" &&
        accessPropertyByPath(prevChips, diff[0].path).type === "mention";
      // TODO: sketch that we re-compute this here and in mention plugin. when I tried using a state which
      // tracked if the mention dropdown was open, it was sometimes stale here. A solvable problem I'm sure
      // but not one I want to solve right now.
      const isMentionMatch = !!checkForMentionMatch(editorState.read(() => $getRoot().getTextContent()));

      // Check for changes that were whitespace-related
      let isSpaceInsertion = false;
      let isSpaceRemove = false;
      if (diff.length === 1 && diff[0].op === "add" && diff[0].value.type === "text" && diff[0].value.value === " ") {
        isSpaceInsertion = true;
      } else if (
        diff.length === 1 &&
        diff[0].op === "remove" &&
        accessPropertyByPath(prevChips, diff[0].path).value === " "
      ) {
        isSpaceRemove = true;
      } else if (diff.length === 1 && diff[0].op === "replace" && typeof diff[0].value === "string") {
        // The change was to a single text chip. Check if it was an add/remove of a space
        const string = accessPropertyByPath(chips, diff[0].path);
        const prevString = accessPropertyByPath(prevChips, diff[0].path);
        const stringDiff = compare(prevString.split(""), string.split(""));
        isSpaceInsertion = stringDiff.length === 1 && stringDiff[0].op === "add" && stringDiff[0].value === " ";
        isSpaceRemove =
          stringDiff.length === 1 &&
          stringDiff[0].op === "remove" &&
          accessPropertyByPath(prevString, stringDiff[0].path) === " ";
      }

      // Update the graph
      let referencingNodes: GraphNode[] = [];
      editorState.read(() => {
        const paragraph = $getRoot().getChildren()[0] as ParagraphNode;
        if (graphNodeMatchesParagraph(node, paragraph, graphStore)) {
          return;
        }
        referencingNodes = node.relations
          .filter((relation) => {
            if (relation.from.id !== node.id) return false;
            if (!(relation.to instanceof GraphNode)) return false;
            return relation.to.content.some((item) => item.type === "mention" && item.value === node.id);
          })
          .map((relation) => relation.to) as GraphNode[];

        const isSpaceOrMentionChange =
          isSpaceInsertion || isSpaceRemove || isAddMention || isRemoveMention || isMentionMatch;
        if (!graphStore.shouldTreatObjectAsLink(node) || isSpaceOrMentionChange) {
          // update the node's content
          const newContent = createContentMatchingParagraph(paragraph);
          node.setContent(newContent);
        } else {
          // create a new node with the editor's content and point the current relation to it
          const newNode = graphStore.createNode({ content: createContentMatchingParagraph(paragraph) });
          graphStore.setGraphNodeAtPath([...pathToParentRelations, relation], newNode);
          graphStore.addElsewhereAfterCreate(newNode, parent, root);
          viewController.setFocusedNode(pathToNodeStr);
        }
      });
      editor.update(() => {
        referencingNodes.map((refNode) => {
          refNode.setContent(createContentMatchingParagraph(createParagraphMatchingGraphNode(refNode, graphStore)));
        });
      });
    },
    [editor, graphStore, viewController, pathToParentRelations, pathToNodeStr, relation, node, root, parent],
  );

  const setEditorToGraphNodeText = useCallback(
    (graphNode: GraphNode) => {
      editor.update(() => {
        const currentParagraph = $getRoot().getChildren()[0] as ParagraphNode;
        if (graphNodeMatchesParagraph(graphNode, currentParagraph, graphStore)) {
          return;
        }
        currentParagraph.replace(createParagraphMatchingGraphNode(graphNode, graphStore));
        /**
         * Setting the selection to null here seems to prevent the error below.
         * Based on https://stackoverflow.com/a/72197580, it seems that when we're
         * updating the editor state on a non-focused editor, a new selection is
         * automatically set in the new editor state, and then the editor takes
         * the dom selection away from the user, leading to other downstream issues.
         *
         * ```
         * Error: updateEditor: selection has been lost because the previously
         * selected nodes have been removed and selection wasn't moved to
         * another node. Ensure selection changes after removing/replacing a
         * selected node.
         * ```
         */
        $setSelection(null);
      });
    },
    [editor, graphStore],
  );

  useEffect(() => {
    setEditorToGraphNodeText(node);
  }, [setEditorToGraphNodeText, node, node.content]);

  useEffect(() => {
    const unsubscribe = editor.registerUpdateListener(({ editorState, prevEditorState }) => {
      updateGraphOnEditorChange(editorState, prevEditorState);
    });
    return unsubscribe;
  }, [editor, updateGraphOnEditorChange]);

  return null;
});
