/**
 * Parte 1 - Verifica se o navegador suporta Service Worker e registra o arquivo sw.js
 */

const status = document.getElementById("status");

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("sw.js")
    .then(() => {
      status.textContent = "Service Worker registrado com sucesso!";
    })
    .catch((err) => {
      status.textContent = "Erro ao registrar no navegador:" + err;
    });
} else {
  status.textContent = "Este navegador não suporta Service Worker";
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

  await addNote(title, content);
  noteForm.reset();
  await renderNotes();

  noteForm.reset();
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