/**
 * db.js - Camada de dados via IndexedDB com Wrapper Dexie.js
 */

//Iniciar/criar o DB
const db = new Dexie("NotasPWA");

//Definir o schema 
db.version(1).stores({
    notes: '++id, title, content'
});

//Função de criar nota
async function addNote(title, content) {
    return db.notes.add({
        title, 
        content,
        createdAt: new Date().toISOString(),
    });
}

//Função de listar todas as notas
async function getAllNotes() {
    return db.notes.toArray();
}

//Função de atualizar nota
async function updateNote(id, changes) {
    return db.notes.update(id, changes);
}

//Função de deletar nota
async function deleteNote(id) {
    return db.notes.delete(id);
}


/**
 * Background Sync - OUTBOX QUANDO OFFLINE
 **/

db.version(2).stores({
    notes: '++id, title, content',
    outbox: '++id, payload, createdAt', //Fila (outbox) pendentes de sincronização
})

//Outbox Lista de request após o retorno de Network
async function outboxAdd(payload){
    return db.outbox.add(
        {payload, createdAt: new Date().toISOString()}
    )
}

async function outboxGetAll() {
    return db.outbox.toArray();
}

async function outboxRemove(id) {
    return db.outbox.delete(id);
}