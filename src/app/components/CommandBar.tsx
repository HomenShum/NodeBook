import * as Dialog from "@radix-ui/react-dialog";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { Path } from "@/app/components/Path";
import { GraphObject } from "@/app/graph/GraphObject";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useSetRoot } from "@/app/tree/utils";
import { ObjectPath } from "@/app/util";
import { cn } from "@/lib/utils";

import styles from "./CommandBar.module.css";

type Command =
  | {
      type: "create";
      id: string;
      name: string;
      perform: () => void;
    }
  | {
      type: "navigate";
      id: string;
      name: string;
      object: GraphObject;
      path: ObjectPath;
      perform: () => void;
    };

const CommandBar = () => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const close = () => {
    setOpen(false);
    setSearch("");
  };
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const graphStore = useGraphStore();
  const setRoot = useSetRoot();

  useHotkeys("mod+shift+k", () => setOpen(true), { enableOnContentEditable: true });

  const filteredCommands = useMemo<Command[]>(() => {
    return [
      ...(search === ""
        ? []
        : graphStore
            .search({ text: search, filters: { types: ["node"] }, sort: { by: "score" } })
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
        name: search === "" ? "Create blank node" : `Create new node: "${search}"`,
        perform: async () => {
          const { node } = await graphStore.addChildNode({
            parentId: graphStore.userRoot.id,
            nodeProps: { content: search },
          });
          close();
          setRoot(node.getPath());
        },
      },
    ];
  }, [graphStore, setRoot, search]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prevIndex) => Math.min(prevIndex + 1, filteredCommands.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prevIndex) => Math.max(prevIndex - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].perform();
        }
        break;
    }
  };

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
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.Overlay} />
        <Dialog.Content className={styles.Content} onKeyDown={handleKeyDown} onEscapeKeyDown={close}>
          <input
            className={styles.Input}
            placeholder="Search nodes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className={styles.List} ref={listRef}>
            {filteredCommands.map((command, index) => (
              <div
                className={cn(styles.Item, selectedIndex === index && styles.Selected)}
                key={command.id}
                onClick={() => command.perform()}
              >
                <span>{command.name}</span>
                {command.type !== "create" && <Path path={command.path} />}
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default CommandBar;
