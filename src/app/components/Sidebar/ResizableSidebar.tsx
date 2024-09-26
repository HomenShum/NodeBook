import { ArrowLeft, FileSpreadsheet, Globe, Home, MoonIcon, SettingsIcon, SunIcon } from "lucide-react";
import { action } from "mobx";
import { observer } from "mobx-react-lite";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { useUser } from "@/app/StoresProvider";
import CommandBar from "@/app/components/CommandBar";
import { ClearData } from "@/app/components/DataDialog/ClearData";
import { ImportDialog } from "@/app/components/DataDialog/ImportDialog";
import SidebarTree from "@/app/components/Sidebar/SidebarTree";
import { Button } from "@/app/components/UIPrimitives/Button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/UIPrimitives/Tooltip";
import { DevTools } from "@/app/components/dev/DevTools";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useSettingsStore } from "@/app/graph/useSettingsStore";
import { useRenderController } from "@/app/render/useRenderController";
import { createRouteUrl } from "@/app/util";
import { useViewStore } from "@/app/view/useViewStore";

import styles from "./ResizableSidebar.module.css";

interface ResizableSidebarProps {
  isOpen: boolean;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
  onResizeStateChange: (isResizing: boolean) => void;
}

export const ResizableSidebar: React.FC<ResizableSidebarProps> = observer(
  ({ isOpen, minWidth = 150, maxWidth = 450, className, onResizeStateChange }) => {
    const user = useUser();
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

    const { showAllNodesOption } = useSettingsStore();

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

    return (
      <>
        {isOpen && <div className={styles.Backdrop} onClick={() => renderController.toggleLeftSidebar()} />}
        <aside
          ref={sidebarRef}
          className={`${styles.Sidebar} ${isOpen ? styles.Open : ""} ${className || ""}`}
          style={{
            width: `${renderController.sidebarWidth}px`,
          }}
        >
          <div className={`${styles.SidebarContent} ${isResizing ? styles.Resizing : ""}`}>
            <div className={styles.TopContent}>
              <Button className={styles.BackNavigation} variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft size={16} />
              </Button>
              <div style={{ display: "flex", flexDirection: "column", marginTop: "24px" }}>
                <Button
                  style={{ width: "100%" }}
                  variant="ghost"
                  className={styles.Button}
                  onClick={() => {
                    router.push(createRouteUrl({ object: graphStore.globalRoot }));
                  }}
                >
                  <span>
                    <Globe size={16} strokeWidth={1.5} />
                  </span>
                  <span>{graphStore.globalRoot.text}</span>
                </Button>
                <Button
                  style={{ width: "100%" }}
                  variant="ghost"
                  className={styles.Button}
                  onClick={() => {
                    router.push(createRouteUrl(graphStore.getDefaultRootForUser()));
                  }}
                >
                  <span>
                    <Home size={16} strokeWidth={1.5} />
                  </span>
                  <span className={styles.ButtonText}>{graphStore.userRoot.text}</span>
                </Button>
                {showAllNodesOption === true && (
                  <Button
                    style={{ width: "100%" }}
                    variant="ghost"
                    className={styles.Button}
                    onClick={() => {
                      router.push("/all-nodes");
                    }}
                  >
                    <span>
                      <FileSpreadsheet size={16} strokeWidth={1.5} />
                    </span>
                    <span>All Nodes</span>
                  </Button>
                )}
                <div style={{ marginTop: "16px" }}>
                  <SidebarTree />
                </div>
              </div>
              <CommandBar />
            </div>

            <div className={styles.BottomNav}>
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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <span className={styles.BetaLabel}>BETA</span>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="center" sideOffset={5}>
                    This app is in beta testing. It may contain bugs, lose data, or change without notice.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
              graphStore.cleanup();
              viewStore.cleanup();
              renderController.setActiveModal(null);
            }}
          />
        )}
      </>
    );
  },
);
