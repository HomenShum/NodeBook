import React from "react";
import { observer } from "mobx-react-lite";

import { cn } from "@/lib/utils";
import { useViewStore } from "@/app/view/useViewStore";
import NotificationHeader from "@/app/components/Notifications/NotificationHeader";
import NotificationItem from "@/app/components/Notifications/NotificationItem";
import { useNotifications } from "@/app/contexts/NotificationContext";

import styles from "./Notifications.module.css";

export const NotificationPane = observer(function NotificationPane() {
  const viewStore = useViewStore();
  const { notifications } = useNotifications();

  return (
    <div className={cn(styles.NotificationPane, viewStore.notificationPaneOpen ? styles.NotificationPaneActive : "")}>
      <NotificationHeader />
      <div className={styles.NotificationItemsContainer}>
        {notifications.map((notification, idx) => (
          <NotificationItem key={idx} notification={notification} />
        ))}
      </div>
    </div>
  );
});
