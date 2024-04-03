import { Dot } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useViewStore } from "../store/useViewStore";
import { NoteView } from "./NoteView/NoteView";

export const ThoughtstreamView = observer(() => {
  const viewStore = useViewStore().thoughtstreamViewStore;
  const notes = viewStore.notes;

  return (
    <div style={{ width: "100%" }}>
      {notes.map((note, i) => (
        <div key={note.id} className="flex">
          <Dot strokeWidth={4} />
          <NoteView note={note} siblingAbove={notes[i - 1]} siblingBelow={notes[i + 1]} />
        </div>
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
