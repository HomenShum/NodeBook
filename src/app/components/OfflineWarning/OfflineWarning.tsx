import { useEffect, useState } from "react";

import styles from "./OfflineWarning.module.css";

const OfflineWarning = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showWarning, setShowWarning] = useState(false);
  const [offlineTimestamp, setOfflineTimestamp] = useState<number | null>(null);

  useEffect(() => {
    const handleOffline = () => {
      setIsOnline(false);
      setOfflineTimestamp(Date.now());
    };

    const handleOnline = () => {
      setIsOnline(true);
      setShowWarning(false);
      setOfflineTimestamp(null);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined = undefined;
    if (!isOnline && offlineTimestamp) {
      timer = setTimeout(() => {
        setShowWarning(true);
      }, 5000);
    } else {
      clearTimeout(timer);
    }
    return () => clearTimeout(timer);
  }, [isOnline, offlineTimestamp]);

  return showWarning ? (
    <div className={styles.OfflineWarning}>You have been offline for more than 5 seconds.</div>
  ) : null;
};

export default OfflineWarning;
