"use client";

import { generateKeyBetween } from "fractional-indexing";
import { autorun, toJS } from "mobx";
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { env } from "@/app/envFrontend";
import { JWT_LOCAL_STORAGE_KEY } from "@/app/graph/constants";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphStore } from "@/app/graph/GraphStore";
import { getOtherObject } from "@/app/graph/utils";
import { SerializedGraphStore } from "@/app/persistence/SerializedData";
import { NotificationMessageContent } from "@/db/schema";
import logger from "@/lib/logger";

import { isGraphRelationType } from "./graph/isGraphRelationType";

// TODO: what should we actually use for this?
export const uuid = () => uuidv4().slice(0, 8);

export function comparePositions(a: Position | null, b: Position | null) {
  if (a === null) return -1;
  if (b === null) return 1;
  if (a.int === b.int) {
    return a.frac < b.frac ? -1 : 1;
  } else {
    return a.int > b.int ? -1 : 1;
  }
}

export function compareTimestamps(
  a: Date | null,
  b: Date | null,
  aPosition: Position | null = null,
  bPosition: Position | null = null,
) {
  if (a === null) return -1;
  if (b === null) return 1;
  if (a.getTime() === b.getTime()) {
    // tie breaker
    return comparePositions(aPosition, bPosition);
  } else {
    return a.getTime() > b.getTime() ? -1 : 1;
  }
}

export function generateDefaultPosition(createdAt: Date) {
  return { int: createdAt.getTime(), frac: generateKeyBetween(null, null) };
}

// probably sketch but fun for now
export function makeAutoSaving<T>(store: T, propertiesToSave: { [K in keyof T]?: boolean }) {
  if (typeof localStorage === "undefined") return;
  (Object.keys(propertiesToSave) as Array<keyof T>).forEach((name) => {
    if (propertiesToSave[name]) {
      const storedJson = localStorage.getItem(String(name));
      if (storedJson) {
        store[name] = JSON.parse(storedJson);
      }
      autorun(() => {
        const value = toJS(store[name]);
        localStorage.setItem(String(name), JSON.stringify(value));
      });
    }
  });
}
export type Position = { int: number; frac: string };

export type PathLink = { parent: GraphObject; child: GraphObject; relation: GraphRelation };

/**
 * @throws if the relations aren't connected
 */
export const relationsPathToParentChild = (relations: GraphRelation[]): PathLink[] => {
  if (relations.length === 0) return [];

  const path: PathLink[] = [];
  relations.forEach((relation, i) => {
    if (i === 0) {
      path.push({ relation, parent: relation.from, child: relation.to });
    } else {
      if (relation.from.id === path[i - 1].child.id) {
        path.push({ relation, parent: relation.from, child: relation.to });
      } else if (relation.to.id === path[i - 1].child.id) {
        path.push({ relation, parent: relation.to, child: relation.from });
      } else {
        throw new Error("Path is not continuous");
      }
    }
  });
  return path;
};

/**
 * Specifies an object and optionally a path of relations to reach it
 */
export type ObjectPath = {
  object: GraphObject;
  relations?: GraphRelation[];
  endState?: "cycle" | "max-depth" | "root" | "not-loaded";
};

export const isPathContinuous = (path: ObjectPath): boolean => {
  let current: GraphObject = path.object;
  const relations = path.relations || [];
  for (let i = relations.length - 1; i >= 0; i--) {
    const otherSide = getOtherObject(relations[i], current.id);
    if (!otherSide) return false;
    current = otherSide;
  }
  return true;
};

function relationsToObjectPath(relations: GraphRelation[]): ObjectPath | null {
  if (relations.length === 0) return null;
  let current: GraphObject = relations[0].from;
  for (const relation of relations) {
    const otherSide = getOtherObject(relation, current.id);
    if (!otherSide) return null;
    current = otherSide;
  }
  return { relations, object: current };
}

export function objectPathToObjects(path: ObjectPath): GraphObject[] | null {
  const objects: GraphObject[] = [];
  let current: GraphObject = path.object;
  const relations = path.relations || [];
  for (let i = relations.length - 1; i >= 0; i--) {
    objects.unshift(current);
    const otherSide = getOtherObject(relations[i], current.id);
    if (!otherSide) return null;
    current = otherSide;
  }
  objects.unshift(current);
  return objects;
}

export function createRouteUrl(path?: ObjectPath | GraphRelation[] | string): string {
  const pathPrefix = "/g";
  if (!path) {
    return pathPrefix;
  } else if (typeof path === "string") {
    // If path doesn't start with a slash, add it
    if (!path.startsWith("/")) {
      path = "/" + path;
    }
    return pathPrefix + path;
  } else {
    const objectPath = Array.isArray(path) ? relationsToObjectPath(path) : path;
    if (objectPath) {
      const pathSuffix = (objectPath.relations || []).map((r) => "/all/" + r.id).join("");
      return pathPrefix + pathSuffix + "/" + objectPath.object.id;
    }
  }
  return pathPrefix;
}

