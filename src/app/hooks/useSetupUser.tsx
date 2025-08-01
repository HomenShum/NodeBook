import { useAsyncEffect } from "ahooks";
import axios from "axios";
import { useEffect, useState } from "react";

import { MewUser, MOCK_MEW_USER, UNLOGGED_USER } from "@/app/auth/MewUser";
import { useAuth } from "@/app/auth/useAuth";
import { env } from "@/app/envFrontend";
import { JWT_LOCAL_STORAGE_KEY } from "@/app/graph/constants";
import { fetchGetOrCreateUser, fetchGetUser } from "@/app/persistence/loadGraphData";
import { logger } from "@/app/StoresProvider";
import { envAllowsMockAuth, getAuthFetch, LocalStorageUser } from "@/app/util";

const getIsValidToken = (token: string | null): boolean => {
  if (!token) return false;
  const decodedToken = JSON.parse(atob(token.split(".")[1]));
  //Consider tokens expired a day before, so Auth0 can automatically
  //refresh the token.
  return decodedToken.exp > Math.floor(Date.now() / 1000) + 86400;
};

/**
 * Custom hook to setup the user.
 * @returns null while the user is loading or an object of type MewUser.
 * If a user is returned, it won't be changed for the lifetime of the app.
 */
function useSetupUser(): MewUser | null {
  const auth = useAuth();
  const localStorageUser: MewUser | null = LocalStorageUser.get();
  const [user, setUser] = useState<MewUser | null>(localStorageUser);

  useEffect(() => {
    if (!localStorageUser) return;
    const token = localStorage.getItem(JWT_LOCAL_STORAGE_KEY);
    const isValidToken = getIsValidToken(token);
    //Our JWT is valid for 10 days. Sometimes the user might have an expired token.
    //If we have a valid localStorage user, with a valid token, use the token
    //Otherwise, delete the localStorage user.
    if (isValidToken) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
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
        return setUser(MOCK_MEW_USER);
      }
      return setUser(UNLOGGED_USER);
    }

    if (auth.isLoading) return;

    if (auth.user) {
      const token = await auth.getAccessTokenSilently();
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      localStorage.setItem(JWT_LOCAL_STORAGE_KEY, token);
    }

    const authedFetch = getAuthFetch();
    try {
      if (env.env !== "production" && env.hardcodedUserId) {
        const data = await fetchGetUser(authedFetch);
        if (!data) throw new Error("fetchGetUser returned null");
        const user0 = new MewUser({ ...data });
        LocalStorageUser.save(user0);
        return setUser(user0);
      }
      if (auth.user) {
        const data = await fetchGetOrCreateUser(auth.user, authedFetch);
        if (!data) throw new Error("fetchGetOrCreateUser returned null");
        const user0 = new MewUser({ ...data });
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
