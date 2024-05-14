import { observer } from "mobx-react-lite";
import { OutlineView } from "./OutlineView";
import s from "./Splitview.module.css";
import { ThoughtstreamView } from "./ThoughtstreamView";

export const SplitView = observer(() => {
  return (
    <div className={`${s.container} ${s.containerLarge}`}>
      <div className={s.mainContent}>
        <div className={s.halfWidth}>
          <ThoughtstreamView />
        </div>
        <div className={s.divider}></div>
        <div className={s.halfWidth}>
          <OutlineView />
        </div>
      </div>
    </div>
  );
});
