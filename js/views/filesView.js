/**
 * FilesView — renders the Files page HTML with card list and filters.
 */
const FilesView = (() => {

    function render() {
        document.getElementById('page-title').textContent = 'Files';
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="records-search">
                <input type="text" id="file-search" placeholder="Search files..." class="search-input">
            </div>
            <div class="records-filter-bar" style="display:flex;align-items:center;gap:8px;">
                <button class="btn btn-outline btn-sm" id="file-toggle-filters">Filters &#9662;</button>
                <span id="file-active-filter-count" class="filter-count"></span>
                <select id="file-sort-field" style="margin-left:auto;padding:4px;border:1px solid #ddd;border-radius:4px;font-size:13px;">
                    <option value="date">Date</option>
                    <option value="name">Name</option>
                    <option value="size">Size</option>
                    <option value="type">Type</option>
                </select>
                <button id="file-sort-order-btn" class="btn btn-outline btn-sm" data-order="desc" title="Toggle Sort Order">
                    &#8595;
                </button>
            </div>
            <div id="files-list" class="records-list"></div>
            <div id="files-loading" class="loading-indicator hidden">Loading...</div>
            <div id="files-empty" class="empty-state hidden">No files found.</div>
            <button class="fab" id="add-file-btn" title="Add File">+</button>
        `;
    }

    function renderCard(file) {
        const tags = file.tags && file.tags.length
            ? file.tags.map(t => `<span class="tag-pill">${t}</span>`).join('')
            : '';
        const size = file.blob ? (file.blob.size / 1024).toFixed(1) + ' KB' : 'Unknown';

        const deletedClass = file.deletedAt ? 'deleted-record' : '';
        const deletedLabel = file.deletedAt ? '<span class="deleted-label" style="color:red;font-size:0.8em;margin-left:4px;">(Deleted)</span>' : '';

        return `<div class="record-card ${deletedClass}" data-id="${file.id}" style="${file.deletedAt ? 'opacity:0.6;' : ''}">
            <div class="record-card-top">
                <div class="record-card-desc">${file.name || '(unnamed)'}${deletedLabel}</div>
                <div style="font-size:12px;color:var(--text-secondary);">${file.fileType || ''}</div>
            </div>
            <div class="record-card-bottom">
                <span class="record-card-date">${file.createdAt ? new Date(file.createdAt).toLocaleDateString() : ''}</span>
                <span>${size}</span>
            </div>
            ${tags ? `<div class="record-card-tags">${tags}</div>` : ''}
        </div>`;
    }

    function getFormHTML(fileObj = null) {
        const f = fileObj || {};
        return `
            <form id="file-form">
                <div class="form-group">
                    <label for="file-name">Name</label>
                    <input type="text" id="file-name" value="${f.name || ''}" required>
                </div>
                ${!fileObj ? `
                <div class="form-group">
                    <label for="file-upload">File</label>
                    <input type="file" id="file-upload" required>
                </div>` : `
                <div class="form-group">
                    <label>File</label>
                    <p style="font-size:13px;color:#666;">${f.fileType || 'Unknown type'} &middot; Uploaded ${f.createdAt ? new Date(f.createdAt).toLocaleDateString() : ''}</p>
                    ${f.blob ? `<button type="button" class="btn btn-outline btn-sm" id="file-download-btn">Download</button>` : ''}
                </div>`}
                <div class="form-group">
                    <label>Tags</label>
                    <div id="file-tags-container" class="tag-container"></div>
                    <div class="tag-input-wrap">
                        <input type="text" id="file-tag-input" placeholder="Add tag...">
                        <div id="file-tag-suggestions" class="tag-suggestions hidden"></div>
                    </div>
                </div>
                <div class="form-group">
                    <label for="file-notes">Notes</label>
                    <textarea id="file-notes" rows="3" placeholder="Add notes...">${f.notes || ''}</textarea>
                </div>
                <div class="modal-actions">
                    ${fileObj ? `<button type="button" class="btn btn-danger" id="file-delete-btn">Delete</button>` : ''}
                    <button type="submit" class="btn btn-primary">${fileObj ? 'Update' : 'Upload'}</button>
                </div>
            </form>
        `;
    }

    function getFilterFormHTML() {
        return `
            <form id="file-filter-form">
                <div id="file-date-filter-container"></div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="file-f-tags">Tags</label>
                        <select id="file-f-tag-op">
                            <option value="">-- Select --</option>
                            <option value="any">Match Any</option>
                            <option value="all">Match All</option>
                        </select>
                        <div id="file-f-tags-container" class="tag-container"></div>
                        <div class="tag-input-wrap">
                            <input type="text" id="file-f-tag-input" placeholder="Filter by tag...">
                            <div id="file-f-tag-suggestions" class="tag-suggestions hidden"></div>
                        </div>
                    </div>
                </div>
                
                <div class="form-row">
                        <label for="file-include-deleted" style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
                            <span style="text-transform:none;font-size:13px;">Include Deleted</span>
                            <input type="checkbox" id="file-include-deleted">
                        </label>
                </div>
                
                <div class="modal-actions">
                    <button type="button" class="btn btn-outline btn-sm" id="file-clear-filters">Clear</button>
                    <button type="submit" class="btn btn-primary">Apply</button>
                </div>
            </form>
        `;
    }

    return { render, renderCard, getFormHTML, getFilterFormHTML };
})();
