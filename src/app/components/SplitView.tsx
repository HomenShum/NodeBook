import { observer } from "mobx-react-lite";

import { useViewStore } from "@/app/view/useViewStore";

import { OutlineView } from "./OutlineView";
import { ThoughtstreamView } from "./ThoughtstreamView";

import s from "./Splitview.module.css";

export const SplitView = observer(() => {
  const viewStore = useViewStore();
  return (
    <div className={`${s.container}`}>
      <div className={s.mainContent}>
        <div className={s.halfWidth}>
          <ThoughtstreamView tree={viewStore.mainStreamView} />
        </div>
        <div className={s.divider}></div>
        <div className={s.halfWidth}>
          <OutlineView tree={viewStore.mainOutlineView} />
        </div>
      </div>
    </div>
  );
});
