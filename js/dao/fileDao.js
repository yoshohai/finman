/**
 * FileDao — CRUD for file objects (blobs stored in IndexedDB).
 * Soft delete: sets deletedAt timestamp.
 */
const FileDao = (() => {
    const STORE = 'files';

    async function getAll(includeDeleted = false) {
        const db = await DB.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).getAll();
            req.onsuccess = () => {
                let results = req.result;
                if (!includeDeleted) {
                    results = results.filter(r => !r.deletedAt);
                }
                resolve(results);
            };
            req.onerror = () => reject(req.error);
        });
    }

    async function getById(id) {
        const db = await DB.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function add(file) {
        const db = await DB.getDB();
        file.createdAt = new Date().toISOString();
        file.deletedAt = null;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            const req = tx.objectStore(STORE).add(file);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function update(file) {
        const db = await DB.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            const req = tx.objectStore(STORE).put(file);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async function hardDelete(id) {
        const db = await DB.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            const req = tx.objectStore(STORE).delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async function remove(id) {
        const file = await getById(id);
        if (!file) return;

        if (file.deletedAt) {
            return hardDelete(id);
        } else {
            file.deletedAt = new Date().toISOString();
            return update(file);
        }
    }

    return { getAll, getById, add, update, remove };
})();
