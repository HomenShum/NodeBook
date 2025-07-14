import {
  Beaker,
  CircleArrowDown,
  Delete,
  Download,
  Edit,
  Ellipsis,
  Expand,
  GitCompare,
  Globe,
  Link,
  Lock,
  Notebook,
  PanelRight,
  Pin,
  PinOff,
  Plus,
  RefreshCcwDot,
  SendToBack,
  Star,
  User,
} from "lucide-react";
import { action } from "mobx";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useRef, useState } from "react";

import { SetPublicDialog } from "@/app/components/SetPublicDialog/SetPublicDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/UIPrimitives/DropdownMenu";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { useUser } from "@/app/contexts/UserContext";
import { addToFavorites, isFavorited, removeFromFavorites } from "@/app/graph/favorites";
import { GraphNode } from "@/app/graph/GraphNode";
import { useToast } from "@/app/hooks/useToast";
import { useParseWithAi } from "@/app/llm/useParseWithAi";
import { DescendantTreeNode, RootTreeNode } from "@/app/tree/nodes";
import { getAncestorsAsArray, useSetAuthorRoot, useSetMainRoot } from "@/app/tree/utils";
import { createRouteUrl, downloadSubtree, exportSubtreeToIdeapad } from "@/app/util";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

import { useTreeNode } from "./RelatedObjectContext";
import styles from "./styles/RelatedObjectView.module.css";

// Custom positioning hook for Related Object Menu
function useCustomMenuPositioning(menuOpen: boolean, triggerRef: React.RefObject<HTMLButtonElement>) {
  const [position, setPosition] = useState<{
    side: "top" | "right" | "bottom" | "left";
    align: "start" | "center" | "end";
    sideOffset: number;
    alignOffset: number;
    transform?: string;
  }>({
    side: "bottom",
    align: "start",
    sideOffset: 4,
    alignOffset: -5,
  });

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const spaceBelow = viewportHeight - triggerRect.bottom;
    const spaceLeft = triggerRect.left;
    const spaceRight = viewportWidth - triggerRect.right;

    // Estimated menu dimensions
    const estimatedMenuHeight = 480;
    const estimatedMenuWidth = 210;

    // First decide: above or below based on vertical space
    let verticalSide: "top" | "bottom";
    if (spaceBelow >= estimatedMenuHeight + 8) {
      // Enough space below - show below
      verticalSide = "bottom";
    } else if (spaceBelow <= estimatedMenuHeight * 0.25) {
      // Very little space below - show above
      verticalSide = "top";
    } else {
      // Moderate space below - check if we should go left/right instead
      if (spaceLeft >= estimatedMenuWidth) {
        // Move to left and bottom-align with viewport
        const alignOffset = viewportHeight - estimatedMenuHeight - triggerRect.top - 8;
        setPosition({
          side: "left",
          align: "start",
          sideOffset: 4,
          alignOffset: alignOffset,
        });
        return;
      } else if (spaceRight >= estimatedMenuWidth) {
        // Move to right and bottom-align with viewport
        const alignOffset = viewportHeight - estimatedMenuHeight - triggerRect.top - 8;
        setPosition({
          side: "right",
          align: "start",
          sideOffset: 4,
          alignOffset: alignOffset,
        });
        return;
      } else {
        // Fallback to bottom
        verticalSide = "bottom";
      }
    }

    // Second decide: horizontal alignment based on available space
    const align = spaceLeft >= estimatedMenuWidth ? "end" : "start";

    setPosition({
      side: verticalSide,
      align: align,
      sideOffset: 4,
      alignOffset: -5,
    });
  }, [triggerRef]);

  useEffect(() => {
    if (!menuOpen) return;

    // Calculate initial position immediately to avoid animation stutter
    calculatePosition();

    // Recalculate on resize/scroll
    const handleResize = () => calculatePosition();
    const handleScroll = () => calculatePosition();

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [menuOpen, calculatePosition]);

  return position;
}

const ZoomToNode = () => {
  const { treeNode } = useTreeNode();
  const setRoot = useSetMainRoot();
  const handleZoom = useCallback(() => {
    setRoot(treeNode.object);
  }, [treeNode, setRoot]);

  return (
    <DropdownMenuItem onClick={handleZoom}>
      <Expand size={14} />
      Zoom to node
    </DropdownMenuItem>
  );
};

