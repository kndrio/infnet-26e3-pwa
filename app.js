/**
 * Parte 1 - Verifica se o navegador suporta Service Worker e registra o arquivo sw.js
 */

const status = document.getElementById("status");
let swRegistration;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("sw.js")
    .then((registration) => {
      swRegistration = registration;
      status.textContent = "Service Worker registrado com sucesso!";
    })
    .catch((err) => {
      status.textContent = "Erro ao registrar no navegador:" + err;
    });
} else {
  status.textContent = "Este navegador não suporta Service Worker";
}

/**
 * Background Sync - OUTBOX QUANDO OFFLINE
 **/

if("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if(event.data?.type == "sync-success"){
      updateSyncBadge();
    }
  }) 
}

/**
 * Parte 2 - Lida com o evento de instalação do Service Worker
 */

const installButton = document.getElementById("installButton");
let deferredPrompt; //guardar o evento para exibir o prompt de instalação mais tarde


window.addEventListener("beforeinstallprompt", (event) => {

  event.preventDefault(); //impede que o prompt seja exibido automaticamente
  deferredPrompt = event; //guarda o evento para exibir o prompt mais tarde
  installButton.hidden = false; //exibe o botão de instalação

});

installButton.addEventListener("click", async () => { 

  if(!deferredPrompt) return; //verifica se o evento foi armazenado
  deferredPrompt.prompt(); //exibe o prompt de instalação

  const { outcome } = await deferredPrompt.userChoice; //aguarda a escolha do usuário
  console.log(`Usuário ${outcome} a instalação do PWA`); //exibe o resultado no console

  deferredPrompt = null; //limpa o evento armazenado
  installButton.hidden = true; //oculta o botão de instalação

});

/**
 * Parte 3 - Conectar o formulário e a lista as funções do db.js
 */

//Render
async function renderNotes() {
  const notes = await getAllNotes();

  document.getElementById("notesList").innerHTML = ""; //limpa a lista antes de renderizar

  notes.forEach((note) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <h3>${note.title} <small> - ${new Date(note.createdAt).toLocaleString()}</small></h3>
      <p>${note.content}</p>
      <div class="actions">
        <button data-action="edit" data-id="${note.id}">Editar</button>
        <button data-action="delete" data-id="${note.id}">Excluir</button>
      </div>
    `;
    document.getElementById("notesList").appendChild(li);
  });
  
}

//Save
noteForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = document.getElementById("noteTitle").value;
  const content = document.getElementById("noteContent").value.trim();
  if(!title) return;

  //ADICIONA NO INDEXEDDB
  const noteId = await addNote(title, content);

  await queueForSync({id: noteId, title, content})
  
  noteForm.reset();
  await renderNotes();


});

//Edit/remove
notesList.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if(!button) return;

  const id = Number(button.dataset.id);

  if (button.dataset.action === "delete") {
    await deleteNote(parseInt(id));
    await renderNotes();
  }

  if (button.dataset.action === "edit") {
    const novoTitulo = prompt("Digite o novo título da nota:");
    if(novoTitulo) {
      await updateNote(parseInt(id), { title: novoTitulo });
      await renderNotes();
    }

  }
});



//Carrega as notas salvas
renderNotes();


/**
 * Botões de debug do ChannelMessage  
 * Lida com os events do DOM 
 *  
 */

//Checar versão do cache
const checkVersionButton = document.getElementById("checkVersionButton");
if(checkVersionButton) {
  checkVersionButton.addEventListener("click", async () => {
    if(!navigator.serviceWorker.controller) {
      console.log("Nenhum SW ativo para enviar a mensagem");
      return;
    };
    
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => {
      console.log(`Versão do cache (SW): ${event.data.version}`);
    };

    navigator.serviceWorker.controller.postMessage(
      { action: "checkVersion" },
      [channel.port2]
    );

  });
}

//Limpar cache de runtime
const clearCacheButton = document.getElementById("clearCacheButton");
if(clearCacheButton) {
  clearCacheButton.addEventListener("click", async () => {
    if(!navigator.serviceWorker.controller) {
      console.log("Nenhum SW ativo para enviar a mensagem");
      return;
    };
    
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => {
      console.log(`Cache de runtime limpo: ${event.data.cleared} item(ns) removido(s).`);
    };

    navigator.serviceWorker.controller.postMessage(
      { action: "clearRuntimeCache" },
      [channel.port2]
    );

  });
}

/* 
* Background Sync - status de conexão e fila de sincronização 
**/

async function queueForSync(payload) {
  await outboxAdd(payload);
  updateSyncBadge();

  if(navigator.onLine){
    await trySync();
  }else {
    console.log(swRegistration);
    if(swRegistration && "sync" in swRegistration) {
      try {
        await swRegistration.sync.register("sync-notes")
      } catch (err) {
        console.warn("Background Sync indisponível.")
      }
    }
  }
}

async function trySync() {
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
      }
      
    } catch (err) {
      break;
    }
  }
  updateSyncBadge();
}

window.addEventListener("online", () => {
  setOfflineBanner(false);
  trySync();
})

window.addEventListener("offline", () => {
  setOfflineBanner(true);
})

async function updateSyncBadge() {
  const pending = await outboxGetAll;
  const badge = document.getElementById("syncBadge");

  if(!badge) return;

  if(pending.length === 0 ){
    badge.hidden = true;
  } else{
    badge.hidden = false;
    badge.textContent = `${pending.length} nota(s) aguardando sincronização.`
  }
}

function setOfflineBanner(isOffline){
  console.log(isOffline);
  const banner = document.getElementById("offlineBanner");
  if (!banner) return;
  banner.hidden = !isOffline;
}

console.log(navigator);
setOfflineBanner(!navigator.onLine);
updateSyncBadge();