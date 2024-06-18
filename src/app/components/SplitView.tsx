import { observer } from "mobx-react-lite";

import { useRenderController } from "@/app/render/useRenderController";
import { useViewStore } from "@/app/view/useViewStore";

import { OutlineView } from "./OutlineView";
import { ThoughtstreamView } from "./ThoughtstreamView";

import s from "./Splitview.module.css";

export const SplitView = observer(() => {
  const renderController = useRenderController();
  const viewStore = useViewStore();
  return (
    <div className={`${s.container} ${s.containerLarge}`}>
      <div className={s.mainContent}>
        <div className={s.halfWidth}>
          <ThoughtstreamView outline={viewStore.mainStreamView} />
        </div>
        <div className={s.divider}></div>
        <div className={s.halfWidth}>
          <OutlineView outline={viewStore.mainOutlineView} />
        </div>
      </div>
    </div>
  );
});
