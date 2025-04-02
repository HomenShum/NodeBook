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

  /**
   * Saves the current expansion state to the server for all users
   */
  async saveExpansionState(rootObjectId: string, expandedPaths: string[]): Promise<boolean> {
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
      this.cache.set(rootObjectId, {
        paths: expandedPaths,
        timestamp: Date.now(),
      });
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
        this.cache.set(rootObjectId, {
          paths: null,
          timestamp: Date.now(),
        });
        return null;
      }

      // Update cache with new data
      this.cache.set(rootObjectId, {
        paths: result.data.expandedObjects,
        timestamp: Date.now(),
      });
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
