import { z } from "zod";

import { ViewType } from "@/app/view/types";

export const SearchAndReplaceDropdownOptionEnum = z.enum(["Always", "LabelledOnly", "SemicolonOnly"]);
export type SearchAndReplaceDropdownOption = z.infer<typeof SearchAndReplaceDropdownOptionEnum>;

export const PasteLinksOptionEnum = z.enum(["Nothing", "PopulateAsChildren", "PopulateAsOrphanedNodes"]);
export type PasteLinksOption = z.infer<typeof PasteLinksOptionEnum>;

export const ParseWithAiLinkingOptionEnum = z.enum(["None", "LinkNodesInParse", "LinkNodesInGraph"]);
export type ParseWithAiLinkingOption = z.infer<typeof ParseWithAiLinkingOptionEnum>;

export const SerializedUserSettingsSchema = z.object({
  addAllNewNodesAsChildrenOfUserNode: z.boolean().optional(),
  showNodeDetails: z.boolean().optional(),
  hideDirectParent: z.boolean().optional(),
  hideAllRootParents: z.boolean().optional(),
  hideAllParents: z.boolean().optional(),
  hideBackrelations: z.boolean().optional(),
  hideThoughtstreamBullets: z.boolean().optional(),
  hideBulletBackgroundIfParentsOnly: z.boolean().optional(),
  searchAndReplaceEnabled: z.boolean().optional(),
  searchAndReplaceDropdown: SearchAndReplaceDropdownOptionEnum.optional(),
  pasteLinksDropdown: PasteLinksOptionEnum.optional(),
  disableCycles: z.boolean().optional(),
  allowShiftTabAboveViewRoot: z.boolean().optional(),
  hidePinnedItems: z.boolean().optional(),
  publicMode: z.boolean().optional(),
  triggerRelationOnSingleColon: z.boolean().optional(),
  atHashtagReplacement: z.boolean().optional(),
  showIdeapadLinkButton: z.boolean().optional(),
  showExportSubtreeToIdeapad: z.boolean().optional(),
  showGraphViewButton: z.boolean().optional(),
  showGraphRoot: z.boolean().optional(),
  parseWithAiLinkingOption: ParseWithAiLinkingOptionEnum.optional(),
  showBulletForEmptyNode: z.boolean().optional(),
  showNotifications: z.boolean().optional(),
  useRoamResearchStyleMention: z.boolean().optional(),
  showOnlyTodos: z.boolean().optional(),
  showOnlyTodosInQuickCapture: z.boolean().optional(),
  todosFilterType: z.string().optional(),
  todosInQuickCaptureFilterType: z.string().optional(),
  showHiddenObjects: z.boolean().optional(),
  hideHashtagRelations: z.boolean().optional(),
  sidebarExpandedMyFavorites: z.boolean().optional(),
  sidebarExpandedMyHashtags: z.boolean().optional(),
  sidebarExpandedMyShortlinks: z.boolean().optional(),
  sidebarExpandedLocalHashtags: z.boolean().optional(),
  sidebarExpandedLocalMentions: z.boolean().optional(),
  viewModePreferences: z.record(z.nativeEnum(ViewType)).optional(),
  newUser: z.boolean().optional(),
  newUserHints: z.array(z.string()).optional(),
});
export type SerializedUserSettings = z.infer<typeof SerializedUserSettingsSchema>;

export const UserSchema = z.object({
  id: z.string(),
  username: z.string().default(""),
  email: z.string().nullable(),
  name: z.string().nullable(),
  picture: z.string().nullable(),
  createdAt: z.coerce.date().nullable(),
  settings: SerializedUserSettingsSchema,
});
export type PersistedUser = z.infer<typeof UserSchema>;

export type NotificationMessageContent = {
  mentionedById: string;
  nodeId: string;
};
