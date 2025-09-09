"use client";
import { Lightbulb } from "lucide-react";
import React, { createContext, useCallback, useContext, useState } from "react";

import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/app/components/UIPrimitives/Toast";

type ToastType = {
  id: number;
  title: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  closing?: boolean; // Add this line
  isHint?: boolean;
};

type ToastContextType = {
  addToast: (toast: Omit<ToastType, "id">) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Use a ref to persist toast state across navigations
const toastState = {
  toasts: [] as ToastType[],
  nextId: 0,
};

export const ToastContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastType[]>(toastState.toasts);
  const [nextId, setNextId] = useState(toastState.nextId);

  const addToast = useCallback((toast: Omit<ToastType, "id">) => {
    const id = toastState.nextId;
    const newToasts = [...toastState.toasts, { ...toast, id }];
    toastState.toasts = newToasts;
    toastState.nextId = id + 1;
    setToasts(newToasts);
    setNextId(toastState.nextId);

    const duration = toast.duration || 5000; // Default to 5 seconds
    setTimeout(() => {
      // Trigger the closing animation
      setToasts((prevToasts) => prevToasts.map((t) => (t.id === id ? { ...t, closing: true } : t)));
    }, duration);
  }, []);

  const removeToast = useCallback((id: number) => {
    const newToasts = toastState.toasts.filter((t) => t.id !== id);
    toastState.toasts = newToasts;
    setToasts(newToasts);
  }, []);

  const contextValue = { addToast };

  return (
    <ToastContext.Provider value={contextValue}>
      <ToastProvider>
        {children}
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            duration={toast.duration}
            onOpenChange={(open) => {
              if (!open) {
                setTimeout(() => removeToast(toast.id), 300); // A delayto allow animation to complete
              }
            }}
            className={toast.closing ? "closing" : ""}
          >
            <div>
              {toast.isHint && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "4px",
                  }}
                >
                  <Lightbulb
                    style={{
                      height: "16px",
                      width: "16px",
                      color: "var(--amber-9)",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "var(--font-size-xs)",
                      fontWeight: "500",
                      color: "var(--amber-11)",
                    }}
                  >
                    Hint
                  </span>
                </div>
              )}
              <ToastTitle>{toast.title}</ToastTitle>
              {toast.description && <ToastDescription>{toast.description}</ToastDescription>}
              {toast.action && (
                <ToastAction altText={toast.action.label} onClick={toast.action.onClick}>
                  {toast.action.label}
                </ToastAction>
              )}
            </div>
            <ToastClose />
          </Toast>
        ))}
        <ToastViewport />
      </ToastProvider>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastContextProvider");
  }
  return context;
};
