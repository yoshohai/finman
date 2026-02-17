/**
 * TagService — ensures new tags are persisted for autocomplete.
 */
const TagService = (() => {
    async function getAll() {
        return await TagDao.getAll();
    }

    async function ensureTags(tagsArray) {
        if (!tagsArray || !tagsArray.length) return;
        const existing = await TagDao.getAll();
        const existingSet = new Set(existing.map(t => t.value));
        for (const tag of tagsArray) {
            const trimmed = tag.trim();
            if (trimmed && !existingSet.has(trimmed)) {
                await TagDao.add(trimmed);
                existingSet.add(trimmed);
            }
        }
    }

    return { getAll, ensureTags };
})();
