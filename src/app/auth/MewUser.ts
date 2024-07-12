import { User as Auth0User } from "@auth0/auth0-react";

type Auth0UserWithId = Exclude<Auth0User, "sub"> & { sub: string };

export class MewUser {
  id: string;
  auth0Id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  name: string;
  picture: string;
  locale: string;
  updatedAt: Date;
  email: string;
  emailVerified: boolean;

  constructor(u: Auth0UserWithId) {
    this.id = u.sub;
    this.auth0Id = u.sub;
    this.firstName = u.given_name ?? "unknown";
    this.lastName = u.family_name ?? "unknown";
    this.nickname = u.nickname ?? "unknown";
    this.name = u.name ?? "unknown";
    this.picture = u.picture ?? "/profile-default.jpg";
    this.locale = u.locale ?? "en";
    this.updatedAt = new Date(u.updated_at ?? Date.now());
    this.email = u.email ?? "unknown";
    this.emailVerified = u.email_verified ?? false;
  }

  static fromAuth0User(auth0User: Auth0User): MewUser {
    if (!auth0User.sub) {
      throw new TypeError("User must have a `sub` property");
    }

    return new MewUser(auth0User as Auth0UserWithId);
  }
}

export const MOCK_MEW_USER = MewUser.fromAuth0User({
  sub: "mew|0123456789",
  given_name: "Tyler",
  family_name: "Durden",
  nickname: "tyler",
  name: "Tyler Durden",
  picture: "/profile-default.jpg",
  locale: "en",
  updatedAt: "2020-03-24T17:49:22.464Z",
  email: "mock.user@ideaflow.io",
  email_verified: true,
});
