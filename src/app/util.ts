"use client";
import { generateKeyBetween } from "fractional-indexing";
import { autorun, toJS } from "mobx";
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { GraphObject } from "@/app/graph/GraphObject";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphStore } from "@/app/graph/GraphStore";
import { getOtherObject } from "@/app/graph/utils";
import logger from "@/lib/logger";

// TODO: what should we actually use for this?
export const uuid = () => uuidv4().slice(0, 8);

const home = "home";

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
export type ObjectPath = { object: GraphObject; relations?: GraphRelation[] };

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

export function createRouteUrl(path?: ObjectPath | GraphRelation[] | string | typeof home): string {
  let pathSuffix = "/home";

  if (path && path !== home && typeof path === "string") {
    pathSuffix = path;
  }

  if (path && path !== home && typeof path !== "string") {
    const objectPath = Array.isArray(path) ? relationsToObjectPath(path) : path;
    if (objectPath) {
      pathSuffix = (objectPath.relations || []).map((r) => "/all/" + r.id).join("");
      pathSuffix += (pathSuffix.length > 0 ? "/" : "/all/") + objectPath.object.id;
    }
  }

  return "/g" + pathSuffix;
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
  if (lastId === home) {
    const objectPath = graphStore.getDefaultRootForUser();
    return { objectPath, stringPath: createRouteUrl(objectPath) };
  } else {
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
