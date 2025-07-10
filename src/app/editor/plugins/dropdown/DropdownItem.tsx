import { forwardRef } from "react";

import { Path } from "@/app/components/Path";
import { RelationCounter } from "@/app/components/RelatedObject/RelationCounter";
import relationComboboxStyles from "@/app/components/RelatedObject/styles/RelationCombobox.module.css";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";
import { getCanonicalPath } from "@/app/graph/utils";
import {
  GLOBAL_HASHTAGS_NODE_ID,
  GLOBAL_RELATION_TYPES_NODE_ID,
  GLOBAL_ROOT_ID,
  GLOBAL_USERS_NODE_ID,
  USER_MY_HASHTAGS_NODE_ID_PREFIX,
  USER_RELATION_TYPES_NODE_ID_PREFIX,
  USER_ROOT_ID_PREFIX,
} from "@/lib/constants";
import { cn, trimContent } from "@/lib/utils";

import { Match } from "./types";

import styles from "./DropdownPlugin.module.css";

interface DropdownItemProps {
  index: number;
  isSelected: boolean;
  isNotOwned?: boolean;
  onMouseEnter: () => void;
  onClick: (e: React.MouseEvent<HTMLLIElement>) => void;
  showTabHelper?: boolean;
  match: Match;
  searchText?: string;
}

export const DropdownItem = forwardRef<HTMLLIElement, DropdownItemProps>(
  ({ index, isSelected, isNotOwned, onMouseEnter, onClick, showTabHelper, match, searchText }, ref) => {
    return (
      <li
        ref={ref}
        className={cn(isSelected ? styles.Selected : "", isNotOwned ? styles.NotOwned : "")}
        onMouseEnter={onMouseEnter}
        onClick={onClick}
        aria-selected={isSelected}
        role="option"
      >
        <div className={styles.DropdownItem}>
          {match.type === "relationType" ? (
            <div className={relationComboboxStyles.RelationComboboxLabel}>
              {match.isForward ? match.object.label : match.object.reverseLabel}:
            </div>
          ) : (
            <>
              <div className={styles.DropdownItemContent}>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  {match.object instanceof GraphNode ? (
                    searchText ? (
                      trimContent(match.object.text, searchText)
                    ) : (
                      match.object.text
                    )
                  ) : (
                    <RelationDisplay
                      from={match.object.from.text}
                      to={match.object.to.text}
                      relationType={match.object.relationType.label}
                    />
                  )}
                </div>
                <div className={styles.DropdownItemHelper}>
                  {showTabHelper && index === 0 && <div className={styles.DropdownHelper}>Tab to select </div>}
                  {match.type === "node" && <TypeIndicator object={match.object} />}
                  {match.type === "relation" && <div className={styles.RelTypeIndicator}>Relation</div>}
                  {match.type === "node" && (
                    <RelationCounter treeNodeOrGraphObject={match.object} showTooltip={false} />
                  )}
                </div>
              </div>
              {match.type === "node" ? <Path path={getCanonicalPath(match.object)} /> : null}
            </>
          )}
        </div>
      </li>
    );
  },
);

DropdownItem.displayName = "DropdownItem";

export function RelationDisplay({ from, to, relationType }: { from: string; to: string; relationType: string }) {
  return (
    <div className={styles.RelationItem}>
      <span className={styles.RelationItemObject}>{from}</span>
      <div className={cn(styles.RelationItemType)}>
        <span className={styles.RelationItemDash}>—</span>
        <span style={{ width: "fit-content" }}>{relationType}</span>
        <span className={styles.RelationItemArrow}>→</span>
      </div>
      <span className={styles.RelationItemObject}>{to}</span>
    </div>
  );
}

export function TypeIndicator({ object }: { object: GraphObject }) {
  const allSystemPrefixes = [
    GLOBAL_RELATION_TYPES_NODE_ID,
    GLOBAL_ROOT_ID,
    GLOBAL_USERS_NODE_ID,
    USER_RELATION_TYPES_NODE_ID_PREFIX,
    GLOBAL_HASHTAGS_NODE_ID,
  ];

  // If the node is a relation type node, show a "Type" indicator
  if (object instanceof GraphNode && allSystemPrefixes.some((prefix) => object.id.startsWith(prefix))) {
    return <div className={styles.RelatedObjectIndicator}>System</div>;
  } else if (object instanceof GraphNode && object.relations.some((r) => r.relationTypeId === "__reverse__")) {
    return <div className={styles.RelatedObjectIndicator}>Type</div>;
  } else if (object instanceof GraphNode && object.id.startsWith(USER_ROOT_ID_PREFIX)) {
    return <div className={styles.RelatedObjectIndicator}>User</div>;
  } else if (
    object.relations?.some((r: any) => {
      return r.from.id.startsWith(USER_MY_HASHTAGS_NODE_ID_PREFIX);
    })
  ) {
    return <div className={styles.RelatedObjectIndicator}> # </div>;
  }
  return null;
}
