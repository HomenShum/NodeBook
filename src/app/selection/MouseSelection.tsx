import { RefObject, useCallback, useEffect, useRef } from "react";
import { useViewStore } from "../store/useViewStore";
import { Coordinate } from "./utils";

interface Props {
  appContainerRef: RefObject<HTMLDivElement>;
}

export const MouseSelection = ({ appContainerRef }: Props) => {
  const viewStore = useViewStore();

  const isSelecting = useRef(false);
  const selectionBoxRef = useRef<HTMLDivElement>(null);
  const selectionStart = useRef<Coordinate>({ x: 0, y: 0 });

  const handleMouseDown = (e: MouseEvent) => {
    isSelecting.current = true;
    selectionStart.current = { x: e.clientX, y: e.clientY };

    requestAnimationFrame(() => {
      selectionBoxRef.current?.style.setProperty("display", "block");
      selectionBoxRef.current?.style.setProperty("top", `${selectionStart.current.y}px`);
      selectionBoxRef.current?.style.setProperty("left", `${selectionStart.current.x}px`);
      selectionBoxRef.current?.style.setProperty("width", "0px");
      selectionBoxRef.current?.style.setProperty("height", "0px");
    });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isSelecting.current) return;
      requestAnimationFrame(() => {
        const left = Math.min(e.clientX, selectionStart.current.x);
        const top = Math.min(e.clientY, selectionStart.current.y);
        const height = Math.abs(e.clientY - selectionStart.current.y);
        const width = Math.abs(e.clientX - selectionStart.current.x);
        selectionBoxRef.current?.style.setProperty("top", `${top}px`);
        selectionBoxRef.current?.style.setProperty("left", `${left}px`);
        selectionBoxRef.current?.style.setProperty("height", `${height}px`);
        selectionBoxRef.current?.style.setProperty("width", `${width}px`);
        viewStore.maybeSelectNodes({ left, top, height, width });
      });
    },
    [viewStore],
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      const selectionBox = selectionBoxRef.current?.getBoundingClientRect();
      isSelecting.current = false;
      selectionBoxRef.current?.style.setProperty("display", "none");

      if (!selectionBox) return;
      viewStore.maybeSelectNodes(selectionBox);
    },
    [viewStore],
  );

  useEffect(() => {
    const containerEl = appContainerRef.current;
    if (!containerEl) return;
    containerEl.addEventListener("mousedown", handleMouseDown);
    containerEl.addEventListener("mousemove", handleMouseMove);
    containerEl.addEventListener("mouseup", handleMouseUp);

    return () => {
      containerEl.removeEventListener("mousedown", handleMouseDown);
      containerEl.removeEventListener("mousemove", handleMouseMove);
      containerEl.removeEventListener("mouseup", handleMouseUp);
    };
  }, [appContainerRef, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={selectionBoxRef}
      style={{ display: "none", position: "absolute", backgroundColor: "rgba(0, 120, 255, 0.3)" }}
    ></div>
  );
};
