"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Star } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CmdEditor } from "@/app/components/CommandBar/CmdEditor";
import LineLoader from "@/app/components/LineLoader/LineLoader";
import { Path } from "@/app/components/Path";
import { RelationCounter } from "@/app/components/RelatedObject/RelationCounter";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { TypeIndicator } from "@/app/editor/plugins/dropdown/DropdownItem";
import { useGetRecentNodes } from "@/app/editor/plugins/dropdown/utils";
import { isFavorited } from "@/app/graph/favorites";
import { Chip } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";
import { getCanonicalPath } from "@/app/graph/utils";
import { useToast } from "@/app/hooks/useToast";
import { useSetMainRoot } from "@/app/tree/utils";
import { ObjectPath } from "@/app/util";
import { useViewStore } from "@/app/view/useViewStore";
import { cn, isMac } from "@/lib/utils";

import styles from "./CommandBar.module.css";

const MAX_DROPDOWN_RESULTS = 30;

export type Search = { text: string; chips: Chip[] };

type Command =
  | {
      type: "create";
      id: string;
      name: string;
      perform: (event?: React.MouseEvent<HTMLDivElement>) => void;
    }
  | {
      type: "navigate";
      id: string;
      name: string;
      object: GraphObject;
      path: ObjectPath;
      isFavorited?: boolean;
      perform: (event?: React.MouseEvent<HTMLDivElement>) => void;
    };

