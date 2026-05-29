const CACHE = "neoassistence-v4";
const STATIC_CACHE = "neoassistence-static-v4";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then(keys => Promise.all(keys.map(k => {
        if (k !== CACHE && k !== STATIC_CACHE) return caches.delete(k);
      }))),
    ])
  );
});

async function cacheThenReturn(request, res, cacheName) {
  const cloned = res.clone();
  const cache = await caches.open(cacheName);
  cache.put(request, cloned);
  return res;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/models/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => cacheThenReturn(event.request, res, STATIC_CACHE));
      })
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      fetch(event.request)
        .then((res) => cacheThenReturn(event.request, res, STATIC_CACHE))
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((res) => cacheThenReturn(event.request, res, CACHE))
      .catch(() => caches.match(event.request))
  );
});

const ICONS = {
  registro: "/icons/icon-192.png",
  retardo: "/icons/icon-192.png",
  incidencia: "/icons/icon-192.png",
  permiso: "/icons/icon-192.png",
  alerta: "/icons/icon-192.png",
  reporte: "/icons/icon-192.png",
};

const ACTIONS = {
  registro: [{ action: "view", title: "Ver registro" }],
  incidencia: [{ action: "view", title: "Ver incidencia" }],
  permiso: [{ action: "view", title: "Ver permiso" }],
  alerta: [{ action: "dashboard", title: "Dashboard" }],
};

const CLICK_ROUTES = {
  registro: "/kiosko",
  incidencia: "/incidencias",
  permiso: "/permisos",
  alerta: "/dashboard",
  reporte: "/reportes-auto",
};

self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const ntype = data.type || "general";
    const icon = ICONS[ntype] || "/icons/icon-192.png";
    const actions = ACTIONS[ntype] || [];
    const options = {
      body: data.body,
      icon,
      badge: "/icons/icon-192.png",
      vibrate: ntype === "alerta" ? [300, 150, 300, 150, 300] : [200, 100, 200],
      data: { type: ntype, employee: data.employee },
      actions,
      tag: ntype,
      renotify: ntype === "alerta",
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
  } catch {}
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const ndata = event.notification.data || {};
  const ntype = ndata.type || "general";
  const route = CLICK_ROUTES[ntype] || "/kiosko";

  if (event.action === "dashboard") {
    event.waitUntil(clients.openWindow("/dashboard"));
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(route) && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(route);
    })
  );
});
