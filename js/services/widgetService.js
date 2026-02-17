/**
 * WidgetService — manages custom dashboard widgets.
 * Persists widget definitions in 'settings' store under 'dashboard_widgets'.
 * Calculates widget values based on record filters.
 */
const WidgetService = (() => {
    const SETTINGS_KEY = 'dashboard_widgets';

    async function getAllWidgets() {
        const db = await DB.getDB();
        return new Promise((resolve) => {
            const tx = db.transaction('settings', 'readonly');
            const req = tx.objectStore('settings').get(SETTINGS_KEY);
            req.onsuccess = () => {
                resolve(req.result ? req.result.value : []);
            };
            req.onerror = () => resolve([]);
        });
    }

    async function saveWidgets(widgets) {
        const db = await DB.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('settings', 'readwrite');
            const req = tx.objectStore('settings').put({ key: SETTINGS_KEY, value: widgets });
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async function addWidget(widget) {
        const widgets = await getAllWidgets();
        widget.id = Date.now().toString(); // Simple ID
        widgets.push(widget);
        await saveWidgets(widgets);
        return widget;
    }

    async function removeWidget(id) {
        const widgets = await getAllWidgets();
        const newWidgets = widgets.filter(w => w.id !== id);
        await saveWidgets(newWidgets);
    }

    async function updateWidget(id, updatedWidget) {
        const widgets = await getAllWidgets();
        const index = widgets.findIndex(w => w.id === id);
        if (index !== -1) {
            widgets[index] = { ...updatedWidget, id };
            await saveWidgets(widgets);
        }
    }

    async function getWidgetById(id) {
        const widgets = await getAllWidgets();
        return widgets.find(w => w.id === id);
    }

    async function reorderWidgets(fromIndex, toIndex) {
        const widgets = await getAllWidgets();
        if (fromIndex < 0 || fromIndex >= widgets.length || toIndex < 0 || toIndex >= widgets.length) {
            return;
        }
        const [movedWidget] = widgets.splice(fromIndex, 1);
        widgets.splice(toIndex, 0, movedWidget);
        await saveWidgets(widgets);
    }

    /**
     * Calculate value for a widget based on its configuration.
     * Config: { name, aggregation, filter: { dateFilter, type, amtOp, amtVal, amtVal2, tags: [], tagOp } }
     */
    async function calculateValue(widget) {
        let records = await RecordService.getAll(false); // No deleted records for projections
        const filter = widget.filter || {};

        // Parse date filter using DateFilterUtil
        let startDate = null, endDate = null;
        if (filter.dateFilter) {
            try {
                const parsedRange = DateFilterUtil.parseDateRange(filter.dateFilter);
                startDate = parsedRange.start;
                endDate = parsedRange.end;
            } catch (err) {
                console.warn('Widget date filter error:', err);
            }
        } else if (filter.from || filter.to) {
            // Backward compatibility: handle legacy from/to format
            if (filter.from) startDate = new Date(filter.from);
            if (filter.to) endDate = new Date(filter.to);
        }

        // Expand recurring records into projected occurrences
        const fromDateStr = startDate ? startDate.toISOString().split('T')[0] : null;
        const toDateStr = endDate ? endDate.toISOString().split('T')[0] : null;
        records = expandRecurring(records, fromDateStr, toDateStr);

        // Apply filters (logic mirroring recordsController.js)
        records = records.filter(r => {
            // Date range using DateFilterUtil
            if (!DateFilterUtil.isDateInRange(r.date, startDate, endDate)) {
                return false;
            }
            // Type
            if (filter.type && r.type !== filter.type) return false;
            // Tags
            if (filter.tags && filter.tags.length) {
                const rTags = (r.tags || []).map(t => t.toLowerCase());
                const fTags = filter.tags.map(t => t.toLowerCase());
                const tagOp = filter.tagOp || 'any';
                if (tagOp === 'all') {
                    if (!fTags.every(ft => rTags.includes(ft))) return false;
                } else {
                    if (!fTags.some(ft => rTags.includes(ft))) return false;
                }
            }
            // Amount filter
            if (filter.amtOp) {
                const a = r.amount || 0;
                const amtValue = parseFloat(filter.amtVal) || 0;
                if (filter.amtOp === 'eq' && a !== amtValue) return false;
                if (filter.amtOp === 'lt' && a >= amtValue) return false;
                if (filter.amtOp === 'lte' && a > amtValue) return false;
                if (filter.amtOp === 'gt' && a <= amtValue) return false;
                if (filter.amtOp === 'gte' && a < amtValue) return false;
                if (filter.amtOp === 'between') {
                    const amtValue2 = parseFloat(filter.amtVal2) || 0;
                    if (a < amtValue || a > amtValue2) return false;
                }
            }
            // Search (legacy support)
            if (filter.search) {
                const search = filter.search.toLowerCase();
                const haystack = `${r.description || ''} ${r.type || ''} ${(r.tags || []).join(' ')}`.toLowerCase();
                if (!haystack.includes(search)) return false;
            }
            return true;
        });

        // Aggregation
        if (widget.aggregation === 'count') {
            return records.length;
        } else if (widget.aggregation === 'sum') {
            return records.reduce((sum, r) => {
                const val = parseFloat(r.amount) || 0;
                // Sum logic: Creds positive? Debits negative? 
                // Usually for "Spending on Food" we just want the sum of amounts.
                // If mixed types, net? 
                // Let's just sum the absolute values if it's a specific category, 
                // OR respect the sign? 
                // If I filter "Debit" and "Food", I expect a positive number "500".
                // If I filter "Credit" and "Salary", I expect "5000".
                // If I filter "All", Net is useful.
                // Let's respect sign: Credit +, Debit -
                const sign = r.type === 'Credit' ? 1 : -1;
                return sum + (val * sign);
            }, 0);
        }
        return 0;
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

    return { getAllWidgets, addWidget, removeWidget, updateWidget, getWidgetById, calculateValue, reorderWidgets };
})();
