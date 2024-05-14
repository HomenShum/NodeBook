"use client";
import { ArrowLeft, SettingsIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { ReactNode, useRef } from "react";
import s from "./app.module.css";
import { OutlineView } from "./components/OutlineView";
import { SearchBar } from "./components/SearchBar/SearchBar";
import { SplitView } from "./components/SplitView";
import { ThoughtstreamView } from "./components/ThoughtstreamView";
import { DevTools } from "./components/dev/DevTools";
import { NodeTable } from "./components/dev/NodeTable";
import { RelationTable } from "./components/dev/RelationTable";
import { RelationTypeTable } from "./components/dev/RelationTypeTable";
import { ListIcon, SidebarIcon, SplitIcon, StreamIcon } from "./components/icons/icons";
import { ViewType } from "./controller/ViewController";
import { useKeyboardShortcuts } from "./controller/useKeyboardShortcuts";
import { useViewController } from "./controller/useViewController";

interface ButtonNavProps {
  viewType: ViewType;
  icon: ReactNode;
  label: string;
}

const App = observer(() => {
  const appContainerRef = useRef<HTMLDivElement>(null);
  const viewController = useViewController();
  useKeyboardShortcuts();

  const ButtonNavigation = () => (
    <>
      <ButtonNav viewType={ViewType.THOUGHTSTREAM} icon={<StreamIcon />} label="Stream" />
      <ButtonNav viewType={ViewType.OUTLINE} icon={<ListIcon />} label="List" />
      <ButtonNav viewType={ViewType.SPLIT} icon={<SplitIcon />} label="Split" />
    </>
  );

  const ButtonNav: React.FC<ButtonNavProps> = ({ viewType, icon, label }) => (
    <button
      className={`${s.Button} ${viewController.curView === viewType ? s.Selected : ""}`}
      onClick={() => viewController.setView(viewType)}
      data-label={label}
    >
      <div className={s.ButtonIcon}>{icon}</div>
      {label}
    </button>
  );

  return (
    <div className={s.App}>
      <div ref={appContainerRef} className={s.AppContainer}>
        <aside className={`${s.LeftAside} ${viewController.leftSidebarOpen ? s.AsideVisible : ""}`}>
          {/* for now keeping this as tailwind bc it handles wisely the gaps in both axis */}
          <div className="flex items-start flex-col w-full gap-x-2 gap-y-1 py-1">
            <ButtonNavigation />
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
              <SettingsIcon size={18} strokeWidth={1.5} className="absolute top-4 right-4" />
            </button>
          </header>
          <div className={s.MainContainer}>
            <main className={`${s.Main} ${viewController.leftSidebarOpen ? s.LeftShift : ""}`}>
              {viewController.curView === ViewType.OUTLINE ? (
                <OutlineView />
              ) : viewController.curView === ViewType.THOUGHTSTREAM ? (
                <ThoughtstreamView />
              ) : (
                <SplitView />
              )}
            </main>
            {viewController.rightSidebarOpen && (
              <aside className={"w-1/3 bg-[--gray-2] border-l overflow-y-hidden absolute right-0 pt-12"}>
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
});

export default App;
