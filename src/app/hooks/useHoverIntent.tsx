import { useCallback, useRef, useState } from "react";

interface UseHoverIntentOptions {
  /**
   * Delay in milliseconds before showing tooltip
   */
  delay?: number;
  /**
   * Minimum distance in pixels mouse must move to cancel hover intent
   */
  sensitivity?: number;
}

export function useHoverIntent({ delay = 200, sensitivity = 7 }: UseHoverIntentOptions = {}) {
  const [isHovering, setIsHovering] = useState(false);
  const timerRef = useRef<NodeJS.Timeout>();
  const mousePositionRef = useRef<{ x: number; y: number } | null>(null);

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      mousePositionRef.current = { x: e.clientX, y: e.clientY };
      timerRef.current = setTimeout(() => {
        setIsHovering(true);
      }, delay);
    },
    [delay],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!mousePositionRef.current) return;

      const { x, y } = mousePositionRef.current;
      const distance = Math.sqrt(Math.pow(e.clientX - x, 2) + Math.pow(e.clientY - y, 2));

      if (distance > sensitivity) {
        // Mouse moved too fast/far, cancel hover intent
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setIsHovering(true);
        }, delay);
        mousePositionRef.current = { x: e.clientX, y: e.clientY };
      }
    },
    [delay, sensitivity],
  );

  const handleMouseLeave = useCallback(() => {
    clearTimeout(timerRef.current);
    setIsHovering(false);
    mousePositionRef.current = null;
  }, []);

  return {
    isHovering,
    hoverProps: {
      onMouseEnter: handleMouseEnter,
      onMouseMove: handleMouseMove,
      onMouseLeave: handleMouseLeave,
    },
  };
}
