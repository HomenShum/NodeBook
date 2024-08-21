"use client";

import { autorun, isObservable, makeAutoObservable } from "mobx";

export enum SearchAndReplaceDropdownOption {
  Always = "always",
  LabelledOnly = "labelled-only",
  SemicolonOnly = "semicolon-only"
}

type SerializedUserSettings = {
  addThoughtstreamDirectChildrenToOutline?: boolean;
  addAllOutlineDescendantsToThoughtstream?: boolean;
  addThoughtstreamNestedChildrenToThoughtstream?: boolean;
  removingNodeAsDirectChildOfThoughtstreamDeletesIt?: boolean;
  showNodeDetails?: boolean;
  hideDirectParent?: boolean;
  hideAllRootParents?: boolean;
  hideAllParents?: boolean;
  hideBackrelations?: boolean;
  hideBundles?: boolean;
  hideZones?: boolean;
  hideThoughtstreamBullets?: boolean;
  hideBulletBackgroundIfParentsOnly?: boolean;
  searchAndReplaceEnabled?: boolean;
  searchAndReplaceDropdown?: SearchAndReplaceDropdownOption;
  disableCycles?: boolean;
  addStreamLabeledRelationsToMyLists?: boolean;
  allowShiftTabAboveViewRoot?: boolean;
  hidePinnedItems?: boolean;
};

export class SettingsStore {
  /** Add outline descendants which are direct children of outline to outline */
  public addThoughtstreamDirectChildrenToOutline = false;
  /** Add thoughtstream descendants which are direct children of thoughtstream to thoughtstream */
  public addAllOutlineDescendantsToThoughtstream = true;
  /** Add thoughtstream descendants which are not direct children of thoughtstream as direct children of thoughtstream */
  public addThoughtstreamNestedChildrenToThoughtstream = false;
  /** When enabled, removing a node as a direct child of a thoughtstream will delete it */
  public removingNodeAsDirectChildOfThoughtstreamDeletesIt = false;

  public showNodeDetails = false;
  public hideDirectParent = true;
  public hideAllRootParents = true;
  public hideAllParents = false;
  public hideBackrelations = false;
  public hideBundles = true;
  public hideZones = false;
  public hideThoughtstreamBullets = true;
  public hideBulletBackgroundIfParentsOnly = true;
  public searchAndReplaceEnabled = true;
  public searchAndReplaceDropdown: SearchAndReplaceDropdownOption = SearchAndReplaceDropdownOption.LabelledOnly;
  public disableCycles = true;
  public addStreamLabeledRelationsToMyLists = true;
  public allowShiftTabAboveViewRoot = false;
  public hidePinnedItems = false;

  private stopAutosave: () => void;

  constructor() {
    this.makeObservable();
    this.loadFromLocalStorage();
    this.stopAutosave = autorun(() => this.saveToLocalStorage());
  }

  makeObservable() {
    if (isObservable(this)) return;
    makeAutoObservable(this);
  }

  resetToDefaults() {
    this.addThoughtstreamDirectChildrenToOutline = false;
    this.addAllOutlineDescendantsToThoughtstream = true;
    this.addThoughtstreamNestedChildrenToThoughtstream = false;
    this.removingNodeAsDirectChildOfThoughtstreamDeletesIt = false;
    this.showNodeDetails = false;
    this.hideDirectParent = true;
    this.hideAllRootParents = true;
    this.hideAllParents = false;
    this.hideBackrelations = false;
    this.hideBundles = true;
    this.hideZones = false;
    this.hideThoughtstreamBullets = true;
    this.hideBulletBackgroundIfParentsOnly = true;
    this.searchAndReplaceEnabled = false;
    this.searchAndReplaceDropdown = SearchAndReplaceDropdownOption.LabelledOnly;
    this.disableCycles = true;
    this.addStreamLabeledRelationsToMyLists = true;
    this.allowShiftTabAboveViewRoot = false;
    this.hidePinnedItems = false;
  }

  saveToLocalStorage() {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem("userSettings", JSON.stringify(this.serialize()));
  }

  loadFromLocalStorage() {
    if (typeof localStorage === "undefined") return;
    const dataString = localStorage.getItem("userSettings");
    if (dataString) {
      try {
        const data = JSON.parse(dataString);
        if (!data || typeof data !== "object") return;
        this.deserialize(data);
      } catch (e) {
        console.warn("Error loading user settings from local storage", e);
      }
    }
  }
  
  serialize(): SerializedUserSettings {
    return {
      addThoughtstreamDirectChildrenToOutline: this.addThoughtstreamDirectChildrenToOutline,
      addAllOutlineDescendantsToThoughtstream: this.addAllOutlineDescendantsToThoughtstream,
      addThoughtstreamNestedChildrenToThoughtstream: this.addThoughtstreamNestedChildrenToThoughtstream,
      removingNodeAsDirectChildOfThoughtstreamDeletesIt: this.removingNodeAsDirectChildOfThoughtstreamDeletesIt,
      showNodeDetails: this.showNodeDetails,
      hideDirectParent: this.hideDirectParent,
      hideAllRootParents: this.hideAllRootParents,
      hideAllParents: this.hideAllParents,
      hideBackrelations: this.hideBackrelations,
      hideBundles: this.hideBundles,
      hideZones: this.hideZones,
      hideThoughtstreamBullets: this.hideThoughtstreamBullets,
      hideBulletBackgroundIfParentsOnly: this.hideBulletBackgroundIfParentsOnly,
      searchAndReplaceEnabled: this.searchAndReplaceEnabled,
      searchAndReplaceDropdown: this.searchAndReplaceDropdown,
      disableCycles: this.disableCycles,
      addStreamLabeledRelationsToMyLists: this.addStreamLabeledRelationsToMyLists,
      allowShiftTabAboveViewRoot: this.allowShiftTabAboveViewRoot,
      hidePinnedItems: this.hidePinnedItems,
    };
  }

