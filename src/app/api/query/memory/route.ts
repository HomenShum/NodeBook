import { NextResponse } from "next/server";
import { z } from "zod";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { getBearerToken, getConvexClient, updateAgentMemoryReference } from "@/lib/convexServer";

const RequestSchema = z.object({
  memoryId: z.string().min(1).max(500),
  action: z.enum(["pin", "unpin", "forget"]),
});

export const POST = withAuth(async (request: NextAuthenticatedRequest) => {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid memory action" }, { status: 400 });
  try {
    const convex = getConvexClient(getBearerToken(request));
    return NextResponse.json(await convex.mutation(updateAgentMemoryReference, parsed.data));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Memory action failed";
    const status = message.includes("NOT_FOUND") ? 404 : message.includes("LIMIT") ? 409 : 502;
    return NextResponse.json({ error: message.slice(0, 300) }, { status });
  }
});
