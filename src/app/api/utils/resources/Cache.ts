import axios from "axios";
import { z } from "zod";

import { readCacheSchema, updateCacheSchema } from "@/app/api/cache/canonical/types";
export const CacheResource = {
  canonical: {
    get: async (objectIds: z.infer<typeof readCacheSchema>["objectIds"]) => {
      const response = await axios.post("/api/cache/canonical", { objectIds });
      return response.data;
    },
    update: async (data: z.infer<typeof updateCacheSchema>) => {
      const response = await axios.put("/api/cache/canonical", data);
      return response.data;
    },
  },
};
