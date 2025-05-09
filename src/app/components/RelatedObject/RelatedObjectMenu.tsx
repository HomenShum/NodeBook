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
import { useCallback, useState } from "react";

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
import { getOtherObject } from "@/app/graph/utils";
import { useToast } from "@/app/hooks/useToast";
import { useParseWithAi } from "@/app/llm/useParseWithAi";
import { getAncestorsAsArray, useSetAuthorRoot, useSetMainRoot } from "@/app/tree/utils";
import { createRouteUrl, downloadSubtree, exportSubtreeToIdeapad } from "@/app/util";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

import { useTreeNode } from "./RelatedObjectContext";
import styles from "./styles/RelatedObjectView.module.css";

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
  const setRoot = useSetMainRoot();

  const handleGoToNode = useCallback(() => {
    viewStore.cancelDeepSearch();
    viewStore.jumpToNodeId = object.id;

    // searchQuery is updated asynchronously with an event listener, so we need to wait for it to be updated
    // before we can scroll to the node.
    setTimeout(() => {
      const parent = object.canonicalRelation ? getOtherObject(object.canonicalRelation, object.id) : null;
      if (parent) {
        setRoot(parent);
      }

      const element = document.querySelector(`[data-nodeid="${object.id}"]`);
      if (!element) {
        return;
      }
      element.scrollIntoView({ behavior: "auto" });
    }, 0);
  }, [viewStore, object, setRoot]);

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
  const { viewType, setViewType } = useTreeNode();

  const handleSetToEditView = useCallback(() => {
    setViewType("edit");
  }, [setViewType]);

  if (viewType === "edit") {
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

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setMenuOpen(open);
      if (open) {
        // When menu is opened, select the node by setting both anchor and head to the same node
        treeNode.tree.selectBetween(treeNode.id, treeNode.id);
      } else {
        // When menu is closed, deselect the node
        treeNode.tree.selection = null;
      }
    },
    [treeNode],
  );

  return (
    <DropdownMenu open={menuOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger className={cn(styles.TrailMenuTrigger, menuOpen && styles.TrailMenuTriggerVisible)}>
        <Ellipsis size={16} className={styles.TrailMenuIcon} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" alignOffset={-5}>
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
