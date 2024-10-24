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
};

type ToastContextType = {
  addToast: (toast: Omit<ToastType, "id">) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastType[]>([]);
  const [nextId, setNextId] = useState(0);

  const addToast = useCallback((toast: Omit<ToastType, "id">) => {
    const id = nextId;
    setToasts((prevToasts) => [...prevToasts, { ...toast, id }]);
    setNextId((prevId) => prevId + 1);

    const duration = toast.duration || 5000; // Default to 5 seconds
    setTimeout(() => {
      // Trigger the closing animation
      setToasts((prevToasts) =>
        prevToasts.map((t) => (t.id === id ? { ...t, closing: true } : t))
      );
    }, duration);
  }, [nextId]);

  const removeToast = useCallback((id: number) => {
    setToasts((prevToasts) => prevToasts.filter((t) => t.id !== id));
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
