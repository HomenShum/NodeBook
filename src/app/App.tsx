"use client";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";

import { LoginScreen } from "@/app/auth/LoginScreen";
import { useAuth } from "@/app/auth/useAuth";
import { SidebarIcon } from "@/app/components/CustomIcons";
import { ResizableSidebar } from "@/app/components/Sidebar/ResizableSidebar";
import { Button } from "@/app/components/UIPrimitives/Button";
import Loader from "@/app/components/UIPrimitives/Loader";
import { useKeyboardShortcuts } from "@/app/render/useKeyboardShortcuts";
import { useRenderController } from "@/app/render/useRenderController";

import { useLoading } from "./StoresProvider";

import styles from "./app.module.css";

import "./global.css";

export default observer(
  ({
    children,
  }: Readonly<{
    children: React.ReactNode;
  }>) => {
    const [isResizing, setIsResizing] = useState(false);
    const auth = useAuth();
    const isLoading = useLoading();

    const appContainerRef = useRef<HTMLDivElement>(null);
    const renderController = useRenderController();
    useKeyboardShortcuts();

    useEffect(() => {
      const htmlElement = document.documentElement;
      if (renderController.isDarkMode) {
        htmlElement.classList.add("dark");
      } else {
        htmlElement.classList.remove("dark");
      }
    }, [renderController.isDarkMode]);

    useEffect(() => {
      document.documentElement.style.setProperty("--sidebar-width", `${renderController.sidebarWidth}px`);
    }, [renderController.sidebarWidth]);

    if (auth && auth.error) {
      return (
        <div>
          <div>Error: {auth.error.message}</div>
          <button onClick={() => auth.logout({ logoutParams: { returnTo: window.location.origin } })}>
            Force logout
          </button>
        </div>
      );
    } else if (auth && !auth.isAuthenticated) {
      return <LoginScreen />;
    } else if (isLoading) {
      return <Loader />;
    } else {
      return (
        <div className={styles.App}>
          <div ref={appContainerRef} className={styles.AppContainer}>
            <ResizableSidebar isOpen={renderController.leftSidebarOpen} onResizeStateChange={setIsResizing} />
            <div className={styles.Container}>
              <Button
                className={styles.SidebarToggle}
                variant="ghost"
                size="icon"
                onClick={() => renderController.toggleLeftSidebar()}
              >
                <SidebarIcon />
              </Button>
              {/* <Button
                className={styles.RightSidebarToggle}
                variant="ghost"
                size="icon"
                onClick={() => renderController.toggleRightSidebar()}
              >
                <SidebarIcon />
              </Button> */}
              <div className={styles.MainContainer}>
                <main
                  className={`${styles.Main} ${renderController.leftSidebarOpen ? styles.ShiftMain : ""} ${
                    isResizing ? styles.MainDragging : ""
                  }`}
                >
                  {children}
                </main>
                {/* {renderController.rightSidebarOpen && (
                  <aside className={styles.DevToolsSidebar}>
                    <SidebarOutlines />
                    <DevTools />
                  </aside>
                )} */}
              </div>
            </div>
          </div>
        </div>
      );
    }
  },
);
