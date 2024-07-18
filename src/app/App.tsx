"use client";
import { ArrowLeft, MoonIcon, SettingsIcon, SunIcon } from "lucide-react";
import { action } from "mobx";
import { observer } from "mobx-react-lite";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { LoginScreen } from "@/app/auth/LoginScreen";
import { useAuth } from "@/app/auth/useAuth";
import { SearchBar } from "@/app/components/SearchBar/SearchBar";
import SidebarTree from "@/app/components/SidebarTree";
import { Button } from "@/app/components/UIPrimitives/Button";
import { ListIcon, SidebarIcon, SplitIcon, StreamIcon } from "@/app/components/icons";
import { useKeyboardShortcuts } from "@/app/render/useKeyboardShortcuts";
import { useRenderController } from "@/app/render/useRenderController";
import { ViewType } from "@/app/view/ViewType";
import { cn } from "@/lib/utils";

import { DevTools } from "./components/dev/DevTools";
import { SidebarOutlines } from "./components/dev/SidebarOutlines";

import styles from "./app.module.css";

import "./global.css";

export default observer(
  ({
    children,
    curView,
  }: Readonly<{
    children: React.ReactNode;
    curView: ViewType;
  }>) => {
    const { isAuthenticated, isLoading } = useAuth();
    const appContainerRef = useRef<HTMLDivElement>(null);
    const renderController = useRenderController();
    useKeyboardShortcuts();

    const ButtonNavigation = () => (
      <>
        <Link className={`${styles.Button} ${curView === ViewType.OUTLINE && styles.Selected}`} href="/outline">
          <ListIcon className={styles.ButtonIcon} />
          List
        </Link>
        <Link className={`${styles.Button} ${curView === ViewType.THOUGHTSTREAM && styles.Selected}`} href="/stream">
          <StreamIcon className={styles.ButtonIcon} />
          Stream
        </Link>
        <Link
          className={`${styles.Button} ${styles.Hidden} ${curView === ViewType.SPLIT ? styles.Selected : ""}`}
          href="/split"
        >
          <SplitIcon className={styles.ButtonIcon} /> Split
        </Link>
      </>
    );
    const router = useRouter();

    if (!isAuthenticated) {
      return <LoginScreen />;
    } else if (isLoading) {
      return <div>Loading...</div>;
    } else {
      return (
        <div className={cn(styles.App, renderController.isDarkMode && "dark")}>
          <div ref={appContainerRef} className={styles.AppContainer}>
            <aside className={`${styles.LeftAside} ${renderController.leftSidebarOpen && styles.AsideVisible}`}>
              <div className={styles.AsideContent}>
                <ButtonNavigation />
                <SidebarTree />
              </div>
            </aside>

            <div className={styles.Container}>
              <header className={styles.Header}>
                <Button
                  variant="ghost"
                  size="icon"
                  // className={styles.LeftSidebarIcon}
                  onClick={() => renderController.toggleLeftSidebar()}
                >
                  <SidebarIcon />
                </Button>
                <div className={`${styles.HeaderNav} ${renderController.leftSidebarOpen && styles.ShiftNav}`}>
                  <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft size={16} />
                  </Button>
                  <SearchBar />
                  <div className={styles.HeaderNavButtons}>
                    <ButtonNavigation />
                  </div>
                </div>
                <div className={styles.RightNav}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={action(() => {
                      renderController.isDarkMode = !renderController.isDarkMode;
                    })}
                    // className={styles.Button}
                  >
                    {renderController.isDarkMode ? (
                      <SunIcon size={16} strokeWidth={1.5} />
                    ) : (
                      <MoonIcon size={16} strokeWidth={1.5} />
                    )}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => renderController.toggleRightSidebar()}>
                    <SettingsIcon size={16} strokeWidth={1.5} />
                  </Button>
                </div>
              </header>
              <div className={styles.MainContainer}>
                <main className={`${styles.Main} ${renderController.leftSidebarOpen && styles.ShiftMain}`}>
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
