const CACHE = "neoassistence-v1";
const STATIC_CACHE = "neoassistence-static-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // API requests - network only, no cache
  if (url.pathname.startsWith("/api/")) return;

  // Model files - cache first
  if (url.pathname.startsWith("/models/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetched = fetch(event.request).then((res) => {
          caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, res.clone()));
          return res;
        });
        return cached || fetched;
      })
    );
    return;
  }

  // Next.js static assets - cache first
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetched = fetch(event.request).then((res) => {
          caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, res.clone()));
          return res;
        });
        return cached || fetched;
      })
    );
    return;
  }

  // Navigation & other pages - network first, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        caches.open(CACHE).then((cache) => cache.put(event.request, res.clone()));
        return res;
      })
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
