import React from "react";
import {ExpandIcon, PanelRightCloseIcon, X} from "lucide-react";

import s from "@/app/components/QuickCapture/QuickCapture.module.css";
import s1 from "@/app/components/Breadcrumbs/Breadcrumbs.module.css";
import { cn } from "@/lib/utils";
import { Button } from "@/app/components/UIPrimitives/Button";
import { useViewStore } from "@/app/view/useViewStore";
import { useSetMainRoot } from "@/app/tree/utils";

function QuickCaptureMenu() {

  const viewStore = useViewStore();
  const setMainRoot = useSetMainRoot();

  const handleMainViewExpand = () => {
    if(!viewStore.quickCaptureOpen) return;
    const root = viewStore.quickCaptureTree.root.object;
    viewStore.toggleQuickCapture();
    setMainRoot(root);
  }

    const handleSideViewExpand = () => {
        if(!viewStore.quickCaptureOpen) return;
        const root = viewStore.quickCaptureTree.root.object;
        viewStore.toggleQuickCapture();
        viewStore.createSidebarTree(root)
    }

  return (
    <div className={s.QuickCaptureMenu}>
      <Button
        className={cn(s1.ShowTooltip, s1.RightAlign)}
        data-tooltip={"Close Quick Capture"}
        size="icon"
        onClick={() => viewStore.toggleQuickCapture()}
      >
        <X size={14} />
      </Button>
      <Button
        className={cn(s1.ShowTooltip, s1.RightAlign)}
        data-tooltip={"Open in Main View"}
        size="icon"
        onClick={() => handleMainViewExpand()}
      >
        <ExpandIcon size={14}/>
      </Button>
      <Button
            className={cn(s1.ShowTooltip, s1.RightAlign)}
            data-tooltip={"Open in Side View"}
            size="icon"
            onClick={() => handleSideViewExpand()}
      >
         <PanelRightCloseIcon size={14}/>
      </Button>
    </div>
  );
}

export default QuickCaptureMenu;