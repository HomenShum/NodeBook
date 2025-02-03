import React from "react";
import { BellIcon, CheckCheckIcon, ListFilterIcon, SettingsIcon, XIcon } from "lucide-react";

import { useViewStore } from "@/app/view/useViewStore";
import { useNotifications } from "@/app/contexts/NotificationContext";

import styles from "./Notifications.module.css";

function NotificationHeader() {
  const viewStore = useViewStore();
  const { markAllAsRead } = useNotifications();

  const closeNotificationsPane = () => {
    viewStore.setNotificationPaneOpen(false);
  };

  return (
    <div className={styles.NotificationHeader}>
      <div>
        <BellIcon width={16} />
        <span>Notifications</span>
      </div>
      <div>
        <CheckCheckIcon width={16} onClick={markAllAsRead} />
        <ListFilterIcon width={16} />
        <SettingsIcon width={16} />
        <XIcon width={16} onClick={closeNotificationsPane} />
      </div>
    </div>
  );
}

export default NotificationHeader;
