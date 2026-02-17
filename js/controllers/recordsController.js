/**
 * RecordsController — orchestrates the Records page with card list, filters, infinite scroll.
 */
const RecordsController = (() => {
    let currentTags = [];         // tags on the record form
    let currentAttachments = [];
    let editingRecord = null;

    // Filter state
    let filterTagsList = [];
    let allRecords = [];
    let filteredRecords = [];
    let displayedCount = 0;
    const PAGE_SIZE = 20;
    let searchDebounce = null;
    let savedFilters = {}; // Store filter state for restoration

    async function init() {
        RecordsView.render();
        await restoreFilters();
        bindEvents();
        updateFilterCount();
        // Load initial
        await loadAndRender();
    }

    function bindEvents() {
        document.getElementById('add-record-btn').addEventListener('click', () => openForm(null));

        // Open filters in modal
        document.getElementById('rec-toggle-filters').addEventListener('click', () => {
            Modal.open('Record Filters', RecordsView.getFilterFormHTML());
            bindFilterForm();
        });

        // Sort change
        document.getElementById('rec-sort-field').addEventListener('change', applyFilters);
        document.getElementById('rec-sort-order-btn').addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            const current = btn.dataset.order;
            const next = current === 'desc' ? 'asc' : 'desc';
            btn.dataset.order = next;
            btn.innerHTML = next === 'desc' ? '&#8595;' : '&#8593;';
            applyFilters();
        });

        // Search with debounce
        document.getElementById('rec-search').addEventListener('input', () => {
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(() => applyFilters(), 200);
        });

        // Infinite scroll
        window.addEventListener('scroll', () => {
            if (!document.getElementById('records-list')) return;
            if (displayedCount >= filteredRecords.length) return;
            if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 100) {
                loadMore();
            }
        });

        // Card click delegation
        document.getElementById('records-list').addEventListener('click', async (e) => {
            const card = e.target.closest('.record-card');
            if (!card) return;
            const id = parseInt(card.dataset.id);
            const record = await RecordService.getById(id);
            if (record) openForm(record);
        });
    }

    function bindFilterForm() {
        const form = document.getElementById('rec-filter-form');

        // Initialize date filter view for filter form
        const dateFilterContainer = document.getElementById('rec-date-filter-container');
        if (dateFilterContainer) {
            dateFilterContainer.innerHTML = DateFilterView.getHTML('rec');
            DateFilterView.setupTypeSelectHandlers('rec');
            // Restore saved date filter values if available
            if (savedFilters.dateFilter) {
                DateFilterView.setFilterValues('rec', savedFilters.dateFilter);
                DateFilterView.setupTypeSelectHandlers('rec');
            }
        }

        // Restore other filter values
        if (savedFilters.type) document.getElementById('rec-f-type').value = savedFilters.type;
        if (savedFilters.amtOp) {
            document.getElementById('rec-f-amt-op').value = savedFilters.amtOp;
            if (savedFilters.amtOp === 'between') {
                document.getElementById('rec-f-amt-val2-group').style.display = '';
            }
        }
        if (savedFilters.amtVal) document.getElementById('rec-f-amt-val').value = savedFilters.amtVal;
        if (savedFilters.amtVal2) document.getElementById('rec-f-amt-val2').value = savedFilters.amtVal2;
        if (savedFilters.tags) filterTagsList = [...savedFilters.tags];
        if (savedFilters.tagOp) document.getElementById('rec-f-tag-op').value = savedFilters.tagOp;
        if (savedFilters.includeDeleted) document.getElementById('rec-include-deleted').checked = savedFilters.includeDeleted;

        // Amount operator: show/hide second field for "between"
        document.getElementById('rec-f-amt-op').addEventListener('change', () => {
            const op = document.getElementById('rec-f-amt-op').value;
            document.getElementById('rec-f-amt-val2-group').style.display = op === 'between' ? '' : 'none';
        });

        // Tag filter autocomplete
        const tagInput = document.getElementById('rec-f-tag-input');
        const suggestions = document.getElementById('rec-f-tag-suggestions');

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
        document.getElementById('rec-clear-filters').addEventListener('click', async () => {
            document.getElementById('rec-f-type').value = '';
            const searchInput = document.getElementById('rec-search');
            if (searchInput) searchInput.value = '';
            // Clear date filter
            DateFilterView.clearFilterValues('rec');

            const typeInput = document.getElementById('rec-f-type');
            if (typeInput) typeInput.value = '';

            // Reset sort
            const sortFieldInput = document.getElementById('rec-sort-field');
            if (sortFieldInput) sortFieldInput.value = 'date';
            const btn = document.getElementById('rec-sort-order-btn');
            if (btn) {
                btn.dataset.order = 'desc';
                btn.innerHTML = '&#8595;';
            }

            const amtOpInput = document.getElementById('rec-f-amt-op');
            if (amtOpInput) amtOpInput.value = '';
            const amtValInput = document.getElementById('rec-f-amt-val');
            if (amtValInput) amtValInput.value = '';
            const amtVal2Input = document.getElementById('rec-f-amt-val2');
            if (amtVal2Input) amtVal2Input.value = '';
            const amtVal2Group = document.getElementById('rec-f-amt-val2-group');
            if (amtVal2Group) amtVal2Group.style.display = 'none';
            const includeDeletedInput = document.getElementById('rec-include-deleted');
            if (includeDeletedInput) includeDeletedInput.checked = false;

            filterTagsList = [];
            const tagOpInput = document.getElementById('rec-f-tag-op');
            if (tagOpInput) tagOpInput.value = '';
            renderFilterTags();

            savedFilters = {
                search: '',
                dateFilter: {},
                type: '',
                sortField: 'date',
                sortOrder: 'desc',
                amtOp: '',
                amtVal: '',
                amtVal2: '',
                tags: [],
                tagOp: '',
                includeDeleted: false
            };
            await SettingsService.saveFilter('records', savedFilters);
            updateFilterCount();
            await loadAndRender(); // Re-fetch without deleted
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
            console.error('rec-filter-form not found');
        }
    }

    function updateFilterCount() {
        const dateFilter = savedFilters.dateFilter || {};
        const searchInputCount = document.getElementById('rec-search');
        const badge = document.getElementById('rec-active-filter-count');

        let count = 0;
        if (dateFilter && (dateFilter.startDate || dateFilter.endDate)) count++;
        if (searchInputCount && searchInputCount.value.trim()) count++;
        if (savedFilters.type) count++;
        if (filterTagsList.length) count++;
        if (savedFilters.amtOp) count++;
        if (savedFilters.includeDeleted) count++;
        if (badge) badge.textContent = count ? `(${count} active)` : '';
    }

    function renderFilterTags() {
        const container = document.getElementById('rec-f-tags-container');
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

    async function loadAndRender() {
        const includeDeleted = savedFilters.includeDeleted || false;
        allRecords = await RecordService.getAll(includeDeleted);
        // Sort newest first
        allRecords.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        applyFilters();
    }

    function applyFilters() {
        const search = (document.getElementById('rec-search').value || '').trim().toLowerCase();
        
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
        
        const type = savedFilters.type || '';
        const amtOp = savedFilters.amtOp || '';
        const amtVal = savedFilters.amtVal ? parseFloat(savedFilters.amtVal) : NaN;
        const amtVal2 = savedFilters.amtVal2 ? parseFloat(savedFilters.amtVal2) : NaN;

        filteredRecords = allRecords.filter(r => {
            // Search
            if (search) {
                const haystack = `${r.description || ''} ${r.type || ''} ${(r.tags || []).join(' ')}`.toLowerCase();
                if (!haystack.includes(search)) return false;
            }
            // Date range using DateFilterUtil
            if (!DateFilterUtil.isDateInRange(r.date, startDate, endDate)) {
                return false;
            }
            // Type
            if (type && r.type !== type) return false;
            // Tags
            if (filterTagsList.length) {
                const tagOp = savedFilters.tagOp || 'any';
                const rTags = (r.tags || []).map(t => t.toLowerCase());
                const fTags = filterTagsList.map(t => t.toLowerCase());
                if (tagOp === 'all') {
                    if (!fTags.every(ft => rTags.includes(ft))) return false;
                } else {
                    if (!fTags.some(ft => rTags.includes(ft))) return false;
                }
            }
            // Amount
            if (amtOp && !isNaN(amtVal)) {
                const a = r.amount;
                if (amtOp === 'eq' && a !== amtVal) return false;
                if (amtOp === 'lt' && a >= amtVal) return false;
                if (amtOp === 'lte' && a > amtVal) return false;
                if (amtOp === 'gt' && a <= amtVal) return false;
                if (amtOp === 'gte' && a < amtVal) return false;
                if (amtOp === 'between' && !isNaN(amtVal2)) {
                    if (a < amtVal || a > amtVal2) return false;
                }
            }
            return true;
        });

        // Sort
        // Sort
        const sortField = document.getElementById('rec-sort-field').value;
        const sortOrderBtn = document.getElementById('rec-sort-order-btn');
        const sortOrder = sortOrderBtn.dataset.order || 'desc';
        const mult = sortOrder === 'asc' ? 1 : -1;

        filteredRecords.sort((a, b) => {
            let valA, valB;

            // Extract values based on field
            switch (sortField) {
                case 'amount':
                    valA = a.amount;
                    valB = b.amount;
                    break;
                case 'date':
                    valA = a.date;
                    valB = b.date;
                    break;
                case 'description':
                    valA = (a.description || '').toLowerCase();
                    valB = (b.description || '').toLowerCase();
                    break;
                case 'type':
                    valA = a.type;
                    valB = b.type;
                    break;
                case 'startDate':
                    valA = (a.recurring && a.recurring.startDate) ? a.recurring.startDate : '';
                    valB = (b.recurring && b.recurring.startDate) ? b.recurring.startDate : '';
                    break;
                case 'endDate':
                    valA = (a.recurring && a.recurring.endDate) ? a.recurring.endDate : '';
                    valB = (b.recurring && b.recurring.endDate) ? b.recurring.endDate : '';
                    break;
                case 'createdAt':
                    valA = a.createdAt || '';
                    valB = b.createdAt || '';
                    break;
                case 'modifiedAt':
                    valA = a.modifiedAt || '';
                    valB = b.modifiedAt || '';
                    break;
                default:
                    valA = a.date;
                    valB = b.date;
            }

            // Compare
            if (valA < valB) return -1 * mult;
            if (valA > valB) return 1 * mult;
            return 0;
        });

        // Save filters and update count
        saveFilters();
        updateFilterCount();

        // Reset and render
        displayedCount = 0;
        document.getElementById('records-list').innerHTML = '';
        loadMore();
    }

    function loadMore() {
        const list = document.getElementById('records-list');
        const emptyEl = document.getElementById('records-empty');
        const loadingEl = document.getElementById('records-loading');

        const batch = filteredRecords.slice(displayedCount, displayedCount + PAGE_SIZE);
        if (batch.length) {
            list.insertAdjacentHTML('beforeend', batch.map(r => RecordsView.renderCard(r)).join(''));
            displayedCount += batch.length;
        }

        emptyEl.classList.toggle('hidden', filteredRecords.length > 0);
        loadingEl.classList.toggle('hidden', displayedCount >= filteredRecords.length);
    }

    function clearFilters() {
        document.getElementById('rec-search').value = '';
        
        // Clear date filter
        DateFilterView.clearFilterValues('rec');

        document.getElementById('rec-f-type').value = '';

        // Reset sort
        document.getElementById('rec-sort-field').value = 'date';
        const btn = document.getElementById('rec-sort-order-btn');
        btn.dataset.order = 'desc';
        btn.innerHTML = '&#8595;';

        document.getElementById('rec-f-amt-op').value = '';
        document.getElementById('rec-f-amt-val').value = '';
        document.getElementById('rec-f-amt-val2').value = '';
        document.getElementById('rec-f-amt-val2-group').style.display = 'none';
        document.getElementById('rec-include-deleted').checked = false;

        filterTagsList = [];
        document.getElementById('rec-f-tag-op').value = '';
        renderFilterTags();
        
        // Reset savedFilters
        savedFilters = {
            search: '',
            dateFilter: {},
            type: '',
            sortField: 'date',
            sortOrder: 'desc',
            amtOp: '',
            amtVal: '',
            amtVal2: '',
            tags: [],
            tagOp: '',
            includeDeleted: false
        };
        
        loadAndRender(); // Re-fetch without deleted
    }

    async function saveFilters() {
        const btn = document.getElementById('rec-sort-order-btn');
        const hasDateFilterForm = !!document.getElementById('rec-date-start-type');
        const dateFilter = hasDateFilterForm ? DateFilterView.getFilterValues('rec') : (savedFilters.dateFilter || {});
        const searchInput = document.getElementById('rec-search');
        const typeInput = document.getElementById('rec-f-type');
        const sortFieldInput = document.getElementById('rec-sort-field');
        const amtOpInput = document.getElementById('rec-f-amt-op');
        const amtValInput = document.getElementById('rec-f-amt-val');
        const amtVal2Input = document.getElementById('rec-f-amt-val2');
        const tagOpInput = document.getElementById('rec-f-tag-op');
        const includeDeletedInput = document.getElementById('rec-include-deleted');

        const state = {
            search: searchInput ? searchInput.value : '',
            dateFilter: dateFilter,  // Save the date filter object
            type: typeInput ? typeInput.value : (savedFilters.type || ''),
            sortField: sortFieldInput ? sortFieldInput.value : 'date',
            sortOrder: btn ? btn.dataset.order : 'desc',
            amtOp: amtOpInput ? amtOpInput.value : (savedFilters.amtOp || ''),
            amtVal: amtValInput ? amtValInput.value : (savedFilters.amtVal || ''),
            amtVal2: amtVal2Input ? amtVal2Input.value : (savedFilters.amtVal2 || ''),
            tags: [...filterTagsList],
            tagOp: tagOpInput ? tagOpInput.value : (savedFilters.tagOp || ''),
            includeDeleted: includeDeletedInput ? includeDeletedInput.checked : !!savedFilters.includeDeleted
        };
        savedFilters = state;
        await SettingsService.saveFilter('records', state);
    }

    async function restoreFilters() {
        const saved = await SettingsService.getFilter('records');
        if (!saved) return;
        savedFilters = saved;
        const searchInput = document.getElementById('rec-search');
        if (saved.search && searchInput) searchInput.value = saved.search;

        // Restore date filter (new format)
        if (saved.dateFilter) {
            DateFilterView.setFilterValues('rec', saved.dateFilter);
            DateFilterView.setupTypeSelectHandlers('rec');
        } else if (saved.from || saved.to) {
            // Backward compatibility: convert old format to new format
            const fromInput = document.getElementById('rec-date-start');
            const toInput = document.getElementById('rec-date-end');
            if (fromInput && saved.from) fromInput.value = saved.from;
            if (toInput && saved.to) toInput.value = saved.to;
        }

        const typeInput = document.getElementById('rec-f-type');
        if (saved.type && typeInput) typeInput.value = saved.type;
        const includeDeletedInput = document.getElementById('rec-include-deleted');
        if (saved.includeDeleted && includeDeletedInput) includeDeletedInput.checked = saved.includeDeleted;

        // Restore sort
        const sortFieldInput = document.getElementById('rec-sort-field');
        if (saved.sortField && sortFieldInput) sortFieldInput.value = saved.sortField;
        if (saved.sortOrder) {
            const btn = document.getElementById('rec-sort-order-btn');
            if (btn) {
                btn.dataset.order = saved.sortOrder;
                btn.innerHTML = saved.sortOrder === 'desc' ? '&#8595;' : '&#8593;';
            }
        }

        const amtOpInput = document.getElementById('rec-f-amt-op');
        const amtValInput = document.getElementById('rec-f-amt-val');
        const amtVal2Input = document.getElementById('rec-f-amt-val2');
        const amtVal2Group = document.getElementById('rec-f-amt-val2-group');
        if (saved.amtOp && amtOpInput) {
            amtOpInput.value = saved.amtOp;
            if (saved.amtOp === 'between' && amtVal2Group) {
                amtVal2Group.style.display = '';
            }
        }
        if (saved.amtVal && amtValInput) amtValInput.value = saved.amtVal;
        if (saved.amtVal2 && amtVal2Input) amtVal2Input.value = saved.amtVal2;
        if (saved.tags && saved.tags.length) {
            filterTagsList = saved.tags;
            renderFilterTags();
        }
        const tagOpInput = document.getElementById('rec-f-tag-op');
        if (saved.tagOp && tagOpInput) tagOpInput.value = saved.tagOp;
    }


    // ── Form handling (same as before) ──

    async function openForm(record) {
        editingRecord = record;
        currentTags = record && record.tags ? [...record.tags] : [];
        currentAttachments = [];

        if (record) {
            currentAttachments = await RecordService.getAttachments(record.id);
        }

        Modal.open(record ? 'Edit Record' : 'New Record', RecordsView.getFormHTML(record));
        renderFormTags();
        renderAttachments();
        bindFormEvents();
    }

    function renderFormTags() {
        const container = document.getElementById('rec-tags-container');
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

    function renderAttachments() {
        const list = document.getElementById('rec-attachments');
        if (!list) return;
        if (!currentAttachments.length) {
            list.innerHTML = '<li style="color:#666;font-size:12px;">No attachments</li>';
            return;
        }
        list.innerHTML = currentAttachments.map(a =>
            `<li>${a.fileName} <span class="tag-remove" data-att-id="${a.id}" style="cursor:pointer;">&times;</span></li>`
        ).join('');
        list.querySelectorAll('.tag-remove').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const attId = parseInt(e.target.dataset.attId);
                await RecordService.removeAttachment(attId);
                currentAttachments = currentAttachments.filter(a => a.id !== attId);
                renderAttachments();
            });
        });
    }

    function bindFormEvents() {
        // Recurring toggle
        const recurringCb = document.getElementById('rec-recurring');
        if (recurringCb) {
            recurringCb.addEventListener('change', () => {
                document.getElementById('rec-recurring-fields').classList.toggle('visible', recurringCb.checked);
            });
        }

        // Tag input with autocomplete
        const tagInput = document.getElementById('rec-tag-input');
        const suggestions = document.getElementById('rec-tag-suggestions');

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

        // Attach file button
        document.getElementById('rec-add-attachment').addEventListener('click', async () => {
            if (!editingRecord || !editingRecord.id) {
                alert('Please save the record first before attaching files.');
                return;
            }
            const files = await FileService.getAll();
            Modal.open('Attach File', RecordsView.getAttachmentPickerHTML(files));
            document.querySelectorAll('[data-file-id]').forEach(el => {
                el.addEventListener('click', async () => {
                    const fileId = parseInt(el.dataset.fileId);
                    await RecordService.addAttachment(editingRecord.id, fileId);
                    const updatedRecord = await RecordService.getById(editingRecord.id);
                    openForm(updatedRecord);
                });
            });
        });

        // Delete button
        const deleteBtn = document.getElementById('rec-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if (confirm('Delete this record?')) {
                    await RecordService.remove(editingRecord.id);
                    Modal.close();
                    await loadAndRender();
                }
            });
        }

        // Form submit
        document.getElementById('record-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                type: document.getElementById('rec-type').value,
                description: document.getElementById('rec-desc').value,
                amount: parseFloat(document.getElementById('rec-amount').value),
                date: document.getElementById('rec-date').value,
                tags: [...currentTags],
                recurring: {
                    enabled: document.getElementById('rec-recurring').checked,
                    startDate: document.getElementById('rec-rec-start').value || null,
                    endDate: document.getElementById('rec-rec-end').value || null,
                    intervalValue: parseInt(document.getElementById('rec-rec-interval').value) || 1,
                    intervalUnit: document.getElementById('rec-rec-unit').value,
                },
            };

            if (editingRecord) {
                data.id = editingRecord.id;
                data.createdAt = editingRecord.createdAt;
                data.deletedAt = null;
            }

            await RecordService.save(data);
            Modal.close();
            await loadAndRender();
        });
    }

    return { init };
})();
