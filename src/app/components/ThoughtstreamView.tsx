import { observer } from "mobx-react-lite";
import { useMemo } from "react";
import { Note } from "../model/ThoughtstreamNote";
import { useGraphStore } from "../store/graph";
import { useViewStore } from "../store/outline";
import { NoteView } from "./NoteView/NoteView";

export const ThoughtstreamView = observer(() => {
  const graphStore = useGraphStore();
  const viewStore = useViewStore();
  const graphRoot = graphStore.getNode("root");
  if (!graphRoot) {
    return <div>Missing root node</div>;
  }

  const notes = useMemo(() => {
    return graphStore.nodes
      .map((node) => new Note(viewStore.thoughtstreamViewStore, node))
      .filter((note) => note.id !== "root");
  }, [graphStore.nodes, viewStore.thoughtstreamViewStore]);

  return (
    <div style={{ width: "100%" }}>
      {notes.map((note) => (
        <NoteView key={note.id} note={note} />
      ))}
      <button
        onClick={() => {
          const { child } = graphRoot.createChild();
          setTimeout(() => {
            const el = document.querySelector(`[data-nodeid="${child.id}"]`);
            if (el instanceof HTMLElement) el.focus();
          }, 0);
        }}
      >
        +
      </button>
    </div>
  );
});
