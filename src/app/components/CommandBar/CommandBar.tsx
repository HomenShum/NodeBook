"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { observer } from "mobx-react-lite";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { CmdEditor } from "@/app/components/CommandBar/CmdEditor";
import { Path } from "@/app/components/Path";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useUser } from "@/app/contexts/UserContext";
import { Chip } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";
import { useSetRoot } from "@/app/tree/utils";
import { ObjectPath } from "@/app/util";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

import styles from "./CommandBar.module.css";

export type Search = { text: string; chips: Chip[] };

type Command =
  | {
      type: "create";
      id: string;
      name: string;
      perform: (isCmdPressed: boolean) => void;
    }
  | {
      type: "navigate";
      id: string;
      name: string;
      object: GraphObject;
      path: ObjectPath;
      perform: (isCmdPressed: boolean) => void;
    };

const CommandBar = observer(() => {
  const user = useUser();
  const viewStore = useViewStore();

  const [search, setSearch] = useState<Search>({ text: "", chips: [] });

  const close = useCallback(() => {
    setSearch({ text: "", chips: [] });
    viewStore.setCommandBarOpen(false);
  }, [viewStore]);

  useHotkeys(
    "mod+shift+k",
    (event) => {
      event.preventDefault();
      if (viewStore) {
        if (viewStore.isCommandBarOpen) {
          close();
        } else {
          viewStore.setCommandBarOpen(true);
        }
      }
    },
    { enableOnContentEditable: true },
    [viewStore],
  );

  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const dropdownContainerRef = useRef<HTMLDivElement>(null);
  const graphStore = useGraphStore();
  const setRoot = useSetRoot();

  const filteredCommands = useMemo<Command[]>(() => {
    return [
      ...(search.text === ""
        ? []
        : graphStore
            .search({ text: search.text, filters: { types: ["node"] }, sort: { by: "score" } })
            .nodes.slice(0, 30)
            .map(({ node }) => {
              const path = node.getPath();
              return {
                type: "navigate" as const,
                id: node.id,
                name: node.text,
                object: node,
                path,
                perform: () => {
                  close();
                  setRoot(path);
                },
              };
            })),
      {
        type: "create" as const,
        id: "create",
        name: search.text === "" ? "Create blank node" : `Create new node: "${search.text}"`,
        perform: async (isCmdPressed: boolean) => {
          const { node } = await graphStore.addChildNode({
            parentId: graphStore.userRoot.id,
            nodeProps: { content: search.chips },
          });

          const newMentionChips = search.chips.filter((chip) => chip.type === "mention");
          for (const mentionChip of newMentionChips) {
            await graphStore.addRelation({
              fromId: node.id,
              toId: mentionChip.value,
            });
          }

          close();
          if (isCmdPressed) {
            setRoot(node.getPath());
          }
        },
      },
    ];
  }, [graphStore, setRoot, search, close]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prevIndex) => Math.min(prevIndex + 1, filteredCommands.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prevIndex) => Math.max(prevIndex - 1, 0));
          break;
        case "Tab":
        case "Enter":
          e.preventDefault();
          e.stopPropagation();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].perform(e.metaKey);
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

  return (
    !user.isAnonymous && (
      <Dialog.Root open={viewStore.isCommandBarOpen} onOpenChange={viewStore.setCommandBarOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.Overlay}>
            <div ref={dropdownContainerRef} className={styles.DropdownContainer} />
            <Dialog.Content className={styles.Content} onKeyDown={handleKeyDown} onEscapeKeyDown={close}>
              <VisuallyHidden asChild>
                <Dialog.DialogTitle>Command Bar</Dialog.DialogTitle>
              </VisuallyHidden>
              <VisuallyHidden asChild>
                <Dialog.DialogDescription>
                  Search for nodes or create a new one. Use arrow keys to navigate and Enter to select.
                </Dialog.DialogDescription>
              </VisuallyHidden>
              <CmdEditor dropdownContainerRef={dropdownContainerRef} onChange={setSearch} />
              <div className={styles.List} ref={listRef}>
                {filteredCommands.map((command, index) => (
                  <div
                    key={command.id}
                    className={cn(styles.Item, selectedIndex === index && styles.Selected)}
                    onClick={(e) => command.perform(e.metaKey)}
                  >
                    <span>{command.name}</span>
                    {command.type !== "create" && <Path path={command.path} />}
                  </div>
                ))}
              </div>
            </Dialog.Content>
          </Dialog.Overlay>
        </Dialog.Portal>
      </Dialog.Root>
    )
  );
});

export default CommandBar;
