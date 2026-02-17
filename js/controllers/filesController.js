/**
 * FilesController — orchestrates the Files page with card list, filters, infinite scroll.
 */
const FilesController = (() => {
    let currentTags = [];
    let editingFile = null;

    // Filter state
    let filterTagsList = [];
    let allFiles = [];
    let filteredFiles = [];
    let displayedCount = 0;
    const PAGE_SIZE = 20;
    let searchDebounce = null;
    let savedFilters = {}; // Store filter state for restoration

    async function init() {
        FilesView.render();
        await restoreFilters();
        bindEvents();
        updateFilterCount();
        // Load initial
        loadAndRender();
    }

    async function loadAndRender() {
        const includeDeleted = savedFilters.includeDeleted || false;
        allFiles = await FileService.getAll(includeDeleted);
        // Default sort: newest
        allFiles.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        applyFilters();
    }

    function applyFilters() {
        const search = (document.getElementById('file-search').value || '').trim().toLowerCase();
        
        // Get date filter values from savedFilters
        const dateFilter = savedFilters.dateFilter || {};
        let startDate = null, endDate = null;
        
        try {
            const parsedRange = DateFilterUtil.parseDateRange(dateFilter);
            startDate = parsedRange.start;
            endDate = parsedRange.end;
        } catch (err) {
            console.warn('Date filter error:', err);
        }

        filteredFiles = allFiles.filter(f => {
            if (search) {
                const text = `${f.name || ''} ${f.fileType || ''} ${(f.tags || []).join(' ')}`.toLowerCase();
                if (!text.includes(search)) return false;
            }
            // Date range filter on createdAt
            if (!DateFilterUtil.isDateInRange(f.createdAt, startDate, endDate)) {
                return false;
            }
            if (filterTagsList.length) {
                const tagOp = savedFilters.tagOp || 'any';
                const fTags = filterTagsList.map(t => t.toLowerCase());
                const rTags = (f.tags || []).map(t => t.toLowerCase());
                if (tagOp === 'all') {
                    if (!fTags.every(ft => rTags.includes(ft))) return false;
                } else {
                    if (!fTags.some(ft => rTags.includes(ft))) return false;
                }
            }
            return true;
        });

        // Sort
        const sortField = document.getElementById('file-sort-field').value;
        const sortOrderBtn = document.getElementById('file-sort-order-btn');
        const sortOrder = sortOrderBtn.dataset.order || 'desc';
        const mult = sortOrder === 'asc' ? 1 : -1;

        filteredFiles.sort((a, b) => {
            let valA, valB;
            switch (sortField) {
                case 'name':
                    valA = (a.name || '').toLowerCase();
                    valB = (b.name || '').toLowerCase();
                    break;
                case 'size':
                    valA = a.blob ? a.blob.size : 0;
                    valB = b.blob ? b.blob.size : 0;
                    break;
                case 'type':
                    valA = (a.fileType || '').toLowerCase();
                    valB = (b.fileType || '').toLowerCase();
                    break;
                default: // date
                    valA = a.createdAt || '';
                    valB = b.createdAt || '';
            }
            if (valA < valB) return -1 * mult;
            if (valA > valB) return 1 * mult;
            return 0;
        });

        // Count
        let count = 0;
        if (dateFilter.startDate || dateFilter.endDate) count++;
        if (search) count++;
        if (filterTagsList.length) count++;
        const badge = document.getElementById('file-active-filter-count');
        badge.textContent = count ? `(${count} active)` : '';

        // Render
        saveFilters();
        displayedCount = 0;
        document.getElementById('files-list').innerHTML = '';
        loadMore();
    }

    function clearFilters() {
        document.getElementById('file-search').value = '';
        // Clear date filter
        DateFilterView.clearFilterValues('file');
        document.getElementById('file-sort-field').value = 'date';
        const btn = document.getElementById('file-sort-order-btn');
        btn.dataset.order = 'desc';
        btn.innerHTML = '&#8595;';
        document.getElementById('file-include-deleted').checked = false;

        filterTagsList = [];
        document.getElementById('file-f-tag-op').value = 'any';
        renderFilterTags();
        
        // Reset savedFilters
        savedFilters = {
            search: '',
            dateFilter: {},
            tags: [],
            tagOp: 'any',
            sortField: 'date',
            sortOrder: 'desc',
            includeDeleted: false
        };
        
        loadAndRender();
    }

    async function saveFilters() {
        const btn = document.getElementById('file-sort-order-btn');
        const hasDateFilterForm = !!document.getElementById('file-date-start-type');
        const dateFilter = hasDateFilterForm ? DateFilterView.getFilterValues('file') : (savedFilters.dateFilter || {});
        const tagOpInput = document.getElementById('file-f-tag-op');
        const includeDeletedInput = document.getElementById('file-include-deleted');
        
        const state = {
            search: document.getElementById('file-search').value,
            dateFilter: dateFilter,  // Save the date filter object
            tags: [...filterTagsList],
            tagOp: tagOpInput ? tagOpInput.value : (savedFilters.tagOp || ''),
            sortField: document.getElementById('file-sort-field').value,
            sortOrder: btn.dataset.order,
            includeDeleted: includeDeletedInput ? includeDeletedInput.checked : !!savedFilters.includeDeleted
        };
        savedFilters = state;
        await SettingsService.saveFilter('files', state);
    }

    async function restoreFilters() {
        const saved = await SettingsService.getFilter('files');
        if (!saved) return;
        
        // Store filters for later restoration in modal
        savedFilters = saved;
        
        if (saved.search) document.getElementById('file-search').value = saved.search;
        if (saved.tags) {
            filterTagsList = saved.tags;
        }
        if (saved.sortField) document.getElementById('file-sort-field').value = saved.sortField;
        if (saved.sortOrder) {
            const btn = document.getElementById('file-sort-order-btn');
            btn.dataset.order = saved.sortOrder;
            btn.innerHTML = saved.sortOrder === 'desc' ? '&#8595;' : '&#8593;';
        }
    }

    function bindEvents() {
        document.getElementById('add-file-btn').addEventListener('click', () => openForm(null));

        // Open filters in modal
        document.getElementById('file-toggle-filters').addEventListener('click', () => {
            Modal.open('File Filters', FilesView.getFilterFormHTML());
            bindFilterForm();
        });

        // Sort
        document.getElementById('file-sort-field').addEventListener('change', applyFilters);
        document.getElementById('file-sort-order-btn').addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            const current = btn.dataset.order;
            const next = current === 'desc' ? 'asc' : 'desc';
            btn.dataset.order = next;
            btn.innerHTML = next === 'desc' ? '&#8595;' : '&#8593;';
            applyFilters();
        });

        // Search with debounce
        document.getElementById('file-search').addEventListener('input', () => {
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(() => applyFilters(), 200);
        });

        // Infinite scroll
        window.addEventListener('scroll', () => {
            if (displayedCount >= filteredFiles.length) return;
            if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 100) {
                loadMore();
            }
        });

        // Card click delegation
        document.getElementById('files-list').addEventListener('click', async (e) => {
            const card = e.target.closest('.record-card');
            if (!card) return;
            const id = parseInt(card.dataset.id);
            const file = await FileService.getById(id);
            if (file) openForm(file);
        });
    }

    function bindFilterForm() {
        const form = document.getElementById('file-filter-form');
        
        // Initialize date filter view for filter form
        const dateFilterContainer = document.getElementById('file-date-filter-container');
        if (dateFilterContainer) {
            dateFilterContainer.innerHTML = DateFilterView.getHTML('file');
            DateFilterView.setupTypeSelectHandlers('file');
            // Restore saved date filter values if available
            if (savedFilters.dateFilter) {
                DateFilterView.setFilterValues('file', savedFilters.dateFilter);
                DateFilterView.setupTypeSelectHandlers('file');
            }
        }

        // Restore other filter values
        if (savedFilters.tags) filterTagsList = [...savedFilters.tags];
        if (savedFilters.tagOp) document.getElementById('file-f-tag-op').value = savedFilters.tagOp;
        if (savedFilters.includeDeleted) document.getElementById('file-include-deleted').checked = savedFilters.includeDeleted;

        // Tag filter autocomplete
        const tagInput = document.getElementById('file-f-tag-input');
        const suggestions = document.getElementById('file-f-tag-suggestions');

        if (tagInput && suggestions) {
            tagInput.addEventListener('input', async () => {
                const val = tagInput.value.trim().toLowerCase();
                if (!val) { suggestions.classList.add('hidden'); return; }
                const allTags = await TagService.getAll();
                const filtered = allTags.filter(t => t.value.toLowerCase().includes(val) && !filterTagsList.includes(t.value));
                if (filtered.length) {
                    suggestions.innerHTML = filtered.map(t =>
                        `<div class="tag-suggestion-item">${t.value}</div>`
                    ).join('');
                    suggestions.classList.remove('hidden');
                    suggestions.querySelectorAll('.tag-suggestion-item').forEach(el => {
                        el.addEventListener('click', () => {
                            filterTagsList.push(el.textContent);
                            tagInput.value = '';
                            suggestions.classList.add('hidden');
                            renderFilterTags();
                        });
                    });
                } else {
                    suggestions.classList.add('hidden');
                }
            });

            tagInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = tagInput.value.trim();
                    if (val && !filterTagsList.includes(val)) {
                        filterTagsList.push(val);
                        tagInput.value = '';
                        suggestions.classList.add('hidden');
                        renderFilterTags();
                    }
                }
            });
        }

        // Render existing tags
        renderFilterTags();

        // Clear button
        document.getElementById('file-clear-filters').addEventListener('click', async () => {
            document.getElementById('file-f-tag-op').value = '';
            document.getElementById('file-include-deleted').checked = false;
            filterTagsList = [];
            renderFilterTags();
            DateFilterView.clearFilterValues('file');
            DateFilterView.setupTypeSelectHandlers('file');

            savedFilters = {
                search: document.getElementById('file-search').value,
                dateFilter: {},
                tags: [],
                tagOp: '',
                sortField: document.getElementById('file-sort-field').value,
                sortOrder: document.getElementById('file-sort-order-btn').dataset.order,
                includeDeleted: false
            };
            await SettingsService.saveFilter('files', savedFilters);
            updateFilterCount();
        });

        // Form submit
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await saveFilters();
                Modal.close();
                await loadAndRender();
            });
        } else {
            console.error('file-filter-form not found');
        }
    }

    function updateFilterCount() {
        const dateFilter = savedFilters.dateFilter || {};
        const searchInput = document.getElementById('file-search');
        const badge = document.getElementById('file-active-filter-count');
        
        let count = 0;
        if (dateFilter && (dateFilter.startDate || dateFilter.endDate)) count++;
        if (searchInput && searchInput.value.trim()) count++;
        if (filterTagsList.length) count++;
        if (savedFilters.includeDeleted) count++;
        
        if (badge) badge.textContent = count ? `(${count} active)` : '';
    }

    function renderFilterTags() {
        const container = document.getElementById('file-f-tags-container');
        container.innerHTML = filterTagsList.map((tag, i) =>
            `<span class="tag-pill">${tag}<span class="tag-remove" data-idx="${i}">&times;</span></span>`
        ).join('');
        container.querySelectorAll('.tag-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                filterTagsList.splice(parseInt(e.target.dataset.idx), 1);
                renderFilterTags();
            });
        });
    }



    function loadMore() {
        const list = document.getElementById('files-list');
        const emptyEl = document.getElementById('files-empty');
        const loadingEl = document.getElementById('files-loading');

        const batch = filteredFiles.slice(displayedCount, displayedCount + PAGE_SIZE);
        if (batch.length) {
            list.insertAdjacentHTML('beforeend', batch.map(f => FilesView.renderCard(f)).join(''));
            displayedCount += batch.length;
        }

        emptyEl.classList.toggle('hidden', filteredFiles.length > 0);
        loadingEl.classList.toggle('hidden', displayedCount >= filteredFiles.length);
    }

    // ── Form handling (similar to before) ──

    async function openForm(fileObj) {
        editingFile = fileObj;
        currentTags = fileObj && fileObj.tags ? [...fileObj.tags] : [];

        Modal.open(fileObj ? 'Edit File' : 'Upload File', FilesView.getFormHTML(fileObj));
        renderFormTags();
        bindFormEvents();
    }

    function renderFormTags() {
        const container = document.getElementById('file-tags-container');
        if (!container) return;
        container.innerHTML = currentTags.map((tag, i) =>
            `<span class="tag-pill">${tag}<span class="tag-remove" data-idx="${i}">&times;</span></span>`
        ).join('');
        container.querySelectorAll('.tag-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                currentTags.splice(parseInt(e.target.dataset.idx), 1);
                renderFormTags();
            });
        });
    }

    function bindFormEvents() {
        // Tag input with autocomplete
        const tagInput = document.getElementById('file-tag-input');
        const suggestions = document.getElementById('file-tag-suggestions');

        tagInput.addEventListener('input', async () => {
            const val = tagInput.value.trim().toLowerCase();
            if (!val) { suggestions.classList.add('hidden'); return; }
            const allTags = await TagService.getAll();
            const filtered = allTags.filter(t => t.value.toLowerCase().includes(val) && !currentTags.includes(t.value));
            if (filtered.length) {
                suggestions.innerHTML = filtered.map(t =>
                    `<div class="tag-suggestion-item">${t.value}</div>`
                ).join('');
                suggestions.classList.remove('hidden');
                suggestions.querySelectorAll('.tag-suggestion-item').forEach(el => {
                    el.addEventListener('click', () => {
                        currentTags.push(el.textContent);
                        tagInput.value = '';
                        suggestions.classList.add('hidden');
                        renderFormTags();
                    });
                });
            } else {
                suggestions.classList.add('hidden');
            }
        });

        tagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const val = tagInput.value.trim();
                if (val && !currentTags.includes(val)) {
                    currentTags.push(val);
                    tagInput.value = '';
                    suggestions.classList.add('hidden');
                    renderFormTags();
                }
            }
        });

        // Auto-populate name from file upload
        const fileUpload = document.getElementById('file-upload');
        if (fileUpload) {
            fileUpload.addEventListener('change', () => {
                const file = fileUpload.files[0];
                const nameInput = document.getElementById('file-name');
                if (file && nameInput) {
                    nameInput.value = file.name;
                }
            });
        }

        // Download button
        const downloadBtn = document.getElementById('file-download-btn');
        if (downloadBtn && editingFile) {
            downloadBtn.addEventListener('click', () => {
                const blob = editingFile.blob;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;

                // Construct filename with extension
                let filename = editingFile.name || 'download';
                if (editingFile.extension && !filename.endsWith('.' + editingFile.extension)) {
                    filename += '.' + editingFile.extension;
                }

                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
            });
        }

        // Delete button
        const deleteBtn = document.getElementById('file-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if (confirm('Delete this file?')) {
                    try {
                        await FileService.remove(editingFile.id);
                        Modal.close();
                        await loadAndRender();
                    } catch (err) {
                        alert(err.message);
                    }
                }
            });
        }

        // Form submit
        document.getElementById('file-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const data = {
                name: document.getElementById('file-name').value,
                notes: document.getElementById('file-notes').value,
                tags: [...currentTags],
            };

            if (editingFile) {
                data.id = editingFile.id;
                data.blob = editingFile.blob;
                data.fileType = editingFile.fileType;
                data.createdAt = editingFile.createdAt;
                data.deletedAt = editingFile.deletedAt;
                // Persist original fields if they exist
                if (editingFile.originalName) data.originalName = editingFile.originalName;
                if (editingFile.extension) data.extension = editingFile.extension;
            } else {
                const fileInput = document.getElementById('file-upload');
                const file = fileInput.files[0];
                if (!file) { alert('Please select a file.'); return; }
                data.blob = file;
                data.fileType = file.type || 'application/octet-stream';

                // Extract extension and original name
                data.originalName = file.name;
                const lastDot = file.name.lastIndexOf('.');
                if (lastDot !== -1) {
                    data.extension = file.name.substring(lastDot + 1);
                }
            }

            await FileService.save(data);
            Modal.close();
            await loadAndRender();
        });
    }

    return { init };
})();
