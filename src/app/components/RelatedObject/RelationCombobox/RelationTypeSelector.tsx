import { Search } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import SelectionItem from "@/app/components/RelatedObject/RelationCombobox/SelectionItem";
import styles from "@/app/components/RelatedObject/styles/RelationCombobox.module.css";
import { PopoverContent } from "@/app/components/UIPrimitives/Popover";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { defaultRelationTypes } from "@/app/graph/constants";
import { GraphRelationType } from "@/app/graph/types";
import { DescendantTreeNode } from "@/app/tree/nodes";

const getCreationLabel = (search: string) => `Create "${search}" relation type`;

interface SelectorProps {
  treeNode: DescendantTreeNode;
  close: () => void;
}

export function RelationTypeSelector({ treeNode, close }: SelectorProps) {
  const parent = treeNode.parent.object;
  const relation = treeNode.relationWithParent;
  const isForward = relation.to.id === treeNode.object.id;
  const graphStore = useGraphStore();
  const [search, setSearch] = useState(relation.relationType.label);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const itemWasSelectedRef = useRef(false);

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
        label: getCreationLabel(search),
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

  const handleExternalClose = useCallback(() => {
    if (search === "" || itemWasSelectedRef.current) return;

    const existingRelationType = items.find((item) => item.label === search);
    if (existingRelationType) {
      existingRelationType.onSelect();
      return;
    }

    const newRelationType = items.find((item) => item.key === "new");
    if (newRelationType && newRelationType.label === getCreationLabel(search)) {
      newRelationType.onSelect();
    }
  }, [items, search]);

  return (
    <PopoverContent
      onCloseAutoFocus={(e) => {
        e.preventDefault();
        handleExternalClose();
      }}
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
            itemWasSelectedRef.current = true;
            close();
          }
        } else if (e.key === "Backspace" && search === "") {
          e.preventDefault();
          e.stopPropagation();
          const item = items[highlightedIndex];
          if (item) {
            item.onSelect();
            itemWasSelectedRef.current = true;
            close();
          }
        } else if (e.key === "z" && (e.metaKey || e.ctrlKey)) {
          // Prevent the nodes content being undone/redone when relation combobox is open
          e.preventDefault();
          e.stopPropagation();
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
            keyProp={key}
            label={label}
            relation={relation}
            isSelected={highlightedIndex === index}
            onSelect={async () => {
              itemWasSelectedRef.current = true;
              await onSelect();
              close();
            }}
            setSelected={() => setHighlightedIndex(index)}
            isForward={isForward}
          />
        ))}
      </div>
    </PopoverContent>
  );
}
