import React, { useCallback, useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { Globe, Link2, ListFilter, Map, MapPin } from "lucide-react";

import s from "@/app/components/QuickCapture/QuickCapture.module.css";
import s1 from "@/app/components/ControlsBar/ControlsBar.module.css"
import { useViewStore } from "@/app/view/useViewStore";
import OutlineContent from "@/app/components/OutlineContent";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/UIPrimitives/DropdownMenu";
import { Button } from "@/app/components/UIPrimitives/Button";
import { SortOptionDropdown } from "@/app/components/ControlsBar/SortOptionDropdown";
import { SortOption } from "@/app/tree/Tree";
import { ViewType } from "@/app/view/types";
import { FilterPill } from "@/app/components/ControlsBar/ControlsBar";
import { cn } from "@/lib/utils";
import { NestedIcon, NotesIcon } from "@/app/components/CustomIcons";
import { QuickCaptureSearchBar } from "@/app/components/SearchBar/QuickCaptureSearchBar";
import { DescendantTreeNode } from "@/app/tree/nodes";
import QuickCaptureMenu from "@/app/components/QuickCapture/QuickCaptureMenu";

function QuickCapture() {
  const viewStore = useViewStore();
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

  const toggleFilter = useCallback((filter: string) => {
    setSelectedFilters((prev) => (prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter]));
  }, []);

  const updateSortOption = (partialSortOption: Partial<SortOption>) => {
    if(!viewStore.quickCaptureTree) return;
    const newSortOption: SortOption = {
      ...viewStore.quickCaptureTree.sortOption,
      ...partialSortOption,
    };
    viewStore.quickCaptureTree.updateSortByOption(newSortOption);
  };

  const toggleViewType = useCallback(() => {
    viewStore.setQuickCaptureViewType(viewStore.quickCaptureViewType === ViewType.Outline ? ViewType.Note : ViewType.Outline);
  }, [viewStore]);

  useEffect(() => {
    if(!viewStore.quickCaptureTree) return;
    viewStore.quickCaptureTree.focus();
  }, [viewStore.quickCaptureTree]);

  if (!viewStore.quickCaptureView) return <></>;

  return (
    <div className={s.QuickCaptureContainer}>
      <QuickCaptureMenu/>
      <div className={s1.ControlsBar}>
        <div className={s1.ControlsBarWrapper}>
          <div className={s1.ControlsBarWrapper}>
            <QuickCaptureSearchBar />
            {selectedFilters.map((filter) => (
              <FilterPill
                key={filter}
                filter={filter}
                onRemove={(filter) => setSelectedFilters((prev) => prev.filter((f) => f !== filter))}
              />
            ))}
            <div className={s1.FiltersDropdown}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" disabled>
                    <ListFilter size={14} strokeWidth={1.5} />
                    <span>Filters</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => toggleFilter("Public")}>
                    <Globe size={14} strokeWidth={1.5} />
                    Public
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => toggleFilter("Shared")}>
                    <Link2 size={14} strokeWidth={1.5} />
                    Shared
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => toggleFilter("Maps")}>
                    <Map size={14} strokeWidth={1.5} />
                    Maps
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => toggleFilter("Places")}>
                    <MapPin size={14} strokeWidth={1.5} />
                    Places
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className={s1.SortOptionDropdown}>
              <SortOptionDropdown sortOption={viewStore.quickCaptureView.sortOption} updateSortOption={updateSortOption} />
            </div>
            <Button
              size="sm"
              onClick={toggleViewType}
              className={cn(s1.ShowTooltip, s1.BottomAlign)}
              data-tooltip={viewStore.quickCaptureViewType === ViewType.Outline ? "Switch to Notes" : "Switch to Lists"}
            >
              {viewStore.quickCaptureViewType === ViewType.Outline ? (
                <>
                  <NestedIcon />
                  <span>Lists</span>
                </>
              ) : (
                <>
                  <NotesIcon />
                  <span>Notes</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      <OutlineContent tree={viewStore.quickCaptureView} />
    </div>
  );
}

export default observer(QuickCapture);
