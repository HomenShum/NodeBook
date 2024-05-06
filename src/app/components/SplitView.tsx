import { observer } from "mobx-react-lite";
import { OutlineView } from "./OutlineView";
import { ThoughtstreamView } from "./ThoughtstreamView";

export const SplitView = observer(({ searchQuery }: { searchQuery: string }) => {
  return (
    <div className="flex mx-auto">
      <div className="flex flex-col gap-12 w-full">
        <div>
          <OutlineView searchQuery={searchQuery} />
        </div>
        <div>
          <ThoughtstreamView searchQuery={searchQuery} />
        </div>
      </div>
    </div>
  );
});