/**
 * Copies the object path to the clipboard as a URL.
 */
export async function copyObjectUrlToClipboard(objectPath: ObjectPath) {
  const domain = `${window.location.protocol}//${window.location.host}`;
  const path = createRouteUrl(objectPath);
  return navigator.clipboard.writeText(`${domain}${path}`);
}

export function parsePathArray(
  path: string[],
  graphStore: GraphStore,
): { objectPath: ObjectPath; stringPath: string } | null {
  if (path.length === 0) return null;
  let relations = [];
  // Some object ids include user subs with pipes or colons that would have been url encoded.
  path = path.map((p) => p.replace(/%7C/g, "|").replace(/%3A/g, ":"));
  //If path contains group, ignore them.
  for (let id of path.slice(0, -1).filter((p) => !(p === "all" || p === "pinned" || p === "pointer"))) {
    const graphRel = graphStore.getRelation(id);
    if (!graphRel) {
      logger.debug("Could not find relation", id);
      return null;
    }
    relations.push(graphRel);
  }
  const lastId = path[path.length - 1];
  const object = graphStore.getObject(lastId);
  if (!object) {
    logger.debug("Could not find object", lastId);
    return null;
  }
  const objectPath = { relations, object };
  if (!isPathContinuous(objectPath)) {
    logger.debug("Path is not continuous", objectPath);
    return null;
  }
  return { objectPath, stringPath: createRouteUrl(objectPath) };
}

export function formatDate(date: Date | undefined): string {
  if (!date) {
    return "No date available";
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const givenDate = new Date(date);

  if (givenDate >= today && givenDate < new Date(today.getTime() + 86400000)) {
    return "Today";
  } else {
    return givenDate.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  }
}

export function sortByPrefixMatch(objects: GraphObject[], query: string) {
  const isPrefixMatch: { [key: string]: number } = {};
  for (const o of objects) {
    if (o.text.toLowerCase().startsWith(query.toLowerCase())) {
      isPrefixMatch[o.id] = 0;
    } else {
      isPrefixMatch[o.id] = 1;
    }
  }

  objects.sort((a, b) => isPrefixMatch[a.id] - isPrefixMatch[b.id]);
}

export function toast(message: string) {
  alert(message);
}

export const truncateText = (text: string, maxLength: number) => {
  if (text.length > maxLength) {
    return text.slice(0, maxLength) + "...";
  }
  return text;
};

export const useIsMobile = (breakpoint: number = 480): boolean => {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= breakpoint);
    };

    // Check initially
    checkIsMobile();

    // Add event listener
    window.addEventListener("resize", checkIsMobile);

    // Clean up
    return () => window.removeEventListener("resize", checkIsMobile);
  }, [breakpoint]);

  return isMobile;
};

export const downloadSubtree = (store: GraphStore, object: GraphObject): void => {
  const subtreeData = JSON.stringify(store.serializeSubtree(object));
  const blob = new Blob([subtreeData], { type: "application/json" });

  // Create a temporary URL for the Blob
  const url = URL.createObjectURL(blob);

  // Create a link element and trigger the download
  const link = document.createElement("a");
  link.href = url;
  link.download = "data.json";
  link.click();

  // Clean up the temporary URL
  URL.revokeObjectURL(url);
};

const keyPrefix = "ideapadlink_";
export const ideapadLinkManager = {
  get: (objectId: string): string => {
    return localStorage.getItem(`${keyPrefix}${objectId}`) || "https://v2.ideapad.io/";
  },
  set: (objectId: string, link: string): void => {
    setTimeout(() => {
      localStorage.setItem(`${keyPrefix}${objectId}`, link);
    }, 0);
  },
  has: (objectId: string): boolean => !!localStorage.getItem(`${keyPrefix}${objectId}`),
};

/**
 * Returns a hash code from a string
 * @param  {String} str The string to hash.
 * @return {Number}    A 32bit integer
 * @see http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
 */
