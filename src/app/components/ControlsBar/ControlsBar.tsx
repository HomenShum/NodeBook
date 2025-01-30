import { Globe, Link2, ListFilter, ListIcon, Map, MapPin, NetworkIcon, Sliders, WorkflowIcon, X } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { ChangeEvent, useCallback, useEffect, useState } from "react";

import { SortOptionDropdown } from "@/app/components/ControlsBar/SortOptionDropdown";
import { FlattenIcon, NestedIcon, NotesIcon } from "@/app/components/CustomIcons";
import { SearchBar } from "@/app/components/SearchBar/SearchBar";
import { Button } from "@/app/components/UIPrimitives/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/UIPrimitives/DropdownMenu";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/UIPrimitives/Popover";
import { Switch } from "@/app/components/UIPrimitives/Switch";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { SortOption, Tree } from "@/app/tree/Tree";
import { ideapadLinkManager } from "@/app/util";
import { ViewType } from "@/app/view/types";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

import { default as s, default as styles } from "./ControlsBar.module.css";

const filterIcons: { [key: string]: React.ReactNode } = {
  Public: <Globe size={14} />,
  Shared: <Link2 size={14} />,
  Maps: <Map size={14} />,
  Places: <MapPin size={14} />,
};

export const FilterPill = ({ filter, onRemove }: { filter: string; onRemove: (filter: string) => void }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Button
      size="sm"
      variant="active"
      onClick={() => onRemove(filter)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {!isHovered && filterIcons[filter]}
      {isHovered && <X size={14} />}
      <span>{filter}</span>
    </Button>
  );
};

interface Props {
  tree: Tree;
}

