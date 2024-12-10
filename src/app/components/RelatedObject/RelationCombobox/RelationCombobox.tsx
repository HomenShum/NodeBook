"use client";

import { observer } from "mobx-react-lite";
import * as React from "react";

import { ParentRelationIcon, SublistIcon, UnlabeledRelationIcon } from "@/app/components/CustomIcons";
import { RelationTypeSelector } from "@/app/components/RelatedObject/RelationCombobox/RelationTypeSelector";
import styles from "@/app/components/RelatedObject/styles/RelationCombobox.module.css";
import { Button } from "@/app/components/UIPrimitives/Button";
import { Popover, PopoverTrigger } from "@/app/components/UIPrimitives/Popover";
import { useUser } from "@/app/contexts/UserContext";
import { DescendantTreeNode, PointerTreeNode } from "@/app/tree/nodes";
import { useIsMobile } from "@/app/util";
import { useViewStore } from "@/app/view/useViewStore";

interface Props {
  setUpdatingRelationType: (updating: boolean) => void;
  treeNode: DescendantTreeNode | PointerTreeNode;
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  setShowRelationType: (value: boolean) => void;
}

export const RelationCombobox = observer(function RelationCombobox({
  setUpdatingRelationType,
  treeNode,
  isOpen,
  setIsOpen,
  setShowRelationType,
}: Props) {
  const user = useUser();

  const object = treeNode.object;

  const relation = treeNode.relationWithParent;

  const viewStore = useViewStore();
  const isForward = relation.to.id === object.id;
  const isMobile = useIsMobile();
  const [isHovered, setIsHovered] = React.useState(isMobile);

  if (viewStore.flattenSublists && treeNode instanceof PointerTreeNode && !treeNode.showRelation) {
    return null;
  }

  const close = () => {
    setIsOpen(false);
    setUpdatingRelationType(false);
    setShowRelationType(false);
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
      variant="default"
      size="xs"
      role="combobox"
      aria-expanded={isOpen}
      className={styles.RelationComboboxLabel}
      onMouseEnter={() => !isMobile && setIsHovered(true)}
      onMouseLeave={() => !isMobile && setIsHovered(false)}
    >
      {relation.relationType.id === "sublist" && <SublistIcon />}
      {relation.relationType.id === "child" && relation.from === treeNode.object && <ParentRelationIcon />}
      {label}
      {!relation.relationType.label ? <UnlabeledRelationIcon empty={!relation.relationType.label} /> : ":"}
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
      {isOpen && (
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
        >
          <RelationTypeSelector treeNode={treeNode} close={close} />
        </div>
      )}
    </Popover>
  );
});
