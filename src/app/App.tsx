"use client";
import { ArrowLeft, SettingsIcon } from "lucide-react";
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

import { DevTools } from "./components/dev/DevTools";
import { SidebarOutlines } from "./components/dev/SidebarOutlines";

import s from "./app.module.css";

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
        <Link className={`${s.Button} ${curView === ViewType.OUTLINE ? s.Selected : ""}`} href="/outline">
          <ListIcon className={s.ButtonIcon} />
          List
        </Link>
        <Link className={`${s.Button} ${curView === ViewType.THOUGHTSTREAM ? s.Selected : ""}`} href="/stream">
          <StreamIcon className={s.ButtonIcon} />
          Stream
        </Link>
        <Link className={`${s.Button} ${curView === ViewType.SPLIT ? s.Selected : ""}`} href="/split">
          <SplitIcon className={s.ButtonIcon} /> Split
        </Link>
      </>
    );
    const router = useRouter();

    return (
      <div className={s.App}>
        <div ref={appContainerRef} className={s.AppContainer}>
          <aside className={`${s.LeftAside} ${renderController.leftSidebarOpen ? s.AsideVisible : ""}`}>
            {/* for now keeping this as tailwind bc it handles wisely the gaps in both axis */}
            <div className="flex items-start flex-col w-full gap-x-2 gap-y-1 py-1">
              <ButtonNavigation />
              <SidebarTree />
            </div>
          </aside>

          <div className={s.Container}>
            <header className={s.Header}>
              <button className={s.LeftSidebarIcon} onClick={() => renderController.toggleLeftSidebar()}>
                <SidebarIcon />
              </button>

              <div className={`${s.HeaderNav} ${renderController.leftSidebarOpen ? s.LeftShift : ""}`}>
                <div className={`${s.BackButton}`} onClick={() => router.back()}>
                  <ArrowLeft size={18} />
                </div>
                <SearchBar />
                <div className={s.HeaderNavButtons}>
                  <ButtonNavigation />
                </div>
              </div>
              <button onClick={() => renderController.toggleRightSidebar()}>
                <SettingsIcon size={18} strokeWidth={1.5} className="absolute top-[16px] right-4" />
              </button>
            </header>
            <div className={s.MainContainer}>
              <main className={`${s.Main} ${renderController.leftSidebarOpen ? s.LeftShift : ""}`}>{children}</main>
              {renderController.rightSidebarOpen && (
                <aside className={s.DevToolsSidebar}>
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
