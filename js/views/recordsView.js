/**
 * RecordsView — renders the Records page HTML with card list and filters.
 */
const RecordsView = (() => {

    function render() {
        document.getElementById('page-title').textContent = 'Records';
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="records-search">
                <input type="text" id="rec-search" placeholder="Search records..." class="search-input">
            </div>
            <div class="records-filter-bar" style="display:flex;align-items:center;gap:8px;">
                <button class="btn btn-outline btn-sm" id="rec-toggle-filters">Filters &#9662;</button>
                <span id="rec-active-filter-count" class="filter-count"></span>
                <select id="rec-sort-field" style="margin-left:auto;padding:4px;border:1px solid #ddd;border-radius:4px;font-size:13px;">
                    <option value="date">Date</option>
                    <option value="amount">Amount</option>
                    <option value="description">Description</option>
                    <option value="type">Type</option>
                    <option value="startDate">Start Date</option>
                    <option value="endDate">End Date</option>
                    <option value="createdAt">Created At</option>
                    <option value="modifiedAt">Modified At</option>
                </select>
                <button id="rec-sort-order-btn" class="btn btn-outline btn-sm" data-order="desc" title="Toggle Sort Order">
                    &#8595;
                </button>
            </div>
            <div id="records-list" class="records-list"></div>
            <div id="records-loading" class="loading-indicator hidden">Loading...</div>
            <div id="records-empty" class="empty-state hidden">No records found.</div>
            <button class="fab" id="add-record-btn" title="Add Record">+</button>
        `;
    }

    function renderCard(record) {
        const tags = record.tags && record.tags.length
            ? record.tags.map(t => `<span class="tag-pill">${t}</span>`).join('')
            : '';
        const recurIcon = record.recurring && record.recurring.enabled ? ' &#x21bb;' : '';
        const typeClass = record.type === 'Credit' ? 'credit' : 'debit';
        const sign = record.type === 'Credit' ? '+' : '-';

        const deletedClass = record.deletedAt ? 'deleted-record' : '';
        const deletedLabel = record.deletedAt ? '<span class="deleted-label" style="color:red;font-size:0.8em;margin-left:4px;">(Deleted)</span>' : '';

        let recurringInfo = '';
        if (record.recurring && record.recurring.enabled) {
            const { startDate, endDate, intervalValue, intervalUnit } = record.recurring;
            recurringInfo = `<div style="font-size:0.75em;color:#666;margin-top:4px;">
                Every ${intervalValue} ${intervalUnit} &middot; Start: ${startDate} ${endDate ? '&middot; End: ' + endDate : ''}
            </div>`;
        }

        return `<div class="record-card ${deletedClass}" data-id="${record.id}" style="${record.deletedAt ? 'opacity:0.6;' : ''}">
            <div class="record-card-top">
                <div class="record-card-desc">${record.description || '(no description)'}${recurIcon}${deletedLabel}</div>
                <div class="record-card-amount ${typeClass}">${sign}${Number(record.amount).toFixed(2)}</div>
            </div>
            <div class="record-card-bottom">
                <span class="record-card-date">${record.date || ''}</span>
                <span class="record-card-type ${typeClass}">${record.type}</span>
            </div>
            ${recurringInfo}
            ${record.attachments && record.attachments.length ? `
                <div style="margin-top:4px;font-size:0.75em;color:#555;">
                    ${record.attachments.map(a => `<span style="display:inline-block;background:#f0f0f0;padding:2px 4px;border-radius:3px;margin-right:4px;">&#128206; ${a.fileName}</span>`).join('')}
                </div>
            ` : ''}
            ${tags ? `<div class="record-card-tags">${tags}</div>` : ''}
        </div>`;
    }

    function getFormHTML(record = null) {
        const r = record || {};
        const isRecurring = r.recurring && r.recurring.enabled;
        return `
            <form id="record-form">
                <div class="form-group">
                    <label for="rec-type">Type</label>
                    <select id="rec-type" required>
                        <option value="Credit" ${r.type === 'Credit' ? 'selected' : ''}>Credit</option>
                        <option value="Debit" ${r.type === 'Debit' ? 'selected' : ''}>Debit</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="rec-desc">Description</label>
                    <input type="text" id="rec-desc" value="${r.description || ''}" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="rec-amount">Amount</label>
                        <input type="number" id="rec-amount" step="0.01" min="0" value="${r.amount || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="rec-date">Date</label>
                        <input type="date" id="rec-date" value="${r.date || new Date().toISOString().split('T')[0]}" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>Tags</label>
                    <div id="rec-tags-container" class="tag-container"></div>
                    <div class="tag-input-wrap">
                        <input type="text" id="rec-tag-input" placeholder="Add tag...">
                        <div id="rec-tag-suggestions" class="tag-suggestions hidden"></div>
                    </div>
                </div>
                <div class="form-group">
                    <label>Attachments</label>
                    <ul id="rec-attachments" class="attachment-list"></ul>
                    <button type="button" class="btn btn-outline btn-sm" id="rec-add-attachment">+ Attach File</button>
                </div>
                <div class="form-group">
                    <div class="checkbox-group">
                        <input type="checkbox" id="rec-recurring" ${isRecurring ? 'checked' : ''}>
                        <label for="rec-recurring" style="margin-bottom:0;text-transform:none;font-size:14px;">Recurring</label>
                    </div>
                    <div id="rec-recurring-fields" class="recurring-fields ${isRecurring ? 'visible' : ''}">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="rec-rec-start">Start Date</label>
                                <input type="date" id="rec-rec-start" value="${isRecurring ? r.recurring.startDate : ''}">
                            </div>
                            <div class="form-group">
                                <label for="rec-rec-end">End Date</label>
                                <input type="date" id="rec-rec-end" value="${isRecurring ? r.recurring.endDate : ''}">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="rec-rec-interval">Every</label>
                                <input type="number" id="rec-rec-interval" min="1" value="${isRecurring ? r.recurring.intervalValue : '1'}">
                            </div>
                            <div class="form-group">
                                <label for="rec-rec-unit">Period</label>
                                <select id="rec-rec-unit">
                                    <option value="Days" ${isRecurring && r.recurring.intervalUnit === 'Days' ? 'selected' : ''}>Days</option>
                                    <option value="Months" ${isRecurring && r.recurring.intervalUnit === 'Months' ? 'selected' : ''}>Months</option>
                                    <option value="Years" ${isRecurring && r.recurring.intervalUnit === 'Years' ? 'selected' : ''}>Years</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-actions">
                    ${record ? `<button type="button" class="btn btn-danger" id="rec-delete-btn">Delete</button>` : ''}
                    <button type="submit" class="btn btn-primary">${record ? 'Update' : 'Add'}</button>
                </div>
            </form>
        `;
    }

    function getAttachmentPickerHTML(files) {
        if (!files.length) return '<p style="padding:8px;color:#666;">No files available. Upload files on the Files page first.</p>';
        let html = '<div style="max-height:200px;overflow-y:auto;">';
        for (const f of files) {
            html += `<div class="breakdown-item" style="cursor:pointer;" data-file-id="${f.id}">
                <span>${f.name}</span><span class="btn btn-sm btn-outline">Attach</span>
            </div>`;
        }
        html += '</div>';
        return html;
    }

    function getFilterFormHTML() {
        return `
            <form id="rec-filter-form">
                <div id="rec-date-filter-container"></div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="rec-f-type">Type</label>
                        <select id="rec-f-type">
                            <option value="">-- Select --</option>
                            <option value="Credit">Credit</option>
                            <option value="Debit">Debit</option>
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="rec-f-tags">Tags</label>
                        <select id="rec-f-tag-op">
                            <option value="">-- Select --</option>
                            <option value="any">Match Any</option>
                            <option value="all">Match All</option>
                        </select>
                        <div id="rec-f-tags-container" class="tag-container"></div>
                        <div class="tag-input-wrap">
                            <input type="text" id="rec-f-tag-input" placeholder="Filter by tag...">
                            <div id="rec-f-tag-suggestions" class="tag-suggestions hidden"></div>
                        </div>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="rec-f-amt-op">Amount</label>
                        <select id="rec-f-amt-op">
                            <option value="">-- Select --</option>
                            <option value="eq">= Equal</option>
                            <option value="lt">&lt; Less than</option>
                            <option value="lte">&le; Less or equal</option>
                            <option value="gt">&gt; Greater than</option>
                            <option value="gte">&ge; Greater or equal</option>
                            <option value="between">Between</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="rec-f-amt-val">Value</label>
                        <input type="number" id="rec-f-amt-val" step="0.01" placeholder="Amount">
                    </div>
                    <div class="form-group" id="rec-f-amt-val2-group" style="display:none;">
                        <label for="rec-f-amt-val2">To</label>
                        <input type="number" id="rec-f-amt-val2" step="0.01" placeholder="Max">
                    </div>
                </div>

                <div class="form-row">
                    <label for="rec-include-deleted" style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
                            <span style="text-transform:none;font-size:13px;">Include Deleted</span>
                            <input type="checkbox" id="rec-include-deleted">
                    </label>
                </div>

                <div class="modal-actions">
                    <button type="button" class="btn btn-outline btn-sm" id="rec-clear-filters">Clear</button>
                    <button type="submit" class="btn btn-primary">Apply</button>
                </div>
            </form>
        `;
    }

    return { render, renderCard, getFormHTML, getAttachmentPickerHTML, getFilterFormHTML };
})();
