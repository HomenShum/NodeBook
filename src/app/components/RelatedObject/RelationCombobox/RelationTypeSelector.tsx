import { Delete, MessageCircle, Plus, Search } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { ParentRelationIcon } from "@/app/components/CustomIcons";
import SelectionItem from "@/app/components/RelatedObject/RelationCombobox/SelectionItem";
import styles from "@/app/components/RelatedObject/styles/RelationCombobox.module.css";
import { PopoverContent } from "@/app/components/UIPrimitives/Popover";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { defaultRelationTypes, getRelationTypeIcon } from "@/app/graph/constants";
import { GraphRelationType } from "@/app/graph/types";
import { DescendantTreeNode } from "@/app/tree/nodes";
import { useSetMainRoot } from "@/app/tree/utils";
import { useViewStore } from "@/app/view/useViewStore";

const getCreationLabel = (search: string) => `Create "${search}" relation type`;

interface RelationTypeItem {
  key: string;
  label: string;
  onSelect: () => void;
  icon?: () => JSX.Element;
}

interface SelectorProps {
  treeNode: DescendantTreeNode;
  close: () => void;
}

export function RelationTypeSelector({ treeNode, close }: SelectorProps) {
  const parent = treeNode.parent.object;
  const relation = treeNode.relationWithParent;
  const isForward = relation.to.id === treeNode.object.id;
  const graphStore = useGraphStore();
  const [search, setSearch] = useState(
    relation.relationType.id === "child" && !isForward
      ? "parent"
      : isForward
      ? relation.relationType.label
      : relation.relationType.reverseLabel,
  );
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const itemWasSelectedRef = useRef(false);
  const viewStore = useViewStore();
  const setRoot = useSetMainRoot();

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
    const tmpItems: RelationTypeItem[] = [];

    // Handle special default relation types
    if (search === "child") {
      tmpItems.push({
        key: "parent",
        label: "parent",
        onSelect: async () => await handleSelect(defaultRelationTypes.child, "reverse"),
        icon: () => <ParentRelationIcon />,
      });
    } else if (search === "parent") {
      tmpItems.push({
        key: "child",
        label: "child",
        onSelect: async () => await handleSelect(defaultRelationTypes.child, "forward"),
        icon: () => <ParentRelationIcon />,
      });
    }

    tmpItems.push(
      ...graphStore
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
            icon: getRelationTypeIcon(relationType.id),
          },
          {
            key: `${relationType.id}-reverse`,
            label: relationType.reverseLabel,
            onSelect: async () => await handleSelect(relationType, "reverse"),
            icon: getRelationTypeIcon(relationType.id),
          },
        ])
        .flat()
        .filter(({ label }) => label.toLowerCase().includes(search.toLowerCase())),
    );

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
        icon: () => <Plus size={14} strokeWidth={1.5} />,
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
      icon: () => <Delete size={14} strokeWidth={1.5} />,
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
        // Focus on the prefix if the treeNode has noteContent
        const hasNoteContent = treeNode.childrenGroupsById["noteContent"].nodes.length > 0;
        if (hasNoteContent) {
          // Focus on the prefix.
          const prefixInput = document.querySelector(`[data-note-prefix="${treeNode.object.id}"]`);
          if (prefixInput && prefixInput instanceof HTMLInputElement) {
            prefixInput.focus();
          } else {
            throw new Error("Prefix input not found");
          }
        }
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
      <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
        <div className={styles.RelationComboboxInput}>
          <Search size={14} />
          <input
            placeholder="Search relation types..."
            className={styles.RelationComboboxInputContent}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          style={{ padding: "5px", display: "flex", alignItems: "center" }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (event.shiftKey) {
              viewStore.createSidebarTree(treeNode.relationWithParent);
            } else {
              setRoot(treeNode.relationWithParent);
            }
          }}
        >
          <MessageCircle size={18} />
        </button>
      </div>
      <div className={styles.RelationComboboxGroup}>
        {items.map(({ key, label, onSelect, icon }, index) => (
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
            icon={icon}
          />
        ))}
      </div>
    </PopoverContent>
  );
}
