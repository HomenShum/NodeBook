export class SyncError extends Error {
  actionName?: string;
  data?: Record<string, any>;

  constructor(message: string, { actionName, data }: { actionName?: string; data?: Record<string, any> }) {
    super(message);
    this.name = "SyncError";
    this.actionName = actionName;
    this.data = data;
  }
}

type LogExtras = {
  userId?: string;
};

export const formatSyncErrorForLog = (e: SyncError, { userId }: LogExtras = {}) => {
  let formatted = "[sync]";
  if (userId) {
    formatted += `[${userId}]`;
  }
  if (e.actionName) {
    formatted += `[${e.actionName}]`;
  }
  formatted += " " + e.message;
  return formatted;
};
