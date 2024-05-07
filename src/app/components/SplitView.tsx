import { observer } from "mobx-react-lite";
import { OutlineView } from "./OutlineView";
import { ThoughtstreamView } from "./ThoughtstreamView";

export const SplitView = observer(({ searchQuery }: { searchQuery: string }) => {
  return (
    <div className="flex w-full max-w-7xl mx-auto">
      <div className="flex w-full gap-8 justify-between">
        <div className="w-1/2">
          <ThoughtstreamView searchQuery={searchQuery} />
        </div>
        <div className="w-1/2">
          <OutlineView searchQuery={searchQuery} />
        </div>
      </div>
    </div>
  );
});
