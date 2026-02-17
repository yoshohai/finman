/**
 * RecordService — business logic for financial records.
 */
const RecordService = (() => {
    async function getAll(includeDeleted = false) {
        let records = await RecordDao.getAll(includeDeleted);
        // Enrich with attachments
        // Note: For large datasets, this N+1 query might be slow. 
        // Ideally we'd fetch all attachments and map them in memory, 
        // but for a personal finance app, this is acceptable for now.
        for (const record of records) {
            record.attachments = await getAttachments(record.id);
        }
        return records;
    }

    async function getById(id) {
        return await RecordDao.getById(id);
    }

    async function save(record) {
        // Ensure tags are persisted
        if (record.tags && record.tags.length) {
            await TagService.ensureTags(record.tags);
        }
        if (record.id) {
            await RecordDao.update(record);
            return record.id;
        } else {
            return await RecordDao.add(record);
        }
    }

    async function remove(id) {
        return await RecordDao.remove(id);
    }

    // Manage attachments
    async function getAttachments(recordId) {
        const attachments = await RecordAttachmentDao.getByRecordId(recordId);
        // Enrich with file info
        const enriched = [];
        for (const att of attachments) {
            const file = await FileDao.getById(att.fileId);
            enriched.push({ ...att, fileName: file ? file.name : '(deleted)' });
        }
        return enriched;
    }

    async function addAttachment(recordId, fileId) {
        return await RecordAttachmentDao.add(recordId, fileId);
    }

    async function removeAttachment(attachmentId) {
        return await RecordAttachmentDao.remove(attachmentId);
    }

    return { getAll, getById, save, remove, getAttachments, addAttachment, removeAttachment };
})();
