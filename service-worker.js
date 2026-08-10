const CACHE_NAME = "school-v1-cache";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await caches.delete(CACHE_NAME);
      await self.registration.unregister();
    })()
  );
});
