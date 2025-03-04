import { CheckSquare, Globe, ListFilter } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useState } from "react";

import { FilterPill } from "@/app/components/ControlsBar/ControlsBar";
import s1 from "@/app/components/ControlsBar/ControlsBar.module.css";
import { SortOptionDropdown } from "@/app/components/ControlsBar/SortOptionDropdown";
import { NestedIcon, NotesIcon } from "@/app/components/CustomIcons";
import OutlineContent from "@/app/components/OutlineContent";
import s from "@/app/components/QuickCapture/QuickCapture.module.css";
import QuickCaptureMenu from "@/app/components/QuickCapture/QuickCaptureMenu";
import { QuickCaptureSearchBar } from "@/app/components/SearchBar/QuickCaptureSearchBar";
import { Button } from "@/app/components/UIPrimitives/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/UIPrimitives/DropdownMenu";
import { OutlineParentContext } from "@/app/contexts/OutlineContentContext";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { useUser } from "@/app/contexts/UserContext";
import { SortOption } from "@/app/tree/Tree";
import { ViewType } from "@/app/view/types";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

function QuickCapture() {
  const viewStore = useViewStore();
  const user = useUser();
  const settingsStore = useSettingsStore();
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

  // Initialize selectedFilters based on current settings
  useEffect(() => {
    const filters = [];
    if (settingsStore.showOnlyTodosInQuickCapture) {
      if (settingsStore.todosInQuickCaptureFilterType === "all") {
        filters.push("TODOs");
      } else if (settingsStore.todosInQuickCaptureFilterType === "checked") {
        filters.push("TODOs (Checked)");
      } else if (settingsStore.todosInQuickCaptureFilterType === "unchecked") {
        filters.push("TODOs (Unchecked)");
      }
    }
    setSelectedFilters(filters);
  }, [settingsStore.showOnlyTodosInQuickCapture, settingsStore.todosInQuickCaptureFilterType]);

  // Add event listener for Escape key to close the quick capture popup
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && viewStore.quickCaptureOpen) {
        viewStore.closeQuickCapture();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [viewStore]);

  const toggleFilter = useCallback(
    (filter: string, status?: string) => {
      if (filter === "TODOs") {
        if (status) {
          // Set the filter type
          settingsStore.setTodosInQuickCaptureFilterType(status);
          // Enable the filter
          settingsStore.setShowOnlyTodosInQuickCapture(true);
        } else {
          // Just toggle the filter on/off without changing type
          settingsStore.setShowOnlyTodosInQuickCapture(!settingsStore.showOnlyTodosInQuickCapture);
        }
      }

      // Add the filter to selectedFilters with appropriate label
      let filterLabel = filter;
      if (filter === "TODOs" && status) {
        if (status === "checked") filterLabel = "TODOs (Checked)";
        else if (status === "unchecked") filterLabel = "TODOs (Unchecked)";
      }

      setSelectedFilters((prev) =>
        prev.some((f) => f.startsWith("TODOs"))
          ? prev.filter((f) => !f.startsWith("TODOs")).concat(filterLabel)
          : [...prev, filterLabel],
      );
    },
    [settingsStore],
  );

  const updateSortOption = (partialSortOption: Partial<SortOption>) => {
    if (!viewStore.quickCaptureOpen) return;
    const newSortOption: SortOption = {
      ...viewStore.quickCaptureTree.sortOption,
      ...partialSortOption,
    };
    viewStore.quickCaptureTree.updateSortByOption(newSortOption);
  };

  const toggleViewType = useCallback(() => {
    viewStore.setQuickCaptureViewType(
      viewStore.quickCaptureViewType === ViewType.Outline ? ViewType.Note : ViewType.Outline,
    );
  }, [viewStore]);

  if (!viewStore.quickCaptureView || !viewStore.quickCaptureOpen) return <></>;

  if (user.isAnonymous)
    return (
      <div className={s.QuickCaptureContainer}>
        <QuickCaptureMenu />
      </div>
    );

  return (
    <div className={s.QuickCaptureContainer}>
      <QuickCaptureMenu />
      <div className={s1.ControlsBar}>
        <div className={s1.ControlsBarWrapper}>
          <div className={s1.ControlsBarWrapper}>
            <QuickCaptureSearchBar />
            {selectedFilters.map((filter) => (
              <FilterPill
                key={filter}
                filter={filter}
                onRemove={(filter) => {
                  if (filter.startsWith("TODOs")) {
                    settingsStore.setShowOnlyTodosInQuickCapture(false);
                  }
                  setSelectedFilters((prev) => prev.filter((f) => f !== filter));
                }}
              />
            ))}
            <div className={s1.FiltersDropdown}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm">
                    <ListFilter size={14} strokeWidth={1.5} />
                    <span>Filters</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => toggleFilter("Public")}>
                    <Globe size={14} strokeWidth={1.5} />
                    Public
                  </DropdownMenuItem>
                  {/* <DropdownMenuItem onSelect={() => toggleFilter("Shared")}>
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
                  </DropdownMenuItem> */}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>
                    <CheckSquare size={14} strokeWidth={1.5} />
                    TODOs
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => toggleFilter("TODOs", "all")} style={{ paddingLeft: "24px" }}>
                    All TODOs
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => toggleFilter("TODOs", "checked")} style={{ paddingLeft: "24px" }}>
                    Checked TODOs
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => toggleFilter("TODOs", "unchecked")} style={{ paddingLeft: "24px" }}>
                    Unchecked TODOs
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className={s1.SortOptionDropdown}>
              <SortOptionDropdown
                sortOption={viewStore.quickCaptureView.sortOption}
                updateSortOption={updateSortOption}
              />
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
      <OutlineParentContext.Provider value="QuickCapture">
        <OutlineContent tree={viewStore.quickCaptureView} />
      </OutlineParentContext.Provider>
    </div>
  );
}

export default observer(QuickCapture);
