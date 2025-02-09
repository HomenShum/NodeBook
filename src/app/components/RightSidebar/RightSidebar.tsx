import { PanelRightCloseIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useRef, useState } from "react";

import OutlineContent from "@/app/components/OutlineContent";
import s from "@/app/components/RightSidebar/RightSidebar.module.css";
import { useViewStore } from "@/app/view/useViewStore";

interface RightSidebarProps {
  minWidth: number;
  maxWidth: number;
}

const RightSidebar = observer(function RightSidebar({ minWidth, maxWidth }: RightSidebarProps) {
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
      if (isResizing && sidebarRef.current) {
        const newWidth = sidebarRef.current.getBoundingClientRect().right - e.clientX;
        // if (newWidth >= minWidth && newWidth <= maxWidth) {
        viewStore.setRightSidebarWidth(newWidth);
        // }
      }
    },
    [isResizing, minWidth, maxWidth, viewStore],
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
    <div ref={sidebarRef} className={s.RightSidebarContainer} style={{ width: `${viewStore.rightSidebarWidth}px` }}>
      <div ref={resizerRef} className={s.Resizer} onPointerDown={startResizing}>
        <div className={s.ResizerHandle} />
      </div>
      <div className={s.RightSidebar}>
        <div className={s.CloseIconContainer} onClick={() => viewStore.toggleRightSidebar()} title={"Close sidebar"}>
          <PanelRightCloseIcon size={20} />
        </div>
        {viewStore.sidebarTrees.map((tree) => (
          <OutlineContent key={tree.id} tree={tree} />
        ))}
      </div>
    </div>
  );
});

export default RightSidebar;
