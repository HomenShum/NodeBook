import { observer } from "mobx-react-lite";
import { OutlineView } from "./OutlineView";
import { ThoughtstreamView } from "./ThoughtstreamView";

export const SplitView = observer(({ searchQuery }: { searchQuery: string }) => {
  return (
    <div className="grid grid-flow-row">
      <div className="grid" style={{ gridTemplateColumns: "2fr 3fr" }}>
        <div>
          <h2 className="text-l font-bold mb-4">Thoughtstream view</h2>
          <ThoughtstreamView searchQuery={searchQuery} />
        </div>
        <div>
          <h2 className="text-l font-bold mb-4">Outline view</h2>
          <OutlineView searchQuery={searchQuery} />
        </div>
      </div>
    </div>
  );
});
