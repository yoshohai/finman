/**
 * RecordDao — CRUD for financial records.
 * Soft delete: sets deletedAt timestamp.
 */
const RecordDao = (() => {
    const STORE = 'records';

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

    async function add(record) {
        const db = await DB.getDB();
        const now = new Date().toISOString();
        record.createdAt = now;
        record.modifiedAt = now;
        record.deletedAt = null;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            const req = tx.objectStore(STORE).add(record);
            req.onsuccess = () => resolve(req.result); // returns generated id
            req.onerror = () => reject(req.error);
        });
    }

    async function update(record) {
        const db = await DB.getDB();
        record.modifiedAt = new Date().toISOString();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            const req = tx.objectStore(STORE).put(record);
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
        const record = await getById(id);
        if (!record) return;

        if (record.deletedAt) {
            // Already soft-deleted, so hard delete
            // Also remove attachments
            await RecordAttachmentDao.removeByRecordId(id);
            return hardDelete(id);
        } else {
            // Soft delete
            record.deletedAt = new Date().toISOString();
            return update(record);
        }
    }

    return { getAll, getById, add, update, remove };
})();
