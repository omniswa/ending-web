/** Promise wrapper around IndexedDB, used for binary data (EPUB files, covers). */
import { DB } from "../config.js";

let connection = null;

function open() {
  connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB.name, DB.version);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of Object.values(DB.stores)) {
        if (!db.objectStoreNames.contains(name))
          db.createObjectStore(name, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      connection = null;
      reject(request.error);
    };
  });
  return connection;
}

/** Runs `work(stores)` in one transaction and resolves with its return value once committed. */
async function transact(storeNames, mode, work) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    const stores = Object.fromEntries(
      storeNames.map((name) => [name, transaction.objectStore(name)]),
    );
    let result;
    try {
      result = work(stores);
    } catch (error) {
      transaction.abort();
      reject(error);
      return;
    }
    transaction.oncomplete = () =>
      resolve(result instanceof IDBRequest ? result.result : undefined);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export const dbGet = (store, key) =>
  transact([store], "readonly", (s) => s[store].get(key));
export const dbGetAll = (store) =>
  transact([store], "readonly", (s) => s[store].getAll());

/** Applies several put/delete operations atomically across stores. */
export function dbBatch(operations) {
  const names = [...new Set(operations.map((op) => op.store))];
  return transact(names, "readwrite", (stores) => {
    for (const op of operations) {
      if (op.type === "put") stores[op.store].put(op.value);
      else stores[op.store].delete(op.key);
    }
  });
}
