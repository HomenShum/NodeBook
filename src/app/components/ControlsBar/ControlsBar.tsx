import {
  CheckSquare,
  Download,
  Globe,
  Link2,
  ListFilter,
  ListIcon,
  Map,
  MapPin,
  MinusSquare,
  NetworkIcon,
  Save,
  Sliders,
  WorkflowIcon,
  X,
} from "lucide-react";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/UIPrimitives/DropdownMenu";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/UIPrimitives/Popover";
import { Switch } from "@/app/components/UIPrimitives/Switch";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { useSlugs } from "@/app/contexts/SlugContext";
import { useUser } from "@/app/contexts/UserContext";
import { AccessMode, GraphNode } from "@/app/graph/GraphNode";
import { useToast } from "@/app/hooks/useToast";
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
  TODOs: <CheckSquare size={14} />,
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
  const graphStore = useGraphStore();
  const { addToast } = useToast();
  const { updateSlugByNodeId, slugs, deleteSlugByNodeId } = useSlugs();
  const user = useUser();

  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [ideapadLink, setIdeapadLink] = useState(ideapadLinkManager.get(tree.rootObjectId));

  const savedSlug = slugs[tree.rootObjectId] || "";
  const [slug, setSlug] = useState(savedSlug);

  const handleLinkChange = (event: ChangeEvent<HTMLInputElement>) => {
    const element = event.target as HTMLInputElement;
    if (!element.value) return;
    ideapadLinkManager.set(tree.rootObjectId, element.value);
    setIdeapadLink(element.value);
  };

  const handleOnChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value.replace(/[^a-z0-9-]/g, "");
    setSlug(newValue);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      saveSlug();
    }
  };

  useEffect(() => {
    setSlug(savedSlug);
  }, [savedSlug]);

  const saveSlug = async () => {
    if (savedSlug === slug) return;

    if (slug.length === 0) {
      await deleteSlugByNodeId(tree.rootObjectId);
      addToast({
        title: "Short URL removed",
        duration: 4000,
      });
      return;
    }

    const ownerNodeId = Object.keys(slugs).find((nodeId) => slugs[nodeId] === slug);

    if (ownerNodeId) {
      const shouldDelete = confirm("A node is already using this slug. Assign the slug to this node?");
      if (!shouldDelete) {
        return;
      }
      await deleteSlugByNodeId(ownerNodeId);
    }

    const wasSuccess = await updateSlugByNodeId(tree.rootObjectId, slug);
    if (!wasSuccess) {
      alert("Something went wrong");
      setSlug(savedSlug);
    } else {
      addToast({
        title: "Short URL saved",
        duration: 4000,
      });
    }
  };

  function copySlug(): void {
    if (!savedSlug || savedSlug.length <= 0) return;
    navigator.clipboard.writeText(`${window.location.origin}/${savedSlug}`).then(() => {
      addToast({
        title: "Short URL copied to clipboard",
        duration: 4000,
      });
    });
  }

  useEffect(() => {
    const filters: string[] = [];
    if (settingsStore.showOnlyTodos) {
      if (settingsStore.todosFilterType === "all") {
        filters.push("TODOs");
      } else if (settingsStore.todosFilterType === "checked") {
        filters.push("TODOs (Checked)");
      } else if (settingsStore.todosFilterType === "unchecked") {
        filters.push("TODOs (Unchecked)");
      }
    }
    setSelectedFilters(filters);
  }, [settingsStore.showOnlyTodos, settingsStore.todosFilterType]);

  const toggleFilter = useCallback(
    (filter: string, status?: string) => {
      if (filter === "TODOs") {
        if (status) {
          settingsStore.setTodosFilterType(status);
          settingsStore.setShowOnlyTodos(true);
        } else {
          settingsStore.setShowOnlyTodos(!settingsStore.showOnlyTodos);
        }
      }

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
            onRemove={(filter) => {
              if (filter.startsWith("TODOs")) {
                settingsStore.setShowOnlyTodos(false);
              }
              setSelectedFilters((prev) => prev.filter((f) => f !== filter));
            }}
          />
        ))}
        <div className={styles.FiltersDropdown}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <ListFilter size={14} strokeWidth={1.5} />
                <span>Filters</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => toggleFilter("Public", "all")}>
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
              ) : viewStore.viewType === ViewType.Webpage ? (
                <Globe size={14} strokeWidth={1.5} />
              ) : (
                <NotesIcon />
              )}
              <span>
                {viewStore.graphMode
                  ? "Graph View"
                  : viewStore.viewType === ViewType.Outline
                  ? "List View"
                  : viewStore.viewType === ViewType.Note
                  ? "Note View"
                  : viewStore.viewType === ViewType.Webpage
                  ? "Webpage View"
                  : "Card View"}
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
            <DropdownMenuItem onSelect={() => setViewType(ViewType.Card)}>
              <NotesIcon />
              Card View
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setViewType(ViewType.Webpage)}>
              <Globe size={14} strokeWidth={1.5} />
              Webpage View
            </DropdownMenuItem>
            {settingsStore.showGraphViewButton && (
              <DropdownMenuItem onSelect={() => setViewType(ViewType.Graph)}>
                <NetworkIcon size={14} strokeWidth={1.5} />
                Graph View
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <Popover
          onOpenChange={(open: boolean) => {
            if (!open) {
              setSlug(savedSlug);
            }
          }}
        >
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
              <div className={s.SwitchItem}>
                <label htmlFor="show-hidden-relations">Show hidden relations</label>
                <Switch
                  id="show-hidden-relations"
                  checked={settingsStore.showHiddenRelations}
                  onCheckedChange={(checked: boolean) => settingsStore.setShowHiddenRelations(checked)}
                />
              </div>

              <div className={s.SwitchItem}>
                <label htmlFor="show-graph-root">Show graph root</label>
                <Switch
                  id="show-graph-root"
                  checked={settingsStore.showGraphRoot}
                  onCheckedChange={(checked: boolean) => settingsStore.setShowGraphRoot(checked)}
                />
              </div>
              {tree.rootObject instanceof GraphNode && tree.rootObject.isPublic && (
                <div className={s.SwitchItem}>
                  <label htmlFor="access-mode">Allow unlogged users to append</label>
                  <Switch
                    id="access-mode"
                    checked={tree.rootObject.accessMode === AccessMode.APPEND}
                    onCheckedChange={(checked: boolean) =>
                      graphStore.setAppendMode({
                        objectId: tree.rootObjectId,
                        accessMode: checked ? AccessMode.APPEND : AccessMode.READ,
                      })
                    }
                  />
                </div>
              )}
              {settingsStore.showIdeapadLinkButton && (
                <div className={cn(s.SwitchItem, s.TextInput)}>
                  <label htmlFor="set-ideapad-link">Set Ideapad Link</label>
                  <input id="set-ideapad-link" value={ideapadLink} onChange={handleLinkChange} />
                </div>
              )}
              <div className={cn(s.SwitchItem, s.TextInput)}>
                <label htmlFor="set-slug">Short URL</label>
                <input
                  id="set-slug"
                  value={slug}
                  onChange={handleOnChange}
                  onKeyDown={handleKeyDown}
                  disabled={user.isAnonymous}
                  className={user.isAnonymous ? s.DisabledInput : ""}
                />
                <button onClick={saveSlug} disabled={user.isAnonymous}>
                  Save
                </button>
                <button onClick={copySlug}>Copy</button>
              </div>
              {!user.isAnonymous && (
                <div className={s.SwitchItem}>
                  <span>Expansion State</span>
                  <div className={s.ButtonContainer}>
                    <Button
                      size="sm"
                      variant="outline"
                      className={s.PopoverButton}
                      onClick={async () => {
                        const success = await tree.saveExpansionStateForAllUsers();
                        if (success) {
                          addToast({
                            title: "Expansion state saved for all users",
                            duration: 4000,
                          });
                        } else {
                          addToast({
                            title: "Failed to save expansion state",
                            duration: 4000,
                          });
                        }
                      }}
                    >
                      <Save size={14} />
                      <span>Save</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={s.PopoverButton}
                      onClick={() => {
                        tree.collapseAllNodes();
                        addToast({
                          title: "All nodes collapsed",
                          duration: 4000,
                        });
                      }}
                    >
                      <MinusSquare size={14} />
                      <span>Collapse All</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={s.PopoverButton}
                      onClick={async () => {
                        const success = await tree.applySavedExpansionState();
                        if (success) {
                          addToast({
                            title: "Saved expansion state applied",
                            duration: 4000,
                          });
                        } else {
                          addToast({
                            title: "No saved expansion state found",
                            duration: 4000,
                          });
                        }
                      }}
                    >
                      <Download size={14} />
                      <span>Apply Saved State</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
});
