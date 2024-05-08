"use client";
import { toJS } from "mobx";
import { Inter } from "next/font/google";
import { useEffect, useRef, useState } from "react";
import { ViewController } from "./controller/ViewController";
import { ViewControllerProvider } from "./controller/useViewController";
import { env } from "./envFrontend";
import "./global.css";
import { GraphStore } from "./model/GraphStore";
import { GraphStoreProvider } from "./store/useGraphStore";

// If loading a variable font, you don't need to specify the font weight
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

// Initialize stores
const graphStore = new GraphStore();
const viewController = new ViewController(graphStore);

// Expose stores to the window for debugging
if (typeof window !== "undefined" && env.env !== "production") {
  window.mew = {
    env,
    toJS,
    graphStore,
    viewController,
  };
}

function persistData(dataString: string) {
  if (env.persistTo === "local") {
    localStorage.setItem("data", dataString);
  } else if (env.persistTo === "server") {
    fetch("/api/persist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: dataString }),
    });
  } else {
    return env.persistTo satisfies never;
  }
}

async function loadData() {
  let dataString: string | null = null;
  if (env.persistTo === "local") {
    dataString = localStorage.getItem("data");
  } else if (env.persistTo === "server") {
    const json = await fetch("/api/persist").then((res) => res.json());
    dataString = json.data;
  }
  return dataString ? JSON.parse(dataString) : null;
}

/**
 * The root component which wraps every page in the application
 * and provides the app stores.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isLoading, setIsLoading] = useState(true);
  const persistedData = useRef<string | null>(null);
  useEffect(() => {
    if (!env.isPersistenceEnabled) {
      setIsLoading(false);
      return;
    }
    async function setupSync() {
      const data = await loadData();
      if (data !== null) {
        graphStore.deserializeInPlace(data);
      }
      setIsLoading(false);
      setInterval(() => {
        const newDataString = JSON.stringify(graphStore.serialize());
        if (newDataString !== persistedData.current) {
          persistedData.current = newDataString;
          persistData(newDataString);
        }
      }, 500);
    }
    setupSync();
  }, []);
  return (
    <html lang="en" className={inter.className}>
      <GraphStoreProvider value={graphStore}>
        <ViewControllerProvider value={viewController}>
          <body>{isLoading ? <div>Loading...</div> : children}</body>
        </ViewControllerProvider>
      </GraphStoreProvider>
    </html>
  );
}
