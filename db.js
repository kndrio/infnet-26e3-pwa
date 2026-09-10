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
