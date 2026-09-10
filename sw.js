//ServiceWork = Proxy
const CACHE_VERSION = "v1";
const CACHE_NAME = "Meu1WPA";

const ASSETS = ["/", "/index.html", "/app.js", "/app.webmanifest"];

//Listener para Evento install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

//Ativação, limpar versões antigas
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => 
      Promise.all(
        cacheNames
        .filter((name) => name !== CACHE_NAME)
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