const GoToAuthorNode = observer(() => {
  const { treeNode } = useTreeNode();
  const setAuthorRoot = useSetAuthorRoot();
  const handleSelect = useCallback(() => {
    setAuthorRoot(treeNode.object.authorId);
  }, [setAuthorRoot, treeNode]);

  return (
    <DropdownMenuItem onSelect={handleSelect}>
      <User size={14} />
      Go to author node
    </DropdownMenuItem>
  );
});

const ToggleFromNote = () => {
  const { treeNode } = useTreeNode();
  const graphStore = useGraphStore();
  const { object } = treeNode;

  const handleRemoveFromNote = useCallback(() => {
    graphStore.applyCombinedTransaction([
      {
        type: "removeRelationFromList",
        transaction: {
          objectId: treeNode.parent.object.id,
          relationId: treeNode.relationWithParent.id,
          listType: "noteContent",
        },
      },
    ]);
  }, [graphStore, treeNode]);

  const handleAddToNote = useCallback(() => {
    graphStore.applyCombinedTransaction([
      {
        type: "addRelationToList",
        transaction: {
          objectId: treeNode.parent.object.id,
          relationId: treeNode.relationWithParent.id,
          listType: "noteContent",
        },
      },
    ]);
  }, [graphStore, treeNode]);

  if (!(object instanceof GraphNode)) {
    return null;
  }

  return treeNode.parentGroup.id === "noteContent" ? (
    <DropdownMenuItem onSelect={handleRemoveFromNote}>
      <Notebook size={14} />
      <span>Remove from note</span>
    </DropdownMenuItem>
  ) : (
    <DropdownMenuItem onSelect={handleAddToNote}>
      <Notebook size={14} />
      <span>Add to note</span>
    </DropdownMenuItem>
  );
};

const TogglePin = observer(() => {
  const { treeNode } = useTreeNode();
  const parent = treeNode.parent.object;
  const relation = treeNode.relationWithParent;

  const handleUnpinRelation = useCallback(() => {
    parent.unpinChildRelation(relation);
  }, [parent, relation]);

  const handlePinRelation = useCallback(() => {
    parent.pinChildRelation(relation);
  }, [parent, relation]);

  return parent.isRelationPinned(relation) ? (
    <DropdownMenuItem onSelect={handleUnpinRelation}>
      <PinOff size={14} />
      Unpin
    </DropdownMenuItem>
  ) : (
    <DropdownMenuItem onSelect={handlePinRelation}>
      <Pin size={14} />
      Pin
    </DropdownMenuItem>
  );
});

const ToggleFavorites = () => {
  const { treeNode } = useTreeNode();
  const graphStore = useGraphStore();
  const { object } = treeNode;

  const handleRemoveFromFavorites = useCallback(() => {
    removeFromFavorites(graphStore, object);
  }, [graphStore, object]);

  const handleAddToFavorites = useCallback(() => {
    addToFavorites(graphStore, object);
  }, [graphStore, object]);

  return isFavorited(graphStore, object) ? (
    <DropdownMenuItem onSelect={handleRemoveFromFavorites}>
      <Star size={14} fill="currentColor" />
      Remove from favorites
    </DropdownMenuItem>
  ) : (
    <DropdownMenuItem onSelect={handleAddToFavorites}>
      <Star size={14} />
      Add to favorites
    </DropdownMenuItem>
  );
};

const TogglePublic = () => {
  const { treeNode } = useTreeNode();
  const { object } = treeNode;
  const [publicDialogOpen, setPublicDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenuItem onSelect={() => setPublicDialogOpen(true)}>
        {object.isPublic ? <Lock size={14} /> : <Globe size={14} />}
        {object.isPublic ? "Make private" : "Make public"}
      </DropdownMenuItem>
      <SetPublicDialog isOpen={publicDialogOpen} setOpen={setPublicDialogOpen} treeNode={treeNode} />
    </>
  );
};

