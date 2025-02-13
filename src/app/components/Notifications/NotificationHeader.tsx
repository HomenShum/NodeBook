import React from "react";
import { BellIcon, CheckCheckIcon, ListFilterIcon, SettingsIcon, XIcon } from "lucide-react";

import { useViewStore } from "@/app/view/useViewStore";
import { useNotifications } from "@/app/contexts/NotificationContext";
import { Button } from "@/app/components/UIPrimitives/Button";
import { cn } from "@/lib/utils";
import breadcrumbStyles from "@/app/components/Breadcrumbs/Breadcrumbs.module.css";

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
        <Button
          className={cn(breadcrumbStyles.ShowTooltip, breadcrumbStyles.RightAlign)}
          onClick={markAllAsRead}
          data-tooltip={"Mark all as read"}
        >
          <CheckCheckIcon width={16} />
        </Button>
        <Button
          className={cn(breadcrumbStyles.ShowTooltip, breadcrumbStyles.RightAlign)}
          data-tooltip={"Sort by oldest"}
        >
          <ListFilterIcon width={16} />
        </Button>
        <Button
          className={cn(breadcrumbStyles.ShowTooltip, breadcrumbStyles.RightAlign)}
          data-tooltip={"Notification settings"}
        >
          <SettingsIcon width={16} />
        </Button>
        <Button
          className={cn(breadcrumbStyles.ShowTooltip, breadcrumbStyles.RightAlign)}
          data-tooltip={"Close notifications"}
          onClick={closeNotificationsPane}
        >
          <XIcon width={16} />
        </Button>
      </div>
    </div>
  );
}

export default NotificationHeader;
