import { getAuthFetch } from "@/app/util";
import rootLogger from "@/lib/logger";

const logger = rootLogger.child({ service: "expansion-state-manager" });

type CachedExpansionState = {
  paths: string[] | null;
  timestamp: number;
};

export class ExpansionStateManager {
  private cache: Map<string, CachedExpansionState> = new Map();
  private readonly CACHE_TTL_MS = 10000; // 10 seconds
  private readonly MAX_CACHE_ENTRIES = 100;

  constructor(private readonly persistenceEnabled = true) {}

  private setCached(rootObjectId: string, paths: string[] | null) {
    if (!this.cache.has(rootObjectId) && this.cache.size >= this.MAX_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) this.cache.delete(oldestKey);
    }
    this.cache.set(rootObjectId, { paths, timestamp: Date.now() });
  }

  /**
   * Saves the current expansion state to the server for all users
   */
  async saveExpansionState(rootObjectId: string, expandedPaths: string[]): Promise<boolean> {
    if (!this.persistenceEnabled) {
      this.setCached(rootObjectId, expandedPaths);
      return true;
    }
    try {
      const authFetch = getAuthFetch();
      const response = await authFetch("/api/expansion-state", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rootObjectId,
          expandedObjects: expandedPaths,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("Failed to save expansion state:", errorText);
        return false;
      }

      // Update cache after successful save
      this.setCached(rootObjectId, expandedPaths);
      return true;
    } catch (error) {
      logger.error("Error saving expansion state:", error);
      return false;
    }
  }

  /**
   * Loads expansion state from the server
   */
  async loadExpansionState(rootObjectId: string): Promise<string[] | null> {
    if (!this.persistenceEnabled) return this.cache.get(rootObjectId)?.paths ?? null;
    try {
      // Check cache first
      const cached = this.cache.get(rootObjectId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        return cached.paths;
      }

      const authFetch = getAuthFetch();
      const response = await authFetch(`/api/expansion-state?rootObjectId=${rootObjectId}`);

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("Failed to load expansion state:", errorText);
        return null;
      }

      const result = await response.json();
      if (!result.data) {
        // Cache the null result too
        this.setCached(rootObjectId, null);
        return null;
      }

      // Update cache with new data
      this.setCached(rootObjectId, result.data.expandedObjects);
      return result.data.expandedObjects;
    } catch (error) {
      logger.error("Error loading expansion state:", error);
      return null;
    }
  }

  /**
   * Clears the expansion state for a given root object
   */
  async clearExpansionState(rootObjectId: string): Promise<boolean> {
    if (!this.persistenceEnabled) {
      this.cache.delete(rootObjectId);
      return true;
    }
    try {
      const authFetch = getAuthFetch();
      const response = await authFetch(`/api/expansion-state?rootObjectId=${rootObjectId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("Failed to clear expansion state:", errorText);
        return false;
      }

      // Clear from cache after successful delete
      this.cache.delete(rootObjectId);

      return true;
    } catch (error) {
      logger.error("Error clearing expansion state:", error);
      return false;
    }
  }
}
