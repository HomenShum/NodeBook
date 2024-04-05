"use client";
import { Sidebar } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useRef } from "react";
import { OutlineView } from "./components/OutlineView";
import { SplitView } from "./components/SplitView";
import { ThoughtstreamView } from "./components/ThoughtstreamView";
import { DevTools } from "./components/dev/DevTools";
import { NodeTable } from "./components/dev/NodeTable";
import { RelationTable } from "./components/dev/RelationTable";
import { RelationTypeTable } from "./components/dev/RelationTypeTable";
import { ViewType } from "./model/ViewStore";
import { MouseSelection } from "./selection/MouseSelection";
import { useViewStore } from "./store/useViewStore";

const App = observer(() => {
  const appContainerRef = useRef<HTMLDivElement>(null);
  // useKeyboardShortcuts();
  const viewStore = useViewStore();

  return (
    <div className="App">
      <div ref={appContainerRef} className="flex flex-col h-full relative">
        <header className="flex justify-center items-center h-8 border-b">
          <button onClick={() => viewStore.toggleLeftSidebar()}>
            <Sidebar size={20} />
          </button>
          <div className="flex-1"></div>
          <button onClick={() => viewStore.toggleRightSidebar()}>
            <Sidebar size={20} className="transform rotate-180" />
          </button>
        </header>
        <div className="flex flex-row flex-1">
          {viewStore.leftSidebarOpen && (
            <aside className="flex flex-col w-1/6 bg-gray-100 border-r">
              <div className="flex flex-col p-4 align-left">
                {/* highlight if active */}
                <button
                  className={`text-left ${viewStore.curView === ViewType.OUTLINE ? "bg-blue-100" : ""}`}
                  onClick={() => viewStore.setView(ViewType.OUTLINE)}
                >
                  Outline view
                </button>
                <button
                  className={`text-left ${viewStore.curView === ViewType.THOUGHTSTREAM ? "bg-blue-100" : ""}`}
                  onClick={() => viewStore.setView(ViewType.THOUGHTSTREAM)}
                >
                  Thoughtstream view
                </button>
                <button
                  className={`text-left ${viewStore.curView === ViewType.SPLIT ? "bg-blue-100" : ""}`}
                  onClick={() => viewStore.setView(ViewType.SPLIT)}
                >
                  Split view
                </button>
              </div>
            </aside>
          )}
          <main className="flex flex-1">
            <div className="m-4 w-full">
              {viewStore.curView === ViewType.OUTLINE ? (
                <div className="flex flex-col h-full items-center">
                  <OutlineView />
                </div>
              ) : viewStore.curView === ViewType.THOUGHTSTREAM ? (
                <ThoughtstreamView />
              ) : (
                <SplitView />
              )}
            </div>
          </main>
          {viewStore.rightSidebarOpen && (
            <aside className="w-1/3 bg-gray-100 border-l overflow-y-auto">
              <DevTools />
              <NodeTable />
              <RelationTable />
              <RelationTypeTable />
            </aside>
          )}
        </div>
        <MouseSelection appContainerRef={appContainerRef} />
      </div>
    </div>
  );
});

export default App;
