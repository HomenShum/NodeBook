"use client";
import dynamic from "next/dynamic";
import { Inter } from "next/font/google";

import { AuthProvider } from "@/app/auth/AuthProvider";

import "./global.css";
import { StoresProvider } from "./StoresProvider";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

const App = dynamic(() => import("./App"), {
  ssr: false,
});

/**
 * The root component which wraps every page in the application
 * and provides app-wide state and ui
 */
export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <AuthProvider>
        <StoresProvider>
          <body>
            <App>{children}</App>
          </body>
        </StoresProvider>
      </AuthProvider>
    </html>
  );
}
