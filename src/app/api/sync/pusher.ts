import Pusher from "pusher";

import { GraphUpdate } from "@/app/graph/GraphUpdate";
import { SyncData } from "@/app/graph/SyncData";
import { env } from "@/envBackend";
import { GLOBAL_GRAPH_CHANNEL, userIdToPusherChannel } from "@/lib/pusher";

const pusher = new Pusher({
  appId: env.PUSHER_APP_ID ?? "",
  key: env.PUSHER_KEY ?? "",
  secret: env.PUSHER_SECRET ?? "",
  cluster: env.PUSHER_CLUSTER ?? "",
  useTLS: true,
});

// Pusher has a 10KB limit on message size, so we need to chunk updates into smaller pieces
// https://pusher.com/docs/channels/library_auth_reference/rest-api/#post-event-trigger-an-event
const MAX_SIZE_PADDING = 250;
const PUSHER_MAX_SIZE = 10240 - MAX_SIZE_PADDING;

const updatesToSize = (updates: GraphUpdate[]): GraphUpdate[][] => {
  const resized: GraphUpdate[][] = [];
  const curSegment: GraphUpdate[] = [];
  while (Buffer.byteLength(JSON.stringify(curSegment)) < PUSHER_MAX_SIZE) {
    const next = updates.shift();
    if (!next) {
      break;
    }
    if (Buffer.byteLength(JSON.stringify([...curSegment, next])) > PUSHER_MAX_SIZE) {
      resized.push(curSegment);
      curSegment.length = 0;
    }
    curSegment.push(next);
  }
  if (curSegment.length > 0) {
    resized.push(curSegment);
  }
  return resized;
};

const updateIsPublic = (update: GraphUpdate): boolean => {
  switch (update.operation) {
    case "addNode":
      return update.node.isPublic;
    case "updateNode":
      return update.oldProps.isPublic || update.newProps.isPublic;
    case "deleteNode":
      return update.node.isPublic;
    case "addRelationType":
      return update.relationType.isPublic;
    case "updateRelationType":
      return update.oldProps.isPublic || update.newProps.isPublic;
    case "deleteRelationType":
      return update.relationType.isPublic;
    case "addRelation":
      return update.relation.isPublic;
    case "updateRelation":
      return update.oldProps.isPublic || update.newProps.isPublic;
    case "deleteRelation":
      return update.deleted.relation.isPublic;
    case "updateRelationList":
      return update.oldIsPublic || update.newIsPublic;
    default:
      update satisfies never;
  }
  return false; // unreachable but needed to satisfy TypeScript
};

const broadcastUpdateChunk = async (channel: string, msgData: SyncData) => {
  let attempts = 0;
  while (attempts < 3) {
    try {
      await pusher.trigger(channel, "transaction-accepted", msgData);
      break;
    } catch (e) {
      attempts++;
      console.warn("Failed to send pusher message", e);
    }
  }
  if (attempts === 3) {
    throw new Error("Failed to send pusher message after 3 attempts");
  }
};

export const broadcastSyncSuccess = async ({ clientId, userId, transactionId, updates }: SyncData) => {
  const userChannel = userIdToPusherChannel(userId);
  const updateChunks = updatesToSize(updates);
  for (const chunk of updateChunks) {
    console.log(`[sync][${userId}] Broadcasting  ${chunk.length} updates through Pusher...`);
    // Broadcast the chunk to the user's channel
    broadcastUpdateChunk(userChannel, { clientId, userId, transactionId, updates: chunk });

    // Broadcast the public updates to the global channel
    const publicUpdates = chunk.filter(updateIsPublic);
    if (publicUpdates.length > 0) {
      broadcastUpdateChunk(GLOBAL_GRAPH_CHANNEL, { clientId, userId, transactionId, updates: publicUpdates });
    }
  }
};
