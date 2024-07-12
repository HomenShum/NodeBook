import { useAuth0 } from "@auth0/auth0-react";
import { useMemo } from "react";

import { MOCK_MEW_USER, MewUser } from "@/app/auth/MewUser";
import { env } from "@/app/envFrontend";

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

const mockAuth0 = {
  error: undefined,
  isAuthenticated: true,
  isLoading: false,
  user: MOCK_MEW_USER,
  getAccessTokenSilently: () => Promise.resolve("INVALID_JWT_MOCK_AUTH" as any),
  getAccessTokenWithPopup: () => Promise.resolve("INVALID_JWT"),
  loginWithRedirect: () => Promise.resolve(),
  loginWithPopup: () => Promise.resolve(),
  logout: () => Promise.resolve(),
};

const useMockAuth = (): Auth0Interface => mockAuth0;

export const useAuth: () => Auth0Interface = !env.isAuthEnabled
  ? useMockAuth
  : () => {
      const auth = useAuth0();
      const user = auth.user;

      const mewUser = useMemo(() => {
        return user?.sub ? MewUser.fromAuth0User(user) : undefined;
      }, [user]);

      return {
        ...auth,
        user: mewUser,
      };
    };
