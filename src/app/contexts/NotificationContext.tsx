import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { NotificationManager, Notification } from "@/app/util";

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notificationManager = useMemo(() => new NotificationManager(), []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    async function loadNotifications() {
      const data = await notificationManager.fetchNotifications();
      setNotifications(data);
    }

    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [notificationManager]);

  async function markAsRead(id: string) {
    await notificationManager.markAsRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  }

  async function markAllAsRead() {
    await notificationManager.markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
