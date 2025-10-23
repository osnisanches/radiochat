const CACHE_NAME = 'ar-radio-cache-v3';
const APP_SHELL = [
  '/',
  '/index.html',
  // Em desenvolvimento, não cachear scripts/estilos para evitar versão antiga
  // '/styles.css',
  // '/app.js',
  // Removido '/config.json' do pré-cache para evitar stale
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Não intercepta mídia/streams/iframes
  const isMedia = request.destination === 'audio' || request.destination === 'video' || request.destination === 'iframe';
  if (isMedia) return;

  // Config.json: network-first com fallback ao cache para offline
  const isConfig = url.origin === self.location.origin && url.pathname.endsWith('/config.json');
  if (isConfig) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(new Request(request, { cache: 'reload' }));
          const clone = fresh.clone();
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, clone);
          return fresh;
        } catch (err) {
          const cached = await caches.match(request);
          if (cached) return cached;
          throw err;
        }
      })()
    );
    return;
  }

  // Navegação: network falling back to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Scripts e estilos: network-first (não adiciona ao cache para dev)
  const isScriptOrStyle = request.destination === 'script' || request.destination === 'style';
  if (isScriptOrStyle) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Demais assets: cache first, falling back to network
  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request).then((resp) => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return resp;
        }).catch(() => cached)
      );
    })
  );
});