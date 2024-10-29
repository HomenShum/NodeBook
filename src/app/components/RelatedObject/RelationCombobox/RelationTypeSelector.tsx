import { Search } from "lucide-react";
import * as React from "react";
import { useCallback, useMemo } from "react";

import SelectionItem from "@/app/components/RelatedObject/RelationCombobox/SelectionItem";
import styles from "@/app/components/RelatedObject/styles/RelationCombobox.module.css";
import { PopoverContent } from "@/app/components/UIPrimitives/Popover";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { defaultRelationTypes } from "@/app/graph/constants";
import { GraphRelationType } from "@/app/graph/types";
import { DescendantTreeNode } from "@/app/tree/nodes";

interface SelectorProps {
  treeNode: DescendantTreeNode;
  close: () => void;
}

export function RelationTypeSelector({ treeNode, close }: SelectorProps) {
  const parent = treeNode.parent.object;
  const relation = treeNode.relationWithParent;
  const isForward = relation.to.id === treeNode.object.id;
  const graphStore = useGraphStore();
  const [search, setSearch] = React.useState(relation.relationType.label);
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);

  const handleSelect = useCallback(
    async (relationType: GraphRelationType, wantDirection: "forward" | "reverse") => {
      if (relationType.id === relation?.relationType.id) {
        if (!isForward && wantDirection === "forward") {
          await graphStore.updateRelation({ relationId: relation.id, reverse: true });
        }
        if (isForward && wantDirection === "reverse") {
          await graphStore.updateRelation({ relationId: relation.id, reverse: true });
        }
        return;
      }
      await graphStore.updateRelation({
        relationId: relation.id,
        relationProps: { relationType },
        reverse: wantDirection === "forward" ? !isForward : isForward,
      });
    },
    [graphStore, isForward, relation.id, relation?.relationType.id],
  );

  const items = useMemo(() => {
    const tmpItems = graphStore
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
          onSelect: async () => await handleSelect(relationType, "forward"),
        },
        {
          key: `${relationType.id}-reverse`,
          label: relationType.reverseLabel,
          onSelect: async () => await handleSelect(relationType, "reverse"),
        },
      ])
      .flat()
      .filter(({ label }) => label.toLowerCase().includes(search.toLowerCase()));

    if (search.length > 0 && parent !== null && relation.relationType.label !== search) {
      tmpItems.push({
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

    tmpItems.push({
      key: "delete",
      label: "Delete relation label",
      onSelect: async () => {
        await graphStore.updateRelation({
          relationId: relation.id,
          relationProps: {
            relationType: defaultRelationTypes.child,
          },
          reverse: !isForward,
        });
      },
    });

    return tmpItems;
  }, [graphStore, handleSelect, isForward, parent, relation.id, relation.relationType.label, search]);

  return (
    <PopoverContent
      onCloseAutoFocus={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          setHighlightedIndex((highlightedIndex + 1 + items.length) % items.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          setHighlightedIndex((highlightedIndex - 1 + items.length) % items.length);
        } else if (e.key === "Enter") {
          const item = items[highlightedIndex];
          if (item) {
            e.preventDefault();
            e.stopPropagation();
            item.onSelect();
            close();
          }
        } else if (e.key === "Backspace" && search === "") {
          e.preventDefault();
          e.stopPropagation();
          const item = items[highlightedIndex];
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
        {items.map(({ key, label, onSelect }, index) => (
          <SelectionItem
            key={key}
            label={label}
            relation={relation}
            isSelected={highlightedIndex === index}
            onSelect={onSelect}
            setSelected={() => setHighlightedIndex(index)}
            isForward={isForward}
          />
        ))}
      </div>
    </PopoverContent>
  );
}