function hashCode(str: string, seed = 0) {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

function getProperId(id: string, limit: number = 36, int: boolean = false) {
  if (id.length === 0) {
    return "";
  }
  if (id.length > limit || int) {
    return hashCode(id).toString().slice(0, limit);
  }
  return id;
}

export function ideapadSnapshotFromSerializedGraph(data: SerializedGraphStore, userId: string, graphStore: GraphStore) {
  const snapshot = {
    nodes: Object.values(data.nodesById).map((node) => ({
      clientId: getProperId(node.id, 36),
      userId: userId,
      title: node.content.map((elem) => elem.value).join("") || "",
      likeCount: 0,
      commentCount: 0,
      colorId: null,
      isDeleted: false,
      anonymous: null,
      status: "not-acknowledged",
      attachedBoardClientId: null,
      permissionsExplicitlySet: false,
      createdAt: node.createdAt || new Date().toISOString(),
      updatedAt: node.updatedAt || new Date().toISOString(),
      attributes: {},
    })),
    edges: Object.values(data.relationsById).map((relation) => ({
      id: getProperId(relation.id, 9, true),
      clientId: getProperId(relation.id, 36),
      sourceIdeaClientId: getProperId(relation.fromId, 36),
      targetIdeaClientId: getProperId(relation.toId, 36),
      labelText: graphStore.getRelationType(relation.relationTypeId)?.label || "",
      colorId: null,
      isDeleted: false,
    })),
  };
  // Remove connections with source or client not found in nodes. This can happen when nodes are private.
  const allNodeIds = new Set(snapshot.nodes.map((node) => node.clientId));
  snapshot.edges = snapshot.edges.filter(
    (edge) => allNodeIds.has(edge.sourceIdeaClientId) && allNodeIds.has(edge.targetIdeaClientId),
  );
  return snapshot;
}

/**
 * TODO There's no reason for this to be different from ideapadSnapshotFromSerializedGraph.
 * It was implemented as part of https://github.com/IdeaFlowCo/mew/pull/762 and I made it
 * a separate function to avoid breaking existing functions. I intended to refactor it
 * together with the function above but ran out of time so left them separate.
 */
export function ideapadSnapshotFromGraph(graphStore: GraphStore, userId: string) {
  const nodesToIgnore = new Set<string>();
  const relationsToIgnore = new Set<string>();
  const attributesByNodeId = new Map<string, any>();
  const colorsByNodeId = new Map<string, number>();

  // Get all relation types which are flagged to be ideapad attributes
  const ideapadShowAsAttributeRelationTypeIds = new Set<string>();
  const relationTypeNodes = Array.from(graphStore.nodesById.values()).filter(isGraphRelationType);
  for (const relationTypeNode of relationTypeNodes) {
    for (const relation of relationTypeNode.relations) {
      if (relation.relationType.label === "ideapad_show_as" && relation.to.text === "attribute") {
        ideapadShowAsAttributeRelationTypeIds.add(relationTypeNode.id);
        nodesToIgnore.add(relation.to.id); // Hide the "attribute" node
        break;
      }
    }
  }

  // Ignore all user nodes and connections
  const usersNode = graphStore.usersNode;
  for (const relation of usersNode.relations) {
    if (relation.relationType.label === "sublist") {
      const userNode = relation.to;
      relationsToIgnore.add(relation.id);
      nodesToIgnore.add(userNode.id);
      for (const userRelation of userNode.relations) {
        const otherSide = getOtherObject(userRelation, userNode.id);
        if (otherSide) {
          nodesToIgnore.add(otherSide.id);
          relationsToIgnore.add(userRelation.id);
        }
      }
    }
  }

  for (const relation of graphStore.relationsById.values()) {
    // Relations with a type flagged to be ideapad attributes are ignored from import
    // but included as an attribute on source node
    if (ideapadShowAsAttributeRelationTypeIds.has(relation.relationType.id)) {
      nodesToIgnore.add(relation.to.id);
      relationsToIgnore.add(relation.id);
      attributesByNodeId.set(relation.from.id, {
        ...(attributesByNodeId.get(relation.from.id) || {}),
        [relation.relationType.label]: relation.to.text,
      });
    }
    // Hide nodes flagged to be ignored
    if (relation.relationType.label === "ideapad_show_as" && relation.to.text === "none") {
      nodesToIgnore.add(relation.from.id);
      nodesToIgnore.add(relation.to.id); // Hide the "none" node
      relationsToIgnore.add(relation.id);
    }
    // Note node colors specified by ideapad_color relation
    if (relation.relationType.label === "ideapad_color") {
      try {
        const colorInt = parseInt(relation.to.text);
        colorsByNodeId.set(relation.from.id, colorInt);
        nodesToIgnore.add(relation.to.id); // Hide color value node
        relationsToIgnore.add(relation.id); // Hide ideapad_color relation
      } catch (e) {
        console.error(e);
      }
    }
    // Ignore relation type nodes and relations
    if (relation.relationTypeId === "__type__") {
      relationsToIgnore.add(relation.id);
      nodesToIgnore.add(relation.to.id);
    } else if (relation.relationTypeId === "__reverse__") {
      relationsToIgnore.add(relation.id);
      nodesToIgnore.add(relation.to.id);
    }
    // Ignore __user_relation_types__ node
    if (relation.from.text === "__user_relation_types__") {
      nodesToIgnore.add(relation.from.id);
    }
  }

  const edges: Map<string, any> = new Map();
  for (const relation of graphStore.relationsById.values()) {
    if (relationsToIgnore.has(relation.id)) continue;
    if (nodesToIgnore.has(relation.from.id) || nodesToIgnore.has(relation.to.id)) continue;
    edges.set(relation.id, {
      id: relation.id.split("-")[0],
      clientId: relation.id,
      sourceIdeaClientId: relation.from.id,
      targetIdeaClientId: relation.to.id,
      labelText: relation.relationType.label,
      colorId: null,
      isDeleted: false,
    });
  }

  const nodes = new Map<string, any>();
  for (const node of graphStore.nodesById.values()) {
    if (nodesToIgnore.has(node.id)) {
      continue;
    }
    nodes.set(node.id, {
      clientId: node.id,
      userId: userId,
      title: node.content.map((elem) => elem.value).join("") || "",
      likeCount: 0,
      commentCount: 0,
      colorId: colorsByNodeId.get(node.id) || null,
      isDeleted: false,
      anonymous: null,
      status: "not-acknowledged",
      attachedBoardClientId: null,
      permissionsExplicitlySet: false,
      createdAt: node.createdAt || new Date().toISOString(),
      updatedAt: node.updatedAt || new Date().toISOString(),
      attributes: attributesByNodeId.get(node.id) || {},
    });
  }

  return { nodes, edges };
}

export function getAuthFetch(): typeof fetch {
  const token = localStorage.getItem(JWT_LOCAL_STORAGE_KEY);
  if (token) {
    return async (input, init) => {
      return fetch(input, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
    };
  }
  return fetch;
}

export function exportSubtreeToIdeapad(graphStore: GraphStore, rootNode: GraphObject, userId: string) {
  // if rootNode isn't a GraphNode, throw
  if (!(rootNode instanceof GraphNode)) {
    throw new Error("Root node is not a GraphNode");
  }
  // Get subtree data using existing serializeSubtree method
  const subtreeData = graphStore.serializeSubtree(rootNode);

  // Create snapshot format
  const snapshot = ideapadSnapshotFromSerializedGraph(subtreeData, userId, graphStore);

  // Export as zip
  const nodes = new Map(snapshot.nodes.map((node) => [node.clientId, node]));
  const edges = new Map(snapshot.edges.map((edge) => [edge.clientId, edge]));
  exportToIdeapad({ nodes, edges });
}

/**
 * Exports a graph to Ideapad.
 *
 * Exports the data as a single JSON file containing nodes and edges.
 */
export function exportToIdeapad({ nodes, edges }: { nodes: Map<string, any>; edges: Map<string, any> }) {
  // Convert maps to arrays for JSON serialization
  const data = {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()),
  };

  // Create timestamp suffix in format YYYY-MM-DD_HH-mm-ss
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[:.]/g, "-") // Replace colons and periods with hyphens
    .replace("T", "_") // Replace T with underscore
    .slice(0, 19); // Take only YYYY-MM-DD_HH-mm-ss part

  // Create JSON blob
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });

  // Download file
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ideapad_export_${timestamp}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export type Notification = {
  id: string;
  userId: string;
  messageContent: NotificationMessageContent;
  isRead: boolean;
  createdAt: string;
};

export class NotificationManager {
  private static instance: NotificationManager;
  private API_URL = "/api/notifications";
  //Todo: In future, use lastFetchedAt so we don't end up fetching all notifications
  // just fetch new unloaded notification;
  private lastFetchedAt: string | null = null;

  async fetchNotifications(): Promise<Notification[]> {
    try {
      if (!env.isAuthEnabled) return [];
      const authFetch = getAuthFetch();
      const response = await authFetch(this.API_URL);
      const data = await response.json();
      if (data.status === "success") {
        return data.data;
      } else {
        console.error("Error fetching notifications:", data.message);
        return [];
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
      return [];
    }
  }

  async markAsRead(notificationId: string): Promise<void> {
    const authFetch = getAuthFetch();
    await authFetch(this.API_URL, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId }),
    });
  }

  async markAllAsRead(): Promise<void> {
    const authFetch = getAuthFetch();
    await authFetch(this.API_URL, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
  }

  async create({ nodeId, userId }: { nodeId: string; userId: string }): Promise<void> {
    const authFetch = getAuthFetch();
    await authFetch(this.API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodeId,
        userId,
      }),
    });
  }
}
