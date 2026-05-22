"use client";
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type Toast = { id: number; message: string; type: "success" | "error" | "info" };
type ToastCtx = { toast: (msg: string, type?: "success" | "error" | "info") => void };

const ToastContext = createContext<ToastCtx>({ toast: () => {} });
export const useToast = () => useContext(ToastContext);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const colors = { success: "#9cffb5", error: "#ff8c9e", info: "#5ef2ff" };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              padding: "12px 18px",
              borderRadius: 10,
              background: "rgba(13,21,38,0.95)",
              border: `1px solid ${colors[t.type]}`,
              color: colors[t.type],
              fontSize: 13,
              maxWidth: 300,
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
              animation: "slideIn 0.3s ease",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
      <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </ToastContext.Provider>
  );
}