const CommandBar = observer(() => {
  const viewStore = useViewStore();
  const { addToast } = useToast();

  const [search, setSearch] = useState<Search>({ text: "", chips: [] });

  const resetSearch = () => setSearch({ text: "", chips: [] });

  const close = useCallback(() => {
    viewStore.setCommandBarOpen(false);
  }, [viewStore]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const dropdownContainerRef = useRef<HTMLDivElement>(null);
  const graphStore = useGraphStore();
  const setRoot = useSetMainRoot();

  const handleZoomToNode = useCallback(
    (object: GraphObject) => {
      setRoot(object);
      close();
    },
    [setRoot, close],
  );

  const getRecentNodes = useGetRecentNodes(MAX_DROPDOWN_RESULTS, graphStore.userRoot.id);

  const filteredCommands = useMemo<Command[]>(() => {
    const commands: Command[] = [];
    if (search.text === "") {
      commands.push(
        ...getRecentNodes().map(({ object }) => {
          const path = getCanonicalPath(object);
          return {
            type: "navigate" as const,
            id: object.id,
            name: object.text,
            object,
            path,
            perform: async (event?: React.MouseEvent<HTMLDivElement>) => {
              if (event?.shiftKey) {
                viewStore.createSidePanelTree(object);
              } else {
                close();
                resetSearch();
                if (path.endState === "not-loaded") {
                  await graphStore.layerManager.loadCanonicalWithIds([object.id], true);
                  const updatedPath = getCanonicalPath(object);
                  setRoot(updatedPath);
                } else {
                  setRoot(path);
                }
              }
            },
          };
        }),
      );
    } else {
      commands.push(
        ...graphStore
          .search({ text: search.text, filters: { types: ["node"] }, sort: { by: "score" } })
          .nodes.map(({ node }) => ({ node, isFavorited: isFavorited(graphStore, node) }))
          .sort((a, b) => (b.isFavorited && !a.isFavorited ? 1 : a.isFavorited && !b.isFavorited ? -1 : 0))
          .slice(0, MAX_DROPDOWN_RESULTS)
          .map(({ node, isFavorited }) => {
            const path = getCanonicalPath(node);
            return {
              type: "navigate" as const,
              id: node.id,
              name: node.text,
              object: node,
              isFavorited,
              path,
              perform: async (event?: React.MouseEvent<HTMLDivElement>) => {
                if (event?.shiftKey) {
                  viewStore.createSidePanelTree(node);
                } else {
                  close();
                  resetSearch();
                  if (path.endState === "not-loaded") {
                    await graphStore.layerManager.loadCanonicalWithIds([node.id], true);
                    const updatedPath = getCanonicalPath(node);
                    setRoot(updatedPath);
                  } else {
                    setRoot(path);
                  }
                }
              },
            };
          }),
      );
    }
    if (!graphStore.user.isAnonymous) {
      commands.push({
        type: "create" as const,
        id: "create",
        name:
          search.text === ""
            ? "Create blank node"
            : `Create new node: "${search.text}" ( ${isMac ? "⌘" : "Ctrl"} + Enter )`,
        perform: async () => {
          const { node } = await graphStore.addChildNode({
            parentId: graphStore.userRoot.id,
            nodeProps: { content: search.chips },
          });

          const newMentionChips = search.chips.filter((chip) => chip.type === "mention");
          for (const mentionChip of newMentionChips) {
            await graphStore.addRelation({
              fromId: mentionChip.value,
              toId: node.id,
            });
          }

          close();
          resetSearch();
          setRoot(node);

          // Toast on new node creation
          addToast({
            title: "New node created at your root",
            description: node.text || "Empty node",
            duration: 5000,
            action: {
              label: "Zoom into node",
              onClick: () => handleZoomToNode(node),
            },
          });

          return node.id;
        },
      });
    }
    // The graphStore.search call above also loads canonical paths but it has a limit so
    // we don't always get the full paths. Here we call it again with only the first 5 commands
    // so we're more likely to get the full paths.
    graphStore.layerManager.loadCanonicalWithIds(commands.slice(0, 5).map(({ id }) => id));
    return commands; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    graphStore.totalNodes, //Required to refresh the search results
    search.text,
    search.chips,
    getRecentNodes,
    graphStore,
    viewStore,
    close,
    setRoot,
    addToast,
    handleZoomToNode,
  ]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          if (filteredCommands.length > 1) {
            e.preventDefault();
            e.stopPropagation();
            setSelectedIndex((prevIndex) => (prevIndex + 1 >= filteredCommands.length ? 0 : prevIndex + 1));
          }
          break;
        case "ArrowUp":
          if (filteredCommands.length > 1) {
            e.preventDefault();
            e.stopPropagation();
            setSelectedIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : filteredCommands.length - 1));
          }
          break;
        case "Tab":
        case "Enter":
          e.preventDefault();
          e.stopPropagation();
          const index = e.ctrlKey || e.metaKey ? filteredCommands.length - 1 : selectedIndex;
          if (filteredCommands[index]) {
            filteredCommands[index].perform();
          }
          break;
      }
    },
    [filteredCommands, selectedIndex],
  );

  // Scroll to selected element
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  // When the mention dropdown is open (see `CmdEditor`), pressing escape should
  // close it, not the command bar. Previously we used the `Dialog.Content`'s
  // `onEscapeKeyDown` prop to handle closing the command bar on escape, but
  // that was resulting in the command bar closing when the user pressed escape
  // while the mention dropdown was open. That's because the handler passed to
  // `Dialog.Content` runs before the typeahead plugin's escape handler, so the
  // plugin doesn't get a chance to handle and stop propagation. By handling in
  // an effect here, the plugin handles the event first and can stop
  // propagation.
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [viewStore.isCommandBarOpen, close]);

  return (
    <Dialog.Root open={viewStore.isCommandBarOpen} onOpenChange={viewStore.setCommandBarOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.Overlay}>
          <div ref={dropdownContainerRef} className={styles.DropdownContainer} />
          <Dialog.Content className={styles.Content} onKeyDown={handleKeyDown} onInteractOutside={close}>
            <VisuallyHidden asChild>
              <Dialog.DialogTitle>Command Bar</Dialog.DialogTitle>
            </VisuallyHidden>
            <VisuallyHidden asChild>
              <Dialog.DialogDescription>
                Search for nodes or create a new one. Use arrow keys to navigate and Enter to select.
              </Dialog.DialogDescription>
            </VisuallyHidden>
            <CmdEditor dropdownContainerRef={dropdownContainerRef} onChange={setSearch} initialValue={search} />
            <LineLoader height={2} />
            <div className={styles.List} ref={listRef}>
              {filteredCommands.map((command, index) => (
                <div
                  key={command.id}
                  className={cn(styles.Item, selectedIndex === index && styles.Selected)}
                  onClick={(e) => command.perform(e)}
                >
                  <span style={{ display: "flex", gap: 8, alignItems: "center", width: "100%" }}>
                    <span style={{ marginRight: "auto" }}>{command.name}</span>
                    {command.type === "navigate" && (
                      <>
                        <TypeIndicator object={command.object} />
                        {command.isFavorited && <Star size={16} />}
                        <RelationCounter object={command.object} showTooltip={false} />
                      </>
                    )}
                  </span>
                  {command.type !== "create" && <Path path={command.path} skipLast={true} />}
                </div>
              ))}
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
});

export default CommandBar;
