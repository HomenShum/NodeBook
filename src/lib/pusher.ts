export const userIdToPusherChannel = (userId: string) => {
  // Replace unsafe characters with -
  // https://pusher.com/docs/channels/using_channels/channels/#channel-naming-conventions
  return userId.replace(/[^a-zA-Z0-9_\-=@,.;]/g, "-");
};
