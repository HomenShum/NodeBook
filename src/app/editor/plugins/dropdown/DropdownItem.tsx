import { Path } from "@/app/components/Path";
import { RelationCounter } from "@/app/components/RelatedObject/RelationCounter";
import relationComboboxStyles from "@/app/components/RelatedObject/styles/RelationCombobox.module.css";
import { graphNodeIsCustomRelType } from "@/app/graph/constants";
import { GraphNode } from "@/app/graph/GraphNode";
import { getCanonicalPath } from "@/app/graph/utils";
import { USER_MY_HASHTAGS_NODE_ID_PREFIX } from "@/lib/constants";
import { cn } from "@/lib/utils";

import { Match } from "./types";

import styles from "./DropdownPlugin.module.css";

interface DropdownItemProps {
  index: number;
  ref?: (element: HTMLLIElement) => void;
  isSelected: boolean;
  isNotOwned?: boolean;
  onMouseEnter: () => void;
  onClick: (e: React.MouseEvent<HTMLLIElement>) => void;
  showTabHelper?: boolean;
  match: Match;
}

export function DropdownItem({
  index,
  ref,
  isSelected,
  isNotOwned,
  onMouseEnter,
  onClick,
  showTabHelper,
  match,
}: DropdownItemProps) {
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
                  match.object.text
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
                {match.type === "node" && graphNodeIsCustomRelType(match.object, true) ? (
                  <div className={styles.RelTypeIndicator}>Type</div>
                ) : match.object.relations?.some((r: any) => {
                    return r.from.id.startsWith(USER_MY_HASHTAGS_NODE_ID_PREFIX);
                  }) ? (
                  <div className={styles.RelTypeIndicator}> # </div>
                ) : null}

                {match.type === "relation" ? <div className={styles.RelTypeIndicator}>Relation</div> : null}
                {match.type === "node" ? <RelationCounter object={match.object} showTooltip={false} /> : null}
              </div>
            </div>
            {match.type === "node" ? <Path path={getCanonicalPath(match.object)} /> : null}
          </>
        )}
      </div>
    </li>
  );
}

export function RelationDisplay({ from, to, relationType }: { from: string; to: string; relationType: string }) {
  return (
    <div className={styles.RelationItem}>
      <span className={styles.RelationItemObject}>{from}</span>
      <div className={cn(relationComboboxStyles.RelationComboboxLabel, styles.RelationItemType)}>
        <span className={styles.RelationItemDash}>—</span>
        <span>{relationType}</span>
        <span className={styles.RelationItemArrow}>→</span>
      </div>
      <span className={styles.RelationItemObject}>{to}</span>
    </div>
  );
}
