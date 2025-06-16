import { Maximize, Minimize } from "lucide-react";
import { useContext } from "react";

import { FilteredNodesContext } from "@/app/components/RelatedObject/contexts/FilteredNodesContext";
import { Button } from "@/app/components/UIPrimitives/Button";
import { cn } from "@/lib/utils";

interface GlobalFilteredNodesButtonProps {
  showLabel?: boolean;
  className?: string;
  tooltipClassName?: string;
}

export const GlobalFilteredNodesButton = ({
  showLabel = true,
  className = "",
  tooltipClassName = "",
}: GlobalFilteredNodesButtonProps) => {
  const { globalExpanded, setGlobalExpanded, instances } = useContext(FilteredNodesContext);

  // Only show the button if there are filtered nodes instances
  if (instances.size === 0) {
    return null;
  }

  const label = globalExpanded ? "Collapse All Unmatched" : "Expand All Unmatched";
  const icon = globalExpanded ? <Minimize size={14} /> : <Maximize size={14} />;

  return (
    <Button
      variant="default"
      size="sm"
      className={cn(className, tooltipClassName)}
      onClick={() => setGlobalExpanded(!globalExpanded)}
      data-tooltip={showLabel ? undefined : label}
    >
      {icon}
      <span>{label}</span>
    </Button>
  );
};
