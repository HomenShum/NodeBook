"use client";
import { Search, SettingsIcon, X } from "lucide-react";
import { observer } from "mobx-react-lite";
import { ReactNode, useRef, useState } from "react";
import s from "./app.module.css";
import { OutlineView } from "./components/OutlineView";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

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
    <div className="App">
      <div ref={appContainerRef} className="flex w-full h-full relative overflow-y-scroll items-start">
        <aside className={`${s.LeftAside} ${viewController.leftSidebarOpen ? s.AsideVisible : ""}`}>
          <div className="flex items-start flex-col w-full gap-x-2 gap-y-1 py-1">
            <ButtonNavigation />
          </div>
        </aside>

        <div className="relative w-full flex flex-col">
          <header className={`fixed w-full bg-white z-20 flex justify-center items-center px-4 border-b`}>
            <button className="fixed left-4" onClick={() => viewController.toggleLeftSidebar()}>
              <SidebarIcon />
            </button>
            <div
              className={`flex justify-between w-10/12 lg:w-[720px] items-center transition-all animate-out duration-300 ${
                viewController.leftSidebarOpen ? "ml-[16%]" : ""
              }
              }`}
            >
              <div
                className={searchFocused ? s.SearchFocus : s.Search}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              >
                <Search className={s.SearchIcon} size={16} strokeWidth={2.5} />
                <input
                  type="search"
                  placeholder="Search..."
                  className={s.SearchContent}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")}>
                    <X size={18} className={s.CancelSearch} />
                  </button>
                )}
              </div>
              <div className="flex gap-2 py-2 pl-2 align-left">
                <ButtonNavigation />
              </div>
            </div>
            <button onClick={() => viewController.toggleRightSidebar()}>
              <SettingsIcon size={18} strokeWidth={1.5} className="absolute top-4 right-4" />
            </button>
          </header>
          <div className="flex flex-row flex-1">
            <main
              className={`flex flex-1 pt-20 transition-all animate-out duration-300  ${
                viewController.leftSidebarOpen ? " pl-[16%]" : ""
              }`}
            >
              {viewController.curView === ViewType.OUTLINE ? (
                <OutlineView searchQuery={searchQuery} />
              ) : viewController.curView === ViewType.THOUGHTSTREAM ? (
                <ThoughtstreamView searchQuery={searchQuery} />
              ) : (
                <SplitView searchQuery={searchQuery} />
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
