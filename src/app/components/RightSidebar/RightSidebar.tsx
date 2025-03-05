import { PanelRightCloseIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useRef, useState } from "react";

import OutlineContent from "@/app/components/OutlineContent";
import s from "@/app/components/RightSidebar/RightSidebar.module.css";
import { OutlineParentContext } from "@/app/contexts/OutlineContentContext";
import { useViewStore } from "@/app/view/useViewStore";

const RightSidebar = observer(function RightSidebar({ parentRef }: { parentRef: React.RefObject<HTMLDivElement> }) {
  const viewStore = useViewStore();

  const resizerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [activePointerId, setActivePointerId] = useState<number | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const startResizing = useCallback((e: React.PointerEvent) => {
    setIsResizing(true);
    setActivePointerId(e.pointerId); // Store the pointerId
    e.preventDefault();
    e.stopPropagation();

    if (resizerRef.current) {
      resizerRef.current.setPointerCapture(e.pointerId);
    }
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);

    // Release the pointer capture
    if (resizerRef.current && activePointerId !== null) {
      resizerRef.current.releasePointerCapture(activePointerId);
    }
    setActivePointerId(null); // Reset the stored pointerId
  }, [activePointerId]);

  const resize = useCallback(
    (e: PointerEvent) => {
      if (isResizing && sidebarRef.current && parentRef.current) {
        const newWidth =
          ((sidebarRef.current.getBoundingClientRect().right - e.clientX) /
            parentRef.current.getBoundingClientRect().width) *
          100;

        if (newWidth >= 40 && newWidth <= 60) {
          viewStore.setRightSidebarWidth(newWidth);
        }
      }
    },
    [isResizing, viewStore],
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

  if (!viewStore.rightSidebarOpen) return <></>;

  return (
    <div ref={sidebarRef} className={s.RightSidebarContainer} style={{ width: `${viewStore.rightSidebarWidth}%` }}>
      <div ref={resizerRef} className={s.Resizer} onPointerDown={startResizing}>
        <div className={s.ResizerHandle} />
      </div>
      <div className={s.RightSidebar}>
        <div className={s.CloseIconContainer} onClick={() => viewStore.toggleRightSidebar()} title={"Close sidebar"}>
          <PanelRightCloseIcon size={20} />
        </div>
        <OutlineParentContext.Provider value="RightSidebar">
          {viewStore.sidebarTrees.map((tree) => (
            <OutlineContent key={tree.id} tree={tree} />
          ))}
        </OutlineParentContext.Provider>
      </div>
    </div>
  );
});

export default RightSidebar;
