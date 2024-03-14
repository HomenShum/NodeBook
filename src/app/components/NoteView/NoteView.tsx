import { Editor } from "@/app/editor/Editor";
import { Note } from "@/app/model/ThoughtstreamNote";
import { useGraphStore } from "@/app/store/graph";
import { useViewStore } from "@/app/store/outline";
import { observer } from "mobx-react-lite";
import styles from "./NoteView.module.css";

interface Props {
  note: Note;
}

export const NoteView = observer(({ note }: Props) => {
  const graphStore = useGraphStore();
  const viewStore = useViewStore();

  return (
    <>
      <div
        className={styles.Note}
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
              context={{ node: note }}
            />
            {viewStore.showNodeDetails && (
              <div
                style={{ display: "flex", fontSize: "0.75rem", gap: "10px" }}
              >
                <span style={{ color: "gray" }}>
                  noteId: {note.id.slice(0, 8)}
                </span>
                <span style={{ color: "gray" }}>
                  nodeId: {note.graphNode.id.slice(0, 8)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
});
