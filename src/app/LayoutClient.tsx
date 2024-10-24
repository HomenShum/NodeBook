"use client";
import dynamic from "next/dynamic";

import { AuthProvider } from "@/app/auth/AuthProvider";
import { ToastContextProvider } from "@/app/hooks/useToast";
  
import { StoresProvider } from "./StoresProvider";

const App = dynamic(() => import("./App"), {
  ssr: false,
});

export default function LayoutClient({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ToastContextProvider>
      <AuthProvider>
        <StoresProvider>
          <App>{children}</App>
        </StoresProvider>
      </AuthProvider>
    </ToastContextProvider>
  );
}
