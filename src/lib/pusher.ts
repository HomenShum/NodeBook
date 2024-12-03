const GLOBAL_GRAPH_CHANNEL = "global-graph-updates";

export const getGlobalGraphChannel = (channelPrefix: string) => `${channelPrefix}-${GLOBAL_GRAPH_CHANNEL}`;

export const userIdToPusherChannel = ({ channelPrefix, userId }: { channelPrefix: string; userId: string }) => {
  // Replace unsafe characters with -
  // https://pusher.com/docs/channels/using_channels/channels/#channel-naming-conventions
  const cleanedId = userId.replace(/[^a-zA-Z0-9_\-=@,.;]/g, "-");
  return `${channelPrefix}-${cleanedId}`;
};
