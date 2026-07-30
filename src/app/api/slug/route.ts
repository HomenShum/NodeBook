import { NextResponse } from "next/server";
import { z } from "zod";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import {
  getBearerToken,
  getConvexClient,
  listSlugsReference,
  resolveSlugReference,
  setSlugReference,
} from "@/lib/convexServer";

const SetSlugSchema = z.object({
  nodeId: z.string().min(1).max(2048),
  slug: z.string().trim().min(1).max(128).regex(/^[^/]+$/),
});
const DeleteSlugSchema = z.object({ nodeId: z.string().min(1).max(2048) });

export const POST = withAuth(async (request: NextAuthenticatedRequest) => {
  const parsed = SetSlugSchema.safeParse(await request.json());
  if (!parsed.success || parsed.data.slug === "home") {
    return NextResponse.json({ error: "Invalid node or slug." }, { status: 400 });
  }
  try {
    await getConvexClient(getBearerToken(request)).mutation(setSlugReference, parsed.data);
    return NextResponse.json({ message: "Slug updated successfully." });
  } catch (error) {
    console.error("Slug update failed", error);
    return NextResponse.json({ error: "Slug update failed." }, { status: 409 });
  }
});

export const DELETE = withAuth(async (request: NextAuthenticatedRequest) => {
  const parsed = DeleteSlugSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Missing nodeId" }, { status: 400 });
  try {
    await getConvexClient(getBearerToken(request)).mutation(setSlugReference, { ...parsed.data, slug: null });
    return NextResponse.json({ message: "Deleted slug successfully." });
  } catch (error) {
    console.error("Slug delete failed", error);
    return NextResponse.json({ error: "Slug delete failed." }, { status: 502 });
  }
});

export const GET = withAuth(async (request: NextAuthenticatedRequest) => {
  const url = new URL(request.url);
  const nodeId = url.searchParams.get("nodeId");
  const slug = url.searchParams.get("slug");
  try {
    const client = getConvexClient(getBearerToken(request));
    if (slug) {
      const document = await client.query(resolveSlugReference, { slug });
      const node = document ? JSON.parse(document) : null;
      return NextResponse.json({ nodes: node ? [{ id: node.id, slug: node.slug }] : [] });
    }
    const nodes = await client.query(listSlugsReference, {});
    return NextResponse.json({ nodes: nodeId ? nodes.filter((node) => node.id === nodeId) : nodes });
  } catch (error) {
    console.error("Slug read failed", error);
    return NextResponse.json({ error: "Slug read failed." }, { status: 502 });
  }
});
