/**
 * TagDao — CRUD for tags (used for autocomplete).
 * Tags are keyed by 'value' (the tag string).
 */
const TagDao = (() => {
    const STORE = 'tags';

    async function getAll() {
        const db = await DB.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function add(value) {
        const db = await DB.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            const req = tx.objectStore(STORE).put({ value, createdAt: new Date().toISOString() });
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async function remove(value) {
        const db = await DB.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            const req = tx.objectStore(STORE).delete(value);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    return { getAll, add, remove };
})();
