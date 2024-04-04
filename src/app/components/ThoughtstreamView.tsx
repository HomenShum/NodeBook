import { observer } from "mobx-react-lite";
import { useViewStore } from "../store/useViewStore";
import { comparePositions } from "../util";
import { BulletList } from "./BulletChildren";

export const ThoughtstreamView = observer(() => {
  const viewStore = useViewStore();

  const bullets = Array.from(viewStore.outlineViewStore.bulletsById.values())
    .map((bullet) => ({
      position: bullet.graphNode.thoughtstreamPosition,
      bullet,
    }))
    .sort((a, b) => comparePositions(a.position, b.position));

  return (
    <div style={{ width: "100%" }}>
      <BulletList bullets={bullets} parents={[]} depth={0} />
      {/* {notes.map((note, i) => (
        <div key={note.id} className="flex">
          <Dot strokeWidth={4} />
          <NoteView note={note} siblingAbove={notes[i - 1]} siblingBelow={notes[i + 1]} />
        </div>
      ))} */}
      <button
        onClick={() => {
          const newNote = viewStore.thoughtstreamViewStore.createNote();
          viewStore.setFocusedNode(newNote);
        }}
      >
        +
      </button>
    </div>
  );
});
