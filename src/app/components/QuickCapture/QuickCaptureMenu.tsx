import { AppWindowIcon, ExpandIcon, PanelRightCloseIcon, PanelRightIcon, X } from "lucide-react";

import s1 from "@/app/components/Breadcrumbs/Breadcrumbs.module.css";
import s from "@/app/components/QuickCapture/QuickCapture.module.css";
import { Button } from "@/app/components/UIPrimitives/Button";
import { useSetMainRoot } from "@/app/tree/utils";
import { ViewType } from "@/app/view/types";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";
import BreadcrumbMenu from "@/app/components/Breadcrumbs/BreadcrumbMenu";
import { useUser } from "@/app/contexts/UserContext";

function QuickCaptureMenu() {
  const viewStore = useViewStore();
  const setMainRoot = useSetMainRoot();
  const user = useUser();

  const handleMainViewExpand = () => {
    if (!viewStore.quickCaptureOpen) return;
    //Copy QC's selection because it's lost when closing QC.
    const selection = viewStore.quickCaptureTree.selection;
    const root = viewStore.quickCaptureTree.root.object;
    viewStore.setViewType(ViewType.Note);
    viewStore.closeQuickCapture();
    setMainRoot(root);
    if (selection?.type === "editor") {
      viewStore.mainView.setFocusedNode(selection.treeNodeId, selection.position, selection.editMode, true);
    }
  };

  const handleSideViewExpand = () => {
    if (!viewStore.quickCaptureOpen) return;
    const root = viewStore.quickCaptureTree.root.object;
    viewStore.closeQuickCapture();
    viewStore.createSidebarTree(root);
  };

  const handleOpenInNewWindow = () => {
    if (!viewStore.quickCaptureOpen) return;
    const protocol = window.location.host.includes("localhost") ? "http://" : "https://";
    // @ts-ignore
    window.open(protocol + window.location.host, "_blank").focus();
  };

  return (
    <div className={s.QuickCaptureMenu}>
      <div>
        {" "}
        <Button
          className={cn(s1.ShowTooltip, s1.RightAlign)}
          data-tooltip={"Close Quick Capture"}
          size="icon"
          onClick={() => viewStore.closeQuickCapture()}
        >
          <X size={14} />
        </Button>
        {!user.isAnonymous && (
          <Button
            className={cn(s1.ShowTooltip, s1.RightAlign)}
            data-tooltip={"Open in Main View"}
            size="icon"
            onClick={() => handleMainViewExpand()}
          >
            <ExpandIcon size={14} />
          </Button>
        )}
        {!user.isAnonymous && (
          <Button
            className={cn(s1.ShowTooltip, s1.RightAlign)}
            data-tooltip={"Open in Side View"}
            size="icon"
            onClick={() => handleSideViewExpand()}
          >
            <PanelRightIcon size={14} />
          </Button>
        )}
        {!user.isAnonymous && (
          <Button
            className={cn(s1.ShowTooltip, s1.RightAlign)}
            data-tooltip={"Open in New View"}
            size="icon"
            onClick={() => handleOpenInNewWindow()}
          >
            <AppWindowIcon size={14} />
          </Button>
        )}
      </div>
      <div>
        <BreadcrumbMenu />
      </div>
    </div>
  );
}

export default QuickCaptureMenu;
