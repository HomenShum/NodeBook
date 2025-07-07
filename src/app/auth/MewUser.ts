import { PersistedUser, SerializedUserSettings } from "@/db/schema";

export class MewUser {
  id: string;
  username: string;
  email: string;
  name: string;
  picture: string;
  createdAt: Date;
  settings: SerializedUserSettings;
  newUser: boolean;

  constructor(u: PersistedUser) {
    this.id = u.id;
    this.email = u.email ?? "unknown";
    this.username = u.username || this.email; // default to email for now
    this.name = u.name ?? "unknown";
    this.picture = u.picture ?? "/profile-default.jpg";
    this.createdAt = u.createdAt ?? new Date("2020-01-01");
    this.settings = u.settings ?? {};
    this.newUser = u.newUser ?? true;
  }

  get isAnonymous() {
    return this.id === UNLOGGED_USER_ID;
  }
}

const UNLOGGED_USER_ID = "SPECIAL::mew|unlogged";
export const UNLOGGED_USER = new MewUser({
  id: UNLOGGED_USER_ID,
  username: "unlogged.user",
  email: "unlogged.user@ideaflow.io",
  name: "Unlogged User",
  picture: "/profile-default.jpg",
  createdAt: new Date("2024-07-16T17:14:31.223Z"),
  settings: {},
  newUser: false,
} as PersistedUser);

const MOCK_MEW_USER_ID = "SPECIAL::mew|0123456789";
export const MOCK_MEW_USER = new MewUser({
  id: MOCK_MEW_USER_ID,
  username: "mock.user",
  email: "mock.user@ideaflow.io",
  name: "Tyler Durden",
  picture: "/profile-default.jpg",
  createdAt: new Date("2024-07-16T17:14:31.223Z"),
  settings: {},
  newUser: false,
} as PersistedUser);
