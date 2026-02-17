/**
 * DateFilterView — reusable date filter UI component for Elasticsearch-style filtering.
 */
const DateFilterView = (() => {
    /**
     * Render date filter HTML
     * @param {string} prefix - identifier prefix (e.g., 'rec', 'file', 'dash')
     * @param {Object} initialValues - { startDate: string, endDate: string }
     * @returns {string} HTML
     */
    function getHTML(prefix, initialValues = {}) {
        const startDate = initialValues.startDate || '';
        const endDate = initialValues.endDate || '';

        return `
            <div class="date-filter-group" data-prefix="${prefix}">
                <div class="form-group">
                    <label for="${prefix}-date-start-type">Start Date</label>
                    <div class="date-input-group">
                        <select class="date-type-select" id="${prefix}-date-start-type" data-field="start">
                            <option value="">-- Select --</option>
                            <option value="now">Now</option>
                            <option value="absolute">Absolute</option>
                            <option value="relative">Relative</option>
                        </select>
                        <!-- Now input (hidden by default) -->
                        <input type="text" class="date-value-input" id="${prefix}-date-start-now" data-field="start" data-type="now" value="now" style="display:none;">
                        
                        <!-- Absolute input -->
                        <input type="date" class="date-value-input" id="${prefix}-date-start-absolute" data-field="start" data-type="absolute" placeholder="Select date" style="display:none;" value="${startDate.match(/^\d{4}-\d{2}-\d{2}$/) ? startDate : ''}">
                        
                        <!-- Relative input -->
                        <div class="date-relative-group" id="${prefix}-date-start-relative" data-field="start" data-type="relative" style="display:none;">
                            <input type="number" class="date-relative-number" data-field="start" min="1" placeholder="e.g., 30">
                            <select class="date-relative-unit" data-field="start">
                                <option value="">-- Select --</option>
                                <option value="d ago">days ago</option>
                                <option value="w ago">weeks ago</option>
                                <option value="m ago">months ago</option>
                                <option value="y ago">years ago</option>
                                <option value="d from now">days from now</option>
                                <option value="w from now">weeks from now</option>
                                <option value="m from now">months from now</option>
                                <option value="y from now">years from now</option>
                            </select>
                        </div>
                    </div>
                    <small style="color:#999;font-size:11px;margin-top:2px;display:block;">
                        Examples: <strong>2024-02-16</strong> | <strong>30d ago</strong> | <strong>2w from now</strong>
                    </small>
                </div>
                <div class="form-group">
                    <label for="${prefix}-date-end-type">End Date</label>
                    <div class="date-input-group">
                        <select class="date-type-select" id="${prefix}-date-end-type" data-field="end">
                            <option value="">-- Select --</option>
                            <option value="now">Now</option>
                            <option value="absolute">Absolute</option>
                            <option value="relative">Relative</option>
                        </select>
                        <!-- Now input (hidden by default) -->
                        <input type="text" class="date-value-input" id="${prefix}-date-end-now" data-field="end" data-type="now" value="now" style="display:none;">
                        
                        <!-- Absolute input -->
                        <input type="date" class="date-value-input" id="${prefix}-date-end-absolute" data-field="end" data-type="absolute" placeholder="Select date" style="display:none;" value="${endDate.match(/^\d{4}-\d{2}-\d{2}$/) ? endDate : ''}">
                        
                        <!-- Relative input -->
                        <div class="date-relative-group" id="${prefix}-date-end-relative" data-field="end" data-type="relative" style="display:none;">
                            <input type="number" class="date-relative-number" data-field="end" min="1" placeholder="e.g., 30">
                            <select class="date-relative-unit" data-field="end">
                                <option value="">-- Select --</option>
                                <option value="d ago">days ago</option>
                                <option value="w ago">weeks ago</option>
                                <option value="m ago">months ago</option>
                                <option value="y ago">years ago</option>
                                <option value="d from now">days from now</option>
                                <option value="w from now">weeks from now</option>
                                <option value="m from now">months from now</option>
                                <option value="y from now">years from now</option>
                            </select>
                        </div>
                    </div>
                    <small style="color:#999;font-size:11px;margin-top:2px;display:block;">
                        Examples: <strong>2024-02-16</strong> | <strong>30d ago</strong> | <strong>2w from now</strong>
                    </small>
                </div>
            </div>
        `;
    }

    /**
     * Handle date type select change
     * Shows/hides inputs based on selected type
     */
    function setupTypeSelectHandlers(prefix) {
        const startTypeSelect = document.getElementById(`${prefix}-date-start-type`);
        const endTypeSelect = document.getElementById(`${prefix}-date-end-type`);

        if (!startTypeSelect || !endTypeSelect) {
            return;
        }

        const updateInputsForField = (field) => {
            const typeSelect = document.getElementById(`${prefix}-date-${field}-type`);
            const type = typeSelect.value;

            // Hide all inputs for this field
            document.getElementById(`${prefix}-date-${field}-now`).style.display = 'none';
            document.getElementById(`${prefix}-date-${field}-absolute`).style.display = 'none';
            document.getElementById(`${prefix}-date-${field}-relative`).style.display = 'none';

            // Show the selected type's input
            if (type === 'now') {
                // No input needed for "now"
            } else if (type === 'absolute') {
                document.getElementById(`${prefix}-date-${field}-absolute`).style.display = '';
            } else if (type === 'relative') {
                const relativeGroup = document.getElementById(`${prefix}-date-${field}-relative`);
                relativeGroup.style.display = 'flex';
            }
        };

        startTypeSelect.addEventListener('change', () => updateInputsForField('start'));
        endTypeSelect.addEventListener('change', () => updateInputsForField('end'));

        // Initialize on load
        updateInputsForField('start');
        updateInputsForField('end');
    }

    /**
     * Get filter values from the form
     * @param {string} prefix
     * @returns {Object} { startDate: string, endDate: string }
     */
    function getFilterValues(prefix) {
        const startType = document.getElementById(`${prefix}-date-start-type`)?.value;
        const endType = document.getElementById(`${prefix}-date-end-type`)?.value;

        let startDate = '';
        let endDate = '';

        // Build start date value based on type
        if (startType === 'now') {
            startDate = 'now';
        } else if (startType === 'absolute') {
            const val = document.getElementById(`${prefix}-date-start-absolute`)?.value?.trim();
            startDate = val || '';
        } else if (startType === 'relative') {
            const num = document.getElementById(`${prefix}-date-start-relative`)?.querySelector('.date-relative-number')?.value?.trim();
            const unit = document.getElementById(`${prefix}-date-start-relative`)?.querySelector('.date-relative-unit')?.value?.trim();
            if (num && unit) {
                // unit is like "d ago", "w from now", etc.
                startDate = `${num}${unit}`; // "30d ago"
            }
        }

        // Build end date value based on type
        if (endType === 'now') {
            endDate = 'now';
        } else if (endType === 'absolute') {
            const val = document.getElementById(`${prefix}-date-end-absolute`)?.value?.trim();
            endDate = val || '';
        } else if (endType === 'relative') {
            const num = document.getElementById(`${prefix}-date-end-relative`)?.querySelector('.date-relative-number')?.value?.trim();
            const unit = document.getElementById(`${prefix}-date-end-relative`)?.querySelector('.date-relative-unit')?.value?.trim();
            if (num && unit) {
                endDate = `${num}${unit}`;
            }
        }

        return { startDate, endDate };
    }

    /**
     * Set filter values in the form
     * @param {string} prefix
     * @param {Object} values - { startDate: string, endDate: string }
     */
    function setFilterValues(prefix, values) {
        if (!values) return;

        // Helper function to parse and set a date field
        const setDateField = (field, dateStr) => {
            if (!dateStr) return;

            const typeSelect = document.getElementById(`${prefix}-date-${field}-type`);
            if (!typeSelect) return;

            if (dateStr === 'now') {
                typeSelect.value = 'now';
            } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                // Absolute date format
                typeSelect.value = 'absolute';
                document.getElementById(`${prefix}-date-${field}-absolute`).value = dateStr;
            } else if (dateStr.match(/^\d+[dwmy]\s+(ago|from now)$/)) {
                // Relative date format (e.g., "30d ago" or "2w from now")
                typeSelect.value = 'relative';
                const match = dateStr.match(/^(\d+)([dwmy])\s+(ago|from now)$/);
                if (match) {
                    const num = match[1];
                    const unit = match[2];
                    const direction = match[3];
                    
                    const unitValue = `${unit} ${direction}`; // e.g., "d ago" or "w from now"
                    
                    document.getElementById(`${prefix}-date-${field}-relative`).querySelector('.date-relative-number').value = num;
                    document.getElementById(`${prefix}-date-${field}-relative`).querySelector('.date-relative-unit').value = unitValue;
                }
            }
        };

        setDateField('start', values.startDate);
        setDateField('end', values.endDate);

        // Re-initialize handlers to show correct inputs
        setupTypeSelectHandlers(prefix);
    }

    /**
     * Clear filter values
     * @param {string} prefix
     */
    function clearFilterValues(prefix) {
        // Reset type selects to empty (-- Select --)
        const startTypeSelect = document.getElementById(`${prefix}-date-start-type`);
        const endTypeSelect = document.getElementById(`${prefix}-date-end-type`);

        if (startTypeSelect) startTypeSelect.value = '';
        if (endTypeSelect) endTypeSelect.value = '';

        // Clear all input values
        const startAbsolute = document.getElementById(`${prefix}-date-start-absolute`);
        const endAbsolute = document.getElementById(`${prefix}-date-end-absolute`);
        
        if (startAbsolute) startAbsolute.value = '';
        if (endAbsolute) endAbsolute.value = '';

        const startRelativeNum = document.getElementById(`${prefix}-date-start-relative`)?.querySelector('.date-relative-number');
        const endRelativeNum = document.getElementById(`${prefix}-date-end-relative`)?.querySelector('.date-relative-number');
        
        if (startRelativeNum) startRelativeNum.value = '';
        if (endRelativeNum) endRelativeNum.value = '';

        // Re-initialize handlers to show correct inputs
        setupTypeSelectHandlers(prefix);
    }

    return {
        getHTML,
        setupTypeSelectHandlers,
        getFilterValues,
        setFilterValues,
        clearFilterValues,
    };
})();
