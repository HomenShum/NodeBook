import { PersistedUser, SerializedUserSettings } from "@/app/domain/schema";

export class NodeBookUser {
  id: string;
  username: string;
  email: string;
  name: string;
  picture: string;
  createdAt: Date;
  settings: SerializedUserSettings;

  constructor(u: PersistedUser) {
    this.id = u.id;
    this.email = u.email ?? "unknown";
    this.username = u.username || this.email; // default to email for now
    this.name = u.name ?? "unknown";
    this.picture = u.picture ?? "/profile-default.jpg";
    this.createdAt = u.createdAt ?? new Date("2020-01-01");
    this.settings = u.settings ?? {};
  }

  get isAnonymous() {
    return this.id === UNLOGGED_USER_ID;
  }
}

const UNLOGGED_USER_ID = "SPECIAL::nodebook|unlogged";
export const UNLOGGED_USER = new NodeBookUser({
  id: UNLOGGED_USER_ID,
  username: "unlogged.user",
  email: "unlogged.user@nodebook.io",
  name: "Unlogged User",
  picture: "/profile-default.jpg",
  createdAt: new Date("2024-07-16T17:14:31.223Z"),
  settings: {},
} as PersistedUser);

const MOCK_NODEBOOK_USER_ID = "SPECIAL::nodebook|0123456789";
export const MOCK_NODEBOOK_USER = new NodeBookUser({
  id: MOCK_NODEBOOK_USER_ID,
  username: "mock.user",
  email: "mock.user@nodebook.io",
  name: "Tyler Durden",
  picture: "/profile-default.jpg",
  createdAt: new Date("2024-07-16T17:14:31.223Z"),
  settings: {},
} as PersistedUser);
