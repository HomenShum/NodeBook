"use client";

import { autorun, isObservable, makeAutoObservable } from "mobx";

import {
  SearchAndReplaceDropdownOption,
  SearchAndReplaceDropdownOptionEnum,
  SerializedUserSettings,
} from "@/db/schema";

export class SettingsStore {
  private saveUserSettings?: (settings: SerializedUserSettings) => Promise<void>;

  public addAllNewNodesAsChildrenOfUserNode = false;
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
  public searchAndReplaceDropdown: SearchAndReplaceDropdownOption =
    SearchAndReplaceDropdownOptionEnum.enum.LabelledOnly;
  public disableCycles = true;
  public addStreamLabeledRelationsToMyLists = true;
  public allowShiftTabAboveViewRoot = false;
  public hidePinnedItems = false;
  public publicMode = true;
  public showAllNodesOption = false;
  public isFlattenSublistsEnabled = false;
  public triggerRelationOnSingleColon = false;
  private stopAutosave: () => void;

  constructor(
    initialSettings?: SerializedUserSettings,
    saveUserSettings?: (settings: SerializedUserSettings) => Promise<void>,
  ) {
    this.saveUserSettings = saveUserSettings;
    this.makeObservable();
    if (initialSettings) {
      this.deserialize(initialSettings);
    }
    this.stopAutosave = autorun(() => this.syncToServer());
  }

  makeObservable() {
    if (isObservable(this)) return;
    makeAutoObservable(this);
  }

  resetToDefaults() {
    this.addAllNewNodesAsChildrenOfUserNode = false;
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
    this.searchAndReplaceDropdown = SearchAndReplaceDropdownOptionEnum.enum.LabelledOnly;
    this.disableCycles = true;
    this.addStreamLabeledRelationsToMyLists = true;
    this.allowShiftTabAboveViewRoot = false;
    this.hidePinnedItems = false;
    this.showAllNodesOption = false;
    this.triggerRelationOnSingleColon = false;
  }

  private async syncToServer() {
    if (this.saveUserSettings) {
      try {
        await this.saveUserSettings(this.serialize());
      } catch (e) {
        console.warn("Error saving user settings", e);
      }
    }
  }

  private serialize(): SerializedUserSettings {
    return {
      addAllNewNodesAsChildrenOfUserNode: this.addAllNewNodesAsChildrenOfUserNode,
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
      allowShiftTabAboveViewRoot: this.allowShiftTabAboveViewRoot,
      hidePinnedItems: this.hidePinnedItems,
      triggerRelationOnSingleColon: this.triggerRelationOnSingleColon,
    };
  }

  private deserialize(data: SerializedUserSettings) {
    this.addAllNewNodesAsChildrenOfUserNode =
      data.addAllNewNodesAsChildrenOfUserNode ?? this.addAllNewNodesAsChildrenOfUserNode;
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
    this.allowShiftTabAboveViewRoot = data.allowShiftTabAboveViewRoot ?? this.allowShiftTabAboveViewRoot;
    this.hidePinnedItems = data.hidePinnedItems ?? this.hidePinnedItems;
    this.triggerRelationOnSingleColon = data.triggerRelationOnSingleColon ?? this.triggerRelationOnSingleColon;
  }

  setAddAllNewNodesAsChildrenOfUserNode(value: boolean) {
    this.addAllNewNodesAsChildrenOfUserNode = value;
  }

  setPublicMode(value: boolean) {
    this.publicMode = value;
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

  setShowAllNodesOption(value: boolean) {
    this.showAllNodesOption = value;
  }

  setIsFlattenSublistsEnabled(value: boolean) {
    this.isFlattenSublistsEnabled = value;
  }

  setTriggerRelationOnSingleColon(value: boolean): void {
    this.triggerRelationOnSingleColon = value;
  }

  cleanup() {
    this.stopAutosave();
  }
}
