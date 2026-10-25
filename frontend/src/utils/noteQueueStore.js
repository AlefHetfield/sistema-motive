const DATABASE = 'motive-note-outbox-v1';

export function createNoteQueueStore(indexedDB = globalThis.indexedDB) {
  let opening;
  const open = () => {
    if (!indexedDB) return Promise.reject(new Error('O armazenamento persistente não está disponível.'));
    if (!opening) opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('entries', { keyPath: 'id' }).createIndex('userId', 'userId');
      request.onerror = () => { opening = null; reject(request.error); };
      request.onblocked = () => { opening = null; reject(new Error('Feche outras versões do sistema e tente novamente.')); };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); opening = null; };
        resolve(db);
      };
    });
    return opening;
  };
  return {
    async list(userId) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('entries', 'readonly');
        const request = tx.objectStore('entries').index('userId').getAll(userId);
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = tx.onabort = () => reject(tx.error || new Error('Falha ao ler notas pendentes.'));
      });
    },
    async update(id, userId, change) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('entries', 'readwrite', { durability: 'strict' });
        const store = tx.objectStore('entries');
        const request = store.get(id);
        let result, failure;
        request.onsuccess = () => {
          try {
            if (request.result && request.result.userId !== userId) throw new Error('Esta cópia pertence a outra conta.');
            result = change(request.result || null);
            if (result && (result.id !== id || result.userId !== userId)) throw new Error('Cópia local inválida.');
            if (result) store.put(result); else store.delete(id);
          } catch (error) { failure = error; tx.abort(); }
        };
        tx.oncomplete = () => resolve(result);
        tx.onerror = tx.onabort = () => reject(failure || tx.error || new Error('Não foi possível preservar a nota neste navegador.'));
      });
    },
    async close() { if (opening) (await opening).close(); opening = null; },
  };
}
