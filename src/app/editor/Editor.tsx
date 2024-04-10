import { $createParagraphNode, $createTextNode, $getRoot, $setSelection, EditorState, ParagraphNode } from "lexical";

import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect } from "react";
import { useRelationAtPath } from "../components/RelatedNode/RelatedNodeContext";
import { Chip, GraphNode } from "../model/GraphNode";
import { GraphStore } from "../model/GraphStore";
import { $createMentionNode, $isMentionNode, MentionNode } from "../model/MentionNode";
import { useGraphStore } from "../store/useGraphStore";
import { useViewStore } from "../store/useViewStore";
import styles from "./Editor.module.css";
import { KeyboardOverridesPlugin } from "./KeyboardOverridesPlugin";
import { MentionPlugin } from "./MentionPlugin";
import { OnChangePlugin } from "./OnChangePlugin";
import { ViewStoreRegistryPlugin } from "./ViewStoreRegistryPlugin";
import { ContentEditable } from "./ui/ContentEditable";

const theme = {
  // Theme styling goes here
};

// Catch any errors that occur during Lexical updates and log them
// or throw them as needed. If you don't throw them, Lexical will
// try to recover gracefully without losing user data.
const onError = (error: any) => {
  console.error(error);
};

export const Editor = () => {
  const { node, pathToNodeStr } = useRelationAtPath();
  const viewStore = useViewStore();
  const initialConfig = {
    namespace: "MyEditor",
    theme,
    onError,
    nodes: [MentionNode],
    editorState: () => {
      const paragraph = $createParagraphNode();
      const text = $createTextNode(node.text);
      paragraph.append(text);
      $getRoot().append(paragraph);
      $getRoot().selectEnd();
    },
  };

  return (
    <div
      className={styles.EditorWrapper}
      // onFocus={() => viewStore.setFocusedNode(bullet)}
    >
      <LexicalComposer initialConfig={initialConfig}>
        <PlainTextPlugin
          ErrorBoundary={LexicalErrorBoundary}
          contentEditable={<ContentEditable nodeId={node.id} />}
          placeholder={null}
          // placeholder={<EditorPlaceholder />}
        />
        {/* {viewStore.isFocused(bullet) && <AutoFocusPlugin />} */}
        <HistoryPlugin />
        <SyncEditorAndGraphNode node={node} />
        <KeyboardOverridesPlugin />
        <MentionPlugin />
        <ViewStoreRegistryPlugin pathToNodeStr={pathToNodeStr} />
      </LexicalComposer>
    </div>
  );
};

const graphNodeMatchesParagraph = (node: GraphNode, paragraph: ParagraphNode, graphStore: GraphStore) => {
  const paragraphChildren = paragraph.getChildren();
  if (node.content.length !== paragraphChildren.length) return false;

  const match = node.content.every((chip, idx) => {
    if (chip.type !== paragraphChildren[idx].getType()) return false;

    if (chip.type === "mention") {
      const referencedNode = graphStore.getNode(chip.value);
      return referencedNode !== undefined && referencedNode.text === paragraphChildren[idx].getTextContent();
    } else {
      return chip.value === paragraphChildren[idx].getTextContent();
    }
  });

  return match;
};

const createParagraphMatchingGraphNode = (node: GraphNode, graphStore: GraphStore): ParagraphNode => {
  const paragraph = $createParagraphNode();
  node.content.forEach((chip) => {
    if (chip.type == "mention") {
      const mentionNodeText = graphStore.getNode(chip.value)?.text || "";
      paragraph.append($createMentionNode(chip.value, mentionNodeText));
    } else {
      paragraph.append($createTextNode(chip.value));
    }
  });
  return paragraph;
};

const createContentMatchingParagraph = (paragraph: ParagraphNode): Chip[] => {
  return paragraph
    .getChildren()
    .map((child) =>
      $isMentionNode(child)
        ? { type: "mention", value: child.mentionedGraphNodeId }
        : { type: "text", value: child.getTextContent() },
    );
};

/**
 * This component is responsible for keeping the Lexical editor state in sync
 * with the graph node state. It listens for changes in the editor state and
 * updates the graph node accordingly. It also listens for changes in the graph
 * node state and updates the editor accordingly. It only applies a change if
 * the new state is different from the current state, to avoid infinite loops.
 *
 * (TODO: This way of avoiding infinite loops feels a bit sketchy, but it works
 * for now)
 */
const SyncEditorAndGraphNode = observer(({ node }: { node: GraphNode }) => {
  const [editor] = useLexicalComposerContext();
  const graphStore = useGraphStore();

  const setGraphNodeTextToEditorState = useCallback(
    (editorState: EditorState) => {
      let referencingNodes: GraphNode[] = [];
      editorState.read(() => {
        const paragraph = $getRoot().getChildren()[0] as ParagraphNode;
        if (graphNodeMatchesParagraph(node, paragraph, graphStore)) {
          return;
        }
        referencingNodes = node.relations
          .filter((relation) => {
            if (relation.from.id !== node.id) return false;

            return relation.to.content.some((item) => item.type === "mention" && item.value === node.id);
          })
          .map((relation) => relation.to);
        const newContent = createContentMatchingParagraph(paragraph);
        node.setContent(newContent);
      });
      editor.update(() => {
        referencingNodes.map((refNode) => {
          refNode.setContent(createContentMatchingParagraph(createParagraphMatchingGraphNode(refNode, graphStore)));
        });
      });
    },
    [node, editor, graphStore],
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
  return <OnChangePlugin onChange={setGraphNodeTextToEditorState} />;
});
