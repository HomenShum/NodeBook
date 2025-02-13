import { useEffect, useRef } from "react";
import { captureMessage } from "@sentry/nextjs";

import { useUser } from "@/app/contexts/UserContext";

const MEMORY_THRESHOLD_IN_BYTES = 1.5 * 1024 * 1024 * 1024;
const CHECK_INTERVAL = 30000;

interface CustomPerformance extends Performance {
  memory?: {
    /** The maximum size of the heap, in bytes, that is available to the context. */
    jsHeapSizeLimit: number;
    /** The total allocated heap size, in bytes. */
    totalJSHeapSize: number;
    /** The currently active segment of JS heap, in bytes. */
    usedJSHeapSize: number;
  };
}
function useTrackMemory() {
  const appStartTime = useRef(Date.now());
  const user = useUser();

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.performance === "undefined") return;

    const performance: CustomPerformance = window.performance;

    if (typeof performance.memory === "undefined") {
      console.warn("Memory monitoring is not supported in this browser.");
      return;
    }

    const intervalId = setInterval(() => {
      if (!performance.memory?.usedJSHeapSize) return;
      const usedJSHeapSize = performance.memory.usedJSHeapSize;
      if (usedJSHeapSize > MEMORY_THRESHOLD_IN_BYTES) {
        const elapsedTimeInSeconds = (Date.now() - appStartTime.current) / 1000;

        captureMessage(`Memory exceeded 1.5GB`, {
          level: "warning",
          extra: {
            userId: user.id,
            usedJSHeapSize: `${(usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
            elapsedTime: `${(elapsedTimeInSeconds / 60).toFixed(2)} minutes since app started`,
          },
        });

        clearInterval(intervalId);
      }
    }, CHECK_INTERVAL);

    return () => clearInterval(intervalId);
  }, [user.id]);
}

export default useTrackMemory;
