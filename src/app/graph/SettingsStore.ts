"use client";

import axios from "axios";
import { autorun, isObservable, makeAutoObservable } from "mobx";

import ApiClient from "@/app/api/utils/client/ApiClient";
import { MewUser, MOCK_MEW_USER } from "@/app/auth/MewUser";
import { env } from "@/app/envFrontend";
import { logger } from "@/app/StoresProvider";
import { ViewType } from "@/app/view/types";
import {
  ParseWithAiLinkingOption,
  ParseWithAiLinkingOptionEnum,
  PasteLinksOption,
  PasteLinksOptionEnum,
  SearchAndReplaceDropdownOption,
  SearchAndReplaceDropdownOptionEnum,
  SerializedUserSettings,
} from "@/db/schema";

export enum NewUserHint {
  CtrlClickToExpandInlineRelation = "ctrl-click-to-expand-inline-relation",
}

export class SettingsStore {
  private user: MewUser;
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
  public hidePinnedItems = true;
  public publicMode = true;
  public triggerRelationOnSingleColon = false;
  public atHashtagReplacement = false;
  public showIdeapadLinkButton = false;
  public showExportSubtreeToIdeapad: boolean = false;
  public showGraphRoot = true;
  public parseWithAiLinkingOption: ParseWithAiLinkingOption = ParseWithAiLinkingOptionEnum.enum.LinkNodesInParse;
  public showBulletForEmptyNode: boolean = false;
  public showNotifications: boolean = true;
  public useRoamResearchStyleMention: boolean = true;
  public showOnlyTodos: boolean = false;
  public showOnlyTodosInQuickCapture: boolean = false;
  public todosFilterType: string = "all";
  public todosInQuickCaptureFilterType: string = "all";
  public showHiddenRelations: boolean = false;
  public hideHashtagRelations: boolean = false;
  public sidebarExpandedMyFavorites: boolean = true;
  public sidebarExpandedMyHashtags: boolean = true;
  public sidebarExpandedMyShortlinks: boolean = false;
  public sidebarExpandedLocalHashtags: boolean = false;
  public sidebarExpandedLocalMentions: boolean = false;
  public newUserHints: Set<string> = new Set();
  public viewModePreference: SerializedUserSettings["viewModePreferences"] = {};
  public newUser: boolean = true;
  private stopAutosave: () => void;
  private defaultNewUserHints: Set<NewUserHint> = new Set([NewUserHint.CtrlClickToExpandInlineRelation]);

  constructor(user = MOCK_MEW_USER) {
    this.user = user;
    console.log("User settings building", user);
    this.makeObservable();
    if (user.settings) {
      this.deserialize(user.settings);
    }
    this.stopAutosave = autorun(() => this.syncToServer());
  }

  makeObservable() {
    if (isObservable(this)) return;
    makeAutoObservable(this);
  }

  async persist(newSettings: SerializedUserSettings): Promise<void> {
    if (!env.isPersistenceEnabled || this.user.isAnonymous || !axios.defaults.headers.common["Authorization"]) return;
    try {
      await ApiClient.user.save({
        ...this.user,
        settings: newSettings,
      });
    } catch (e) {
      logger.error("Failed to save user settings", e);
    }
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
    this.hidePinnedItems = true;
    this.triggerRelationOnSingleColon = false;
    this.atHashtagReplacement = false;
    this.showIdeapadLinkButton = false;
    this.showExportSubtreeToIdeapad = false;
    this.parseWithAiLinkingOption = ParseWithAiLinkingOptionEnum.enum.LinkNodesInParse;
    this.showBulletForEmptyNode = false;
    this.showNotifications = true;
    this.useRoamResearchStyleMention = false;
    this.showOnlyTodos = false;
    this.showOnlyTodosInQuickCapture = false;
    this.todosFilterType = "all";
    this.todosInQuickCaptureFilterType = "all";
    this.showHiddenRelations = false;
    this.hideHashtagRelations = false;
    this.sidebarExpandedMyFavorites = true;
    this.sidebarExpandedMyHashtags = true;
    this.sidebarExpandedMyShortlinks = false;
    this.sidebarExpandedLocalHashtags = false;
    this.sidebarExpandedLocalMentions = false;
    this.viewModePreference = {};
    this.newUser = true;
    this.newUserHints = this.defaultNewUserHints;
  }

