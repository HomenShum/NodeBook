import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  $getSelection,
  COMMAND_PRIORITY_LOW,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DOWN_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_TAB_COMMAND,
} from "lexical";
import { action } from "mobx";
import { useEffect } from "react";
import { useRelationAtPath } from "../components/RelatedObject/RelatedObjectContext";
import { GraphNode } from "../model/GraphNode";
import { useGraphStore } from "../store/useGraphStore";
import { useViewStore } from "../store/useViewStore";
import { relationsToPathStr } from "../util";

export const KeyboardOverridesPlugin = () => {
  const graphStore = useGraphStore();
  const viewStore = useViewStore();
  const [editor] = useLexicalComposerContext();
  const {
    object,
    pathToParentRelations,
    relation,
    pathToParentWithOrderedObjects: pathToParentNodes,
    siblingAbove,
    siblingBelow,
    parent,
    setReplacing,
  } = useRelationAtPath();
  if (!(object instanceof GraphNode)) {
    throw new Error("Expected object to be a GraphNode");
  }
  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        action((event) => {
          if (!event || !graphStore) return false;
          event.preventDefault();
          const selection = $getSelection();
          if (!selection || !selection.getNodes() || !selection.getStartEndPoints()) return false;

          const { node: newNode, relation: newRelation } = graphStore.splitRelatedNode(relation, object, selection);

          // Add to outline if necessary
          const root = pathToParentNodes[0].child;
          if (
            (graphStore.addThoughtstreamNestedChildrenToThoughtstream && root.id === graphStore.thoughtstreamRoot.id) ||
            (graphStore.addThoughstreamDirectChildrenToOutline && parent.id === graphStore.thoughtstreamRoot.id)
          ) {
            graphStore.createRelation({
              from: graphStore.outlineRoot,
              to: newNode,
              relationType: graphStore.relationTypesById.child,
            });
          }
          // Add to thoughtstream if necessary
          if (graphStore.addAllOutlineDescendantsToThoughtstream && root.id === graphStore.outlineRoot.id) {
            graphStore.addToThoughtstream(newNode);
          }

          viewStore.setFocusedNode(relationsToPathStr([...pathToParentRelations, newRelation]));
          return true;
        }),
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          const metaOrCtrl = event.metaKey || event.ctrlKey; // Command key on Mac, Ctrl key on Windows
          if (event.key === "@" && object.text === "") {
            // When user types "@" at the beginning of a bullet, we set it to
            // replacing mode, where you can select a different node for the
            // bullet to represent.
            event.preventDefault();
            setReplacing(true);
            return true;
          } else if (metaOrCtrl && event.shiftKey && event.key === "ArrowUp") {
            if (!siblingAbove) return false;
            event.preventDefault();
            graphStore.getRelationList(parent).move([siblingAbove], relation);
            // While in thoughtstream view, move relation into the same bundle as the sibling above
            if (parent.id === graphStore.thoughtstreamRoot.id) {
              const siblingAboveBundle = graphStore.relationToBundles.get(siblingAbove.id)?.[0];
              const thisBundle = graphStore.relationToBundles.get(relation.id)?.[0];
              if (siblingAboveBundle && thisBundle?.id !== siblingAboveBundle?.id) {
                if (thisBundle) {
                  graphStore.removeFromBundle(relation, thisBundle);
                }
                graphStore.addToBundle(relation, siblingAboveBundle);
              }
            }
            return true;
          } else if (metaOrCtrl && event.shiftKey && event.key === "ArrowDown") {
            if (!siblingBelow) return false;
            event.preventDefault();
            graphStore.getRelationList(parent).move([relation], siblingBelow);
            // While in thoughtstream view, move relation into the same bundle as the sibling below
            if (parent.id === graphStore.thoughtstreamRoot.id) {
              const siblingBelowBundle = graphStore.relationToBundles.get(siblingBelow.id)?.[0];
              const thisBundle = graphStore.relationToBundles.get(relation.id)?.[0];
              if (siblingBelowBundle && thisBundle?.id !== siblingBelowBundle?.id) {
                if (thisBundle) {
                  graphStore.removeFromBundle(relation, thisBundle);
                }
                graphStore.addToBundle(relation, siblingBelowBundle);
              }
            }
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_TAB_COMMAND,
        action((event) => {
          if (!graphStore) return false;
          event.preventDefault();
          if (event.shiftKey) {
            const grandparentNode = pathToParentNodes[pathToParentNodes.length - 1].parent;
            const parentRelation = pathToParentRelations[pathToParentRelations.length - 1];
            if (!grandparentNode) {
              console.log("Can't shift tab because no grandparent to move to");
              return false;
            }
            if (grandparentNode.id === graphStore.userRoot.id) {
              console.log("Can't move relation to user root");
              return false;
            }
            if (!parent) {
              console.log("Can't shift tab because no parent to move to");
              return false;
            }
            // Replace the relations pointer to the parent with the grandparent
            if (relation.from.id === parent.id) {
              graphStore.updateRelationFrom(relation, grandparentNode);
            } else {
              graphStore.updateRelationTo(relation, grandparentNode);
            }
            // Position the relation under the parent
            graphStore.getRelationList(grandparentNode).move([relation], parentRelation);
            viewStore.setFocusedNode(relationsToPathStr([...pathToParentRelations.slice(0, -1), relation]));
            return true;
          } else {
            if (!siblingAbove) {
              console.log("Sibling not found");
              return false;
            }
            const siblingAboveNode = siblingAbove.from.id === parent.id ? siblingAbove.to : siblingAbove?.from;
            // Change the relation's parent to the sibling above
            if (relation.from.id === parent.id) {
              graphStore.updateRelationFrom(relation, siblingAboveNode);
            } else {
              graphStore.updateRelationTo(relation, siblingAboveNode);
            }
            // Position the relation at the bottom of the siblings list
            graphStore.getRelationList(siblingAboveNode).move([relation], "bottom");
            // toggle open sibling
            const relationPathToSibling = [...pathToParentRelations, siblingAbove];
            graphStore.setPathExpanded(relationsToPathStr(relationPathToSibling), true);
            // set focus at the relations new path
            viewStore.setFocusedNode(relationsToPathStr([...relationPathToSibling, relation]));
            return true;
          }
        }),
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        (event) => {
          if (!graphStore) return false;
          event.preventDefault();
          if (object.text === "") {
            const parentRelation = pathToParentRelations[pathToParentRelations.length - 1];
            if (parentRelation) {
              graphStore.deleteRelation(relation);
              if (siblingAbove) {
                viewStore.setFocusedNode(relationsToPathStr([...pathToParentRelations, siblingAbove]));
              } else {
                viewStore.setFocusedNode(relationsToPathStr(pathToParentRelations));
              }
              return true;
            }
          }
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => {
          event.preventDefault();
          if (!siblingBelow) return false;
          viewStore.setFocusedNode(relationsToPathStr([...pathToParentRelations, siblingBelow]));
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => {
          event.preventDefault();
          if (!siblingAbove) return false;
          viewStore.setFocusedNode(relationsToPathStr([...pathToParentRelations, siblingAbove]));
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [
    editor,
    graphStore,
    pathToParentRelations,
    relation,
    pathToParentNodes,
    siblingAbove,
    siblingBelow,
    object,
    parent,
  ]);
  return null;
};
