import React, { useEffect } from "react";
import { observer } from "mobx-react-lite";

import s from "@/app/components/QuickCapture.module.css";
import { useViewStore } from "@/app/view/useViewStore";
import OutlineContent from "@/app/components/OutlineContent";

function QuickCapture() {
  const viewStore = useViewStore();

  if (!viewStore.quickCaptureTree) return <></>;

  return (
    <div className={s.QuickCaptureContainer}>
      <OutlineContent tree={viewStore.quickCaptureTree} />
    </div>
  );
}

export default observer(QuickCapture);
