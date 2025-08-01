"use client";
import React from "react";

import { UserContext } from "@/app/contexts/UserContext";
import useSetupUser from "@/app/hooks/useSetupUser";

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const user = useSetupUser();

  if (!user) {
    return <></>;
  }

  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
};
