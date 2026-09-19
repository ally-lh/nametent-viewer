// Custom character uploads for the history, kept in IndexedDB (they are far
// too big for localStorage). Each image is stored once under a stable id
// that history entries reference; nothing here is mutated after storage.
const DB_NAME = 'tabletent';
const DB_VERSION = 1;
const STORE = 'images';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('this browser has no IndexedDB')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('could not open the image store'));
    req.onblocked = () => reject(new Error('the image store is blocked by another tab'));
  });
}

function run(mode, op) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = op(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(req.result); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error('image store transaction failed')); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('image store transaction aborted')); };
  }));
}

/** Store (or overwrite) an image blob under `id`. */
export const putImage = (id, blob) => run('readwrite', store => store.put(blob, id));

/** The stored blob, or null when there is none. */
export const getImage = id => run('readonly', store => store.get(id)).then(v => v ?? null);

export const deleteImage = id => run('readwrite', store => store.delete(id));
