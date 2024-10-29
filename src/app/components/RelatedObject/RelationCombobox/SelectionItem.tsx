import { Check } from "lucide-react";

import styles from "@/app/components/RelatedObject/styles/RelationCombobox.module.css";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphRelationType } from "@/app/graph/types";
import { cn } from "@/lib/utils";

interface SelectionItem {
  keyProp: string;
  label: string;
  onSelect: () => void;
  isSelected: boolean;
  setSelected: (key: string) => void;
  isForward: boolean;
  relation: GraphRelation;
}

function SelectionItem({ keyProp, label, onSelect, isSelected, setSelected, isForward, relation }: SelectionItem) {
  return (
    <div
      className={cn(styles.RelationComboboxItem, isSelected && styles.Selected)}
      onMouseEnter={() => setSelected(keyProp)}
      onClick={onSelect}
    >
      <Check
        size={14}
        className={cn(
          relToKey(relation.relationType, isForward) === keyProp ? styles.SelectedIcon : styles.Transparent,
        )}
      />
      <div>{label}</div>
    </div>
  );
}

const relToKey = (relationType: GraphRelationType, isForward: boolean) =>
  `${relationType.id}-${isForward ? "forward" : "reverse"}`;

export default SelectionItem;
