const CACHE_NAME = 'ar-radio-cache-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  // Em desenvolvimento, não cachear scripts/estilos para evitar versão antiga
  // '/styles.css',
  // '/app.js',
  '/config.json',
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