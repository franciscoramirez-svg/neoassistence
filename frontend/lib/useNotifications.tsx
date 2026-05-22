"use client";

import { useEffect, useState, useRef } from "react";
import { apiRequest } from "@/lib/api";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  created_at: string;
};

const notificationIcons: Record<string, string> = {
  info: "ℹ️",
  success: "✅",
  warning: "⚠️",
  error: "❌",
};

const notificationColors: Record<string, string> = {
  info: "#5ef2ff",
  success: "#9cffb5",
  warning: "#ff8c9e",
  error: "#ff5555",
};

function NotificationBell({ notifications, onMarkRead }: { notifications: Notification[]; onMarkRead: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const unread = notifications.filter(n => !n.read);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <div ref={ref} style={{position: "relative"}}>
      <button 
        onClick={() => setOpen(!open)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          position: "relative", padding: "8px",
        }}
      >
        <span style={{fontSize: 24}}>🔔</span>
        {unread.length > 0 && (
          <span style={{
            position: "absolute", top: 0, right: 0,
            background: "#ff8c9e", color: "white",
            borderRadius: "50%", width: 18, height: 18,
            fontSize: 11, fontWeight: "bold",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {unread.length}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "100%", right: 0,
          width: 320, maxHeight: 400, overflow: "auto",
          background: "#0a1526", borderRadius: 12,
          border: "1px solid rgba(94,242,255,0.2)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
          zIndex: 1000,
        }}>
          <div style={{padding: 12, borderBottom: "1px solid rgba(94,242,255,0.1)"}}>
            <h3 style={{margin: 0, color: "#5ef2ff"}}>Notificaciones</h3>
          </div>
          
          {notifications.length === 0 ? (
            <p style={{padding: 20, textAlign: "center", color: "#9bb4ca"}}>Sin notificaciones</p>
          ) : (
            notifications.map(n => (
              <div 
                key={n.id}
                onClick={() => onMarkRead(n.id)}
                style={{
                  padding: 12, borderBottom: "1px solid rgba(94,242,255,0.1)",
                  background: n.read ? "transparent" : "rgba(94,242,255,0.05)",
                  cursor: "pointer",
                }}
              >
                <div style={{display: "flex", alignItems: "center", gap: 8}}>
                  <span>{notificationIcons[n.type]}</span>
                  <span style={{color: notificationColors[n.type], fontWeight: "bold", fontSize: 13}}>{n.title}</span>
                </div>
                <p style={{margin: "4px 0 0", color: "#9bb4ca", fontSize: 12}}>{n.message}</p>
                <p style={{margin: "4px 0 0", color: "#555", fontSize: 10}}>
                  {new Date(n.created_at).toLocaleString("es-MX")}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [permission, setPermission] = useState<"default" | "granted" | "denied">("default");

  useEffect(() => {
    if (!("Notification" in window)) return;
    setPermission(Notification.permission as any);
  }, []);

  useEffect(() => {
    if (!userId) return;
    apiRequest<{ notifications: Notification[] }>("/notifications")
      .then(r => setNotifications(r.notifications || []))
      .catch(() => {});
  }, [userId]);

  const requestPermission = async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setPermission(perm as any);
  };

  const markRead = async (id: string) => {
    await apiRequest("/notifications/read", {
      method: "POST",
      body: JSON.stringify({ id }),
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const addNotification = (notification: Omit<Notification, "id" | "read" | "created_at">) => {
    const newNotif: Notification = {
      ...notification,
      id: Date.now().toString(),
      read: false,
      created_at: new Date().toISOString(),
    };
    setNotifications(prev => [newNotif, ...prev]);
    
    if (permission === "granted" && "Notification" in window) {
      new Notification(notification.title, {
        body: notification.message,
        icon: "/favicon.ico",
      });
    }
  };

  return {
    notifications,
    permission,
    requestPermission,
    markRead,
    addNotification,
    NotificationBell: () => <NotificationBell notifications={notifications} onMarkRead={markRead} />,
  };
}