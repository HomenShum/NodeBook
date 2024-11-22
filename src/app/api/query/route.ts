import { captureException } from "@sentry/nextjs";
import { NextResponse } from "next/server";

import { withAuth } from "@/app/api/authMiddleware";

import { ask } from "./rag";

export const maxDuration = 30;

export const POST = withAuth(async (request) => {
  try {
    // Parse the request body
    const body = await request.json();
    const { query } = body;

    if (!query.trim()) {
      return NextResponse.json({ error: "Query cannot be empty" }, { status: 400 });
    }

    const response = await ask(query, true);
    return NextResponse.json({ response });
  } catch (error) {
    console.error(error);
    captureException(error, { user: { id: request.userId } });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
});
