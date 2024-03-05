"use client";
import "./App.css";
import { OutlineView } from "./components/OutlineView";
import { NodeTable } from "./components/NodeTable";
import { RelationTable } from "./components/RelationTable";
import { OutlineViewStoreContext, outlineViewStore } from "./store/outline";
import { GraphStoreContext, graphStore } from "./store/graph";

function App() {
  return (
    <div className="App">
      <GraphStoreContext.Provider value={graphStore}>
        <OutlineViewStoreContext.Provider value={outlineViewStore}>
          <div style={{ display: "flex" }}>
            <div style={{ width: "50%", display: "flex", justifyContent: "flex-start" }}>
              <OutlineView />
            </div>
            <div style={{ width: "50%" }}>
              <NodeTable />
              <RelationTable />
            </div>
          </div>
        </OutlineViewStoreContext.Provider>
      </GraphStoreContext.Provider>
    </div>
  );
}

export default App;
