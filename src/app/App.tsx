"use client";
import { Sidebar, X } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useRef, useState } from "react";
import { OutlineView } from "./components/OutlineView";
import { SplitView } from "./components/SplitView";
import { ThoughtstreamView } from "./components/ThoughtstreamView";
import { DevTools } from "./components/dev/DevTools";
import { NodeTable } from "./components/dev/NodeTable";
import { RelationTable } from "./components/dev/RelationTable";
import { RelationTypeTable } from "./components/dev/RelationTypeTable";
import { ViewType } from "./controller/ViewController";
import { useKeyboardShortcuts } from "./controller/useKeyboardShortcuts";
import { useViewController } from "./controller/useViewController";

const App = observer(() => {
  const appContainerRef = useRef<HTMLDivElement>(null);
  const viewController = useViewController();
  useKeyboardShortcuts();
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="App">
      <div ref={appContainerRef} className="flex flex-col h-full relative">
        <header className="flex justify-center items-center px-2 py-4 border-b">
          <button onClick={() => viewController.toggleLeftSidebar()}>
            <Sidebar size={20} />
          </button>
          <div className="flex-1 flex justify-center">
            <div className="bg-gray-100 pl-2 pr-1 py-1 rounded-lg my-1 min-w-64 flex justify-center">
              <input
                type="text"
                placeholder="Search..."
                className="bg-gray-100 focus:outline-none flex-1"
                value={searchQuery}
                onFocus={() => viewController.setFocusedNode(null)}
                onChange={(e) => setSearchQuery(e.target.value)}
              ></input>
              {searchQuery && (
                <button onClick={() => setSearchQuery("")}>
                  <X className="text-gray-400"></X>
                </button>
              )}
            </div>
          </div>
          <button onClick={() => viewController.toggleRightSidebar()}>
            <Sidebar size={20} className="transform rotate-180" />
          </button>
        </header>
        <div className="flex flex-row flex-1">
          {viewController.leftSidebarOpen && (
            <aside className="flex flex-col w-1/6 bg-[--teal-2] border-r">
              <div className="flex flex-col p-2 align-left">
                {/* highlight if active */}
                <button
                  className={`text-left px-2 py-1 hover:bg-[--teal-3] ${
                    viewController.curView === ViewType.OUTLINE ? "bg-[--teal-4]" : ""
                  }`}
                  onClick={() => viewController.setView(ViewType.OUTLINE)}
                >
                  Outline view
                </button>
                <button
                  className={`text-left px-2 py-1 hover:bg-[--teal-3] ${
                    viewController.curView === ViewType.THOUGHTSTREAM ? "bg-[--teal-4]" : ""
                  }`}
                  onClick={() => viewController.setView(ViewType.THOUGHTSTREAM)}
                >
                  Thoughtstream view
                </button>
                <button
                  className={`text-left px-2 py-1 hover:bg-[--teal-3] ${
                    viewController.curView === ViewType.SPLIT ? "bg-[--teal-4]" : ""
                  }`}
                  onClick={() => viewController.setView(ViewType.SPLIT)}
                >
                  Split view
                </button>
              </div>
            </aside>
          )}
          <main className="flex flex-1">
            <div className="m-4 w-full">
              {viewController.curView === ViewType.OUTLINE ? (
                <div className="flex flex-col h-full items-center">
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
            <aside className="w-1/3 bg-gray-100 border-l overflow-y-auto">
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
