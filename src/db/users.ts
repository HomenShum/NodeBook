import { eq } from "drizzle-orm";

import { PersistedUser, userTable } from "@/db/schema";
import { MewDatabase, MewDbTransaction } from "@/db/types";

export const getOrCreateUser = async (db: MewDatabase, user: PersistedUser) => {
  const result = await db.select().from(userTable).where(eq(userTable.id, user.id));
  if (result.length === 1) {
    return result[0];
  } else if (result.length === 0) {
    return await db.transaction(async (tx) => createUser(tx, user));
  } else {
    throw new Error("Multiple users with the same ID");
  }
};

export const getUser = async (db: MewDatabase, userId: string) => {
  const result = await db.select().from(userTable).where(eq(userTable.id, userId));
  return result.length === 1 ? result[0] : null;
};

const createUser = async (tx: MewDbTransaction, user: PersistedUser) => {
  const result = await tx
    .insert(userTable)
    .values({
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      picture: user.picture,
      createdAt: user.createdAt,
      settings: "{}", // Settings are ignored here as they are updated in a separate request
    })
    .onConflictDoNothing()
    .returning();
  return result[0];
};

export const updateUserSettings = async (db: MewDatabase, user: PersistedUser) => {
  await db
    .update(userTable)
    .set({ settings: JSON.stringify(user.settings) })
    .where(eq(userTable.id, user.id));
};
