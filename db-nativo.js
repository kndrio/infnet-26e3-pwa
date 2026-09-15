/**
 * db-nativo.js — Mesma interface do db.js (addNote, getAllNotes, updateNote,
 * deleteNote), mas implementada com a API NATIVA do IndexedDB, sem Dexie.
 *
 * Para comparar com a versão de biblioteca: troque só a tag <script> no
 * index.html de "db.js" para "db-nativo.js" — o app.js não muda em nada,
 * porque as funções têm o mesmo nome e a mesma assinatura.
 *
 * FALE ISSO EM AULA: "Reparem que aqui embrulhamos tudo em Promises na mão
 * — o Dexie faz isso por baixo dos panos. É o mesmo resultado, só que
 * escrevendo o 'motor' à mão em vez de importar ele pronto."
 */

const DB_NAME = "NotasPWA";
const DB_VERSION = 10;
const STORE_NAME = "notes";

// PASSO 1 — Abrir (ou criar) o banco.
// indexedDB.open() é baseado em eventos (não retorna Promise nativamente),
// então embrulhamos numa Promise aqui — o resto do arquivo trabalha só
// com Promises, pra manter a mesma "cara" da versão com Dexie.
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // Só dispara quando o banco ainda não existe, ou quando DB_VERSION
    // mudou. É AQUI que se define o "schema" — o equivalente ao
    // db.version(1).stores({...}) da versão com Dexie.
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("title", "title", { unique: false });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

// Guarda a conexão em cache para não reabrir o banco a cada operação.
let dbPromise = openDatabase();

// ===== NÍVEL ESSENCIAL: criar e listar =====

// PASSO 2 — Criar uma nota nova
async function addNote(title, content) {
  const database = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.add({
      title,
      content,
      createdAt: new Date().toISOString(),
    });

    request.onsuccess = () => resolve(request.result); // id gerado
    request.onerror = () => reject(request.error);
  });
}

// PASSO 3 — Listar todas as notas
async function getAllNotes() {
  const database = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ===== NÍVEL INTERMEDIÁRIO: atualizar e remover =====

// PASSO 4 — Atualizar uma nota existente
// IndexedDB nativo não tem "update parcial": é preciso LER o registro,
// mesclar as mudanças na mão, e regravar inteiro com put(). Comparem
// com o db.notes.update(id, changes) — uma linha só — da versão Dexie.
// É exatamente esse tipo de verbosidade que a biblioteca poupa.
async function updateNote(id, changes) {
  const database = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const existing = getRequest.result;
      if (!existing) return resolve(undefined); // nota não encontrada
      const updated = { ...existing, ...changes };
      const putRequest = store.put(updated);
      putRequest.onsuccess = () => resolve(putRequest.result);
      putRequest.onerror = () => reject(putRequest.error);
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

// PASSO 5 — Remover uma nota
async function deleteNote(id) {
  const database = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
