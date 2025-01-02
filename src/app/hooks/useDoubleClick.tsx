import { useCallback, useRef } from "react";

interface UseDoubleClickOptions {
  onSingleClick?: (e: any) => void;
  onDoubleClick?: (e: any) => void;
  threshold?: number;
}

export function useDoubleClick({ onSingleClick, onDoubleClick, threshold = 250 }: UseDoubleClickOptions) {
  const lastClickTimeRef = useRef(0);

  const handleClick = useCallback(
    (e: any) => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastClickTimeRef.current;
      lastClickTimeRef.current = currentTime;

      if (timeDiff < threshold) {
        onDoubleClick?.(e);
      } else {
        setTimeout(() => {
          if (currentTime === lastClickTimeRef.current) {
            onSingleClick?.(e);
          }
        }, threshold);
      }
    },
    [onSingleClick, onDoubleClick, threshold],
  );

  return handleClick;
}
