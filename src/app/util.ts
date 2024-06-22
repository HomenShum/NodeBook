"use client";
import { generateKeyBetween } from "fractional-indexing";
import { autorun, toJS } from "mobx";
import { usePathname } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

import { GraphObject } from "@/app/graph/GraphObject";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphStore } from "@/app/graph/GraphStore";
import { ViewType } from "@/app/view/ViewType";

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

export const relationsToPathStr = (relations: GraphRelation[]) => {
  return "/" + relations.map((r) => r.id).join("/");
};

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

export function useCurView() {
  const pathname = usePathname();
  const firstElement = pathname.split("/")[1];
  switch (firstElement) {
    case "outline":
      return ViewType.OUTLINE;
    case "stream":
      return ViewType.THOUGHTSTREAM;
    case "split":
      return ViewType.SPLIT;
    default:
      return ViewType.OUTLINE;
  }
}

export function relationsToURLPath(relations: GraphRelation[], graphStore: GraphStore) {
  return `/${relations.map((x) => x.id).join("/")}`;
}

export function pathToNodeSet(path: GraphRelation[]) {
  const nodes = new Set();
  for (const relation of path) {
    nodes.add(relation.from.id);
    nodes.add(relation.to.id);
  }
  return nodes;
}

export function countOccurrencesInPath(object: GraphObject, path: PathLink[]) {
  return path.reduce((acc, { child }) => (child.id === object.id ? acc + 1 : acc), 0);
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
