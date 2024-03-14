"use client";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import "./App.css";
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
          <div style={{ display: "flex" }}>
            <div
              style={{
                width: "50%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
              }}
            >
              <AppView />
            </div>
            <div style={{ width: "50%" }}>
              <NodeTable />
              <RelationTable />
            </div>
          </div>
        </ViewStoreContext.Provider>
      </GraphStoreContext.Provider>
    </div>
  );
}

const AppView = observer(() => {
  const viewStore = useViewStore();

  let view = <div>Loading...</div>;
  switch (viewStore.curView) {
    case ViewType.OUTLINE:
      view = <OutlineView />;
      break;
    case ViewType.THOUGHTSTREAM:
      view = <ThoughtstreamView />;
      break;
  }

  return (
    <>
      <div style={{ display: "flex", gap: "10px" }}>
        <button onClick={() => viewStore.setView(ViewType.OUTLINE)}>Outline view</button>
        <button onClick={() => viewStore.setView(ViewType.THOUGHTSTREAM)}>Thoughtstream view</button>
      </div>
      {view}
    </>
  );
});

export default App;
