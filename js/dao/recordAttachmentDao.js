/**
 * RecordAttachmentDao — junction table linking records to files.
 */
const RecordAttachmentDao = (() => {
    const STORE = 'recordAttachments';

    async function getAll() {
        const db = await DB.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function getByRecordId(recordId) {
        const db = await DB.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            const idx = tx.objectStore(STORE).index('recordId');
            const req = idx.getAll(recordId);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function getByFileId(fileId) {
        const db = await DB.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            // Assuming 'fileId' index exists as per db.js
            const idx = tx.objectStore(STORE).index('fileId');
            const req = idx.getAll(fileId);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function add(recordId, fileId) {
        const db = await DB.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            const req = tx.objectStore(STORE).add({
                recordId,
                fileId,
                createdAt: new Date().toISOString()
            });
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function remove(id) {
        const db = await DB.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            const req = tx.objectStore(STORE).delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async function removeByRecordId(recordId) {
        const attachments = await getByRecordId(recordId);
        const db = await DB.getDB();
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        attachments.forEach(a => store.delete(a.id));
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    return { getAll, getByRecordId, getByFileId, add, remove, removeByRecordId };
})();
