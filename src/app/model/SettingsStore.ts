"use client";
import { makeAutoObservable } from "mobx";

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
  showAtSignOnMention?: boolean;
  hideThoughtstreamBullets?: boolean;
  hideBulletBackgroundIfParentsOnly?: boolean;
  searchAndReplaceDropdown?: "labelled-only" | "all" | "none";
  disableCycles?: boolean;
  atSignTriggerToReplaceObject?: boolean;
  addStreamLabeledRelationsToMyLists?: boolean;
  allowShiftTabAboveViewRoot?: boolean;
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
  public showAtSignOnMention = true;
  public hideThoughtstreamBullets = true;
  public hideBulletBackgroundIfParentsOnly = true;
  public searchAndReplaceDropdown: "labelled-only" | "all" | "none" = "labelled-only";
  public disableCycles = true;
  public atSignTriggerToReplaceObject = false;
  public addStreamLabeledRelationsToMyLists = true;
  public allowShiftTabAboveViewRoot = false;

  constructor() {
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
    this.showAtSignOnMention = true;
    this.hideThoughtstreamBullets = true;
    this.hideBulletBackgroundIfParentsOnly = true;
    this.searchAndReplaceDropdown = "labelled-only";
    this.disableCycles = true;
    this.atSignTriggerToReplaceObject = false;
    this.addStreamLabeledRelationsToMyLists = true;
    this.allowShiftTabAboveViewRoot = false;
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
      showAtSignOnMention: this.showAtSignOnMention,
      hideThoughtstreamBullets: this.hideThoughtstreamBullets,
      hideBulletBackgroundIfParentsOnly: this.hideBulletBackgroundIfParentsOnly,
      searchAndReplaceDropdown: this.searchAndReplaceDropdown,
      disableCycles: this.disableCycles,
      atSignTriggerToReplaceObject: this.atSignTriggerToReplaceObject,
      addStreamLabeledRelationsToMyLists: this.addStreamLabeledRelationsToMyLists,
      allowShiftTabAboveViewRoot: this.allowShiftTabAboveViewRoot,
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
    this.showAtSignOnMention = data.showAtSignOnMention ?? this.showAtSignOnMention;
    this.hideThoughtstreamBullets = data.hideThoughtstreamBullets ?? this.hideThoughtstreamBullets;
    this.hideBulletBackgroundIfParentsOnly =
      data.hideBulletBackgroundIfParentsOnly ?? this.hideBulletBackgroundIfParentsOnly;
    this.searchAndReplaceDropdown = data.searchAndReplaceDropdown ?? this.searchAndReplaceDropdown;
    this.disableCycles = data.disableCycles ?? this.disableCycles;
    this.atSignTriggerToReplaceObject = data.atSignTriggerToReplaceObject ?? this.atSignTriggerToReplaceObject;
    this.addStreamLabeledRelationsToMyLists =
      data.addStreamLabeledRelationsToMyLists ?? this.addStreamLabeledRelationsToMyLists;
    this.allowShiftTabAboveViewRoot = data.allowShiftTabAboveViewRoot ?? this.allowShiftTabAboveViewRoot;
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

  setShowAtSignOnMention(value: boolean) {
    this.showAtSignOnMention = value;
  }

  setHideThoughtstreamBullets(value: boolean) {
    this.hideThoughtstreamBullets = value;
  }

  setHideBulletBackgroundIfParentsOnly(value: boolean) {
    this.hideBulletBackgroundIfParentsOnly = value;
  }

  setSearchAndReplaceDropdown(value: "labelled-only" | "all" | "none") {
    this.searchAndReplaceDropdown = value;
  }

  setDisableCycles(value: boolean) {
    this.disableCycles = value;
  }

  setAtSignTriggerToReplaceObject(value: boolean) {
    this.atSignTriggerToReplaceObject = value;
  }

  setAddStreamLabeledRelationsToMyLists(value: boolean) {
    this.addStreamLabeledRelationsToMyLists = value;
  }

  setAllowShiftTabAboveViewRoot(value: boolean) {
    this.allowShiftTabAboveViewRoot = value;
  }
}
