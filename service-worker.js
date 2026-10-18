// Bump this version whenever the offline app shell changes (HTML/CSS/JS).
const VERSION = "v4";
const CACHE_PREFIX = `ferien-countdown:${self.registration.scope}:`;
const CACHE_NAME = CACHE_PREFIX + VERSION;
const APP_SHELL = [
  "./index.html",
  "./style.css",
  "./script.js",
  "./pwa-update.js",
  "./manifest.webmanifest",
  "./app-icon.png"
];
const INDEX_URL = new URL("./index.html", self.registration.scope).href;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Bypass the HTTP cache, including Safari's cached app shell.
    await cache.addAll(APP_SHELL.map(path =>
      new Request(new URL(path, self.registration.scope), { cache: "reload" })
    ));
    // A failed/incomplete download leaves the previous worker active.
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name =>
      (name.startsWith(CACHE_PREFIX) || /^ferien-countdown-v\d+$/.test(name)) &&
      name !== CACHE_NAME
    ).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin ||
      !url.href.startsWith(self.registration.scope)) return;

  const isNavigation = request.mode === "navigate";
  if (isNavigation && url.pathname !== new URL(self.registration.scope).pathname &&
      url.pathname !== new URL(INDEX_URL).pathname) return;
  const isAsset = ["style", "script", "image", "manifest"].includes(request.destination);
  if (!isNavigation && !isAsset) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = isNavigation ? INDEX_URL : request;
    const controller = new AbortController();
    // A stalled connection must not prevent an offline start indefinitely.
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(request, {
        cache: "no-cache",
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      // Never replace a working shell with a redirect/login/error page.
      if (!response.redirected && response.type !== "opaque") {
        try {
          await cache.put(cacheKey, response.clone());
        } catch (error) {
          // Storage pressure must not break an otherwise successful request.
          console.warn("Offline cache could not be updated", error);
        }
      }
      return response;
    } catch (error) {
      const cached = await cache.match(cacheKey);
      // Only navigations get HTML; a missing script must never receive HTML.
      return cached || Response.error();
    } finally {
      clearTimeout(timeout);
    }
  })());
});
