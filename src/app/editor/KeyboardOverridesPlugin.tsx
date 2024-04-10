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
import { useRelationAtPath } from "../components/RelatedNode/RelatedNodeContext";
import { useGraphStore } from "../store/useGraphStore";
import { useViewStore } from "../store/useViewStore";
import { relationsToPathStr } from "../util";

export const KeyboardOverridesPlugin = () => {
  const graphStore = useGraphStore();
  const viewStore = useViewStore();
  const [editor] = useLexicalComposerContext();
  const { node, pathToParentRelations, relation, pathToParentNodes, siblingAbove, siblingBelow, parent, setReplacing } =
    useRelationAtPath();
  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        action((event) => {
          if (!event || !graphStore) return false;
          event.preventDefault();
          const selection = $getSelection();
          if (!selection || !selection.getNodes() || !selection.getStartEndPoints()) return false;
          const { relation: newRelation } = graphStore.splitRelatedNode(relation, node, selection);
          viewStore.setFocusedNode(relationsToPathStr([...pathToParentRelations, newRelation]));
          return true;
        }),
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          const metaOrCtrl = event.metaKey || event.ctrlKey; // Command key on Mac, Ctrl key on Windows
          if (event.key === "@" && node.text === "") {
            // When user types "@" at the beginning of a bullet, we set it to
            // replacing mode, where you can select a different node for the
            // bullet to represent.
            event.preventDefault();
            setReplacing(true);
            return true;
          } else if (metaOrCtrl && event.shiftKey && event.key === "ArrowUp") {
            if (!siblingAbove) return false;
            // TODO: is this sketchy?
            event.preventDefault();
            parent.allRelationsList.move([siblingAbove], relation);
            return true;
          } else if (metaOrCtrl && event.shiftKey && event.key === "ArrowDown") {
            if (!siblingBelow) return false;
            event.preventDefault();
            parent.allRelationsList.move([relation], siblingBelow);
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
            const grandparentNode = pathToParentNodes[pathToParentNodes.length - 2];
            const parentRelation = pathToParentRelations[pathToParentRelations.length - 1];
            if (!grandparentNode) {
              console.log("Can't shift tab because no grandparent to move to");
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
            grandparentNode.allRelationsList.move([relation], parentRelation);
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
            siblingAboveNode.allRelationsList.move([relation], "bottom");
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
          if (node.text === "") {
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
    node,
    parent,
  ]);
  return null;
};
