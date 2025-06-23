import { z } from "zod";

export const updateCacheSchema = z.record(z.string(), z.array(z.object({ id: z.string(), label: z.string() })));
export const readCacheSchema = z.object({
  objectIds: z.array(z.string()),
});
