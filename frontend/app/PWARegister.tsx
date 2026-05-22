"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://192.168.1.85:8000/api";

export default function PWARegister() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
      setSupported("PushManager" in window);
      checkSubscription();
    }
  }, []);

  async function checkSubscription() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    } catch {}
  }

  async function subscribe() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: "BI7DZpRUZrHeGp68gU21BuZmQzhlbVh15zfixwq87qosOao4Q6-svUAsmqhqRQbkuHrDybEFhUdMfQoNKY99Nes",
      });
      const user = JSON.parse(localStorage.getItem("neoassistence_user") || "{}");
      await fetch(`${API}/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: sub.toJSON().keys || {},
          employee_id: user.id || "",
          employee_name: user.name || "",
        }),
      });
      setSubscribed(true);
    } catch (e) {
      console.error("Push subscribe error:", e);
    }
  }

  async function unsubscribe() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(`${API}/push/unsubscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
        setSubscribed(false);
      }
    } catch {}
  }

  if (!supported) return null;

  return (
    <div style={{ position: "fixed", bottom: 8, right: 8, zIndex: 999 }}>
      <button
        onClick={subscribed ? unsubscribe : subscribe}
        style={{
          padding: "6px 10px",
          borderRadius: 8,
          border: subscribed ? "1px solid rgba(94,242,255,0.3)" : "1px solid rgba(255,204,94,0.3)",
          background: subscribed ? "rgba(94,242,255,0.1)" : "rgba(255,204,94,0.1)",
          color: subscribed ? "#5ef2ff" : "#ffcc5e",
          fontSize: 11,
          cursor: "pointer",
        }}
      >
        {subscribed ? "Notif: ON" : "Notif: OFF"}
      </button>
    </div>
  );
}
