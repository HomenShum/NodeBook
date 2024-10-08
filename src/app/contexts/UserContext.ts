import { createContext, useContext } from "react";

import { MewUser, UNLOGGED_USER } from "@/app/auth/MewUser";

export const UserContext = createContext<MewUser>(UNLOGGED_USER);

export const useUser = () => {
  return useContext(UserContext);
};
