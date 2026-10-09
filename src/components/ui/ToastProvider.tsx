"use client";

import { createContext, useCallback, useState } from "react";
import { ToastItem } from "./Toast";

export type ToastType = "success" | "error" | "info";
export type Toast = { id: string; message: string; type: ToastType; duration: number };

export type ToastContextValue = {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", duration = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => {
        const next = [...prev, { id, message, type, duration }];
        return next.length > 3 ? next.slice(-3) : next;
      });
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        aria-label="Notifications"
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-col gap-2 p-4 sm:bottom-4 sm:left-auto sm:right-4 sm:w-80"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
