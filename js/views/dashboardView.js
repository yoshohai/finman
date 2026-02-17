/**
 * DashboardView — renders the Dashboard page HTML.
 */
const DashboardView = (() => {

    function render() {
        document.getElementById('page-title').textContent = 'Dashboard';
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="widgets-section" style="margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                    <h2 style="margin:0;font-size:1.2rem;color:var(--text-primary);">Widgets</h2>
                    <button id="dash-add-widget-btn" class="btn btn-sm btn-outline" style="padding:2px 8px;font-size:1.2rem;line-height:1;">+</button>
                </div>
                <div id="dash-widgets-container" class="summary-cards" style="border-bottom:1px solid var(--border);padding-bottom:10px;"></div>
            </div>
            <div class="projection-section">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                    <h2 style="margin:0;font-size:1.2rem;color:var(--text-primary);">Projection</h2>
                    <button class="btn btn-outline btn-sm" id="dash-toggle-filters" style="margin-left:auto;">Filters &#9662;</button>
                    <span id="dash-active-filter-count" class="filter-count"></span>
                </div>
                <div class="summary-cards">
                    <div class="summary-card">
                        <div class="card-label">Credits</div>
                        <div class="card-value credit" id="dash-credits">0</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">Debits</div>
                        <div class="card-value debit" id="dash-debits">0</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">Net</div>
                        <div class="card-value" id="dash-net">0</div>
                    </div>
                </div>
                <div class="chart-wrap">
                    <canvas id="dash-chart"></canvas>
                </div>
                <div class="breakdown-section" id="dash-breakdown">
                    <h3>Breakdown by Interval</h3>
                    <div id="dash-breakdown-list"></div>
                </div>
            </div>
        `;
    }

    function getWidgetFormHTML() {
        return `
            <form id="widget-form">
                <div class="form-group">
                    <label for="wid-name">Widget Name</label>
                    <input type="text" id="wid-name" required placeholder="e.g. FD">
                </div>
                
                <h3 style="font-size:1rem;margin:10px 0;border-bottom:1px solid #eee;">Filters</h3>
                
                <div id="wid-date-filter-container"></div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="wid-f-type">Type</label>
                        <select id="wid-f-type">
                            <option value="">-- Select --</option>
                            <option value="Credit">Credit</option>
                            <option value="Debit">Debit</option>
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="wid-f-tags">Tags</label>
                        <select id="wid-f-tag-op">
                            <option value="">-- Select --</option>
                            <option value="any">Match Any</option>
                            <option value="all">Match All</option>
                        </select>
                        <div id="wid-f-tags-container" class="tag-container"></div>
                        <div class="tag-input-wrap">
                            <input type="text" id="wid-f-tag-input" placeholder="Add tag...">
                            <div id="wid-f-tag-suggestions" class="tag-suggestions hidden"></div>
                        </div>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="wid-f-amt-op">Amount</label>
                        <select id="wid-f-amt-op">
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
                        <label for="wid-f-amt-val">Value</label>
                        <input type="number" id="wid-f-amt-val" step="0.01" placeholder="Amount">
                    </div>
                    <div class="form-group" id="wid-f-amt-val2-group" style="display:none;">
                        <label for="wid-f-amt-val2">To</label>
                        <input type="number" id="wid-f-amt-val2" step="0.01" placeholder="Max">
                    </div>
                </div>

                <h3 style="font-size:1rem;margin:10px 0;border-bottom:1px solid #eee;">Aggregation</h3>
                
                <div class="form-group">
                    <label for="wid-agg">Aggregation Type</label>
                    <select id="wid-agg">
                        <option value="sum">Sum of Amounts</option>
                        <option value="count">Count of Records</option>
                    </select>
                </div>

                <div class="modal-actions">
                    <button type="submit" class="btn btn-primary">Add Widget</button>
                </div>
            </form>
        `;
    }

    function getFilterFormHTML() {
        return `
            <form id="dash-filter-form">
                <div id="dash-date-filter-container"></div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="dash-f-type">Type</label>
                        <select id="dash-f-type">
                            <option value="">-- Select --</option>
                            <option value="Credit">Credit</option>
                            <option value="Debit">Debit</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="dash-f-tags">Tags</label>
                        <select id="dash-f-tag-op">
                            <option value="">-- Select --</option>
                            <option value="any">Match Any</option>
                            <option value="all">Match All</option>
                        </select>
                        <div id="dash-f-tags-container" class="tag-container"></div>
                        <div class="tag-input-wrap">
                            <input type="text" id="dash-f-tag-input" placeholder="Filter by tag...">
                            <div id="dash-f-tag-suggestions" class="tag-suggestions hidden"></div>
                        </div>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="dash-f-amt-op">Amount</label>
                        <select id="dash-f-amt-op">
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
                        <label for="dash-f-amt-val">Value</label>
                        <input type="number" id="dash-f-amt-val" step="0.01" placeholder="Amount">
                    </div>
                    <div class="form-group" id="dash-f-amt-val2-group" style="display:none;">
                        <label for="dash-f-amt-val2">To</label>
                        <input type="number" id="dash-f-amt-val2" step="0.01" placeholder="Max">
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="dash-interval">Interval</label>
                        <select id="dash-interval">
                            <option value="daily">Daily</option>
                            <option value="monthly" selected>Monthly</option>
                            <option value="yearly">Yearly</option>
                        </select>
                    </div>
                </div>
                
                <div class="modal-actions">
                    <button type="button" class="btn btn-outline btn-sm" id="dash-clear-filters">Clear</button>
                    <button type="submit" class="btn btn-primary">Apply</button>
                </div>
            </form>
        `;
    }

    return { render, getWidgetFormHTML, getFilterFormHTML };
})();
