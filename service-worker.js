const CACHE_NAME = "ferien-countdown-v2";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.webmanifest"
  "./app-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(FILES_TO_CACHE))
  );

  self.skipWaiting();
});


self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(cacheNames =>
        Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => caches.delete(name))
        )
      )
  );

  self.clients.claim();
});


self.addEventListener("fetch", event => {

  if (event.request.method !== "GET") {
    return;
  }

  const requestURL =
    new URL(event.request.url);

  if (
    requestURL.origin !==
    self.location.origin
  ) {
    return;
  }

  event.respondWith(

    fetch(event.request)

      .then(response => {

        const copy =
          response.clone();

        caches
          .open(CACHE_NAME)
          .then(cache =>
            cache.put(
              event.request,
              copy
            )
          );

        return response;

      })

      .catch(() =>
        caches
          .match(event.request)
          .then(cachedResponse =>
            cachedResponse ||
            caches.match("./index.html")
          )
      )

  );

});