export const ControlsBar = observer(function ControlsBar({ tree }: Props) {
  const viewStore = useViewStore();
  const settingsStore = useSettingsStore();

  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [ideapadLink, setIdeapadLink] = useState(ideapadLinkManager.get(tree.rootObjectId));
  const [savedSlug, setSavedSlug] = useState("");
  const [slug, setSlug] = useState("");

  useEffect(() => {
    fetch(`/api/slug?nodeId=${tree.rootObjectId}`)
      .then((res) => res.json())
      .then((data) => {
        setSlug(data.slug);
        setSavedSlug(data.slug);
      });
  }, [tree.rootObjectId]);

  const handleLinkChange = (event: ChangeEvent<HTMLInputElement>) => {
    const element = event.target as HTMLInputElement;
    if (!element.value) return;
    ideapadLinkManager.set(tree.rootObjectId, element.value);
    setIdeapadLink(element.value);
  };

  const saveSlug = async () => {
    if (savedSlug === slug) return;
    const response = await fetch("/api/slug", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ nodeId: tree.rootObjectId, slug: slug }),
    });

    if (response.ok) {
      setSavedSlug(slug);
    } else {
      alert("Slug already in use.");
      setSlug(savedSlug);
    }
  };

  const toggleFilter = useCallback((filter: string) => {
    setSelectedFilters((prev) => (prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter]));
  }, []);

  const updateSortOption = (partialSortOption: Partial<SortOption>) => {
    const newSortOption: SortOption = {
      ...tree.sortOption,
      ...partialSortOption,
    };
    tree.updateSortByOption(newSortOption);
  };

  const setViewType = useCallback(
    (viewType: ViewType) => {
      if (viewType === ViewType.Graph) {
        viewStore.setGraphMode(true);
      } else {
        viewStore.setGraphMode(false);
        viewStore.setViewType(viewType);
      }
    },
    [viewStore],
  );

  return (
    <div className={s.ControlsBar}>
      <div className={styles.ControlsBarWrapper}>
        <SearchBar />
        {selectedFilters.map((filter) => (
          <FilterPill
            key={filter}
            filter={filter}
            onRemove={(filter) => setSelectedFilters((prev) => prev.filter((f) => f !== filter))}
          />
        ))}
        <div className={styles.FiltersDropdown}>
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
        <div className={styles.SortOptionDropdown}>
          <SortOptionDropdown sortOption={tree.sortOption} updateSortOption={updateSortOption} />
        </div>
      </div>
      <div className={styles.RightWrapper}>
        {settingsStore.showIdeapadLinkButton && (
          <Button
            size="sm"
            variant={"default"}
            onClick={() => window.open(ideapadLink, "_blank")}
            className={cn(s.ShowTooltip, s.BottomAlign)}
            data-tooltip={"Open graph view"}
          >
            <WorkflowIcon size={14} strokeWidth={1.5} />
            <span>Graph</span>
          </Button>
        )}
        <Button
          size="sm"
          variant={viewStore.flattenSublists ? "active" : "default"}
          onClick={() => viewStore.setFlattenSublists(!viewStore.flattenSublists)}
          className={cn(s.ShowTooltip, s.BottomAlign)}
          data-tooltip={viewStore.flattenSublists ? "Expand Sublists" : "Flatten Sublists"}
        >
          {viewStore.flattenSublists ? <FlattenIcon /> : <NestedIcon />}
          <span>Sublists</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
              {viewStore.graphMode ? (
                <NetworkIcon size={14} strokeWidth={1.5} />
              ) : viewStore.viewType === ViewType.Outline ? (
                <ListIcon size={17} strokeWidth={1.8} />
              ) : (
                <NotesIcon />
              )}
              <span>
                {viewStore.graphMode
                  ? "Graph View"
                  : viewStore.viewType === ViewType.Outline
                  ? "List View"
                  : "Note View"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => setViewType(ViewType.Outline)}>
              <ListIcon size={17} strokeWidth={1.7} />
              List View
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setViewType(ViewType.Note)}>
              <NotesIcon />
              Note View
            </DropdownMenuItem>
            {settingsStore.showGraphViewButton && (
              <DropdownMenuItem onSelect={() => setViewType(ViewType.Graph)}>
                <NetworkIcon size={14} strokeWidth={1.5} />
                Graph View
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm">
              <Sliders size={14} strokeWidth={1.5} />
              <span>Display</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={5}>
            <div className={s.PopoverHeader}>Display Options</div>
            <div>
              <div className={s.SwitchItem}>
                <label htmlFor="show-node-details">Show node details</label>
                <Switch
                  id="show-node-details"
                  checked={settingsStore.showNodeDetails}
                  onCheckedChange={(checked: boolean) => settingsStore.setShowNodeDetails(checked)}
                />
              </div>
              <div className={s.SwitchItem}>
                <label htmlFor="hide-direct-parent">Hide direct parent</label>
                <Switch
                  id="hide-direct-parent"
                  checked={settingsStore.hideDirectParent}
                  onCheckedChange={(checked: boolean) => settingsStore.setHideDirectParent(checked)}
                />
              </div>
              <div className={s.SwitchItem}>
                <label htmlFor="hide-all-root-parents">Hide all root parents</label>
                <Switch
                  id="hide-all-root-parents"
                  checked={settingsStore.hideAllRootParents}
                  onCheckedChange={(checked: boolean) => settingsStore.setHideAllRootParents(checked)}
                />
              </div>
              <div className={s.SwitchItem}>
                <label htmlFor="hide-all-parents">Hide all parents</label>
                <Switch
                  id="hide-all-parents"
                  checked={settingsStore.hideAllParents}
                  onCheckedChange={(checked: boolean) => settingsStore.setHideAllParents(checked)}
                />
              </div>
              <div className={s.SwitchItem}>
                <label htmlFor="hide-backrelations">Hide backrelations</label>
                <Switch
                  id="hide-backrelations"
                  checked={settingsStore.hideBackrelations}
                  onCheckedChange={(checked: boolean) => settingsStore.setHideBackrelations(checked)}
                />
              </div>
              <div className={s.SwitchItem}>
                <label htmlFor="hide-thoughtstream-bullets">Hide bullets in thoughtstream view</label>
                <Switch
                  id="hide-thoughtstream-bullets"
                  checked={settingsStore.hideThoughtstreamBullets}
                  onCheckedChange={(checked: boolean) => settingsStore.setHideThoughtstreamBullets(checked)}
                />
              </div>
              <div className={s.SwitchItem}>
                <label htmlFor="hide-bullet-background-if-parents-only">
                  Hide bullet backgrounds if it contains only parents
                </label>
                <Switch
                  id="hide-bullet-background-if-parents-only"
                  checked={settingsStore.hideBulletBackgroundIfParentsOnly}
                  onCheckedChange={(checked: boolean) => settingsStore.setHideBulletBackgroundIfParentsOnly(checked)}
                />
              </div>
              <div className={s.SwitchItem}>
                <label htmlFor="hide-pinned-items">Hide pinned items from the main list</label>
                <Switch
                  id="hide-pinned-items"
                  checked={settingsStore.hidePinnedItems}
                  onCheckedChange={(checked: boolean) => settingsStore.setHidePinnedItems(checked)}
                />
              </div>
              {settingsStore.showIdeapadLinkButton && (
                <div className={cn(s.SwitchItem, s.TextInput)}>
                  <label htmlFor="set-ideapad-link">Set Ideapad Link</label>
                  <input id="set-ideapad-link" value={ideapadLink} onChange={handleLinkChange} />
                </div>
              )}
              <div className={cn(s.SwitchItem, s.TextInput)}>
                <label htmlFor="set-slug">Set Slug Link</label>
                <input id="set-slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
                <button onClick={saveSlug}>Save</button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
});
