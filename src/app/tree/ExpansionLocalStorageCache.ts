import { env } from "@/app/envFrontend";

export class ExpansionLocalStorageCache {
  private static LOCAL_STORAGE_KEY = "expansionsByPath";
  /**
   * Read local storage and creates a map, if there's no expansion data,
   * return an empty map.
   */
  load(): Map<string, boolean> {
    const cache = env.isFrontend ? localStorage.getItem(ExpansionLocalStorageCache.LOCAL_STORAGE_KEY) : null;
    return cache ? new Map(JSON.parse(cache)) : new Map<string, boolean>();
  }

  /**
   * Writes state to local storage.
   */
  update(expansionMap: Map<string, boolean>): void {
    // Use a timeout to defer the writes, we do not want to immediately
    // write and block the thread.
    setTimeout(() => {
      if(!env.isFrontend) return;
      localStorage.setItem(ExpansionLocalStorageCache.LOCAL_STORAGE_KEY, JSON.stringify([...expansionMap]));
    }, 0);
  }

  clear(): void {
    if(!env.isFrontend) return;
    localStorage.removeItem(ExpansionLocalStorageCache.LOCAL_STORAGE_KEY);
  }
}