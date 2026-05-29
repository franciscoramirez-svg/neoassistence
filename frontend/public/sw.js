const CACHE = "neoassistence-v3";
const STATIC_CACHE = "neoassistence-static-v3";

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

self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      vibrate: [200, 100, 200],
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
  } catch {}
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/kiosko"));
});
