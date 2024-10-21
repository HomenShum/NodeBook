import React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import styles from "@/app/components/RelatedObject/styles/RelationCombobox.module.css";
import { GraphRelationType } from "@/app/graph/types";
import { GraphRelation } from "@/app/graph/GraphRelation";

interface SelectionItem {
  key: string;
  label: string;
  onSelect: () => void;
  isSelected: boolean;
  setSelected: (key: string) => void;
  isForward: boolean;
  relation: GraphRelation;
}

function SelectionItem({ key, label, onSelect, isSelected, setSelected, isForward, relation }: SelectionItem) {
  return (
    <div
      className={cn(styles.RelationComboboxItem, isSelected && styles.Selected)}
      onMouseEnter={() => setSelected(key)}
      onClick={() => {
        onSelect();
        close();
      }}
    >
      <Check
        size={14}
        className={cn(relToKey(relation.relationType, isForward) === key ? styles.SelectedIcon : styles.Transparent)}
      />
      <div>{label}</div>
    </div>
  );
}

const relToKey = (relationType: GraphRelationType, isForward: boolean) =>
  `${relationType.id}-${isForward ? "forward" : "reverse"}`;

export default SelectionItem;
