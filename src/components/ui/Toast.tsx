"use client";

import { useEffect, useState } from "react";
import type { Toast, ToastType } from "./ToastProvider";

const variants: Record<ToastType, { container: string; iconLabel: string; icon: string }> = {
  success: {
    container: "border-emerald-200 bg-emerald-50 text-emerald-900",
    iconLabel: "Succès",
    icon: "✓",
  },
  error: {
    container: "border-red-200 bg-red-50 text-red-900",
    iconLabel: "Erreur",
    icon: "✕",
  },
  info: {
    container: "border-brand bg-brand-light text-ink",
    iconLabel: "Information",
    icon: "⚠",
  },
};

export function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 10);
    const hideTimer = setTimeout(() => setVisible(false), toast.duration - 300);
    const removeTimer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      clearTimeout(removeTimer);
    };
  }, [toast.id, toast.duration, onDismiss]);

  function dismiss() {
    setVisible(false);
    setTimeout(() => onDismiss(toast.id), 300);
  }

  const v = variants[toast.type];

  return (
    <div
      role="alert"
      className={[
        "flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg",
        "transition-all duration-300",
        v.container,
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
      ].join(" ")}
    >
      <span aria-label={v.iconLabel} className="mt-0.5 shrink-0 text-base font-bold leading-none">
        {v.icon}
      </span>
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fermer cette notification"
        className="shrink-0 rounded-md p-0.5 opacity-60 transition hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
      >
        ✕
      </button>
    </div>
  );
}
