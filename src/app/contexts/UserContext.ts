import { createContext, useContext } from "react";

import { NodeBookUser, UNLOGGED_USER } from "@/app/auth/NodeBookUser";

export const UserContext = createContext<NodeBookUser>(UNLOGGED_USER);

export const useUser = () => {
  return useContext(UserContext);
};
