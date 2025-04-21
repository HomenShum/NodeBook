"use client";

import * as Sentry from "@sentry/nextjs";
import { observer } from "mobx-react-lite";
import React, { useEffect, useState } from "react";

import { useAuth } from "@/app/auth/useAuth";
import CommandBar from "@/app/components/CommandBar/CommandBar";
import { SidebarIcon } from "@/app/components/CustomIcons";
import ImageViewer from "@/app/components/ImageViewer/ImageViewer";
import OfflineWarning from "@/app/components/OfflineWarning/OfflineWarning";
import { ResizableSidebar } from "@/app/components/Sidebar/ResizableSidebar";
import { Button } from "@/app/components/UIPrimitives/Button";
import { useLoading } from "@/app/contexts/LoadingContext";
import { useNotifications } from "@/app/contexts/NotificationContext";
import useServiceWorker from "@/app/hooks/useServiceWorker";
import useTrackMemory from "@/app/hooks/useTrackMemory";
import { isCommandBarHotKey, isFocusSearchHotkey, isQuickCaptureHotkey, isRightSidePanelHotkey } from "@/app/hotkeys";
import { useKeyboardShortcuts } from "@/app/render/useKeyboardShortcuts";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

import styles from "./app.module.css";

import "./global.css";
interface Props {
  children: React.ReactNode;
}

export default observer(function App({ children }: Props) {
  // Enable react-scan for performance debugging
  // useEffect(() => {
  //   scan();
  // }, []);

  const [isResizing, setIsResizing] = useState(false);
  const auth = useAuth();
  const isLoading = useLoading();
  const { unreadCount } = useNotifications();

  const viewStore = useViewStore();
  useKeyboardShortcuts();
  useServiceWorker();
  useTrackMemory();

  useEffect(() => {
    const htmlElement = document.documentElement;
    if (viewStore.isDarkMode) {
      htmlElement.classList.add("dark");
    } else {
      htmlElement.classList.remove("dark");
    }
  }, [viewStore.isDarkMode]);

  useEffect(() => {
    if (!viewStore) return;
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (isCommandBarHotKey(event)) {
        event.preventDefault();
        viewStore.setCommandBarOpen(!viewStore.isCommandBarOpen);
      }
      if (isQuickCaptureHotkey(event)) {
        event.preventDefault();
        viewStore.openQuickCapture(true);
      }
      if (isRightSidePanelHotkey(event)) {
        event.preventDefault();
        viewStore.toggleRightSidePanel();
      }
      if (isFocusSearchHotkey(event)) {
        event.preventDefault();
        const searchInputs = document.querySelectorAll('input[type="search"]');
        if (searchInputs.length <= 0) return;
        (searchInputs[0] as HTMLElement).focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [viewStore]);

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
  } else {
    return (
      <div className={styles.App}>
        <div className={styles.AppContainer}>
          <OfflineWarning />
          <ImageViewer />
          <ResizableSidebar isOpen={viewStore.leftSidebarOpen} onResizeStateChange={setIsResizing} />
          <CommandBar />
          <div className={styles.Container}>
            <Button
              data-tooltip="Toggle sidebar · ⌘⇧B"
              className={cn(styles.SidebarToggle, unreadCount ? styles.UnreadNotification : "")}
              variant="default"
              size="icon"
              onClick={() => viewStore.toggleLeftSidebar()}
            >
              <SidebarIcon />
              {unreadCount > 0 && !viewStore.leftSidebarOpen && <span>{unreadCount}</span>}
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
