import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { NextRequest, NextResponse } from "next/server";

// Initialize the OpenAI client using the AI SDK provider
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// System prompt template for contextual generation
const SYSTEM_PROMPT = `You are an AI assistant that helps users complete their thoughts and ideas in a note-taking app.
You will be given a tree representation of a user's notes and a specific node marked with <|generate here|>.
Your task is to continue the text at that location, providing helpful, relevant content that fits naturally with the surrounding context.
Be concise, clear, and match the style of the existing content.
Only respond with the generated content that should be inserted at the marked position, without any explanation or additional formatting.`;

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const { treeText, nodeId } = await req.json();

    if (!treeText) {
      return NextResponse.json(
        { error: "Missing required parameters", details: "treeText is required" },
        { status: 400 },
      );
    }

    // Create a user prompt that includes the tree and the marker for generation
    const userPrompt = `Here is a tree representation of my notes:

${treeText}

Please continue the text at the position marked with <|generate_here|>. Match the style and be contextually relevant, but don't match the formatting. That is, return plain text without bullets or indentation.`;

    // Make the API call to OpenAI using streamText
    const result = await streamText({
      model: openai("gpt-4o"), // Use the provider instance
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.7,
      maxTokens: 1000,
    });

    // Create a streaming response using the AI SDK's response type and stream
    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Error in contextual generation API:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
