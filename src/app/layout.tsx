import { Metadata } from "next";
import { Inter } from "next/font/google";
import Head from "next/head";

import LayoutClient from "./LayoutClient";

import "./global.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  title: "(Beta) Zephyr",
  description: "A global graph for human coordination",
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
      </Head>
      <body>
        <LayoutClient>{children}</LayoutClient>
      </body>
    </html>
  );
}
