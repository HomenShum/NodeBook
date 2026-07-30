import fs from "fs";

import { Command } from "commander";
import fetch, { Response } from "node-fetch";

const program = new Command();

const description = `
Upload NodeBook ideapad export to Ideapad via api.

How to use:
1. Export your data from NodeBook using 'Export to Ideapad'
2. Open ideapad.io and create a new board
3. Open the network tab in the dev tools
4. Create a new idea and copy the boardId and bearer token from the request headers
5. Run this script  

Note:
- Attributes don't get created for some reason
- Although this gets around the import-from-json size limit, ideapad can still crash if you add too many ideas or connections to a board
`;

program
  .description(description.trim())
  .requiredOption("-t, --token <token>", "Bearer token for authentication")
  .requiredOption("-b, --board <boardId>", "Board client ID")
  .requiredOption("-f, --file <path>", "Path to the JSON file")
  .option("-a, --assign-new-ids", "Assign new clientIds to all ideas and store the mapping")
  .option("-s, --batch-size <size>", "Batch size for ideas and edges", parseInt, 2000)
  .parse();

async function main({
  filePath,
  boardClientId,
  bearerToken,
  assignNewIds,
  batchSize,
}: {
  filePath: string;
  boardClientId: string;
  bearerToken: string;
  assignNewIds: boolean;
  batchSize: number;
}) {
  try {
    const rawData = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(rawData);
    const idMap = new Map<string, string>();

    if (assignNewIds) {
      // Assign new clientIds to all ideas and store the mapping
      data.nodes = data.nodes.map((node: any) => {
        const newClientId = crypto.randomUUID();
        idMap.set(node.clientId, newClientId);
        return {
          ...node,
          clientId: newClientId,
        };
      });
      data.edges = data.edges.map((edge: any) => {
        const newClientId = crypto.randomUUID();
        return {
          ...edge,
          id: null,
          clientId: newClientId,
          sourceIdeaClientId: idMap.get(edge.sourceIdeaClientId) || edge.sourceIdeaClientId,
          targetIdeaClientId: idMap.get(edge.targetIdeaClientId) || edge.targetIdeaClientId,
        };
      });
    }

    // Process ideas in batches of 1000
    const totalIdeasBatches = Math.ceil(data.nodes.length / batchSize);
    for (let i = 0; i < data.nodes.length; i += batchSize) {
      console.log(`Processing ideas batch ${i / batchSize + 1}/${totalIdeasBatches}`);
      const ideasBatch = data.nodes.slice(i, i + batchSize).map((node: any) => ({
        clientId: node.clientId,
        userId: node.userId,
        title: node.title,
        likeCount: node.likeCount,
        commentCount: node.commentCount,
        colorId: node.colorId,
        isDeleted: node.isDeleted,
        anonymous: node.anonymous,
        status: node.status,
        attachedBoardClientId: node.attachedBoardClientId,
        permissionsExplicitlySet: node.permissionsExplicitlySet,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        attributes: node.attributes || {},
      }));

      const ideasPayload = {
        boardClientId,
        ideas: ideasBatch,
        connections: [],
      };

      const ideasResponse = await fetch("https://ideapad.io/api/v1/boards/createIdeasAndConnections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearerToken}`,
        },
        body: JSON.stringify(ideasPayload),
      });

      if (!ideasResponse.ok) {
        throw ideasResponse;
      }
    }

    // Process edges in batches of 1000
    const totalEdgesBatches = Math.ceil(data.edges.length / batchSize);
    for (let i = 0; i < data.edges.length; i += batchSize) {
      console.log(`Processing edges batch ${i / batchSize + 1}/${totalEdgesBatches}`);
      const edgesBatch = data.edges.slice(i, i + batchSize).map((edge: any) => ({
        id: null,
        clientId: edge.clientId,
        sourceIdeaClientId: edge.sourceIdeaClientId,
        targetIdeaClientId: edge.targetIdeaClientId,
        labelText: edge.labelText,
        colorId: edge.colorId,
        isDeleted: edge.isDeleted,
      }));

      const edgesPayload = {
        boardClientId,
        ideas: [],
        connections: edgesBatch,
      };

      const edgesResponse = await fetch("https://ideapad.io/api/v1/boards/createIdeasAndConnections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearerToken}`,
        },
        body: JSON.stringify(edgesPayload),
      });

      if (!edgesResponse.ok) {
        throw edgesResponse;
      }
    }

    console.log("Success - All batches processed");
  } catch (e) {
    if (e instanceof Response) {
      console.error(`HTTP error: ${e.status} - ${e.statusText}`);
      try {
        const body = await e.json();
        console.log("Body:", body);
      } catch (e) {}
    } else {
      console.error("Error:", e);
    }
  }
}

if (require.main === module) {
  main(program.opts());
}
