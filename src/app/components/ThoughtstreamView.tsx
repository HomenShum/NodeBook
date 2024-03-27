import { observer } from "mobx-react-lite";
import { useGraphStore } from "../store/graph";
import { useViewStore } from "../store/outline";
import { NoteView } from "./NoteView/NoteView";

export const ThoughtstreamView = observer(() => {
  const graphStore = useGraphStore();
  const viewStore = useViewStore().thoughtstreamViewStore;
  const graphRoot = graphStore.getRoot();
  if (!graphRoot) {
    return <div>Missing root node</div>;
  }

  const notes = viewStore.notes;

  return (
    <div style={{ width: "100%" }}>
      {notes.map((note, i) => (
        <NoteView key={note.id} note={note} siblingAbove={notes[i - 1]} siblingBelow={notes[i + 1]} />
      ))}
      <button
        onClick={() => {
          const newNote = viewStore.createNote();
          viewStore.setFocusedNode(newNote);
        }}
      >
        +
      </button>
    </div>
  );
});
