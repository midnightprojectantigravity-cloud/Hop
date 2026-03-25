const CACHE_VERSION = 'hop-shell-v1';
const RUNTIME_CACHE = 'hop-runtime-v1';

const getScopeBaseUrl = () => {
  const scope = self.registration?.scope || self.location.origin + '/';
  const url = new URL(scope);
  return url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
};

const toScopedPath = (relativePath) => new URL(relativePath, self.registration?.scope || self.location.origin).toString();

const getPrecacheUrls = () => {
  const basePath = getScopeBaseUrl();
  const scopeOrigin = self.location.origin;
  return [
    `${scopeOrigin}${basePath}`,
    `${scopeOrigin}${basePath}index.html`,
    `${scopeOrigin}${basePath}manifest.webmanifest`,
    `${scopeOrigin}${basePath}assets/manifest.json`,
    `${scopeOrigin}${basePath}vite.svg`,
    `${scopeOrigin}${basePath}pwa/icon-192.svg`,
    `${scopeOrigin}${basePath}pwa/icon-512.svg`,
  ];
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(getPrecacheUrls())).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== CACHE_VERSION && key !== RUNTIME_CACHE)
        .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

const isCacheableRequest = (request) => (
  request.method === 'GET'
  && new URL(request.url).origin === self.location.origin
);

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!isCacheableRequest(request)) return;

  const requestUrl = new URL(request.url);
  const basePath = getScopeBaseUrl();
  const isNavigation = request.mode === 'navigate';
  const isScopedAsset = requestUrl.pathname.startsWith(basePath);

  if (!isScopedAsset) return;

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(RUNTIME_CACHE);
          const cachedNavigation = await cache.match(request);
          if (cachedNavigation) return cachedNavigation;
          return caches.match(toScopedPath('./index.html'));
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
