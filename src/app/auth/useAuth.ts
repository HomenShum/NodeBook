import { Auth0ContextInterface, useAuth0 } from "@auth0/auth0-react";

import { env } from "@/app/envFrontend";

export type Auth = Auth0ContextInterface | undefined;

/**
 * Returns the Auth0 context if auth is enabled, otherwise returns undefined.
 */
export const useAuth: () => Auth = !env.isAuthEnabled
  ? () => {
      return undefined;
    }
  : () => {
      return useAuth0();
    };
