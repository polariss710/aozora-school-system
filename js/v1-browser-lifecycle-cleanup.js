(function installV1BrowserLifecycleCleanup() {
  const V1_SCOPE_PATH = "/aozora-school-system-v1/";
  const V1_CACHE_NAME = "school-v1-cache";

  async function cleanupV1BrowserLifecycle() {
    const expectedScope = new URL(V1_SCOPE_PATH, window.location.origin).href;

    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration(expectedScope);
      if (registration?.scope === expectedScope) {
        try {
          await registration.update();
        } catch (_error) {
          // Continue with the exact unregister/cache cleanup when update is unavailable.
        }
        await registration.unregister();
      }
    }

    if ("caches" in window) {
      await window.caches.delete(V1_CACHE_NAME);
    }
  }

  if (window.location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
      cleanupV1BrowserLifecycle().catch(() => {
        // Fail closed: never broaden cleanup to other scopes, caches, or storage.
      });
    });
  }
})();
