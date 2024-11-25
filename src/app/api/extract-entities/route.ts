import { captureException } from "@sentry/nextjs";
import { NextResponse } from "next/server";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { extractEntitiesWithOpenAi } from "@/app/api/extract-entities/extractEntitiesWithOpenAi";
import { ExtractEntitiesRequestSchema, ExtractEntitiesResponse } from "@/app/llm/ExtractEntitiesRequest";

export const POST = withAuth(postHandler);
async function postHandler(req: NextAuthenticatedRequest) {
  const parsedRequest = ExtractEntitiesRequestSchema.safeParse(await req.json());

  if (!parsedRequest.success) {
    console.error(parsedRequest.error);
    captureException(parsedRequest.error, { extra: { message: "Invalid sync data request" } });
    return NextResponse.json({ status: "error", message: "Invalid sync data request" }, { status: 400 });
  }

  const { nodeText } = parsedRequest.data;

  const extractedEntities = await extractEntitiesWithOpenAi(nodeText);

  // Declare response like this to get type checking between client and server
  const response: ExtractEntitiesResponse = { extractedEntities };
  return NextResponse.json(response);
}
