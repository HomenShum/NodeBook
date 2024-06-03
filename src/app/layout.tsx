"use client";
import { autorun, toJS } from "mobx";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { DataLoadProvider } from "./DataLoadContext";
import { ViewController } from "./controller/ViewController";
import { ViewControllerProvider } from "./controller/useViewController";
import { env } from "./envFrontend";
import "./global.css";
import { GraphStore } from "./model/GraphStore";
import { SettingsStore } from "./model/SettingsStore";
import { GraphStoreProvider } from "./model/useGraphStore";
import { SettingsStoreProvider } from "./model/useSettingsStore";
import { useCurView } from "./util";

const App = dynamic(() => import("./App"), {
  ssr: false,
});

// Initialize stores
const settingsStore = new SettingsStore();
settingsStore.loadFromLocalStorage();
const graphStore = new GraphStore(settingsStore);
const viewController = new ViewController(settingsStore, graphStore);

autorun(() => {
  settingsStore.saveToLocalStorage();
});

// Expose stores to the window for debugging
if (typeof window !== "undefined" && env.env !== "production") {
  window.mew = {
    env,
    toJS,
    graphStore,
    viewController,
  };
}

function persistGraphData(dataString: string) {
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

async function loadGraphData() {
  let dataString: string | null = null;
  if (env.persistTo === "local") {
    dataString = localStorage.getItem("data");
  } else if (env.persistTo === "server") {
    try {
      const json = await fetch("/api/persist").then((res) => res.json());
      dataString = json.data;
    } catch (e) {
      console.error("Error loading data from server", e);
    }
  }
  return dataString ? JSON.parse(dataString) : null;
}
/**
 * The root component which wraps every page in the application
 * and provides the app stores.
 */
export default function RootTemplate({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [hasLoaded, setHasLoaded] = useState(false);
  const persistedData = useRef<string | null>(null);
  const curView = useCurView();

  useEffect(() => {
    if (!env.isPersistenceEnabled) {
      setHasLoaded(true);
      return;
    }
    async function setupSync() {
      const data = await loadGraphData();
      if (data !== null) {
        graphStore.deserializeInPlace(data);
      }
      setHasLoaded(true);
      setInterval(() => {
        const newDataString = JSON.stringify(graphStore.serialize());
        if (newDataString !== persistedData.current) {
          persistedData.current = newDataString;
          persistGraphData(newDataString);
        }
      }, 500);
    }
    setupSync();
  }, []);

  return (
    <html>
      <DataLoadProvider value={hasLoaded}>
        <SettingsStoreProvider value={settingsStore}>
          <GraphStoreProvider value={graphStore}>
            <ViewControllerProvider value={viewController}>
              <body>
                <App curView={curView}>{children}</App>
              </body>
            </ViewControllerProvider>
          </GraphStoreProvider>
        </SettingsStoreProvider>
      </DataLoadProvider>
    </html>
  );
}
