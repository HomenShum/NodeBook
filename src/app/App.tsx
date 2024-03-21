"use client";
import { Sidebar } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { OutlineView } from "./components/OutlineView";
import { SplitView } from "./components/SplitView";
import { ThoughtstreamView } from "./components/ThoughtstreamView";
import { DevTools } from "./components/dev/DevTools";
import { NodeTable } from "./components/dev/NodeTable";
import { RelationTable } from "./components/dev/RelationTable";
import { RelationTypeTable } from "./components/dev/RelationTypeTable";
import { Bullet } from "./model/OutlineBullet";
import { ViewType } from "./model/ViewStore";
import { GraphStoreContext, graphStore } from "./store/graph";
import { ViewStoreContext, useViewStore, viewStore } from "./store/outline";

function App() {
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    graphStore.loadFromServer().then(() => {
      setIsLoading(false);
      // I'm not sure if we should call this "root". it's more like the "user node" or "home node".
      // It's not a root cause graphs don't have roots.
      const root = graphStore.getNode("root") ?? graphStore.createNode({ id: "root", text: "Root" });
      viewStore.outlineViewStore.setRoot(new Bullet(viewStore.outlineViewStore, root));
      // root.createRelatedNode();
      // root.createRelatedNode();
      // root.createRelatedNode();
    });
  }, []);
  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="App">
      <GraphStoreContext.Provider value={graphStore}>
        <ViewStoreContext.Provider value={viewStore}>
          <AppView />
        </ViewStoreContext.Provider>
      </GraphStoreContext.Provider>
    </div>
  );
}

const AppView = observer(() => {
  const viewStore = useViewStore();

  let viewComponent = <div>View</div>;
  switch (viewStore.curView) {
    case ViewType.OUTLINE:
      viewComponent = (
        <div className="flex flex-col h-full items-center">
          <OutlineView />
        </div>
      );
      break;
    case ViewType.THOUGHTSTREAM:
      viewComponent = <ThoughtstreamView />;
      break;
    case ViewType.SPLIT:
      viewComponent = <SplitView />;
      break;
  }

  return (
    <div className="flex flex-col h-full">
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
          <div className="m-4 w-full">{viewComponent}</div>
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
    </div>
  );
});

export default App;
