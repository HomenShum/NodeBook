import { observer } from "mobx-react-lite";
import { OutlineView } from "./OutlineView";
import s from "./Splitview.module.css";
import { ThoughtstreamView } from "./ThoughtstreamView";

export const SplitView = observer(({ searchQuery }: { searchQuery: string }) => {
  return (
    <div className={`${s.container} ${s.containerLarge}`}>
      <div className={s.mainContent}>
        <div className={s.halfWidth}>
          <ThoughtstreamView searchQuery={searchQuery} />
        </div>
        <div className={s.halfWidth}>
          <OutlineView searchQuery={searchQuery} />
        </div>
      </div>
    </div>
  );
});
