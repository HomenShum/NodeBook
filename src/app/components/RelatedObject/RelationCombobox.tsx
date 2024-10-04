"use client";

import { Check, Search } from "lucide-react";
import { observer } from "mobx-react-lite";
import * as React from "react";

import { Button } from "@/app/components/UIPrimitives/Button";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/UIPrimitives/Popover";
import { GraphRelationType } from "@/app/graph/types";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { DescendantTreeNode, PointerTreeNode } from "@/app/tree/nodes";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

import styles from "./styles/RelationCombobox.module.css";

const relToKey = (relationType: GraphRelationType, isForward: boolean) =>
  `${relationType.id}-${isForward ? "forward" : "reverse"}`;

interface Props {
  setUpdatingRelationType: (updating: boolean) => void;
  treeNode: DescendantTreeNode | PointerTreeNode;
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
}

export const RelationCombobox = observer(function RelationCombobox({
  setUpdatingRelationType,
  treeNode,
  isOpen,
  setIsOpen,
}: Props) {
  const object = treeNode.object;

  const relation = treeNode.relationWithParent;

  const viewStore = useViewStore();
  const isForward = relation.to.id === object.id;
  const [isHovered, setIsHovered] = React.useState(false);

  if (viewStore.flattenSublists && treeNode instanceof PointerTreeNode && !treeNode.showRelation) {
    return null;
  }

  const close = () => {
    setIsOpen(false);
    setUpdatingRelationType(false);
    treeNode.tree.setFocusedNode(treeNode.id);
  };

  const label = isForward ? relation.relationType.label : relation.relationType.reverseLabel;
  const button = (
    <Button
      variant="ghost"
      size="sm"
      role="combobox"
      aria-expanded={isOpen}
      className={styles.RelationComboboxLabel}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {label}:
    </Button>
  );

  if (!isHovered && !isOpen) {
    return button;
  }
  return (
    <Popover
      open={isOpen}
      onOpenChange={(newIsOpen) => {
        if (newIsOpen) {
          setIsOpen(true);
        } else {
          close();
        }
      }}
    >
      <PopoverTrigger asChild>{button}</PopoverTrigger>
      <RelationTypeSelector treeNode={treeNode} close={close} />
    </Popover>
  );
});

interface SelectorProps {
  treeNode: DescendantTreeNode;
  close: () => void;
}

function RelationTypeSelector({ treeNode, close }: SelectorProps) {
  const parent = treeNode.parent.object;
  const relation = treeNode.relationWithParent;
  const isForward = relation.to.id === treeNode.object.id;
  const graphStore = useGraphStore();
  const [search, setSearch] = React.useState(relation.relationType.label);
  const [selected, setSelected] = React.useState(`${relation.relationType.id}-${isForward ? "forward" : "reverse"}`);
  const items = graphStore
    .search({
      text: search,
      filters: {
        types: ["relationType"],
      },
      sort: {
        by: "score",
        order: "desc",
      },
    })
    .relationTypes.map(({ relationType }) => [
      {
        key: `${relationType.id}-forward`,
        label: relationType.label,
        onSelect: async () => {
          if (relationType.id === relation.relationType.id) {
            if (isForward) {
              return; // already selected
            } else {
              await graphStore.updateRelation({ relationId: relation.id, reverse: true });
            }
          } else {
            await graphStore.updateRelation({
              relationId: relation.id,
              relationProps: { relationType },
              reverse: !isForward,
            });
          }
        },
      },
      {
        key: `${relationType.id}-reverse`,
        label: relationType.reverseLabel,
        onSelect: async () => {
          if (relationType.id === relation?.relationType.id) {
            if (isForward) {
              await graphStore.updateRelation({ relationId: relation.id, reverse: true });
            } else {
              return; // already selected
            }
          } else {
            await graphStore.updateRelation({
              relationId: relation.id,
              relationProps: { relationType },
              reverse: isForward,
            });
          }
        },
      },
    ])
    .flat()
    .filter(({ label }) => label.toLowerCase().includes(search.toLowerCase()));

  if (search.length > 0 && parent !== null) {
    items.push({
      key: "new",
      label: `Create "${search}" relation type`,
      onSelect: async () => {
        const relationType = await graphStore.addRelationType({
          label: search,
        });
        await graphStore.updateRelation({
          relationId: relation.id,
          relationProps: { relationType },
        });
      },
    });
  }

  items.push({
    key: "delete",
    label: "Delete relation",
    onSelect: async () => {
      await graphStore.removeRelation({ relationId: relation.id });
    },
  });
  return (
    <PopoverContent
      onCloseAutoFocus={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          const index = items.findIndex(({ key }) => key === selected);
          setSelected(items[(index + 1) % items.length].key);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          const index = items.findIndex(({ key }) => key === selected);
          setSelected(items[(index - 1 + items.length) % items.length].key);
        } else if (e.key === "Enter") {
          const item = items.find(({ key }) => key === selected);
          if (item) {
            e.preventDefault();
            e.stopPropagation();
            item.onSelect();
            close();
          }
        } else if (e.key === "Backspace" && search === "") {
          e.preventDefault();
          e.stopPropagation();
          const targetKey = isForward ? "child" : "parent";
          const item = items.find(({ label }) => label === targetKey);
          if (item) {
            item.onSelect();
            close();
          }
        }
      }}
    >
      <div className={styles.RelationComboboxInput}>
        <Search size={14} />
        <input
          placeholder="Search relation types..."
          className={styles.RelationComboboxInputContent}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className={styles.RelationComboboxGroup}>
        {items.map(({ key, label, onSelect }) => (
          <div
            key={key}
            className={cn(styles.RelationComboboxItem, selected === key && styles.Selected)}
            onMouseEnter={() => setSelected(key)}
            onClick={() => {
              onSelect();
              close();
            }}
          >
            <Check
              size={14}
              className={cn(
                relToKey(relation.relationType, isForward) === key ? styles.SelectedIcon : styles.Transparent,
              )}
            />
            <div>{label}</div>
          </div>
        ))}
      </div>
    </PopoverContent>
  );
}