  private async syncToServer() {
    try {
      await this.persist(this.serialize());
    } catch (e) {
      console.warn("Error saving user settings", e);
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
      showExportSubtreeToIdeapad: this.showExportSubtreeToIdeapad,
      showGraphRoot: this.showGraphRoot,
      parseWithAiLinkingOption: this.parseWithAiLinkingOption,
      showBulletForEmptyNode: this.showBulletForEmptyNode,
      showNotifications: this.showNotifications,
      useRoamResearchStyleMention: this.useRoamResearchStyleMention,
      showOnlyTodos: this.showOnlyTodos,
      showOnlyTodosInQuickCapture: this.showOnlyTodosInQuickCapture,
      todosFilterType: this.todosFilterType,
      todosInQuickCaptureFilterType: this.todosInQuickCaptureFilterType,
      showHiddenRelations: this.showHiddenRelations,
      hideHashtagRelations: this.hideHashtagRelations,
      sidebarExpandedMyFavorites: this.sidebarExpandedMyFavorites,
      sidebarExpandedMyHashtags: this.sidebarExpandedMyHashtags,
      sidebarExpandedMyShortlinks: this.sidebarExpandedMyShortlinks,
      sidebarExpandedLocalHashtags: this.sidebarExpandedLocalHashtags,
      sidebarExpandedLocalMentions: this.sidebarExpandedLocalMentions,
      viewModePreferences: this.viewModePreference,
      newUser: this.newUser,
      newUserHints: Array.from(this.newUserHints) as any,
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
    this.showExportSubtreeToIdeapad = data.showExportSubtreeToIdeapad ?? this.showExportSubtreeToIdeapad;
    this.showGraphRoot = data.showGraphRoot ?? this.showGraphRoot;
    this.parseWithAiLinkingOption = data.parseWithAiLinkingOption ?? this.parseWithAiLinkingOption;
    this.showBulletForEmptyNode = data.showBulletForEmptyNode ?? this.showBulletForEmptyNode;
    this.showNotifications = data.showNotifications ?? this.showNotifications;
    this.useRoamResearchStyleMention = data.useRoamResearchStyleMention ?? this.useRoamResearchStyleMention;
    this.showOnlyTodos = data.showOnlyTodos ?? this.showOnlyTodos;
    this.showOnlyTodosInQuickCapture = data.showOnlyTodosInQuickCapture ?? this.showOnlyTodosInQuickCapture;
    this.todosFilterType = data.todosFilterType ?? this.todosFilterType;
    this.todosInQuickCaptureFilterType = data.todosInQuickCaptureFilterType ?? this.todosInQuickCaptureFilterType;
    this.showHiddenRelations = data.showHiddenRelations ?? this.showHiddenRelations;
    this.hideHashtagRelations = data.hideHashtagRelations ?? this.hideHashtagRelations;
    this.sidebarExpandedMyFavorites = data.sidebarExpandedMyFavorites ?? this.sidebarExpandedMyFavorites;
    this.sidebarExpandedMyHashtags = data.sidebarExpandedMyHashtags ?? this.sidebarExpandedMyHashtags;
    this.sidebarExpandedMyShortlinks = data.sidebarExpandedMyShortlinks ?? this.sidebarExpandedMyShortlinks;
    this.sidebarExpandedLocalHashtags = data.sidebarExpandedLocalHashtags ?? this.sidebarExpandedLocalHashtags;
    this.sidebarExpandedLocalMentions = data.sidebarExpandedLocalMentions ?? this.sidebarExpandedLocalMentions;
    this.viewModePreference = data.viewModePreferences ?? this.viewModePreference;
    this.newUser = data.newUser ?? this.newUser;
    this.newUserHints = data.newUserHints ? new Set(data.newUserHints as unknown as string[]) : this.newUserHints;
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

  setNewUser(value: boolean): void {
    this.newUser = value;
  }

  setShowExportSubtreeToIdeapad(value: boolean): void {
    this.showExportSubtreeToIdeapad = value;
  }

  setParseWithAiLinkingOption(value: ParseWithAiLinkingOption): void {
    this.parseWithAiLinkingOption = value;
  }

  setShowBulletForEmptyNode(value: boolean) {
    this.showBulletForEmptyNode = value;
  }

  setShowNotifications(value: boolean) {
    this.showNotifications = value;
  }

  setUseRoamResearchStyleMention(value: boolean) {
    this.useRoamResearchStyleMention = value;
  }

  setShowOnlyTodos(value: boolean) {
    this.showOnlyTodos = value;
  }

  setShowOnlyTodosInQuickCapture(value: boolean) {
    this.showOnlyTodosInQuickCapture = value;
  }

  setTodosFilterType(value: string) {
    this.todosFilterType = value;
  }

  setTodosInQuickCaptureFilterType(value: string) {
    this.todosInQuickCaptureFilterType = value;
  }

  setHideHashtagRelations(value: boolean) {
    this.hideHashtagRelations = value;
  }

  setShowHiddenRelations(value: boolean) {
    this.showHiddenRelations = value;
  }

  setSidebarExpandedMyFavorites(value: boolean) {
    this.sidebarExpandedMyFavorites = value;
  }

  setSidebarExpandedMyHashtags(value: boolean) {
    this.sidebarExpandedMyHashtags = value;
  }

  setSidebarExpandedMyShortlinks(value: boolean) {
    this.sidebarExpandedMyShortlinks = value;
  }

  setSidebarExpandedLocalHashtags(value: boolean) {
    this.sidebarExpandedLocalHashtags = value;
  }

  setSidebarExpandedLocalMentions(value: boolean) {
    this.sidebarExpandedLocalMentions = value;
  }

  removeNewUserHint(hint: string) {
    this.newUserHints.delete(hint);
  }

  addNewUserHint(hint: string) {
    this.newUserHints.add(hint);
  }

  setShowGraphRoot(value: boolean) {
    this.showGraphRoot = value;
  }

  resetNewUserHints() {
    this.newUserHints = this.defaultNewUserHints;
  }

  getViewMode(nodeId: string): ViewType {
    if (this.viewModePreference && this.viewModePreference[nodeId]) {
      return this.viewModePreference[nodeId];
    }
    return ViewType.Outline;
  }

  setViewMode(nodeId: string, viewType: ViewType) {
    if (!this.viewModePreference) {
      this.viewModePreference = {};
    }
    if (viewType === ViewType.Outline) {
      delete this.viewModePreference[nodeId];
      return;
    }
    this.viewModePreference[nodeId] = viewType;
  }

  cleanup() {
    this.stopAutosave();
  }
}
