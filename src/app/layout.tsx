import { Metadata } from "next";
import { Inter } from "next/font/google";
import Head from "next/head";
import React from "react";

import LayoutClient from "./LayoutClient";

import "./global.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  title: "NodeBook",
  description: "A node-native notebook for thinking and collaboration",
};

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <link rel="manifest" href="manifest.json" />
      </Head>
      <body>
        <LayoutClient>{children}</LayoutClient>
      </body>
    </html>
  );
}
