import { Globe, Link2, ListFilter, Map, MapPin, Sliders, X } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useCallback, useState } from "react";

import { ListIcon, PinIconMew, StreamIcon, ViewsIconMew } from "@/app/components/CustomIcons";
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
import { Tree } from "@/app/tree/Tree";
import { ViewType } from "@/app/view/types";
import { useViewStore } from "@/app/view/useViewStore";

import { default as s, default as styles } from "./ControlsBar.module.css";

const filterIcons: { [key: string]: React.ReactNode } = {
  Public: <Globe size={14} />,
  Shared: <Link2 size={14} />,
  Maps: <Map size={14} />,
  Places: <MapPin size={14} />,
};

const FilterPill = ({ filter, onRemove }: { filter: string; onRemove: (filter: string) => void }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Button
      size="sm"
      variant="active"
      className={styles.Button}
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

  const [isPinnedHovered, setIsPinnedHovered] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

  const showPinnedSection = !tree.filter.hidePinnedSection;

  const togglePinnedSection = useCallback(() => {
    tree.updateFilter((prev) => ({ ...prev, hidePinnedSection: !prev.hidePinnedSection }));
  }, [tree]);

  const toggleFilter = useCallback((filter: string) => {
    setSelectedFilters((prev) => (prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter]));
  }, []);

  return (
    <div className={s.ControlsBar}>
      <div className={styles.ControlsBarWrapper}>
        <Button
          size="sm"
          className={styles.Button}
          variant={showPinnedSection ? "active" : "default"}
          onClick={togglePinnedSection}
          onMouseEnter={() => setIsPinnedHovered(true)}
          onMouseLeave={() => setIsPinnedHovered(false)}
        >
          {showPinnedSection && isPinnedHovered ? <X size={14} /> : <PinIconMew size={14} strokeWidth={0.5} />}
          <span>Pinned</span>
        </Button>

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
        {settingsStore.isFlattenSublistsEnabled && (
          <div className={s.SwitchItem}>
            <Switch
              id="show-node-details"
              checked={viewStore.flattenSublists}
              onCheckedChange={(checked: boolean) => viewStore.setFlattenSublists(checked)}
            />
            <label htmlFor="show-node-details">Flatten sublists</label>
          </div>
        )}
      </div>
      <div className={styles.PopoverWrapper}>
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm">
              <ViewsIconMew size={16} fill="none" strokeWidth={1.2} />
              <span>View</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end">
            <div className={styles.PopoverButtonsContainer}>
              <Button
                size="sm"
                className={styles.PopoverButton}
                variant={viewStore.viewType === ViewType.Outline ? "active" : "default"}
                onClick={() => viewStore.setViewType(ViewType.Outline)}
              >
                <ListIcon />
                Outline
              </Button>
              <Button
                size="sm"
                className={styles.PopoverButton}
                variant={viewStore.viewType === ViewType.Note ? "active" : "default"}
                onClick={() => viewStore.setViewType(ViewType.Note)}
              >
                <StreamIcon />
                Note
              </Button>
            </div>
          </PopoverContent>
        </Popover>
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
                <label htmlFor="hide-bundles">Hide bundles</label>
                <Switch
                  id="hide-bundles"
                  checked={settingsStore.hideBundles}
                  onCheckedChange={(checked: boolean) => settingsStore.setHideBundles(checked)}
                />
              </div>
              <div className={s.SwitchItem}>
                <label htmlFor="hide-zones">Hide zones</label>
                <Switch
                  id="hide-zones"
                  checked={settingsStore.hideZones}
                  onCheckedChange={(checked: boolean) => settingsStore.setHideZones(checked)}
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
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
});
