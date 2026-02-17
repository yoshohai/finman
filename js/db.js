/**
 * IndexedDB initialization.
 * Exports: DB.getDB() → Promise<IDBDatabase>
 */
const DB = (() => {
    const DB_NAME = 'FinanceDB';
    const DB_VERSION = 2;
    let dbInstance = null;

    function open() {
        if (dbInstance) return Promise.resolve(dbInstance);
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);

            req.onupgradeneeded = (e) => {
                const db = e.target.result;

                // Records store
                if (!db.objectStoreNames.contains('records')) {
                    const store = db.createObjectStore('records', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('type', 'type', { unique: false });
                    store.createIndex('date', 'date', { unique: false });
                    store.createIndex('deletedAt', 'deletedAt', { unique: false });
                }

                // Tags store
                if (!db.objectStoreNames.contains('tags')) {
                    const store = db.createObjectStore('tags', { keyPath: 'value' });
                }

                // Files store
                if (!db.objectStoreNames.contains('files')) {
                    const store = db.createObjectStore('files', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('deletedAt', 'deletedAt', { unique: false });
                }

                // RecordAttachments store
                if (!db.objectStoreNames.contains('recordAttachments')) {
                    const store = db.createObjectStore('recordAttachments', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('recordId', 'recordId', { unique: false });
                    store.createIndex('fileId', 'fileId', { unique: false });
                }

                // Settings store (filter persistence etc.)
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }

                // Auth store (passcode, fingerprint, etc.)
                if (!db.objectStoreNames.contains('auth')) {
                    db.createObjectStore('auth', { keyPath: 'key' });
                }
            };

            req.onsuccess = (e) => {
                dbInstance = e.target.result;
                resolve(dbInstance);
            };

            req.onerror = (e) => {
                reject(e.target.error);
            };
        });
    }

    return { getDB: open };
})();
