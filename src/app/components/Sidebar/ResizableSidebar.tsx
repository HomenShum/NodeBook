import { ArrowLeft, MoonIcon, Play, SettingsIcon, SunIcon } from "lucide-react";
import { action } from "mobx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { useUser } from "@/app/StoresProvider";
import { ListIcon, StreamIcon } from "@/app/components/CustomIcons";
import { ClearData } from "@/app/components/DataDialog/ClearData";
import { ImportDialog } from "@/app/components/DataDialog/ImportDialog";
import SidebarTree from "@/app/components/Sidebar/SidebarTree";
import { Button } from "@/app/components/UIPrimitives/Button";
import { DevTools } from "@/app/components/dev/DevTools";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useRenderController } from "@/app/render/useRenderController";
import { useCurView } from "@/app/util";
import { createRouteUrl, ViewType } from "@/app/view/ViewType";
import { useViewStore } from "@/app/view/useViewStore";

import styles from "./ResizableSidebar.module.css";

interface ResizableSidebarProps {
  isOpen: boolean;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
  onResizeStateChange: (isResizing: boolean) => void;
}

export const ResizableSidebar: React.FC<ResizableSidebarProps> = ({
  isOpen,
  minWidth = 150,
  maxWidth = 450,
  className,
  onResizeStateChange,
}) => {
  const user = useUser();
  const curView = useCurView();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [activePointerId, setActivePointerId] = useState<number | null>(null);

  const renderController = useRenderController();
  const graphStore = useGraphStore();
  const viewStore = useViewStore();
  const router = useRouter();

  const handleOpenDevTools = () => {
    renderController.setActiveModal("devTools");
  };

  const startResizing = useCallback(
    (e: React.PointerEvent) => {
      setIsResizing(true);
      onResizeStateChange(true);
      setActivePointerId(e.pointerId); // Store the pointerId
      e.preventDefault();
      e.stopPropagation();

      if (resizerRef.current) {
        resizerRef.current.setPointerCapture(e.pointerId);
      }
    },
    [onResizeStateChange],
  );

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    onResizeStateChange(false);

    // Release the pointer capture
    if (resizerRef.current && activePointerId !== null) {
      resizerRef.current.releasePointerCapture(activePointerId);
    }
    setActivePointerId(null); // Reset the stored pointerId
  }, [onResizeStateChange, activePointerId]);

  const resize = useCallback(
    (e: PointerEvent) => {
      if (isResizing && sidebarRef.current) {
        const newWidth = e.clientX - sidebarRef.current.getBoundingClientRect().left;
        if (newWidth >= minWidth && newWidth <= maxWidth) {
          renderController.setSidebarWidth(newWidth);
        }
      }
    },
    [isResizing, minWidth, maxWidth, renderController],
  );

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (isResizing) {
        resize(e);
      }
    };

    const handlePointerUp = () => {
      if (isResizing) {
        stopResizing();
      }
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isResizing, resize, stopResizing]);

  const ButtonNavigation = () => (
    <>
      <Link
        className={`${styles.Button} ${curView === ViewType.GRAPH && styles.Selected}`}
        href={createRouteUrl(ViewType.GRAPH)}
      >
        <ListIcon className={styles.ButtonIcon} />
        List
      </Link>
      <Link
        className={`${styles.Button} ${curView === ViewType.STREAM && styles.Selected}`}
        href={createRouteUrl(ViewType.STREAM)}
      >
        <StreamIcon className={styles.ButtonIcon} />
        Stream
      </Link>
    </>
  );

  return (
    <>
      <aside
        ref={sidebarRef}
        className={`${styles.Sidebar} ${isOpen ? styles.Open : ""} ${className || ""}`}
        style={{
          width: `${renderController.sidebarWidth}px`,
          left: isOpen ? "0" : `${-1 * renderController.sidebarWidth}px`,
        }}
      >
        <div className={`${styles.SidebarContent} ${isResizing ? styles.Resizing : ""}`}>
          <div className={styles.TopContent}>
            <Button className={styles.BackNavigation} variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft size={16} />
            </Button>
            {/* <Button
              variant="default"
              size="default"
              disabled
              style={{ width: "100%", justifyContent: "start", marginBottom: "24px" }}
            >
              <Search size={16}></Search>
              Global Search
            </Button> */}
            {/* <Button variant="ghost" size="sm">
              Workspace
              <Play size={7} fill="currentColor" />
            </Button>
            <ButtonNavigation /> */}
            <Button variant="ghost" size="sm" style={{ marginTop: "24px" }}>
              My Graph
              <Play size={7} fill="currentColor" />
            </Button>
            <SidebarTree />
          </div>

          <div className={styles.RightNav}>
            <Button
              variant="ghost"
              size="icon"
              onClick={action(() => {
                renderController.isDarkMode = !renderController.isDarkMode;
              })}
            >
              {renderController.isDarkMode ? (
                <SunIcon size={16} strokeWidth={1.5} />
              ) : (
                <MoonIcon size={16} strokeWidth={1.5} />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleOpenDevTools}>
              <SettingsIcon size={16} strokeWidth={1.5} />
            </Button>
          </div>
        </div>
        <div ref={resizerRef} className={styles.Resizer} onPointerDown={startResizing} />
      </aside>
      <DevTools />
      <ImportDialog />
      {user.isUnlogged && (
        <ClearData
          onConfirm={() => {
            graphStore.clear();
            viewStore.clear();
            renderController.setActiveModal(null);
          }}
        />
      )}
    </>
  );
};
