import { getAuthFetch } from "@/app/util";
import rootLogger from "@/lib/logger";

const logger = rootLogger.child({ service: "expansion-state-manager" });

export class ExpansionStateManager {
  /**
   * Saves the current expansion state to the server for all users
   */
  async saveExpansionState(rootObjectId: string, expandedObjectIds: string[]): Promise<boolean> {
    try {
      const authFetch = getAuthFetch();
      const response = await authFetch("/api/expansion-state", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rootObjectId,
          expandedObjects: expandedObjectIds,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("Failed to save expansion state:", errorText);
        return false;
      }

      logger.debug(`Successfully saved expansion state for rootObjectId: ${rootObjectId}`);
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
      const authFetch = getAuthFetch();
      const response = await authFetch(`/api/expansion-state?rootObjectId=${rootObjectId}`);

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("Failed to load expansion state:", errorText);
        return null;
      }

      const result = await response.json();
      if (!result.data) {
        logger.debug(`No expansion state found for rootObjectId: ${rootObjectId}`);
        return null;
      }

      logger.debug(`Loaded expansion state for rootObjectId: ${rootObjectId}`);
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

      logger.debug(`Successfully cleared expansion state for rootObjectId: ${rootObjectId}`);
      return true;
    } catch (error) {
      logger.error("Error clearing expansion state:", error);
      return false;
    }
  }
}
