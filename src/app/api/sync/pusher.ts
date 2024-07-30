import Pusher from "pusher";

import { GraphUpdate } from "@/app/graph/GraphUpdate";
import { SyncData } from "@/app/sync/SyncTask";
import { env } from "@/envBackend";
import { userIdToPusherChannel } from "@/lib/pusher";

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

export const broadcastSyncSuccess = async ({ userId, transactionId, updates }: SyncData) => {
  const channel = userIdToPusherChannel(userId);
  const updateChunks = updatesToSize(updates);
  for (const chunk of updateChunks) {
    let attempts = 0;
    while (attempts < 3) {
      try {
        await pusher.trigger(channel, "transaction-accepted", { userId, transactionId, updates: chunk });
        break;
      } catch (e) {
        attempts++;
        console.warn("Failed to send pusher message", e);
      }
    }
    if (attempts === 3) {
      throw new Error("Failed to send pusher message after 3 attempts");
    }
  }
};
