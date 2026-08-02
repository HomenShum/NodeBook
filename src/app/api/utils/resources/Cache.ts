import axios from "axios";
import { z } from "zod";

import { readCacheSchema, updateCacheSchema } from "@/app/api/cache/canonical/types";
import { hasGuestSession } from "@/app/auth/guestSession";

function canUseCloudCache() {
  if (typeof window === "undefined") return false;
  return !hasGuestSession() && Boolean(axios.defaults.headers.common["Authorization"]);
}

export const CacheResource = {
  canonical: {
    get: async (objectIds: z.infer<typeof readCacheSchema>["objectIds"]) => {
      if (!canUseCloudCache()) return { status: "ok", data: [] };
      const response = await axios.post("/api/cache/canonical", { objectIds });
      return response.data;
    },
    update: async (data: z.infer<typeof updateCacheSchema>) => {
      if (!canUseCloudCache()) return { status: "ok" };
      const response = await axios.put("/api/cache/canonical", data);
      return response.data;
    },
  },
};
