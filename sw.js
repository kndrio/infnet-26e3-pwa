//ServiceWork = Proxy
const CACHE_VERSION = "v3";
const CACHE_NAME = "Meu1WPA";

const ASSETS = [
    "/",
    "/index.html",
    "/style.css",
    "/app.js",
    "/app.webmanifest",
    "/db.js",
    "/icons/icon-72x72.png",
    "/icons/icon-96x96.png",
    "/icons/icon-128x128.png",
    "/icons/icon-144x144.png",
    "/icons/icon-152x152.png",
    "/icons/icon-192x192.png",
    "/icons/icon-384x384.png",
    "/icons/icon-512x512.png",
  ];

//Listener para Evento install
self.addEventListener("install", (event) => {

  self.skipWaiting(); //força o SW a ativar imediatamente, sem esperar o SW antigo sair

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

/**
 * Ativação do ServiceWorker - Limpar cache de versões anteriores seja do app ou do runtime
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => 
      Promise.all(
        cacheNames
        .filter((name) => name !== CACHE_NAME && name!== RUNTIME_CACHE_NAME)
        .map((name) => caches.delete(name))
      )
    )
  );
});

//Listener para evento fetch
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

//Comunicações App / SW via postMessage/MessageChannel