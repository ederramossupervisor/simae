const DB_NAME = 'SIMAE_DB';
const DB_VERSION = 2;
let db;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('visitas')) {
        const store = db.createObjectStore('visitas', { keyPath: 'id' });
        store.createIndex('sync', 'sync', { unique: false });
      }
      if (!db.objectStoreNames.contains('escolas')) {
        db.createObjectStore('escolas', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('itens')) {
        db.createObjectStore('itens', { keyPath: 'id' });
      }
    };
  });
}

async function salvarVisitaOffline(visita) {
  visita.sync = false;
  const tx = db.transaction(['visitas'], 'readwrite');
  const store = tx.objectStore('visitas');
  await store.put(visita);
  return true;
}

async function getVisitasOffline() {
  const tx = db.transaction(['visitas'], 'readonly');
  const store = tx.objectStore('visitas');
  return store.getAll();
}

async function excluirVisitaOffline(id) {
  const tx = db.transaction(['visitas'], 'readwrite');
  const store = tx.objectStore('visitas');
  store.delete(id);
}

async function marcarSincronizada(id) {
  const tx = db.transaction(['visitas'], 'readwrite');
  const store = tx.objectStore('visitas');
  const visita = await store.get(id);
  if (visita) {
    visita.sync = true;
    await store.put(visita);
  }
}