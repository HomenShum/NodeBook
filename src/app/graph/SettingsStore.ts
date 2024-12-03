"use client";

import { autorun, isObservable, makeAutoObservable } from "mobx";

import {
  PasteLinksOption,
  PasteLinksOptionEnum,
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
  public hideThoughtstreamBullets = true;
  public hideBulletBackgroundIfParentsOnly = true;
  public searchAndReplaceDropdown: SearchAndReplaceDropdownOption =
    SearchAndReplaceDropdownOptionEnum.enum.LabelledOnly;
  public pasteLinksDropdown: PasteLinksOption = PasteLinksOptionEnum.enum.Nothing;
  public disableCycles = true;
  public addStreamLabeledRelationsToMyLists = true;
  public allowShiftTabAboveViewRoot = false;
  public hidePinnedItems = false;
  public publicMode = true;
  public triggerRelationOnSingleColon = false;
  public atHashtagReplacement = false;
  public showIdeapadLinkButton = false;
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
    this.hideThoughtstreamBullets = true;
    this.hideBulletBackgroundIfParentsOnly = true;
    this.searchAndReplaceDropdown = SearchAndReplaceDropdownOptionEnum.enum.LabelledOnly;
    this.pasteLinksDropdown = PasteLinksOptionEnum.enum.Nothing;
    this.disableCycles = true;
    this.addStreamLabeledRelationsToMyLists = true;
    this.allowShiftTabAboveViewRoot = false;
    this.hidePinnedItems = false;
    this.triggerRelationOnSingleColon = false;
    this.atHashtagReplacement = false;
    this.showIdeapadLinkButton = false;
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
      hideThoughtstreamBullets: this.hideThoughtstreamBullets,
      hideBulletBackgroundIfParentsOnly: this.hideBulletBackgroundIfParentsOnly,
      searchAndReplaceDropdown: this.searchAndReplaceDropdown,
      pasteLinksDropdown: this.pasteLinksDropdown,
      disableCycles: this.disableCycles,
      allowShiftTabAboveViewRoot: this.allowShiftTabAboveViewRoot,
      hidePinnedItems: this.hidePinnedItems,
      triggerRelationOnSingleColon: this.triggerRelationOnSingleColon,
      publicMode: this.publicMode,
      atHashtagReplacement: this.atHashtagReplacement,
      showIdeapadLinkButton: this.showIdeapadLinkButton,
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
    this.hideThoughtstreamBullets = data.hideThoughtstreamBullets ?? this.hideThoughtstreamBullets;
    this.hideBulletBackgroundIfParentsOnly =
      data.hideBulletBackgroundIfParentsOnly ?? this.hideBulletBackgroundIfParentsOnly;
    this.searchAndReplaceDropdown = data.searchAndReplaceDropdown ?? this.searchAndReplaceDropdown;
    this.pasteLinksDropdown = data.pasteLinksDropdown ?? this.pasteLinksDropdown;
    this.disableCycles = data.disableCycles ?? this.disableCycles;
    this.allowShiftTabAboveViewRoot = data.allowShiftTabAboveViewRoot ?? this.allowShiftTabAboveViewRoot;
    this.hidePinnedItems = data.hidePinnedItems ?? this.hidePinnedItems;
    this.triggerRelationOnSingleColon = data.triggerRelationOnSingleColon ?? this.triggerRelationOnSingleColon;
    this.publicMode = data.publicMode ?? this.publicMode;
    this.atHashtagReplacement = data.atHashtagReplacement ?? this.atHashtagReplacement;
    this.showIdeapadLinkButton = data.showIdeapadLinkButton ?? this.showIdeapadLinkButton;
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

  setHideThoughtstreamBullets(value: boolean) {
    this.hideThoughtstreamBullets = value;
  }

  setHideBulletBackgroundIfParentsOnly(value: boolean) {
    this.hideBulletBackgroundIfParentsOnly = value;
  }

  setSearchAndReplaceDropdown(value: SearchAndReplaceDropdownOption) {
    this.searchAndReplaceDropdown = value;
  }

  setPasteLinksDropdown(value: PasteLinksOption) {
    this.pasteLinksDropdown = value;
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

  setTriggerRelationOnSingleColon(value: boolean): void {
    this.triggerRelationOnSingleColon = value;
  }

  setAtHashtagReplacement(value: boolean): void {
    this.atHashtagReplacement = value;
  }

  setShowIdeapadLinkButton(value: boolean): void {
    this.showIdeapadLinkButton = value;
  }

  cleanup() {
    this.stopAutosave();
  }
}
