"use client";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { NodeTable } from "./components/NodeTable";
import { OutlineView } from "./components/OutlineView";
import { RelationTable } from "./components/RelationTable";
import { ThoughtstreamView } from "./components/ThoughtstreamView";
import { ViewType } from "./model/ViewStore";
import { GraphStoreContext, graphStore } from "./store/graph";
import { ViewStoreContext, useViewStore, viewStore } from "./store/outline";

function App() {
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    graphStore.loadFromServer().then(() => {
      setIsLoading(false);
      const root = graphStore.getNode("root") ?? graphStore.createNode({ id: "root", text: "My thoughtstream" });
      viewStore.setRoot(root);
    });
  }, []);
  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="App">
      <GraphStoreContext.Provider value={graphStore}>
        <ViewStoreContext.Provider value={viewStore}>
          <Main />
        </ViewStoreContext.Provider>
      </GraphStoreContext.Provider>
    </div>
  );
}

const Main = observer(() => {
  const viewStore = useViewStore();
  return (
    <div className="flex flex-col h-full">
      <header className="flex justify-center items-center h-8 border-b">
        <button onClick={() => viewStore.toggleLeftSidebar()}>Toggle left sidebar</button>
        <div className="flex-1"></div>
        <button onClick={() => viewStore.toggleRightSidebar()}>Toggle right sidebar</button>
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
            </div>
          </aside>
        )}
        <main className="flex flex-1">
          <div className="m-4">{viewStore.curView === ViewType.OUTLINE ? <OutlineView /> : <ThoughtstreamView />}</div>
        </main>
        {viewStore.rightSidebarOpen && (
          <aside className="w-1/3 bg-gray-100 border-l">
            <NodeTable />
            <RelationTable />
          </aside>
        )}
      </div>
    </div>
  );
});

export default App;
