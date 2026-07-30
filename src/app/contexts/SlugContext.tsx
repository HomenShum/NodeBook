import React, { createContext, useCallback, useContext, useState } from "react";

import { env } from "@/app/envFrontend";
import logger from "@/lib/logger";

type SlugMap = Record<string, string>;

type SlugContextType = {
  slugs: SlugMap;
  fetchAllSlugs: () => Promise<void>;
  updateSlugByNodeId: (nodeId: string, slug: string) => Promise<boolean>;
  deleteSlugByNodeId: (nodeId: string) => Promise<void>;
};

type SlugApiResponse = {
  nodes: {
    slug: string;
    id: string;
  }[];
};

const SlugContext = createContext<SlugContextType | undefined>(undefined);

export const SlugProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [slugs, setSlugs] = useState<SlugMap>({});

  const fetchAllSlugs = useCallback(async () => {
    if (!env.isPersistenceEnabled) {
      setSlugs({});
      return;
    }
    try {
      const response = await fetch("/api/slug");
      if (!response.ok) throw new Error(`Slug request failed with HTTP ${response.status}`);
      const data: SlugApiResponse = await response.json();
      const newSlugMap: SlugMap = {};
      data.nodes.forEach((node) => {
        newSlugMap[node.id] = node.slug;
      });
      setSlugs(newSlugMap);
    } catch (error) {
      console.error("Failed to fetch slugs:", error);
    }
  }, []);

  const updateSlugByNodeId = async (nodeId: string, slug: string): Promise<boolean> => {
    if (!env.isPersistenceEnabled) {
      setSlugs((previous) => ({ ...previous, [nodeId]: slug }));
      return true;
    }
    try {
      const response = await fetch(`/api/slug`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, nodeId }),
      });

      if (!response.ok) {
        logger.error("Failed to set slug on server.");
        return false;
      }

      setSlugs((prev) => {
        const updatedSlugs = { ...prev };
        updatedSlugs[nodeId] = slug;
        return updatedSlugs;
      });
    } catch (error) {
      console.error("Failed to update slug:", error);
      return false;
    }
    return true;
  };

  const deleteSlugByNodeId = async (nodeId: string): Promise<void> => {
    if (!env.isPersistenceEnabled) {
      setSlugs((previous) => {
        const updated = { ...previous };
        delete updated[nodeId];
        return updated;
      });
      return;
    }
    try {
      const response = await fetch(`/api/slug`, { method: "DELETE", body: JSON.stringify({ nodeId }) });

      if (!response.ok) {
        logger.error("Failed to delete slug");
        return;
      }

      setSlugs((prev) => {
        const updatedSlugs = { ...prev };
        delete updatedSlugs[nodeId];
        return updatedSlugs;
      });
    } catch (error) {
      console.error("Failed to delete slug:", error);
    }
  };

  return (
    <SlugContext.Provider value={{ slugs, fetchAllSlugs, updateSlugByNodeId, deleteSlugByNodeId }}>
      {children}
    </SlugContext.Provider>
  );
};

export const useSlugs = () => {
  const context = useContext(SlugContext);
  if (!context) {
    throw new Error("useSlugs must be used within a SlugProvider");
  }
  return context;
};
