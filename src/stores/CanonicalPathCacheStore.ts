import { action, makeObservable, observable } from "mobx";

import ApiClient from "@/app/api/utils/client/ApiClient";

type Ancestor = { id: string; label: string };

class CanonicalPathCacheStore {
  private loadedOrLoadingIds: Set<string> = new Set();
  private missIds: Set<string> = new Set<string>();
  cache = new Map<string, Ancestor[]>();

  constructor() {
    makeObservable(this, {
      cache: observable,
      load: action,
      remove: action,
      update: action,
      clear: action,
    });
  }

  async load(objectIds: string[]) {
    const newIds = objectIds.filter((id) => !this.loadedOrLoadingIds.has(id));
    if (newIds.length === 0) return;
    const notLoadedIds = new Set(newIds);
    newIds.forEach((id) => this.loadedOrLoadingIds.add(id));
    const response = await ApiClient.cache.canonical.get(newIds);
    for (const row of response.data) {
      this.cache.set(row.objectId, row.ancestors);
      this.loadedOrLoadingIds.add(row.objectId);
      this.missIds.delete(row.objectId);
      notLoadedIds.delete(row.objectId);
    }
    notLoadedIds.forEach((id) => {
      this.loadedOrLoadingIds.delete(id);
      this.missIds.add(id);
    });
  }

  async update(objectId: string, ancestors: Ancestor[]) {
    try {
      this.cache.set(objectId, ancestors);
      this.loadedOrLoadingIds.add(objectId);
      this.missIds.delete(objectId);
      await ApiClient.cache.canonical.update({
        [objectId]: ancestors,
      });
    } catch (e) {
      return false;
    }
    return true;
  }

  remove(objectId: string) {
    this.cache.delete(objectId);
    this.loadedOrLoadingIds.delete(objectId);
  }

  isMissing(objectId: string) {
    return this.missIds.has(objectId);
  }

  clear() {
    this.cache.clear();
    this.loadedOrLoadingIds.clear();
  }
}

const canonicalPathCacheStore = new CanonicalPathCacheStore();

export default canonicalPathCacheStore;
