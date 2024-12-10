"use client";
import * as Sentry from "@sentry/nextjs";
import { observer } from "mobx-react-lite";
import React, { useEffect, useState } from "react";

import { useAuth } from "@/app/auth/useAuth";
import CommandBar from "@/app/components/CommandBar/CommandBar";
import { SidebarIcon } from "@/app/components/CustomIcons";
import { ResizableSidebar } from "@/app/components/Sidebar/ResizableSidebar";
import { Button } from "@/app/components/UIPrimitives/Button";
import Loader from "@/app/components/UIPrimitives/Loader";
import { useLoading } from "@/app/contexts/LoadingContext";
import { useKeyboardShortcuts } from "@/app/render/useKeyboardShortcuts";
import { useViewStore } from "@/app/view/useViewStore";
import { isCommandBarHotKey, isQuickCaptureHotkey } from "@/app/hotkeys";

import styles from "./app.module.css";

import "./global.css";

interface Props {
  children: React.ReactNode;
}

export default observer(function App({ children }: Props) {
  const [isResizing, setIsResizing] = useState(false);
  const auth = useAuth();
  const isLoading = useLoading();

  const viewStore = useViewStore();
  useKeyboardShortcuts();

  useEffect(() => {
    const htmlElement = document.documentElement;
    if (viewStore.isDarkMode) {
      htmlElement.classList.add("dark");
    } else {
      htmlElement.classList.remove("dark");
    }
  }, [viewStore.isDarkMode]);

  useEffect(() => {
    if(!viewStore) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if(isCommandBarHotKey(event)){
        event.preventDefault();
        viewStore.setCommandBarOpen(!viewStore.isCommandBarOpen);
      }
      if(isQuickCaptureHotkey(event)){
        event.preventDefault();
        viewStore.toggleQuickCapture();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  })

  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", `${viewStore.sidebarWidth}px`);
  }, [viewStore.sidebarWidth]);

  useEffect(() => {
    if (auth && auth.isAuthenticated && auth.user) {
      Sentry.setUser({
        id: auth.user.sub,
        email: auth.user.email,
      });
    } else {
      Sentry.setUser(null);
    }
  }, [auth]);

  if (auth && auth.error) {
    return (
      <div>
        <div>Error: {auth.error.message}</div>
        <button onClick={() => auth.logout({ logoutParams: { returnTo: window.location.origin } })}>
          Force logout
        </button>
      </div>
    );
  } else if (isLoading) {
    return <Loader />;
  } else {
    return (
      <div className={styles.App}>
        <div className={styles.AppContainer}>
          <ResizableSidebar isOpen={viewStore.leftSidebarOpen} onResizeStateChange={setIsResizing} />
          <CommandBar />
          <div className={styles.Container}>
            <Button
              data-tooltip="Toggle sidebar · ⌘⇧B"
              className={styles.SidebarToggle}
              variant="default"
              size="icon"
              onClick={() => viewStore.toggleLeftSidebar()}
            >
              <SidebarIcon />
            </Button>
            <div className={styles.MainContainer}>
              <main
                className={`${styles.Main} ${viewStore.leftSidebarOpen ? styles.ShiftMain : ""} ${
                  isResizing ? styles.MainDragging : ""
                }`}
              >
                {children}
              </main>
            </div>
          </div>
        </div>
      </div>
    );
  }
});
