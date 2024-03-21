import { Editor } from "@/app/editor/Editor";
import { Note } from "@/app/model/ThoughtstreamNote";
import { useViewStore } from "@/app/store/outline";
import { cn } from "@/lib/utils";
import { observer } from "mobx-react-lite";
import styles from "./NoteView.module.css";

interface Props {
  note: Note;
  siblingAbove?: Note;
  siblingBelow?: Note;
}

export const NoteView = observer(({ note, siblingAbove, siblingBelow }: Props) => {
  const viewStore = useViewStore();

  const isSelected = viewStore.selectedNodes.has(note);

  return (
    <>
      <div
        className={cn(styles.Note, isSelected ? "bg-sky-200" : "")}
        onMouseEnter={() => viewStore.setHoveredNode(note)}
        onMouseLeave={() => viewStore.setHoveredNode(null)}
      >
        <div
          style={{
            gap: "5px",
            display: "flex",
            alignItems: "flex-start",
            flex: 1,
          }}
        >
          <div style={{ flex: 1 }}>
            <Editor
              node={note}
              onChange={(v) => note.graphNode.setText(v ?? "")}
              context={{ node: note, siblingAbove, siblingBelow }}
            />
            {viewStore.showNodeDetails && (
              <div style={{ display: "flex", fontSize: "0.75rem", gap: "10px", userSelect: "none" }}>
                <span style={{ color: "gray" }}>noteId: {note.id.slice(0, 8)}</span>
                <span style={{ color: "gray" }}>nodeId: {note.graphNode.id.slice(0, 8)}</span>
                <span style={{ color: "gray" }}>thoughtstreamPosition: {note.graphNode.thoughtstreamPosition}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
});
