"use client";
import { ArrowLeft, SettingsIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import Link from "next/link";
import { useRef } from "react";
import s from "./app.module.css";
import { SearchBar } from "./components/SearchBar/SearchBar";
import SidebarTree from "./components/SidebarTree";
import { DevTools } from "./components/dev/DevTools";
import { NodeTable } from "./components/dev/NodeTable";
import { RelationTable } from "./components/dev/RelationTable";
import { RelationTypeTable } from "./components/dev/RelationTypeTable";
import { ListIcon, SidebarIcon, SplitIcon, StreamIcon } from "./components/icons/icons";
import { ViewType } from "./controller/ViewController";
import { useKeyboardShortcuts } from "./controller/useKeyboardShortcuts";
import { useViewController } from "./controller/useViewController";
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
    const viewController = useViewController();
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

    return (
      <div className={s.App}>
        <div ref={appContainerRef} className={s.AppContainer}>
          <aside className={`${s.LeftAside} ${viewController.leftSidebarOpen ? s.AsideVisible : ""}`}>
            {/* for now keeping this as tailwind bc it handles wisely the gaps in both axis */}
            <div className="flex items-start flex-col w-full gap-x-2 gap-y-1 py-1">
              <ButtonNavigation />
              <SidebarTree />
            </div>
          </aside>

          <div className={s.Container}>
            <header className={s.Header}>
              <button className={s.LeftSidebarIcon} onClick={() => viewController.toggleLeftSidebar()}>
                <SidebarIcon />
              </button>

              <div className={`${s.HeaderNav} ${viewController.leftSidebarOpen ? s.LeftShift : ""}`}>
                <div className={`${s.BackButton}`}>
                  <ArrowLeft size={18} />
                </div>
                <SearchBar />
                <div className={s.HeaderNavButtons}>
                  <ButtonNavigation />
                </div>
              </div>
              <button onClick={() => viewController.toggleRightSidebar()}>
                <SettingsIcon size={18} strokeWidth={1.5} className="absolute top-[16px] right-4" />
              </button>
            </header>
            <div className={s.MainContainer}>
              <main className={`${s.Main} ${viewController.leftSidebarOpen ? s.LeftShift : ""}`}>{children}</main>
              {viewController.rightSidebarOpen && (
                <aside className={s.DevToolsSidebar}>
                  <DevTools />
                  <NodeTable />
                  <RelationTable />
                  <RelationTypeTable />
                </aside>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  },
);
