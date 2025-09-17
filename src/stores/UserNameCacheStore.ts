import { action, makeObservable, observable } from "mobx";

import { GetUsersResponse } from "@/app/api/types";

class UserNameCacheStore {
  private loadedOrLoadingIds: Set<string> = new Set();
  private missIds: Set<string> = new Set<string>();
  cache = new Map<string, string>();

  constructor() {
    makeObservable(this, {
      cache: observable,
      load: action,
      clear: action,
    });
  }

  async load(userIds: string[]) {
    const newIds = userIds.filter((id) => !this.loadedOrLoadingIds.has(id));
    if (newIds.length === 0) return;
    
    const notLoadedIds = new Set(newIds);
    newIds.forEach((id) => this.loadedOrLoadingIds.add(id));
    
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userIds: newIds }),
      });
      
      const data: GetUsersResponse = await response.json();
      
      if (!data.error) {
        for (const user of data.data) {
          // Use username if available, otherwise use email, otherwise use ID
          const displayName = user.username || user.email || user.id;
          this.cache.set(user.id, displayName);
          this.loadedOrLoadingIds.add(user.id);
          this.missIds.delete(user.id);
          notLoadedIds.delete(user.id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch user names:", error);
    }
    
    // Mark remaining IDs as missing
    notLoadedIds.forEach((id) => {
      this.loadedOrLoadingIds.delete(id);
      this.missIds.add(id);
    });
  }

  getUserName(userId: string): string | null {
    return this.cache.get(userId) || null;
  }

  isMissing(userId: string) {
    return this.missIds.has(userId);
  }

  clear() {
    this.cache.clear();
    this.loadedOrLoadingIds.clear();
    this.missIds.clear();
  }
}

const userNameCacheStore = new UserNameCacheStore();

export default userNameCacheStore;
