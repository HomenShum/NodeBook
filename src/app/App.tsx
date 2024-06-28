"use client";
import { ArrowLeft, MoonIcon, SettingsIcon, SunIcon } from "lucide-react";
import { action } from "mobx";
import { observer } from "mobx-react-lite";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { SearchBar } from "@/app/components/SearchBar/SearchBar";
import SidebarTree from "@/app/components/SidebarTree";
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
    const appContainerRef = useRef<HTMLDivElement>(null);
    const renderController = useRenderController();
    useKeyboardShortcuts();

    const ButtonNavigation = () => (
      <>
        <Link className={`${styles.Button} ${curView === ViewType.OUTLINE ? styles.Selected : ""}`} href="/outline">
          <ListIcon className={styles.ButtonIcon} />
          List
        </Link>
        <Link
          className={`${styles.Button} ${curView === ViewType.THOUGHTSTREAM ? styles.Selected : ""}`}
          href="/stream"
        >
          <StreamIcon className={styles.ButtonIcon} />
          Stream
        </Link>
        <Link className={`${styles.Button} ${curView === ViewType.SPLIT ? styles.Selected : ""}`} href="/split">
          <SplitIcon className={styles.ButtonIcon} /> Split
        </Link>
      </>
    );
    const router = useRouter();

    return (
      <div className={cn(styles.App, renderController.isDarkMode && "dark")}>
        <div ref={appContainerRef} className={styles.AppContainer}>
          <aside className={`${styles.LeftAside} ${renderController.leftSidebarOpen ? styles.AsideVisible : ""}`}>
            {/* for now keeping this as tailwind bc it handles wisely the gaps in both axis */}
            <div className="flex items-start flex-col w-full gap-x-2 gap-y-1 py-1">
              <ButtonNavigation />
              <SidebarTree />
            </div>
          </aside>

          <div className={styles.Container}>
            <header className={styles.Header}>
              <button className={styles.LeftSidebarIcon} onClick={() => renderController.toggleLeftSidebar()}>
                <SidebarIcon />
              </button>

              <div className={`${styles.HeaderNav} ${renderController.leftSidebarOpen ? styles.LeftShift : ""}`}>
                <div className={`${styles.BackButton}`} onClick={() => router.back()}>
                  <ArrowLeft size={18} />
                </div>
                <SearchBar />
                <div className={styles.HeaderNavButtons}>
                  <ButtonNavigation />
                </div>
                <button
                  onClick={action(() => {
                    renderController.isDarkMode = !renderController.isDarkMode;
                  })}
                  className={styles.Button}
                >
                  {renderController.isDarkMode ? <SunIcon size={16} /> : <MoonIcon size={16} />}
                </button>
              </div>
              <button onClick={() => renderController.toggleRightSidebar()}>
                <SettingsIcon size={18} strokeWidth={1.5} className={styles.SettingsButton} />
              </button>
            </header>
            <div className={styles.MainContainer}>
              <main className={`${styles.Main} ${renderController.leftSidebarOpen ? styles.LeftShift : ""}`}>
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
  },
);
