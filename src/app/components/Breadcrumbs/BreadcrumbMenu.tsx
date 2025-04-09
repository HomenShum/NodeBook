import { Command, Lock, SquareSplitHorizontal, Unlock } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useCallback } from "react";

import { useAuth } from "@/app/auth/useAuth";
import { QuickCaptureIcon } from "@/app/components/Icons/QuickCaptureIcon";
import { SyncStatusIndicator } from "@/app/components/SyncStatus/SyncStatusIndicator";
import { Button } from "@/app/components/UIPrimitives/Button";
import { VoiceInputButton } from "@/app/components/VoiceOps/VoiceInputButton";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useLoading } from "@/app/contexts/LoadingContext";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { useUser } from "@/app/contexts/UserContext";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { modKeyName, optionKeyName } from "@/app/hotkeys";
import { useTree } from "@/app/tree/TreeContext";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

import { default as s } from "./Breadcrumbs.module.css";

export const BreadcrumbMenu = observer(function BreadcrumbMenu() {
  const isLoading = useLoading();
  const user = useUser();
  const viewStore = useViewStore();
  const settingsStore = useSettingsStore();
  const graphStore = useGraphStore();
  const auth = useAuth();
  const tree = useTree();

  const handlePublicModeChange = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      const newIsPublic = !settingsStore.publicMode;
      settingsStore.setPublicMode(newIsPublic);

      if (tree.selection) {
        const selection = tree.selectionWithNodes;
        const candidates: { object: GraphObject; relationWithParent: GraphRelation }[] = [];

        // Resolving the list of graph objects in currently focused tree nodes
        if (selection?.type === "node") {
          candidates.push(...selection.nodes.map(({ object, relationWithParent }) => ({ object, relationWithParent })));
        } else if (selection?.type === "editor") {
          candidates.push({
            object: selection.treeNode.object,
            relationWithParent: selection.treeNode.relationWithParent,
          });
        }

        if (candidates.length > 0) {
          graphStore.applyCombinedTransaction(
            candidates.map(({ object, relationWithParent }) => ({
              type: "setIsPublic",
              transaction: {
                objectId: object.id,
                relationId: relationWithParent?.id,
                isPublic: newIsPublic,
                alsoSetRelatedObjects: false,
                alsoSetChildrenAndDescendants: false,
                isNewRelatedObjectsPublic: false,
                isChecked: object instanceof GraphNode ? object.isChecked : null,
              },
            })),
          );
        }

        if (selection?.type === "editor") {
          tree.setFocusedNode(selection.treeNodeId, selection.position, selection.editMode);
        }
      }
    },
    [graphStore, settingsStore, tree],
  );

  if (user.isAnonymous && !isLoading) {
    return (
      <>
        <Button
          style={{ position: "relative" }}
          variant="default"
          className={cn(s.ShowTooltip, s.BottomAlign)}
          data-tooltip={`Command bar · ` + [`${modKeyName}`, "⇧", "K"].join("+")}
          size="icon"
          onClick={() => viewStore.setCommandBarOpen(!viewStore.isCommandBarOpen)}
        >
          <Command size={14} strokeWidth={1.5} />
        </Button>
        <Button variant="active" size="sm" onClick={() => auth?.loginWithRedirect()}>
          Sign in
        </Button>
      </>
    );
  }

  return (
    <div className={s.BreadcrumbRightArea}>
      {!user.isAnonymous && <VoiceInputButton />}
      <Button
        style={{ position: "relative" }}
        variant="default"
        className={cn(s.ShowTooltip, s.BottomAlign)}
        data-tooltip={`Command bar · ` + [`${modKeyName}`, "⇧", "K"].join("+")}
        size="icon"
        onClick={() => viewStore.setCommandBarOpen(!viewStore.isCommandBarOpen)}
      >
        <Command size={14} strokeWidth={1.5} />
      </Button>
      <Button
        style={{ position: "relative" }}
        className={cn(s.ShowTooltip, s.RightAlign)}
        data-tooltip={settingsStore.publicMode ? "Public mode" : "Private mode"}
        variant={settingsStore.publicMode ? "active" : "default"}
        size="icon"
        onClick={(event) => handlePublicModeChange(event)}
      >
        {settingsStore.publicMode ? <Unlock size={14} strokeWidth={1.5} /> : <Lock size={14} strokeWidth={1.5} />}
      </Button>
      <Button
        style={{ position: "relative" }}
        className={cn(s.ShowTooltip, s.RightAlign)}
        data-tooltip={
          viewStore.quickCaptureOpen
            ? `Close Quick Capture`
            : `Open Quick Capture · ` + [`${modKeyName}`, `${optionKeyName}`, "K"].join("+")
        }
        variant={viewStore.quickCaptureOpen ? "active" : "default"}
        size="icon"
        onClick={() => (viewStore.quickCaptureOpen ? viewStore.closeQuickCapture() : viewStore.openQuickCapture())}
      >
        <QuickCaptureIcon />
      </Button>
      <Button
        style={{ position: "relative" }}
        className={cn(s.ShowTooltip, s.RightAlign)}
        data-tooltip={
          (viewStore.rightSidebarOpen ? "Close Side Tree View" : "Open Side Tree View") +
          ` · ` +
          [`${modKeyName}`, `${optionKeyName}`, "S"].join("+")
        }
        variant={viewStore.rightSidebarOpen ? "active" : "default"}
        size="icon"
        onClick={() => viewStore.toggleRightSidebar()}
      >
        <SquareSplitHorizontal size={14} strokeWidth={1.5} />
      </Button>
      <SyncStatusIndicator />
    </div>
  );
});

export default BreadcrumbMenu;