  deserialize(data: SerializedUserSettings) {
    this.addThoughtstreamDirectChildrenToOutline =
      data.addThoughtstreamDirectChildrenToOutline ?? this.addThoughtstreamDirectChildrenToOutline;
    this.addAllOutlineDescendantsToThoughtstream =
      data.addAllOutlineDescendantsToThoughtstream ?? this.addAllOutlineDescendantsToThoughtstream;
    this.addThoughtstreamNestedChildrenToThoughtstream =
      data.addThoughtstreamNestedChildrenToThoughtstream ?? this.addThoughtstreamNestedChildrenToThoughtstream;
    this.removingNodeAsDirectChildOfThoughtstreamDeletesIt =
      data.removingNodeAsDirectChildOfThoughtstreamDeletesIt ?? this.removingNodeAsDirectChildOfThoughtstreamDeletesIt;
    this.showNodeDetails = data.showNodeDetails ?? this.showNodeDetails;
    this.hideDirectParent = data.hideDirectParent ?? this.hideDirectParent;
    this.hideAllRootParents = data.hideAllRootParents ?? this.hideAllRootParents;
    this.hideAllParents = data.hideAllParents ?? this.hideAllParents;
    this.hideBackrelations = data.hideBackrelations ?? this.hideBackrelations;
    this.hideBundles = data.hideBundles ?? this.hideBundles;
    this.hideZones = data.hideZones ?? this.hideZones;
    this.hideThoughtstreamBullets = data.hideThoughtstreamBullets ?? this.hideThoughtstreamBullets;
    this.hideBulletBackgroundIfParentsOnly =
      data.hideBulletBackgroundIfParentsOnly ?? this.hideBulletBackgroundIfParentsOnly;
    this.searchAndReplaceEnabled = data.searchAndReplaceEnabled ?? this.searchAndReplaceEnabled;
    this.searchAndReplaceDropdown = data.searchAndReplaceDropdown ?? this.searchAndReplaceDropdown;
    this.disableCycles = data.disableCycles ?? this.disableCycles;
    this.addStreamLabeledRelationsToMyLists =
      data.addStreamLabeledRelationsToMyLists ?? this.addStreamLabeledRelationsToMyLists;
    this.allowShiftTabAboveViewRoot = data.allowShiftTabAboveViewRoot ?? this.allowShiftTabAboveViewRoot;
    this.hidePinnedItems = data.hidePinnedItems ?? this.hidePinnedItems;
  }

  setAddThoughtstreamDirectChildrenToOutline(value: boolean) {
    this.addThoughtstreamDirectChildrenToOutline = value;
  }

  setAddAllOutlineDescendantsToThoughtstream(value: boolean) {
    this.addAllOutlineDescendantsToThoughtstream = value;
  }

  setAddThoughtstreamNestedChildrenToThoughtstream(value: boolean) {
    this.addThoughtstreamNestedChildrenToThoughtstream = value;
  }

  setRemovingNodeAsDirectChildOfThoughtstreamDeletesIt(value: boolean) {
    this.removingNodeAsDirectChildOfThoughtstreamDeletesIt = value;
  }

  setShowNodeDetails(value: boolean) {
    this.showNodeDetails = value;
  }

  setHideDirectParent(value: boolean) {
    this.hideDirectParent = value;
  }

  setHideAllRootParents(value: boolean) {
    this.hideAllRootParents = value;
  }

  setHideAllParents(value: boolean) {
    this.hideAllParents = value;
  }

  setHideBackrelations(value: boolean) {
    this.hideBackrelations = value;
  }

  setHideBundles(value: boolean) {
    this.hideBundles = value;
  }

  setHideZones(value: boolean) {
    this.hideZones = value;
  }

  setHideThoughtstreamBullets(value: boolean) {
    this.hideThoughtstreamBullets = value;
  }

  setHideBulletBackgroundIfParentsOnly(value: boolean) {
    this.hideBulletBackgroundIfParentsOnly = value;
  }

  setSearchAndReplaceEnabled(value: boolean) {
    this.searchAndReplaceEnabled = value;
  }

  setSearchAndReplaceDropdown(value: SearchAndReplaceDropdownOption) {
    this.searchAndReplaceDropdown = value;
  }

  setDisableCycles(value: boolean) {
    this.disableCycles = value;
  }
  setAddStreamLabeledRelationsToMyLists(value: boolean) {
    this.addStreamLabeledRelationsToMyLists = value;
  }

  setAllowShiftTabAboveViewRoot(value: boolean) {
    this.allowShiftTabAboveViewRoot = value;
  }

  setHidePinnedItems(value: boolean) {
    this.hidePinnedItems = value;
  }

  cleanup() {
    this.stopAutosave();
  }
}