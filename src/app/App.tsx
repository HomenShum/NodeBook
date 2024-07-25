"use client";
import { observer } from "mobx-react-lite";
import { useRef, useState } from "react";

import { LoginScreen } from "@/app/auth/LoginScreen";
import { useAuth } from "@/app/auth/useAuth";
import { SidebarIcon } from "@/app/components/CustomIcons";
import { ResizableSidebar } from "@/app/components/Sidebar/ResizableSidebar";
import { Button } from "@/app/components/UIPrimitives/Button";
import { useKeyboardShortcuts } from "@/app/render/useKeyboardShortcuts";
import { useRenderController } from "@/app/render/useRenderController";
import { cn } from "@/lib/utils";

import { DevTools } from "./components/dev/DevTools";
import { SidebarOutlines } from "./components/dev/SidebarOutlines";

import styles from "./app.module.css";

import "./global.css";

export default observer(
  ({
    children,
  }: Readonly<{
    children: React.ReactNode;
  }>) => {
    const [isResizing, setIsResizing] = useState(false);
    const { isAuthenticated, isLoading } = useAuth();

    const appContainerRef = useRef<HTMLDivElement>(null);
    const renderController = useRenderController();
    useKeyboardShortcuts();

    if (!isAuthenticated) {
      return <LoginScreen />;
    } else if (isLoading) {
      return <div>Loading...</div>;
    } else {
      return (
        <div className={cn(styles.App, renderController.isDarkMode && "dark")}>
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
              <Button
                className={styles.RightSidebarToggle}
                variant="ghost"
                size="icon"
                onClick={() => renderController.toggleRightSidebar()}
              >
                <SidebarIcon />
              </Button>
              <div className={styles.MainContainer}>
                <main
                  className={`${styles.Main} ${renderController.leftSidebarOpen ? styles.ShiftMain : ""} ${
                    isResizing ? styles.MainDragging : ""
                  }`}
                  style={{ marginLeft: renderController.leftSidebarOpen ? renderController.sidebarWidth : "" }}
                >
                  {children}
                </main>
                {renderController.rightSidebarOpen && (
                  <aside className={styles.DevToolsSidebar}>
                    <SidebarOutlines />
                    <DevTools />
                  </aside>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }
  },
);
