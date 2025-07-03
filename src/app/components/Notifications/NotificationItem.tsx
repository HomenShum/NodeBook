import { AtSignIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useNotifications } from "@/app/contexts/NotificationContext";
import { useSetMainRoot } from "@/app/tree/utils";
import { Notification } from "@/app/util";
import { USER_ROOT_ID_PREFIX } from "@/lib/constants";
import { cn } from "@/lib/utils";

import styles from "./Notifications.module.css";

interface Props {
  notification: Notification;
}

export const NotificationItem = observer(function NotificationItem({ notification }: Props) {
  const graphStore = useGraphStore();
  const setRoot = useSetMainRoot();
  const { markAsRead } = useNotifications();

  // Move loading to useEffect to avoid render-time side effects
  useEffect(() => {
    graphStore.layerManager.lazyLoadWithIds([notification.messageContent.nodeId]);
  }, [graphStore.layerManager, notification.messageContent.nodeId]);

  const userNode = graphStore.nodesById.get(USER_ROOT_ID_PREFIX + notification.messageContent.mentionedById);
  const targetNode = graphStore.nodesById.get(notification.messageContent.nodeId);

  if (!targetNode) return <></>;

  const handleClick = () => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    setRoot(targetNode);
  };

  return (
    <div className={cn(styles.NotificationItem, notification.isRead ? styles.isRead : "")} onClick={handleClick}>
      <div className={styles.NotificationIconContainer}>
        <AtSignIcon />
      </div>
      <div className={styles.NotificationTextContainer}>
        <p>
          {userNode ? userNode.text : "Someone"} <span className={styles.nonHighlightedText}>mentioned you:</span>
        </p>
        <p>•&nbsp;{targetNode.text}</p>
        <p>{notification.createdAt}</p>
      </div>
    </div>
  );
});

export default NotificationItem;
