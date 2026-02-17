/**
 * FileService — business logic for file management.
 */
const FileService = (() => {
    async function getAll(includeDeleted = false) {
        return await FileDao.getAll(includeDeleted);
    }

    async function getById(id) {
        return await FileDao.getById(id);
    }

    async function save(fileObj) {
        if (fileObj.tags && fileObj.tags.length) {
            await TagService.ensureTags(fileObj.tags);
        }
        if (fileObj.id) {
            await FileDao.update(fileObj);
            return fileObj.id;
        } else {
            return await FileDao.add(fileObj);
        }
    }

    async function remove(id) {
        // Prevent deletion if linked to a record
        const links = await RecordAttachmentDao.getByFileId(id);
        if (links && links.length > 0) {
            throw new Error('This file is attached to one or more records and cannot be deleted.');
        }
        return await FileDao.remove(id);
    }

    return { getAll, getById, save, remove };
})();
