"use client";
// eslint-disable-file no-use-before-define

import { observer } from "mobx-react-lite";
import * as React from "react";

import { ParentRelationIcon, SublistIcon, UnlabeledRelationIcon } from "@/app/components/CustomIcons";
import { RelationTypeSelector } from "@/app/components/RelatedObject/RelationCombobox/RelationTypeSelector";
import styles from "@/app/components/RelatedObject/styles/RelationCombobox.module.css";
import { Button } from "@/app/components/UIPrimitives/Button";
import { Popover, PopoverTrigger } from "@/app/components/UIPrimitives/Popover";
import { useUser } from "@/app/contexts/UserContext";
import { defaultRelationTypes, getRelationTypeIcon } from "@/app/graph/constants";
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

  const label = React.useMemo(() => {
    if (relation.hasCustomTypeRelation) {
      const typeRelation = relation.customTypeRelation;
      if (!typeRelation) return "";
      const fwTypeNode = typeRelation.to;
      if (isForward) {
        return fwTypeNode.text;
      }
      const reverseRelations = fwTypeNode.relations.filter(
        (rel) => rel.relationTypeId === defaultRelationTypes.__reverse__.id,
      );
      if (reverseRelations.length > 0) {
        const reverseNode = reverseRelations[0].to;
        return reverseNode.text;
      }
      return fwTypeNode.text;
    }
    return isForward ? relation.relationType.label : relation.relationType.reverseLabel;
    // For the below eslint error, if you don't specify the .to and .relations fields
    //  combobox relationtypes won't update when the nodes are changed.
  }, [
    isForward,
    relation.hasCustomTypeRelation,
    relation.customTypeRelation,
    relation.customTypeRelation?.to,
    relation.customTypeRelation?.to?.relations,
    relation.relationType.label,
    relation.relationType.reverseLabel,
  ]);

  if (viewStore.flattenSublists && treeNode instanceof PointerTreeNode && !treeNode.showRelation) {
    return null;
  }

  const close = () => {
    setIsOpen(false);
    setUpdatingRelationType(false);
    setShowRelationType(false);
    treeNode.tree.setFocusedNode(treeNode.id);
  };

  if (user.isAnonymous) {
    return (
      <Button variant="ghost" size="sm" className={styles.RelationComboboxLabel} disabled>
        {label}:
      </Button>
    );
  }

  const icon = getRelationTypeIcon(relation.relationType.id);

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
