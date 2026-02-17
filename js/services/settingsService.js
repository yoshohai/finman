/**
 * SettingsService — business logic for persisting/loading settings.
 */
const SettingsService = (() => {
    async function getFilter(pageKey) {
        return await SettingsDao.get('filter_' + pageKey);
    }

    async function saveFilter(pageKey, filterState) {
        return await SettingsDao.set('filter_' + pageKey, filterState);
    }

    return { getFilter, saveFilter };
})();
