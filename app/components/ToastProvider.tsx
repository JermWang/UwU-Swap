"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastKind = "success" | "error" | "info";

type ToastItem = {
  id: string;
  message: string;
  kind: ToastKind;
};

type ToastFn = (input: { message: string; kind?: ToastKind }) => void;

const ToastContext = createContext<ToastFn | null>(null);

function makeId(): string {
  const c: any = globalThis as any;
  const uuid = c?.crypto?.randomUUID;
  if (typeof uuid === "function") return uuid.call(c.crypto);
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback<ToastFn>((input) => {
    const id = makeId();
    const kind: ToastKind = input.kind ?? "info";
    const message = String(input.message ?? "").trim();
    if (!message) return;

    setToasts((prev) => [...prev, { id, kind, message }]);

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toastViewport" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast${t.kind[0].toUpperCase()}${t.kind.slice(1)}`}>
            <div className="toastMessage">{t.message}</div>
            <button className="toastClose" type="button" onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastFn {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return () => {};
  }
  return ctx;
}
