"use client";

import { observer } from "mobx-react-lite";
import * as React from "react";

import { SublistIcon } from "@/app/components/CustomIcons";
import { RelationTypeSelector } from "@/app/components/RelatedObject/RelationCombobox/RelationTypeSelector";
import styles from "@/app/components/RelatedObject/styles/RelationCombobox.module.css";
import { Button } from "@/app/components/UIPrimitives/Button";
import { Popover, PopoverTrigger } from "@/app/components/UIPrimitives/Popover";
import { useUser } from "@/app/contexts/UserContext";
import { DescendantTreeNode, PointerTreeNode } from "@/app/tree/nodes";
import { useViewStore } from "@/app/view/useViewStore";

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
  const user = useUser();

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
  if (user.isAnonymous) {
    return (
      <Button variant="ghost" size="sm" className={styles.RelationComboboxLabel} disabled>
        {label}:
      </Button>
    );
  }

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
      {relation.relationType.id === "sublist" && <SublistIcon />}
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
      {isOpen && <RelationTypeSelector treeNode={treeNode} close={close} />}
    </Popover>
  );
});
