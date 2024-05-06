"use client";
import { Home, Search, SettingsIcon, X } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useRef, useState } from "react";
import s from "./app.module.css";
import { OutlineView } from "./components/OutlineView";
import { SplitView } from "./components/SplitView";
import { ThoughtstreamView } from "./components/ThoughtstreamView";
import { DevTools } from "./components/dev/DevTools";
import { NodeTable } from "./components/dev/NodeTable";
import { RelationTable } from "./components/dev/RelationTable";
import { RelationTypeTable } from "./components/dev/RelationTypeTable";
import { ListIcon, StreamIcon } from "./components/icons/icons";
import { ViewType } from "./controller/ViewController";
import { useKeyboardShortcuts } from "./controller/useKeyboardShortcuts";
import { useViewController } from "./controller/useViewController";

const App = observer(() => {
  const appContainerRef = useRef<HTMLDivElement>(null);
  const viewController = useViewController();
  useKeyboardShortcuts();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <div className="App">
      <div ref={appContainerRef} className="flex flex-col h-full relative">
        <header className="fixed w-full bg-white z-10 flex justify-center items-center px-4 border-b">
          {/* <button onClick={() => viewController.toggleLeftSidebar()}>
            <SidebarIcon />
          </button> */}
          <div className="flex w-[720px] justify-between items-center">
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
                onFocus={() => viewController.setFocusedNode(null)}
                onChange={(e) => setSearchQuery(e.target.value)}
              ></input>
              {searchQuery && (
                <button onClick={() => setSearchQuery("")}>
                  <X size={18} className={s.CancelSearch}></X>
                </button>
              )}
            </div>
            <div className="flex gap-4 py-2 pl-2 align-left">
              <button
                className={`${s.Button} ${viewController.curView === ViewType.SPLIT ? s.Selected : ""}`}
                onClick={() => viewController.setView(ViewType.SPLIT)}
              >
                <div className={s.ButtonIcon}>
                  <Home size={16} />
                </div>
                Home
              </button>
              <button
                className={`${s.Button} ${viewController.curView === ViewType.THOUGHTSTREAM ? s.Selected : ""}`}
                onClick={() => viewController.setView(ViewType.THOUGHTSTREAM)}
              >
                <div className={s.ButtonIcon}>
                  <StreamIcon />
                </div>
                Stream
              </button>
              <button
                className={`${s.Button} ${viewController.curView === ViewType.OUTLINE ? s.Selected : ""}`}
                onClick={() => viewController.setView(ViewType.OUTLINE)}
              >
                <div className={s.ButtonIcon}>
                  <ListIcon />
                </div>
                List
              </button>
            </div>
          </div>
          <button onClick={() => viewController.toggleRightSidebar()}>
            <SettingsIcon size={18} strokeWidth={1.5} className="absolute top-4 right-4" />
          </button>
        </header>
        <div className="flex flex-row flex-1">
          {viewController.leftSidebarOpen && (
            <aside className="flex flex-col w-1/3 bg-[--teal-2] border-r z-10 pt-16"></aside>
          )}
          <main className="flex flex-1 pt-16">
            <div className="m-4 w-full">
              {viewController.curView === ViewType.OUTLINE ? (
                <div className="flex flex-col h-full items-center ">
                  <OutlineView searchQuery={searchQuery} />
                </div>
              ) : viewController.curView === ViewType.THOUGHTSTREAM ? (
                <ThoughtstreamView searchQuery={searchQuery} />
              ) : (
                <SplitView searchQuery={searchQuery} />
              )}
            </div>
          </main>
          {viewController.rightSidebarOpen && (
            <aside className="w-1/3 bg-[--gray-2] border-l overflow-y-hidden absolute right-0 pt-12">
              <DevTools />
              <NodeTable />
              <RelationTable />
              <RelationTypeTable />
            </aside>
          )}
        </div>
        {/* <MouseSelection appContainerRef={appContainerRef} /> */}
      </div>
    </div>
  );
});

export default App;
