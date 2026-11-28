const CACHE_NAME = "mf-ops-suite-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./manifest.json",
  "./js/01-auth-permissions.js",
  "./js/02-config-dedupe.js",
  "./js/03-storage-sync.js",
  "./js/04-reports-admin.js",
  "./js/05-quotations-builds-service.js",
  "./js/06-quote-builder.js",
  "./js/07-prebuilts-master.js",
  "./js/08-enquiries-init.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;
  if (url.includes("firebaseio.com") || url.includes("script.google.com") || event.request.method !== "GET") {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
