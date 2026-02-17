/**
 * DashboardController — orchestrates the Dashboard page.
 */
const DashboardController = (() => {
    let chart = null;
    let filterTags = [];
    let filterTagsList = [];  // For projection filters
    let savedFilters = {}; // Store filter state for restoration

    async function init() {
        DashboardView.render();
        await restoreFilters();
        bindFilters();
        updateFilterCount();
        await refresh();
        await loadAndRenderWidgets(); // Initialize widgets
        bindWidgetEvents();
    }

    // --- Widget Logic ---

    async function loadAndRenderWidgets() {
        const container = document.getElementById('dash-widgets-container');
        const widgets = await WidgetService.getAllWidgets();

        container.innerHTML = '';
        
        if (!widgets.length) {
            return;
        }

        let draggedCard = null;
        let draggedIndex = null;

        for (let i = 0; i < widgets.length; i++) {
            const w = widgets[i];
            const val = await WidgetService.calculateValue(w);
            const card = document.createElement('div');
            card.className = 'summary-card';
            card.style.position = 'relative';
            card.style.cursor = 'grab';
            card.dataset.widgetId = w.id;
            card.dataset.widgetIndex = i;
            card.draggable = true;

            // Format value
            const formatNum = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
            let displayVal = formatNum(val);

            card.innerHTML = `
                <div class="card-label">${w.name} <span class="widget-remove" data-id="${w.id}" style="cursor:pointer;float:right;color:#aaa;">&times;</span></div>
                <div class="card-value">${displayVal}</div>
                <div style="font-size:0.75em;color:#999;margin-top:4px;">${w.aggregation}</div>
            `;
            container.appendChild(card);

            // Drag and drop handlers
            card.addEventListener('dragstart', (e) => {
                draggedCard = card;
                draggedIndex = parseInt(card.dataset.widgetIndex);
                card.style.opacity = '0.5';
                card.style.cursor = 'grabbing';
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', card.innerHTML);
            });

            card.addEventListener('dragend', (e) => {
                card.style.opacity = '1';
                card.style.cursor = 'grab';
                // Remove all drag-over classes
                container.querySelectorAll('.summary-card').forEach(c => {
                    c.classList.remove('drag-over');
                });
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                return false;
            });

            card.addEventListener('dragenter', (e) => {
                e.preventDefault();
                if (card !== draggedCard) {
                    card.classList.add('drag-over');
                }
            });

            card.addEventListener('dragleave', (e) => {
                card.classList.remove('drag-over');
            });

            card.addEventListener('drop', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                card.classList.remove('drag-over');
                
                if (draggedCard && draggedCard !== card) {
                    const dropIndex = parseInt(card.dataset.widgetIndex);
                    await WidgetService.reorderWidgets(draggedIndex, dropIndex);
                    await loadAndRenderWidgets();
                }
                
                return false;
            });

            // Click to edit (except remove button and during drag)
            card.addEventListener('click', async (e) => {
                if (!e.target.classList.contains('widget-remove')) {
                    await editWidget(w.id);
                }
            });
        }

        // Bind remove buttons
        container.querySelectorAll('.widget-remove').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent triggering card click
                if (confirm('Remove this widget?')) {
                    await WidgetService.removeWidget(e.target.dataset.id);
                    await loadAndRenderWidgets();
                }
            });
        });
    }

    function bindWidgetEvents() {
        document.getElementById('dash-add-widget-btn').addEventListener('click', () => {
            Modal.open('Add Custom Widget', DashboardView.getWidgetFormHTML());
            bindWidgetForm();
        });
    }

    async function editWidget(widgetId) {
        const widget = await WidgetService.getWidgetById(widgetId);
        if (!widget) return;

        Modal.open('Edit Widget', DashboardView.getWidgetFormHTML());
        bindWidgetForm(widget);
    }

    function bindWidgetForm(existingWidget = null) {
        const form = document.getElementById('widget-form');
        let widgetTags = existingWidget ? [...(existingWidget.filter?.tags || [])] : [];

        // Initialize date filter view for widget form
        const dateFilterContainer = document.getElementById('wid-date-filter-container');
        if (dateFilterContainer) {
            dateFilterContainer.innerHTML = DateFilterView.getHTML('wid');
            DateFilterView.setupTypeSelectHandlers('wid');
        }

        // Populate form if editing
        if (existingWidget) {
            document.getElementById('wid-name').value = existingWidget.name || '';
            document.getElementById('wid-agg').value = existingWidget.aggregation || 'sum';
            
            if (existingWidget.filter) {
                const f = existingWidget.filter;
                if (f.dateFilter) {
                    DateFilterView.setFilterValues('wid', f.dateFilter);
                }
                document.getElementById('wid-f-type').value = f.type || '';
                document.getElementById('wid-f-amt-op').value = f.amtOp || '';
                document.getElementById('wid-f-amt-val').value = f.amtVal || '';
                document.getElementById('wid-f-amt-val2').value = f.amtVal2 || '';
                document.getElementById('wid-f-tag-op').value = f.tagOp || '';
                
                // Show second amount field if between
                if (f.amtOp === 'between') {
                    document.getElementById('wid-f-amt-val2-group').style.display = '';
                }
            }
            
            // Update button text
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.textContent = 'Update Widget';
            }
        }

        // Amount operator: show/hide second field for "between"
        document.getElementById('wid-f-amt-op').addEventListener('change', () => {
            const op = document.getElementById('wid-f-amt-op').value;
            document.getElementById('wid-f-amt-val2-group').style.display = op === 'between' ? '' : 'none';
        });

        // Tag handling inside modal
        const tagInput = document.getElementById('wid-f-tag-input');
        const suggestions = document.getElementById('wid-f-tag-suggestions');
        const tagsContainer = document.getElementById('wid-f-tags-container');

        function renderWidgetTags() {
            tagsContainer.innerHTML = widgetTags.map((tag, i) =>
                `<span class="tag-pill">${tag}<span class="tag-remove" data-idx="${i}">&times;</span></span>`
            ).join('');
            tagsContainer.querySelectorAll('.tag-remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    widgetTags.splice(parseInt(e.target.dataset.idx), 1);
                    renderWidgetTags();
                });
            });
        }

        tagInput.addEventListener('input', async () => {
            const val = tagInput.value.trim().toLowerCase();
            if (!val) { suggestions.classList.add('hidden'); return; }
            const allTags = await TagService.getAll();
            const filtered = allTags.filter(t => t.value.toLowerCase().includes(val) && !widgetTags.includes(t.value));

            if (filtered.length) {
                suggestions.innerHTML = filtered.map(t => `<div class="tag-suggestion-item">${t.value}</div>`).join('');
                suggestions.classList.remove('hidden');
                suggestions.querySelectorAll('.tag-suggestion-item').forEach(el => {
                    el.addEventListener('click', () => {
                        widgetTags.push(el.textContent);
                        tagInput.value = '';
                        suggestions.classList.add('hidden');
                        renderWidgetTags();
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
                if (val && !widgetTags.includes(val)) {
                    widgetTags.push(val);
                    tagInput.value = '';
                    suggestions.classList.add('hidden');
                    renderWidgetTags();
                }
            }
        });

        // Handle form submit
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dateFilter = DateFilterView.getFilterValues('wid');

            const widgetData = {
                name: document.getElementById('wid-name').value,
                aggregation: document.getElementById('wid-agg').value,
                filter: {
                    dateFilter: dateFilter,
                    type: document.getElementById('wid-f-type').value,
                    amtOp: document.getElementById('wid-f-amt-op').value,
                    amtVal: document.getElementById('wid-f-amt-val').value,
                    amtVal2: document.getElementById('wid-f-amt-val2').value,
                    tags: widgetTags,
                    tagOp: document.getElementById('wid-f-tag-op').value
                }
            };

            if (existingWidget) {
                await WidgetService.updateWidget(existingWidget.id, widgetData);
            } else {
                await WidgetService.addWidget(widgetData);
            }
            
            Modal.close();
            await loadAndRenderWidgets();
        });
        
        // Render existing tags
        renderWidgetTags();
    }

    async function restoreFilters() {
        const saved = await SettingsService.getFilter('dashboard');
        if (!saved) return;

        // Store filters for later restoration in modal
        savedFilters = saved;
        
        const intervalInput = document.getElementById('dash-interval');
        if (saved.interval && intervalInput) intervalInput.value = saved.interval;
        if (saved.tags && saved.tags.length) {
            filterTagsList = saved.tags;
        }
    }

    async function saveFilters() {
        const dateFilter = DateFilterView.getFilterValues('dash');

        const state = {
            dateFilter: dateFilter,  // Save the date filter object
            type: document.getElementById('dash-f-type').value,
            amtOp: document.getElementById('dash-f-amt-op').value,
            amtVal: document.getElementById('dash-f-amt-val').value,
            amtVal2: document.getElementById('dash-f-amt-val2').value,
            interval: document.getElementById('dash-interval').value,
            tags: [...filterTagsList],
            tagOp: document.getElementById('dash-f-tag-op').value
        };
        savedFilters = state;
        await SettingsService.saveFilter('dashboard', state);
    }

    function bindFilters() {
        // Open filters in modal
        document.getElementById('dash-toggle-filters').addEventListener('click', () => {
            Modal.open('Projection Filters', DashboardView.getFilterFormHTML());
            bindFilterForm();
            updateFilterCount();
        });
    }

    function bindFilterForm() {
        const form = document.getElementById('dash-filter-form');
        
        // Initialize date filter view for filter form
        const dateFilterContainer = document.getElementById('dash-date-filter-container');
        if (dateFilterContainer) {
            dateFilterContainer.innerHTML = DateFilterView.getHTML('dash');
            DateFilterView.setupTypeSelectHandlers('dash');
            // Restore saved date filter values if available
            if (savedFilters.dateFilter) {
                DateFilterView.setFilterValues('dash', savedFilters.dateFilter);
                DateFilterView.setupTypeSelectHandlers('dash');
            }
        }

        // Restore other filter values
        if (savedFilters.type) document.getElementById('dash-f-type').value = savedFilters.type;
        if (savedFilters.amtOp) document.getElementById('dash-f-amt-op').value = savedFilters.amtOp;
        if (savedFilters.amtVal) document.getElementById('dash-f-amt-val').value = savedFilters.amtVal;
        if (savedFilters.amtVal2) document.getElementById('dash-f-amt-val2').value = savedFilters.amtVal2;
        if (savedFilters.tagOp) document.getElementById('dash-f-tag-op').value = savedFilters.tagOp;
        if (savedFilters.interval) document.getElementById('dash-interval').value = savedFilters.interval;
        
        // Show second amount field if needed
        if (savedFilters.amtOp === 'between') {
            document.getElementById('dash-f-amt-val2-group').style.display = '';
        }

        // Amount operator: show/hide second field for "between"
        document.getElementById('dash-f-amt-op').addEventListener('change', () => {
            const op = document.getElementById('dash-f-amt-op').value;
            document.getElementById('dash-f-amt-val2-group').style.display = op === 'between' ? '' : 'none';
        });

        // Tag filter autocomplete
        const tagInput = document.getElementById('dash-f-tag-input');
        const suggestions = document.getElementById('dash-f-tag-suggestions');

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

        // Render existing tags
        renderFilterTags();

        // Clear button
        document.getElementById('dash-clear-filters').addEventListener('click', () => {
            document.getElementById('dash-f-type').value = '';
            document.getElementById('dash-f-amt-op').value = '';
            document.getElementById('dash-f-amt-val').value = '';
            document.getElementById('dash-f-amt-val2').value = '';
            document.getElementById('dash-f-amt-val2-group').style.display = 'none';
            document.getElementById('dash-f-tag-op').value = '';
            filterTagsList = [];
            renderFilterTags();
            DateFilterView.clearFilterValues('dash');
            DateFilterView.setupTypeSelectHandlers('dash');
        });

        // Form submit
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveFilters();
            Modal.close();
            await refresh();
        });
    }

    function updateFilterCount() {
        const badge = document.getElementById('dash-active-filter-count');

        let count = 0;
        if (savedFilters.dateFilter && (savedFilters.dateFilter.startDate || savedFilters.dateFilter.endDate)) count++;
        if (savedFilters.type) count++;
        if (filterTagsList.length) count++;
        if (savedFilters.amtOp) count++;
        if (badge) badge.textContent = count ? `(${count} active)` : '';
    }

    function renderFilterTags() {
        const container = document.getElementById('dash-f-tags-container');
        container.innerHTML = filterTagsList.map((tag, i) =>
            `<span class="tag-pill">${tag}<span class="tag-remove" data-idx="${i}">&times;</span></span>`
        ).join('');
        container.querySelectorAll('.tag-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                filterTagsList.splice(parseInt(e.target.dataset.idx), 1);
                renderFilterTags();
                onFilterChange();
            });
        });
    }

    async function onFilterChange() {
        await saveFilters();
        updateFilterCount();
        await refresh();
    }

    async function refresh() {
        // Use saved filters instead of reading from form elements that don't exist outside modal
        let startDate = null, endDate = null;

        if (savedFilters.dateFilter) {
            try {
                const parsedRange = DateFilterUtil.parseDateRange(savedFilters.dateFilter);
                startDate = parsedRange.start;
                endDate = parsedRange.end;
            } catch (err) {
                console.warn('Date filter error:', err);
            }
        }

        const type = savedFilters.type || '';
        const amtOp = savedFilters.amtOp || '';
        const amtVal = savedFilters.amtVal || '';
        const amtVal2 = savedFilters.amtVal2 || '';
        const interval = savedFilters.interval || 'monthly';

        let records = await RecordService.getAll();

        // Expand recurring records into projected occurrences
        const fromDateStr = startDate ? startDate.toISOString().split('T')[0] : null;
        const toDateStr = endDate ? endDate.toISOString().split('T')[0] : null;
        records = expandRecurring(records, fromDateStr, toDateStr);

        // Apply date filters using DateFilterUtil
        records = records.filter(r => DateFilterUtil.isDateInRange(r.date, startDate, endDate));

        // Apply type filter
        if (type) {
            records = records.filter(r => r.type === type);
        }

        // Apply tag filters
        if (filterTagsList.length) {
            const tagOp = document.getElementById('dash-f-tag-op').value;
            const fTags = filterTagsList.map(t => t.toLowerCase());
            records = records.filter(r => {
                const rTags = (r.tags || []).map(t => t.toLowerCase());
                if (tagOp === 'all') {
                    return fTags.every(ft => rTags.includes(ft));
                } else {
                    return fTags.some(ft => rTags.includes(ft));
                }
            });
        }

        // Apply amount filter
        if (amtOp) {
            const amtValue = parseFloat(amtVal) || 0;
            records = records.filter(r => {
                const a = r.amount || 0;
                if (amtOp === 'eq') return a === amtValue;
                if (amtOp === 'lt') return a < amtValue;
                if (amtOp === 'lte') return a <= amtValue;
                if (amtOp === 'gt') return a > amtValue;
                if (amtOp === 'gte') return a >= amtValue;
                if (amtOp === 'between') {
                    const amtValue2 = parseFloat(amtVal2) || 0;
                    if (a < amtValue || a > amtValue2) return false;
                }
                return true;
            });
        }

        // Compute totals
        let totalCredits = 0, totalDebits = 0;
        records.forEach(r => {
            if (r.type === 'Credit') totalCredits += r.amount;
            else totalDebits += r.amount;
        });

        const formatNum = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

        document.getElementById('dash-credits').textContent = formatNum(totalCredits);
        document.getElementById('dash-debits').textContent = formatNum(totalDebits);
        const net = totalCredits - totalDebits;
        const netEl = document.getElementById('dash-net');
        netEl.textContent = formatNum(net);
        netEl.className = 'card-value ' + (net >= 0 ? 'credit' : 'debit');

        // Build chart data
        const grouped = groupByInterval(records, interval);
        renderChart(grouped, interval);

        // Breakdown by interval
        renderBreakdown(grouped);
    }

    /**
     * Expand recurring records into virtual projected entries
     * within the given date range.
     */
    function expandRecurring(records, fromDate, toDate) {
        const expanded = [];
        // Default range end: 1 year from now if no toDate
        const rangeEnd = toDate || new Date(new Date().getFullYear() + 1, 11, 31).toISOString().split('T')[0];
        const rangeStart = fromDate || '1970-01-01';

        for (const r of records) {
            if (!r.recurring || !r.recurring.enabled) {
                // Non-recurring: pass through as-is
                expanded.push(r);
                continue;
            }

            // Determine recurrence boundaries
            const recStart = r.recurring.startDate || r.date;
            const recEnd = r.recurring.endDate ? (r.recurring.endDate < rangeEnd ? r.recurring.endDate : rangeEnd) : rangeEnd;
            const intervalValue = r.recurring.intervalValue || 1;
            const intervalUnit = r.recurring.intervalUnit || 'Months';

            // Walk from recurrence start, generating an entry each interval
            let current = new Date(recStart + 'T00:00:00');
            const end = new Date(recEnd + 'T00:00:00');
            const maxIterations = 1000; // safety cap
            let count = 0;

            while (current <= end && count < maxIterations) {
                const dateStr = current.toISOString().split('T')[0];

                // Only include if within the visible range
                if (dateStr >= rangeStart && dateStr <= rangeEnd) {
                    expanded.push({
                        ...r,
                        date: dateStr,
                        _projected: true // marker for virtual entry
                    });
                }

                // Advance by interval
                if (intervalUnit === 'Days') {
                    current.setDate(current.getDate() + intervalValue);
                } else if (intervalUnit === 'Months') {
                    current.setMonth(current.getMonth() + intervalValue);
                } else if (intervalUnit === 'Years') {
                    current.setFullYear(current.getFullYear() + intervalValue);
                }
                count++;
            }
        }

        return expanded;
    }

    function groupByInterval(records, interval) {
        const map = {};
        records.forEach(r => {
            let key;
            if (interval === 'daily') key = r.date;
            else if (interval === 'monthly') key = r.date ? r.date.substring(0, 7) : 'Unknown';
            else key = r.date ? r.date.substring(0, 4) : 'Unknown';

            if (!map[key]) map[key] = { credit: 0, debit: 0 };
            if (r.type === 'Credit') map[key].credit += r.amount;
            else map[key].debit += r.amount;
        });

        // Sort keys
        const sorted = Object.keys(map).sort();
        // Cumulative net (running total)
        let runningNet = 0;
        const nets = sorted.map(k => {
            runningNet += map[k].credit - map[k].debit;
            return runningNet;
        });
        return {
            labels: sorted,
            credits: sorted.map(k => map[k].credit),
            debits: sorted.map(k => map[k].debit),
            nets
        };
    }

    function renderChart(data, interval) {
        const ctx = document.getElementById('dash-chart');
        if (chart) chart.destroy();

        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: 'Credits',
                        data: data.credits,
                        backgroundColor: 'rgba(39, 174, 96, 0.7)',
                        borderRadius: 3,
                    },
                    {
                        label: 'Debits',
                        data: data.debits,
                        backgroundColor: 'rgba(192, 57, 43, 0.7)',
                        borderColor: 'rgba(192, 57, 43, 0.7)',
                        borderRadius: 3,
                    },
                    {
                        label: 'Net',
                        data: data.nets,
                        backgroundColor: 'rgba(52, 73, 94, 0.3)',
                        borderColor: 'rgba(52, 73, 94, 0.8)',
                        borderRadius: 3,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { display: false },
                    },
                    y: {
                        grid: { color: '#eee' },
                        ticks: { display: false },
                        // ticks: {
                        //     callback: function (value) {
                        //         if (Math.abs(value) >= 1000000000) return (value / 1000000000).toFixed(1) + 'B';
                        //         if (Math.abs(value) >= 1000000) return (value / 1000000).toFixed(1) + 'M';
                        //         if (Math.abs(value) >= 1000) return (value / 1000).toFixed(1) + 'K';
                        //         return value;
                        //     }
                        // }
                    },
                },
            },
        });
    }

    function renderBreakdown(grouped) {
        const list = document.getElementById('dash-breakdown-list');

        if (!grouped.labels.length) {
            list.innerHTML = '<p style="color:#666;font-size:13px;">No data to display.</p>';
            return;
        }

        list.innerHTML = grouped.labels.map((label, i) => {
            const credit = grouped.credits[i];
            const debit = grouped.debits[i];
            const net = credit - debit;
            const formatNum = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
            return `<div class="breakdown-item">
                <span>${label}</span>
                <span style="color:${net >= 0 ? 'var(--credit)' : 'var(--debit)'}">
                    ${net >= 0 ? '+' : ''}${formatNum(net)}
                    <span style="color:var(--text-secondary);font-size:11px;">(+${formatNum(credit)} / -${formatNum(debit)})</span>
                </span>
            </div>`;
        }).join('');
    }

    return { init };
})();
