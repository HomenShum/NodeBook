import { env } from "@/app/envFrontend";
import { SortOption } from "@/app/tree/Tree"; // Adjust the import path as necessary

export class SortOptionLocalStorageCache {
  private static LOCAL_STORAGE_KEY = "treeSortOption";

  load(): SortOption | undefined {
    const cache = env.isFrontend ? localStorage.getItem(SortOptionLocalStorageCache.LOCAL_STORAGE_KEY) : null;
    return cache ? JSON.parse(cache) : undefined;
  }

  save(sortOption: SortOption): void {
    setTimeout(() => {
      if (!env.isFrontend) return;
      localStorage.setItem(SortOptionLocalStorageCache.LOCAL_STORAGE_KEY, JSON.stringify(sortOption));
    }, 0);
  }

  clear(): void {
    if (!env.isFrontend) return;
    localStorage.removeItem(SortOptionLocalStorageCache.LOCAL_STORAGE_KEY);
  }
}
