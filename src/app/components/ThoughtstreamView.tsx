import { observer } from "mobx-react-lite";
import { Note } from "../model/ThoughtstreamNote";
import { useViewStore } from "../store/outline";
import { NoteView } from "./NoteView/NoteView";

export const ThoughtstreamView = observer(() => {
  const viewStore = useViewStore();
  const root = viewStore.currentViewRoot as Note;
  if (!root) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ width: "100%" }}>
      <h1>{root.graphNode.text}</h1>
      {root.children.map((child, i) => (
        <NoteView key={child.id} note={child} />
      ))}
      <button
        onClick={() => {
          const { child } = root.graphNode.createChild();
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