const JumpTo = () => {
  const { treeNode } = useTreeNode();
  const { object } = treeNode;
  const viewStore = useViewStore();
  const tree = viewStore.treeView;
  const searchTree = viewStore.searchView;

  const handleGoToNode = useCallback(() => {
    viewStore.cancelDeepSearch();
    viewStore.setJumpToNodeId(object.id);
    const curSelection = searchTree.selection;

    // searchQuery is updated asynchronously with an event listener, so we need to wait for it to be updated
    // before we can scroll to the node.
    const element = document.querySelector(`[data-editor-path="${treeNode.id}"]`);
    let curParent: DescendantTreeNode | RootTreeNode | null = treeNode.parent;
    const maxDepth = 6;
    for (let i = 0; i < maxDepth; i++) {
      if (curParent instanceof DescendantTreeNode) {
        tree.setPathExpanded(curParent.path, true);
        curParent = curParent.parent;
      } else {
        break;
      }
    }
    if (curSelection) {
      tree.setSelection(curSelection);
    }

    setTimeout(() => {
      // const parent = object.canonicalRelation ? getOtherObject(object.canonicalRelation, object.id) : null;
      // if (parent) {
      //   setRoot(parent);
      // }
      if (curSelection) {
        tree.setSelection(curSelection);
      }
      const element = document.querySelector(`[data-editor-path="${treeNode.id}"]`);
      if (!element) {
        return;
      }
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
  }, [viewStore, object, treeNode, tree, searchTree]);

  if (viewStore.searchQuery === "") {
    return null;
  }

  return (
    <DropdownMenuItem onClick={handleGoToNode}>
      <CircleArrowDown size={14} />
      Jump to
    </DropdownMenuItem>
  );
};

const ExpandNode = () => {
  const { treeNode } = useTreeNode();
  const setRoot = useSetMainRoot();
  const handleZoom = useCallback(() => {
    setRoot(treeNode.object);
  }, [treeNode, setRoot]);

  return (
    <DropdownMenuItem onClick={handleZoom}>
      <Expand size={14} />
      Zoom to node
    </DropdownMenuItem>
  );
};

const OpenInSidePanel = () => {
  const { treeNode } = useTreeNode();
  const viewStore = useViewStore();

  const handleOpenInSidePanel = useCallback(() => {
    viewStore.createSidePanelTree(treeNode.object);
  }, [treeNode, viewStore]);

  return (
    <DropdownMenuItem onSelect={handleOpenInSidePanel}>
      <PanelRight size={14} />
      Open in Side Panel
    </DropdownMenuItem>
  );
};

const AddChildNode = () => {
  const { treeNode } = useTreeNode();
  const graphStore = useGraphStore();
  const tree = treeNode.tree;

  const handleAddChild = useCallback(() => {
    graphStore.addChildNode({ parentId: treeNode.object.id });
    tree.setPathExpanded(treeNode.path, true);
  }, [graphStore, treeNode, tree]);

  return (
    <DropdownMenuItem onSelect={handleAddChild}>
      <Plus size={14} />
      Add child
    </DropdownMenuItem>
  );
};

const CopyUrl = () => {
  const { treeNode } = useTreeNode();
  const { addToast } = useToast();

  const handleCopyUrl = useCallback(async () => {
    const domain = `${window.location.protocol}//${window.location.host}`;
    const path = createRouteUrl({
      object: treeNode.object,
      relations: getAncestorsAsArray(treeNode).map((node) => node.relationToChild),
    });
    await navigator.clipboard.writeText(`${domain}${path}`);
    addToast({
      title: "Copied node URL to clipboard",
    });
  }, [treeNode, addToast]);

  return (
    <DropdownMenuItem onSelect={handleCopyUrl}>
      <Link size={14} />
      Copy URL
    </DropdownMenuItem>
  );
};

const DeleteNode = () => {
  const { treeNode } = useTreeNode();
  const graphStore = useGraphStore();
  const tree = treeNode.tree;
  const relation = treeNode.relationWithParent;

  if (!(treeNode.object instanceof GraphNode)) {
    return null;
  }

  return (
    <DropdownMenuItem
      onSelect={action(async () => {
        try {
          await graphStore.removeRelation({ relationId: relation.id });
          if (treeNode.siblingAbove) {
            tree.setFocusedNode(treeNode.siblingAbove.path);
          }
        } catch (e) {
          alert(e instanceof Error ? e.message : "Failed to delete relation");
        }
      })}
    >
      <Delete size={14} />
      Delete relation
    </DropdownMenuItem>
  );
};

const ReplaceNode = observer(() => {
  const { setViewType } = useTreeNode();
  return (
    <DropdownMenuItem onSelect={() => setViewType("replace")}>
      <GitCompare size={14} />
      Replace related object
    </DropdownMenuItem>
  );
});

const SetToEditView = () => {
  const { viewType, setViewType, treeNode } = useTreeNode();

  const handleSetToEditView = useCallback(() => {
    setViewType("edit");
  }, [setViewType]);

  if (viewType === "edit" || !treeNode.isEditable) {
    return null;
  }

  return (
    <DropdownMenuItem onSelect={handleSetToEditView}>
      <Edit size={14} />
      Set to edit view
    </DropdownMenuItem>
  );
};

interface Props {
  setUpdatingRelationType: (v: boolean) => void;
}

const UpdateRelationType = observer(({ setUpdatingRelationType }: Props) => {
  return (
    <DropdownMenuItem onSelect={() => setUpdatingRelationType(true)}>
      <RefreshCcwDot size={14} />
      Change relation type
    </DropdownMenuItem>
  );
});

const MakeDefaultPath = () => {
  const { treeNode } = useTreeNode();
  const tree = treeNode.tree;
  const handleMakeDefaultPath = useCallback(() => {
    tree.makePathToNodeCanonical(treeNode);
    // The tree holds a static array of the path ids, so doesn't re-render automatically
    // when we update the canonical relation. So we force a re-render by re-setting the root
    // which will re-compute the path ids according to the new canonical relation.
    tree.setRoot(tree.rootObject);
  }, [tree, treeNode]);

  if (treeNode.parent.object.canonicalRelation?.id !== treeNode.relationWithParent.id) {
    return null;
  }

  return (
    <DropdownMenuItem onSelect={handleMakeDefaultPath}>
      <SendToBack size={14} />
      Make default path
    </DropdownMenuItem>
  );
};

const ParseWithAi = () => {
  const { treeNode } = useTreeNode();
  const parseWithAi = useParseWithAi();

  if (!(treeNode.object instanceof GraphNode)) {
    return null;
  }

  return (
    <DropdownMenuItem onSelect={() => parseWithAi(treeNode)}>
      <Beaker size={14} />
      Parse with AI
    </DropdownMenuItem>
  );
};

const ExportSubtree = () => {
  const { treeNode } = useTreeNode();
  const graphStore = useGraphStore();
  const { object } = treeNode;

  return (
    <DropdownMenuItem onSelect={() => downloadSubtree(graphStore, object)}>
      <Download size={14} />
      Export subtree
    </DropdownMenuItem>
  );
};

const ExportSubtreeToIdeapad = () => {
  const { treeNode } = useTreeNode();
  const graphStore = useGraphStore();
  const user = useUser();

  const settingsStore = useSettingsStore();

  if (!settingsStore.showExportSubtreeToIdeapad) {
    return null;
  }

  return (
    <DropdownMenuItem onSelect={() => exportSubtreeToIdeapad(graphStore, treeNode.object, user.id)}>
      <Download size={14} />
      Export to Ideapad
    </DropdownMenuItem>
  );
};

export const RelatedObjectMenu = observer(function RelatedObjectMenu({ setUpdatingRelationType }: Props) {
  const user = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const { treeNode } = useTreeNode();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const position = useCustomMenuPositioning(menuOpen, triggerRef);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setMenuOpen(open);
      if (open) {
        // When menu is opened, select the node by setting both anchor and head to the same node
        treeNode.tree.selectBetween(treeNode.id, treeNode.id);
      } else {
        // When menu is closed, deselect the node
        treeNode.tree.setSelection(null);
      }
    },
    [treeNode],
  );

  return (
    <DropdownMenu open={menuOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        ref={triggerRef}
        className={cn(styles.TrailMenuTrigger, menuOpen && styles.TrailMenuTriggerVisible)}
      >
        <Ellipsis size={16} className={styles.TrailMenuIcon} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={position.side}
        align={position.align}
        sideOffset={position.sideOffset}
        alignOffset={position.alignOffset}
      >
        {user.isAnonymous ? (
          <ZoomToNode />
        ) : (
          <>
            <JumpTo />
            <GoToAuthorNode />
            <ToggleFromNote />
            <TogglePin />
            <ToggleFavorites />
            <TogglePublic />
            <ExpandNode />
            <OpenInSidePanel />
            <AddChildNode />
            <CopyUrl />
            <DeleteNode />
            <ReplaceNode />
            <SetToEditView />
            <UpdateRelationType setUpdatingRelationType={setUpdatingRelationType} />
            <MakeDefaultPath />
            <ParseWithAi />
            <DropdownMenuSeparator />
            <ExportSubtree />
            <ExportSubtreeToIdeapad />
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
