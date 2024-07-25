import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useState } from "react";

import { MOCK_MEW_USER, MewUser, UNLOGGED_USER } from "@/app/auth/MewUser";
import { env } from "@/app/envFrontend";
import { PersistedUser } from "@/db/schema";
import logger from "@/lib/logger";

type Auth0Interface = Pick<
  ReturnType<typeof useAuth0>,
  | "error"
  | "isAuthenticated"
  | "isLoading"
  | "getAccessTokenSilently"
  | "getAccessTokenWithPopup"
  | "loginWithRedirect"
  | "loginWithPopup"
  | "logout"
  | "user"
>;

type Auth0User = Exclude<Auth0Interface["user"], undefined>;

type MewAuthInterface = Omit<Auth0Interface, "user"> & {
  user: MewUser;
  authFetch: typeof fetch;
};

const mockAuth0 = {
  error: undefined,
  isAuthenticated: true,
  isLoading: false,
  user: env.useMockUserIfAuthDisabled ? MOCK_MEW_USER : UNLOGGED_USER,
  getAccessTokenSilently: () => Promise.resolve("INVALID_JWT_MOCK_AUTH" as any),
  getAccessTokenWithPopup: () => Promise.resolve("INVALID_JWT"),
  loginWithRedirect: () => Promise.resolve(),
  loginWithPopup: () => Promise.resolve(),
  logout: () => Promise.resolve(),
  authFetch: fetch,
};

const useMockAuth = (): MewAuthInterface => mockAuth0;

export const useAuth: () => MewAuthInterface = !env.isAuthEnabled
  ? useMockAuth
  : () => {
      const auth = useAuth0();
      const [mewUser, setMewUser] = useState<MewUser | undefined>(undefined);

      const authFetch = useCallback(
        async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
          const token = await auth.getAccessTokenSilently();
          return fetch(input, {
            ...init,
            headers: {
              ...init?.headers,
              Authorization: `Bearer ${token}`,
            },
          });
        },
        [auth],
      );

      useEffect(() => {
        const fetchUser = async () => {
          if (!auth.user) return;
          try {
            const mewUserData = await fetchGetOrCreateUser(auth.user, authFetch);
            if (!mewUserData) return undefined;
            setMewUser(new MewUser({ ...mewUserData }));
          } catch (e) {
            logger.error("Error fetching user data", e);
          }
        };
        fetchUser();
      }, [auth.user, authFetch]);

      return {
        ...auth,
        user: mewUser ?? UNLOGGED_USER,
        authFetch: authFetch,
      };
    };

const fetchGetOrCreateUser = async (user: Auth0User, authFetch: typeof fetch): Promise<PersistedUser | undefined> => {
  if (!user.sub) throw new TypeError("This function must be called with a User that has the `sub` property");

  return await authFetch("/api/user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user: {
        id: user.sub,
        email: user.email,
        name: user.name ?? user.nickname ?? "The Nameless One",
        picture: user.picture,
        createdAt: user.updated_at ?? new Date().toISOString(),
      },
    }),
  }).then((res) => res.json());
};
