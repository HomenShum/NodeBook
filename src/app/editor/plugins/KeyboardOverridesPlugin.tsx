import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DOWN_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
} from "lexical";
import { action } from "mobx";
import { useEffect } from "react";
import { useRelationAtPath } from "../../components/RelatedObject/RelatedObjectContext";
import { useViewController } from "../../controller/useViewController";
import { GraphNode } from "../../model/GraphNode";
import { useGraphStore } from "../../store/useGraphStore";
import { relationsToPathStr } from "../../util";

export const KeyboardOverridesPlugin = () => {
  const graphStore = useGraphStore();
  const viewController = useViewController();
  const [editor] = useLexicalComposerContext();
  const {
    object,
    pathToParentRelations,
    relation,
    pathToParentWithOrderedObjects: pathToParentNodes,
    pathToNodeStr,
    siblingAbove,
    siblingBelow,
    parent,
    viewType,
    setViewType,
  } = useRelationAtPath();
  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        action((event) => {
          if (viewType === "temp-edit") {
            event.preventDefault();
            setViewType("edit");
            viewController.setFocusedNode(pathToNodeStr);
            return true;
          }
          return false;
        }),
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        action((event) => {
          if (!event || !graphStore) return false;
          event.preventDefault();
          if (viewType === "temp-edit") {
            setViewType("edit");
            viewController.setFocusedNode(pathToNodeStr);
            return true;
          }

          const metaOrCtrl = event.metaKey || event.ctrlKey; // Command key on Mac, Ctrl key on Windows
          const splitToNewBundle = !!metaOrCtrl;

          const selection = $getSelection();
          if (!selection || !selection.getNodes() || !selection.getStartEndPoints()) return false;

          if (object instanceof GraphNode) {
            let {
              child: { node: newNode, relation: newRelation },
              nested,
            } = graphStore.splitRelatedNode(relation, object, selection, pathToNodeStr, {
              splitToNewBundle,
            });
            if (graphStore.correspondingObjectsForPinned.has(relation.id)) {
              newRelation = graphStore.correspondingPinnedForObjects.get(newRelation.id)!;
            }

            // Add to outline if necessary
            graphStore.addElsewhereAfterCreate(newNode, parent, pathToParentNodes[0].child);
            let newPath;
            if (nested) {
              newPath = [...pathToParentRelations, relation, newRelation];
            } else {
              newPath = [...pathToParentRelations, newRelation];
            }
            viewController.setFocusedNode(relationsToPathStr(newPath));
            return true;
          } else {
            // TODO handle related relations
            throw new Error("Splitting relations not yet implemented");
          }
        }),
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          const metaOrCtrl = event.metaKey || event.ctrlKey; // Command key on Mac, Ctrl key on Windows
          if (event.key === "@" && object.text === "") {
            if (viewController.atSignTriggerToReplaceObject) {
              // When user types "@" at the beginning of a bullet, we set it to
              // replacing mode, where you can select a different node for the
              // bullet to represent.
              event.preventDefault();
              setViewType("replace");
              return true;
            }
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
          } else if (metaOrCtrl && event.key === ".") {
            const viewRoot = pathToParentNodes[0].child;
            if (viewRoot.id === graphStore.thoughtstreamRoot.id) {
              viewController.setCurrentStreamViewRoot([...pathToParentRelations, relation]);
            } else if (viewRoot.id === graphStore.outlineRoot.id) {
              viewController.setCurrentOutlineViewRoot([...pathToParentRelations, relation]);
            } else {
              throw new Error("Unknown view root");
            }
            return true;
          } else if (metaOrCtrl && event.key === "ArrowDown") {
            event.preventDefault();
            graphStore.setPathExpanded(pathToNodeStr, true);
            return true;
          } else if (metaOrCtrl && event.key === "ArrowUp") {
            event.preventDefault();
            graphStore.setPathExpanded(pathToNodeStr, false);
            return true;
          } else if (event.altKey && event.shiftKey && (event.key === "r" || event.key === "‰")) {
            // Alt + Shift + R (for some reason, on Taylor's Mac, this is the key combo for ‰)
            if (graphStore.shouldTreatObjectAsLink(object)) {
              event.preventDefault();
              setViewType("temp-edit");
              return true;
            }
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
          let baseRelation;
          if (parent.isRelationPinned(relation)) {
            if (graphStore.correspondingObjectsForPinned.has(relation.id)) {
              baseRelation = graphStore.correspondingObjectsForPinned.get(relation.id)!;
            } else {
              baseRelation = relation;
            }
            parent.unpinChildRelation(relation);
          } else {
            baseRelation = relation;
          }

          if (event.shiftKey) {
            const viewRoot = pathToParentNodes[0].child;
            let visibleRootRelations;
            if (viewRoot.id === graphStore.thoughtstreamRoot.id) {
              visibleRootRelations = viewController.currentStreamViewRoot;
            } else if (viewRoot.id === graphStore.outlineRoot.id) {
              visibleRootRelations = viewController.currentOutlineViewRoot;
            } else {
              throw new Error("Unknown view root");
            }

            if (
              !viewController.allowShiftTabAboveViewRoot &&
              visibleRootRelations &&
              visibleRootRelations.length == pathToParentNodes.length
            ) {
              console.log("Can't shift tab because grandparent is above view root");
              return false;
            }

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
            if (baseRelation.from.id === parent.id) {
              graphStore.updateRelationFrom(baseRelation, grandparentNode);
            } else {
              graphStore.updateRelationTo(baseRelation, grandparentNode);
            }
            // Position the relation under the parent
            graphStore.getRelationList(grandparentNode).move([baseRelation], parentRelation);
            viewController.setFocusedNode(relationsToPathStr([...pathToParentRelations.slice(0, -1), baseRelation]));
            return true;
          } else {
            if (!siblingAbove) {
              console.log("Sibling not found");
              return false;
            }
            const siblingAboveNode = siblingAbove.from.id === parent.id ? siblingAbove.to : siblingAbove?.from;
            // Change the relation's parent to the sibling above
            if (baseRelation.from.id === parent.id) {
              graphStore.updateRelationFrom(baseRelation, siblingAboveNode);
            } else {
              graphStore.updateRelationTo(baseRelation, siblingAboveNode);
            }
            // Position the relation at the bottom of the siblings list
            graphStore.getRelationList(siblingAboveNode).move([baseRelation], "bottom");
            // toggle open sibling
            const relationPathToSibling = [...pathToParentRelations, siblingAbove];
            graphStore.setPathExpanded(relationsToPathStr(relationPathToSibling), true);
            // set focus at the relations new path
            viewController.setFocusedNode(relationsToPathStr([...relationPathToSibling, baseRelation]));
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
                viewController.setFocusedNode(relationsToPathStr([...pathToParentRelations, siblingAbove]));
              } else {
                viewController.setFocusedNode(relationsToPathStr(pathToParentRelations));
              }
              return true;
            }
            return false;
          }

          // merge nodes if necessary
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return false;

          const startEnd = selection.getStartEndPoints();
          if (!startEnd) return false;
          const [selectionStart, selectionEnd] = startEnd;

          // Offset is 0 when at start of text
          if (selectionStart.offset !== 0 || selectionEnd.offset !== 0) return false;
          let targetNode = null;
          let targetPath = null;
          if (siblingAbove) {
            const node = siblingAbove.from.id === parent.id ? siblingAbove.to : siblingAbove.from;
            if (node instanceof GraphNode) {
              targetNode = node;
              targetPath = relationsToPathStr([...pathToParentRelations, siblingAbove]);
            }
          } else {
            const viewRoot = pathToParentNodes[0].child;
            let visibleRootRelations;
            if (viewRoot.id === graphStore.thoughtstreamRoot.id) {
              visibleRootRelations = viewController.currentStreamViewRoot;
            } else if (viewRoot.id === graphStore.outlineRoot.id) {
              visibleRootRelations = viewController.currentOutlineViewRoot;
            } else {
              throw new Error("Unknown view root");
            }

            if (
              visibleRootRelations &&
              visibleRootRelations.length < pathToParentNodes.length &&
              parent instanceof GraphNode
            ) {
              targetNode = parent;
              targetPath = relationsToPathStr([...pathToParentRelations]);
            }
          }

          if (targetNode && object instanceof GraphNode) {
            targetNode.content = targetNode.content.concat(object.content);
            graphStore.deleteNode(object.id);
            graphStore.deleteRelation(relation);
            viewController.setFocusedNode(targetPath!);
            return true;
          }

          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => {
          if (!siblingBelow) return false;
          event.preventDefault();
          viewController.setFocusedNode(relationsToPathStr([...pathToParentRelations, siblingBelow]));
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => {
          if (!siblingAbove) return false;
          event.preventDefault();
          viewController.setFocusedNode(relationsToPathStr([...pathToParentRelations, siblingAbove]));
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ARROW_LEFT_COMMAND,
        (event) => {
          const selectionStart = $getSelection()?.getStartEndPoints()?.[0];
          // Offset is 0 when at start of text
          if (!selectionStart || selectionStart.offset !== 0) return false;
          if (!siblingAbove) return false;
          event.preventDefault();
          viewController.setFocusedNode(relationsToPathStr([...pathToParentRelations, siblingAbove]), {
            focusAt: "end",
          });
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ARROW_RIGHT_COMMAND,
        (event) => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return false;
          const lastNode = $getRoot().getLastDescendant();
          if (
            selection.anchor.key !== lastNode?.getKey() ||
            selection.anchor.offset !== lastNode?.getTextContentSize()
          ) {
            // Selection not at end of editor
            return false;
          }
          if (!siblingBelow) return false;
          event.preventDefault();
          viewController.setFocusedNode(relationsToPathStr([...pathToParentRelations, siblingBelow]), {
            focusAt: "start",
          });
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
    viewController,
    viewType,
    setViewType,
    pathToNodeStr,
  ]);
  return null;
};
