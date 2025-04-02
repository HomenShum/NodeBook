import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

import { env } from "@/envBackend";

export async function POST(req: NextRequest) {
  try {
    const { text, treeText } = await req.json();

    if (!text || !treeText) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!env.OPENAI_API_KEY) {
      console.error("OpenAI API key is not set");
      return NextResponse.json({ error: "OpenAI API key is not configured" }, { status: 500 });
    }

    const prompt = `
You are a graph operation generator. Your task is to convert natural language text into graph operations.
You have access to the current user's graph structure and available operations.

Available Graph Operations:

1. addNode(tx: TxAddNode)
Example:
{
  type: "addNode",
  transaction: {
    nodeProps: {
      content: [{ type: "text", value: "My new node title" }],
      isPublic: false
    }
  }
}

2. addChildNode(tx: TxAddChildNode)
Example:
{
  type: "addChildNode",
  transaction: {
    parentId: "parent-node-id",
    nodeProps: {
      content: [{ type: "text", value: "Child node content" }]
    }
  }
}

3. updateNode(tx: TxUpdateNode)
Example:
{
  type: "updateNode",
  transaction: {
    nodeId: "node-id-to-update",
    nodeProps: {
      content: [{ type: "text", value: "Updated content" }]
    }
  }
}

4. removeNode(tx: TxRemoveNode)
Example:
{
  type: "removeNode",
  transaction: {
    nodeId: "node-id-to-remove"
  }
}

5. addRelation(tx: TxAddRelation)
Example:
{
  type: "addRelation",
  transaction: {
    fromId: "source-node-id",
    toId: "target-node-id",
    relationTypeId: "relation-type-id"
  }
}

6. updateRelation(tx: TxUpdateRelation)
Example:
{
  type: "updateRelation",
  transaction: {
    relationId: "relation-id",
    relationProps: {
      isPublic: true,
      relationTypeId: "new-relation-type-id"
    }
  }
}

7. removeRelation(tx: TxRemoveRelation)
Example:
{
  type: "removeRelation",
  transaction: {
    relationId: "relation-id-to-remove"
  }
}

8. replaceRelationLink(tx: TxReplaceRelationLink)
Example:
{
  type: "replaceRelationLink",
  transaction: {
    relationId: "relation-id",
    direction: "from",
    replaceWith: {
      type: "existing-object",
      id: "replacement-node-id"
    }
  }
}

9. setIsPublic(tx: TxSetIsPublic)
Example:
{
  type: "setIsPublic",
  transaction: {
    objectId: "node-or-relation-id",
    isPublic: true,
    alsoSetRelatedObjects: false,
    alsoSetChildrenAndDescendants: false,
    isNewRelatedObjectsPublic: false,
    isChecked: true
  }
}

10. pinRelation(tx: TxPinRelation)
Example:
{
  type: "pinRelation",
  transaction: {
    objectId: "node-id",
    relationId: "relation-id-to-pin"
  }
}

Given the text input, generate appropriate graph operations that match the user's intent.
If the generated node has no parent, assume the parent should be the user's root node.

Only generate operations that are clearly intended by the text.
Return a JSON object with two arrays: simpleOperations and complexOperations.
Make sure all node and relation IDs referenced in the operations exist in the current graph structure.
For new nodes or relations, you can use "new-id-xxx" as placeholder IDs.

Current Graph Structure:
${treeText}

Text Input: "${text}"

Response Format:
{
  "simpleOperations": [
    {
      "type": "operationType",
      "transaction": {
        // operation specific fields
      }
    }
  ],
  "complexOperations": [
    // More complex operations that might need review
  ]
}

Today's datetime is ${new Date()}
`;

    const openai = new OpenAI({
      apiKey: String(env.OPENAI_API_KEY),
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
    });

    if (!response.choices[0].message.content) {
      return NextResponse.json({ error: "No response from OpenAI" }, { status: 500 });
    }

    // Clean the response content to handle markdown code blocks
    let content = response.choices[0].message.content.trim();

    try {
      // First try: direct JSON parsing (if it's already valid JSON)
      try {
        const operations = JSON.parse(content);
        return NextResponse.json(operations);
      } catch (e) {
        // If direct parsing fails, continue with cleaning
      }

      // Second try: Handle markdown code blocks
      if (content.includes("```")) {
        // Extract content between code block markers
        const codeBlockMatch = content.match(/```(?:json)?\n([\s\S]*?)```/);
        if (codeBlockMatch && codeBlockMatch[1]) {
          content = codeBlockMatch[1].trim();
        } else {
          // If we have opening code block but can't match properly
          content = content
            .replace(/^```(?:json)?\n?/, "")
            .replace(/```$/, "")
            .trim();
        }
      }

      // Third try: Handle any trailing or leading non-JSON content
      // Find the first '{' and last '}' to extract just the JSON object
      const firstBrace = content.indexOf("{");
      const lastBrace = content.lastIndexOf("}");

      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        content = content.substring(firstBrace, lastBrace + 1);
      }

      const operations = JSON.parse(content);
      return NextResponse.json(operations);
    } catch (parseError) {
      console.error("JSON parsing error:", parseError);
      console.error("Content that failed to parse:", content);

      // Attempt to return a basic response structure if parsing fails
      return NextResponse.json(
        {
          simpleOperations: [],
          complexOperations: [],
          error: "Failed to parse AI response",
          details: parseError instanceof Error ? parseError.message : String(parseError),
        },
        { status: 200 },
      ); // Still return 200 to avoid UI errors
    }
  } catch (error) {
    console.error("Operation generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate operations",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
