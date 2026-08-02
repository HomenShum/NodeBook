import { useAsyncEffect } from "ahooks";
import axios from "axios";
import { useEffect, useState } from "react";

import { NodeBookUser, MOCK_NODEBOOK_USER, UNLOGGED_USER } from "@/app/auth/NodeBookUser";
import { useAuth } from "@/app/auth/useAuth";
import { env } from "@/app/envFrontend";
import { JWT_LOCAL_STORAGE_KEY } from "@/app/graph/constants";
import { fetchGetOrCreateUser, fetchGetUser } from "@/app/persistence/loadGraphData";
import { logger } from "@/app/StoresProvider";
import { envAllowsMockAuth, getAuthFetch, LocalStorageUser } from "@/app/util";

const AUTH_TOKEN_TIMEOUT_MS = 10_000;

async function getAccessTokenWithDeadline(
  getAccessTokenSilently: (options: { timeoutInSeconds: number }) => Promise<string>,
): Promise<string> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error("Auth0 silent refresh exceeded 10 seconds")),
      AUTH_TOKEN_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([
      getAccessTokenSilently({ timeoutInSeconds: AUTH_TOKEN_TIMEOUT_MS / 1_000 }),
      timeout,
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export const getIsValidToken = (token: string | null): boolean => {
  if (!token) return false;
  try {
    const decodedToken = JSON.parse(atob(token.split(".")[1]));
    // Leave five minutes for an Auth0 refresh without rejecting normal one-hour
    // access tokens immediately after a successful login.
    return typeof decodedToken.exp === "number" && decodedToken.exp > Math.floor(Date.now() / 1000) + 300;
  } catch {
    return false;
  }
};

/**
 * Custom hook to setup the user.
 * @returns null while the user is loading or an object of type NodeBookUser.
 * If a user is returned, it won't be changed for the lifetime of the app.
 */
function useSetupUser(): NodeBookUser | null {
  const auth = useAuth();
  // LocalStorageUser.get() hydrates a new NodeBookUser instance on every call.
  // Reading it during every render makes the object identity change, which
  // retriggers both effects below and continuously rebuilds the graph stores.
  const [localStorageUser] = useState<NodeBookUser | null>(() => LocalStorageUser.get());
  const [user, setUser] = useState<NodeBookUser | null>(env.isAuthEnabled ? null : localStorageUser);

  useEffect(() => {
    if (!localStorageUser) return;
    const token = localStorage.getItem(JWT_LOCAL_STORAGE_KEY);
    const isValidToken = getIsValidToken(token);
    // If we have a cached user and a still-valid token, restore both once.
    // Otherwise discard the stale cached profile.
    if (isValidToken) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      setUser(localStorageUser);
    } else {
      axios.defaults.headers.common["Authorization"] = null;
      LocalStorageUser.delete();
      setUser(null);
    }
  }, [localStorageUser]);

  //If a localStorage user is absent, and a user is not already set,
  //try to load the user from Auth0 and server. Then save the user in localStorage.
  useAsyncEffect(async () => {
    if (user) return;

    if (!auth) {
      if (envAllowsMockAuth()) {
        return setUser(MOCK_NODEBOOK_USER);
      }
      return setUser(UNLOGGED_USER);
    }

    if (auth.isLoading) return;

    if (auth.user) {
      try {
        const token = await getAccessTokenWithDeadline((options) => auth.getAccessTokenSilently(options));
        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        localStorage.setItem(JWT_LOCAL_STORAGE_KEY, token);
      } catch (error) {
        logger.error("Auth0 session cannot be refreshed; returning to sign in", error);
        axios.defaults.headers.common["Authorization"] = null;
        localStorage.removeItem(JWT_LOCAL_STORAGE_KEY);
        LocalStorageUser.delete();
        await auth.logout({ logoutParams: { returnTo: window.location.origin } });
        return;
      }
    }

    const authedFetch = getAuthFetch();
    try {
      if (env.env !== "production" && env.hardcodedUserId) {
        const data = await fetchGetUser(authedFetch);
        if (!data) throw new Error("fetchGetUser returned null");
        const user0 = new NodeBookUser({ ...data });
        LocalStorageUser.save(user0);
        return setUser(user0);
      }
      if (auth.user) {
        const data = await fetchGetOrCreateUser(auth.user, authedFetch);
        if (!data) throw new Error("fetchGetOrCreateUser returned null");
        const user0 = new NodeBookUser({ ...data });
        LocalStorageUser.save(user0);
        return setUser(user0);
      }
    } catch (e) {
      logger.error("Failed to get or create user, using unlogged user", e);
    }
    LocalStorageUser.delete();
    setUser(UNLOGGED_USER);
  }, [auth, user, localStorageUser]);

  return user;
}

export default useSetupUser;
