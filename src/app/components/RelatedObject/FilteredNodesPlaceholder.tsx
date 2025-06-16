"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useContext, useEffect, useState } from "react";

import { FilteredNodesContext } from "@/app/components/RelatedObject/contexts/FilteredNodesContext";
import { Button } from "@/app/components/UIPrimitives/Button";
import { DescendantTreeNode, GroupId } from "@/app/tree/nodes";
import { SearchTree } from "@/app/tree/SearchTree";
import { comparePositions } from "@/app/util";
import { cn } from "@/lib/utils";

import { RelatedObjectView } from "./RelatedObjectView";
import styles from "./styles/FilteredNodesPlaceholder.module.css";

/**
 * Recursively sets isEditable to false for a node and all its descendants
 */
function setNodeAndDescendantsUneditable(node: DescendantTreeNode) {
  node.isEditable = false;
  
  // Recursively set all children to uneditable
  for (const group of node.childrenGroups) {
    for (const childNode of group.nodes) {
      setNodeAndDescendantsUneditable(childNode);
    }
  }
}

interface FilteredNodesPlaceholderProps {
  tree: SearchTree;
  parentPath: string;
  groupId: GroupId;
  groupIndex: number;
}

export const FilteredNodesPlaceholder = observer(function FilteredNodesPlaceholder({
  tree,
  parentPath,
  groupId,
  groupIndex,
}: FilteredNodesPlaceholderProps) {
  const [localExpanded, setLocalExpanded] = useState(false);
  const [recentStateSource, setRecentStateSource] = useState<"local" | "global">("global");
  const { globalExpanded, registerInstance, unregisterInstance } = useContext(FilteredNodesContext);
  const instanceId = `${parentPath}-${groupId}-${groupIndex}`;

  // Register/unregister this instance with the context
  useEffect(() => {
    registerInstance(instanceId);
    return () => unregisterInstance(instanceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId]); // Only re-run if the instanceId changes

  // Listen for expansion events from SearchTree navigation
  useEffect(() => {
    const handleExpandFilteredNodes = (event: CustomEvent) => {
      const { parentPath: eventParentPath, groupId: eventGroupId } = event.detail;

      // Check if this instance should be expanded
      if (eventParentPath === parentPath && eventGroupId === groupId) {
        setLocalExpanded(true);
        setRecentStateSource("local");
      }
    };

    const handleExpandFilteredNodesSpecific = (event: CustomEvent) => {
      const { parentPath: eventParentPath, groupId: eventGroupId, groupIndex: eventGroupIndex } = event.detail;

      // Check if this specific instance should be expanded
      if (eventParentPath === parentPath && eventGroupId === groupId && eventGroupIndex === groupIndex) {
        setLocalExpanded(true);
        setRecentStateSource("local");
      }
    };

    window.addEventListener("expand-filtered-nodes", handleExpandFilteredNodes as EventListener);
    window.addEventListener("expand-filtered-nodes-specific", handleExpandFilteredNodesSpecific as EventListener);

    return () => {
      window.removeEventListener("expand-filtered-nodes", handleExpandFilteredNodes as EventListener);
      window.removeEventListener("expand-filtered-nodes-specific", handleExpandFilteredNodesSpecific as EventListener);
    };
  }, [parentPath, groupId, groupIndex, instanceId]);

  // Track when globalExpanded changes
  useEffect(() => {
    setRecentStateSource("global");
  }, [globalExpanded]);

  // Use whichever state was changed most recently
  const isExpanded = recentStateSource === "global" ? globalExpanded : localExpanded;

  // Get contiguous groups of filtered nodes
  const contiguousGroups = tree.getContiguousFilteredGroups(parentPath, groupId);

  // If no groups or the specified group index is out of bounds
  if (contiguousGroups.length === 0 || groupIndex >= contiguousGroups.length) {
    return null;
  }

  // Get the filtered nodes and ensure they're properly sorted by position
  // We don't need to reverse them as was done previously - just sort by position
  const filteredNodes = [...contiguousGroups[groupIndex]].sort((a, b) => comparePositions(a.position, b.position));
  const count = filteredNodes.length;

  const handleToggle = () => {
    setLocalExpanded(!isExpanded);
    setRecentStateSource("local");
  };

  return (
    <div className={styles.PlaceholderContainer}>
      <div className={styles.PlaceholderToggle} onClick={handleToggle}>
        <Button variant="ghost" size="sm" className={styles.ToggleButton}>
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {!isExpanded && <span className={styles.Ellipsis}>...</span>}
          <span className={styles.Count}>
            ({count} {isExpanded ? "shown" : "filtered"})
          </span>
        </Button>
      </div>

      {isExpanded && (
        <div className={cn(styles.FilteredNodesContainer)}>
          {filteredNodes.map((node) => {
            setNodeAndDescendantsUneditable(node);
            return (
              <div key={node.path} className={styles.FilteredNode}>
                <RelatedObjectView treeNode={node} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
