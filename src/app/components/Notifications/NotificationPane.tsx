import React from "react";
import { observer } from "mobx-react-lite";

import { cn } from "@/lib/utils";
import { useViewStore } from "@/app/view/useViewStore";
import NotificationHeader from "@/app/components/Notifications/NotificationHeader";
import NotificationItem, { Item } from "@/app/components/Notifications/NotificationItem";

import styles from "./Notifications.module.css";

export const NotificationPane = observer(function NotificationPane() {
  const viewStore = useViewStore();

  return (
    <div className={cn(styles.NotificationPane, viewStore.notificationPaneOpen ? styles.NotificationPaneActive : "")}>
      <NotificationHeader/>
      <div className={styles.NotificationItemsContainer}>
        {items.map((item,idx) => <NotificationItem key={idx} item={item}/>)}
      </div>
    </div>
  );
});

const items: Item[] = [{
  type: "mention",
  dateText: "10 min ago",
  body: <>Check if designs are mobile friendly <b>@Jacob</b></>,
  title: <><b>Cody</b> mentioned you:</>
},{
  type: "reminder",
  dateText: "Yesterday",
  body: <>Change engine Oil <b>Dec 6, 09:30 AM</b></>
}];