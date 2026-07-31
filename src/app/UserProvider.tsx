"use client";
import React from "react";

import { LoginScreen } from "@/app/auth/LoginScreen";
import { useAuth } from "@/app/auth/useAuth";
import { UserContext } from "@/app/contexts/UserContext";
import { env } from "@/app/envFrontend";
import useSetupUser from "@/app/hooks/useSetupUser";

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const auth = useAuth();
  const user = useSetupUser();

  if (env.isAuthEnabled && (!auth || auth.isLoading)) {
    return (
      <main aria-busy="true" aria-label="Loading NodeBook" style={centeredPageStyle}>
        <p>Loading NodeBook…</p>
      </main>
    );
  }

  if (env.isAuthEnabled && !auth?.user) {
    return <LoginScreen />;
  }

  if (!user) {
    return (
      <main aria-busy="true" aria-label="Loading your notebook" style={centeredPageStyle}>
        <p>Loading your notebook…</p>
      </main>
    );
  }

  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
};

const centeredPageStyle: React.CSSProperties = {
  alignItems: "center",
  background: "var(--color-background, #fff)",
  color: "var(--color-foreground, #111)",
  display: "flex",
  height: "100vh",
  justifyContent: "center",
};
