import React, { useCallback } from "react";
import { ExpandIcon, X } from "lucide-react";

import s from "@/app/components/QuickCapture/QuickCapture.module.css";
import { cn } from "@/lib/utils";
import { Button } from "@/app/components/UIPrimitives/Button";
import { useViewStore } from "@/app/view/useViewStore";
import { useSetMainRoot } from "@/app/tree/utils";

function QuickCaptureMenu() {

  const viewStore = useViewStore();
  const setMainRoot = useSetMainRoot();

  const handleExpand = () => {
    if(!viewStore.quickCaptureTree) return;
    const root = viewStore.quickCaptureTree.root.object;
    viewStore.toggleQuickCapture();
    setMainRoot(root);
  }

  return (
    <div className={s.QuickCaptureMenu}>
      <Button
        className={cn(s.ShowTooltip, s.RightAlign)}
        data-tooltip={"Close Quick Capture"}
        size="icon"
        onClick={() => viewStore.toggleQuickCapture()}
      >
        <X size={14} />
      </Button>
      <Button
        className={cn(s.ShowTooltip, s.RightAlign)}
        data-tooltip={"Close Quick Capture"}
        size="icon"
        onClick={() => handleExpand()}
      >
        <ExpandIcon size={14}/>
      </Button>
    </div>
  );
}

export default QuickCaptureMenu;