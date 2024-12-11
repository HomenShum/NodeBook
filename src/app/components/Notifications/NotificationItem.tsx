import React from "react";
import { AlarmClockIcon, AtSignIcon, LucideIcon } from "lucide-react";

import styles from "./Notifications.module.css";

export type Item = {
  type: "mention" | "reminder",
  dateText: string,
  body: any,
  title?:any
}
interface Props {
  item: Item
}

function NotificationItem({item}: Props) {
  return (
    <div className={styles.NotificationItem}>
        <div className={styles.NotificationIconContainer}>
          {item.type === "reminder" ? <AlarmClockIcon/> : <AtSignIcon/>}
        </div>
        <div className={styles.NotificationTextContainer}>
          {item.title && <p>{item.title}</p>}
          <p>•&nbsp;{item.body}</p>
          <p>{item.dateText}</p>
        </div>
    </div>
  );
}

export default NotificationItem;