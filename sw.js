//ServiceWork = Proxy
const CACHE_VERSION = "v10";
const CACHE_NAME = `app-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE_NAME = `runtime-${CACHE_VERSION}`;
const OUTBOX_STORE = "outbox"; //Usado pelo Background Sync

const ASSETS = [
    "/",
    "/index.html",
    "/styles.css",
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

  //Import de Scripts que serão necessários também pelo SW
  importScripts("/cdn/dexie.js", "db.js");

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

/**
 * Estratégias de cache
 * Nem todo recurso deve ser tratado da mesma forma
 * SW lida com as request via URL
 * 
 * 1. App shell (Assets) - Cache de arquivos estáticos do app; Objetivo Velocidade e Disponibilidade.
 *    O cache é feito no evento install do SW, e o cache é limpo no evento activate do SW.
 *    O cache é versionado com CACHE_VERSION, e o nome do cache é app-shell-${CACHE_VERSION}.
 * 
 * 2. Runtime (API) - Cache de respostas de requisições de API (POST/PUT/DELETE) + (JSON, etc)
 *    Arquivos que mudam com frequência, como respostas de requisições HTTP.
 *    Bypass para requisições POST, PUT, DELETE, etc. sem cache.
 *    Se a rede falhar SyncManager (Background Sync) pode ser usado para enviar a requisição quando a rede voltar.
 */

//Listener para evento fetch
self.addEventListener("fetch", (event) => {

  const { request } = event;

  if (request.method !== "GET") {
    return; //Deixa passar requisições POST, PUT, DELETE, etc. sem cache
  }

  const url = new URL(request.url);
  const isAppShellAsset = ASSETS.includes(url.pathname);

  if(isAppShellAsset) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(networkFirst(request));
  }

});

/**
 * Resposta a estratégia de cache: AppShell
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
}

/**
 * Resposta a estratégia de cache: Runtime(API)
 */
async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE_NAME);
  try{
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if(cached) return cached; //Sem rede: devolve a última versão;
    throw err; //Não tem rede nem cache: propaga o erro.
  }
}

/*
* Comunicações App / SW via postMessage/MessageChannel
* SW não tem acesso direto ao DOM / 
* Forma de comunicação entre o SW e o app é via postMessage/MessageChannel
*/
self.addEventListener("message", (event) => {
      console.log("Mensagem recebida do app:", event);
  const { action } = event.data || {};

  if(action === "skipWaiting") {
    self.skipWaiting();
  }

  //Checar versão do cache
  if(action === "checkVersion"){
   event.ports[0]?.postMessage({ version: CACHE_VERSION }); 
   return;
  }

  //Limpar cache de runtime
  if(action === "clearRuntimeCache") {
    caches.open(RUNTIME_CACHE_NAME).then(async (cache)  => {
      const keys = await cache.keys();
      await Promise.all(keys.map((key) => cache.delete(key)));
      event.ports[0]?.postMessage({ cleared: keys.length });
    });
  }

});


/**
 * Background Sync - OUTBOX QUANDO OFFLINE
 **/

self.addEventListener("sync", (event) => {
  if(event.tag == "sync-notes"){
    event.waitUntil(syncOutbox());
  }
})

async function syncOutbox() {
  const pending = await outboxGetAll();

  for (const item of pending){
    try {
      const response = await fetch("https://jsonplaceholder.typicode.com/posts", {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
      });

      if(response.ok){
        await outboxRemove(item.id);
        await notifyClients({ type: "sync-success", noteId: item.payload.id});
        await notifyTaskSynced(item.payload)
      }
      
    } catch (err) {
      break;
    }
  }
}

async function notifyClients(message) {
  const clients = await self.clients.matchAll();
  clients.forEach ((client) => client.postMessage(message));
}

/**
 * Notificações - Lidar com as push notifications
 */

async function notifyTaskSynced(payload) {
  try{
    await self.registration.showNotification("Feed atualizado", {
      body: `"${payload.title}" foi sincronizado com sucesso.`,
      icon: "icons/icon-192x192.png",
      badge: "icons/icon-72x72.png",
      tag: `sync-${payload.id}`,
    })
  }catch (err) {
    //Sem permissão ou navegadopr sem suporte
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({type: "window'"}).then((clientsList) => {
      if (clientsList.length > 0) {
        return clientsList[0].focus();
      }
      return self.clients.openWindow("/");
    })
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "Nova notificação", body: "Você tem uma atualização."};

  try{
    if(event.data) data = event.data.json();
  } catch (err) {
    if(event.data) data.body = event.data.text();
  }


  event.waitUntil(
    self.registration.showNotification(data.title || "Notificação" , {
      body: data.body,
      icon: "icons/icon-192x192.png",
      badge: "icons/icon-72x72.png",      
    })
  );
});