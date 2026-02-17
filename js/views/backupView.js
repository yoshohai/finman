/**
 * BackupView — Renders the Backup/Restore modal content.
 */
const BackupView = (() => {
    function getModalHTML() {
        return `
            <div class="backup-tabs">
                <button class="backup-tab active" data-tab="backup">Backup</button>
                <button class="backup-tab" data-tab="restore">Restore</button>
                <button class="backup-tab" data-tab="reset">Reset</button>
            </div>
            
            <!-- BACKUP TAB -->
            <div id="tab-backup" class="backup-panel">
                <div>
                    <label>Destination</label>
                    <div>
                        <label><input type="radio" name="backup-dest" value="file" checked> Download JSON File</label>
                        <label><input type="radio" name="backup-dest" value="drive"> Google Drive</label>
                    </div>
                </div>
                <div id="backup-drive-auth" class="auth-section hidden">
                    <p class="auth-status">Not signed in</p>
                    <button class="btn btn-outline btn-sm" id="btn-drive-signin">Sign In to Google</button>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-primary" id="btn-start-backup">Start Backup</button>
                </div>
            </div>

            <!-- RESTORE TAB -->
            <div id="tab-restore" class="backup-panel hidden">
                <div>
                    <label>Source</label>
                    <div>
                        <label><input type="radio" name="restore-src" value="file" checked> JSON File</label>
                        <label><input type="radio" name="restore-src" value="drive"> Google Drive</label>
                    </div>
                </div>
                
                <div id="restore-file-section">
                    <div class="form-group">
                        <label>Select File</label>
                        <input type="file" id="restore-file-input" accept=".json">
                    </div>
                </div>

                <div id="restore-drive-section" class="hidden">
                    <div id="restore-drive-auth" class="auth-section">
                        <button class="btn btn-outline btn-sm" id="btn-drive-signin-restore">Sign In to Google</button>
                    </div>
                    <div id="restore-drive-list" class="hidden">
                        <label>Select Backup</label>
                        <select id="restore-drive-select">
                            <option value="">Loading...</option>
                        </select>
                        <button class="btn btn-outline btn-sm" id="btn-refresh-drive" style="margin-top:4px;">Refresh</button>
                    </div>
                </div>

                <div style="margin-top:16px;">
                    <label>Conflict Resolution</label>
                    <div>
                        <label><input type="radio" name="restore-strat" value="overwrite"> Overwrite</label>
                        <label><input type="radio" name="restore-strat" value="ignore" checked> Skip</label>
                    </div>
                    <p style="font-size:11px;color:#666;margin-top:4px;">
                        "Overwrite" will delete all current data before restoring.<br>
                        "Skip" will keep current data and only add non-existing records (by ID).
                    </p>
                </div>

                <div class="modal-actions">
                    <button class="btn btn-danger" id="btn-start-restore">Restore Data</button>
                </div>
            </div>
            <!-- RESET TAB -->
            <div id="tab-reset" class="backup-panel hidden">
                <p style="margin:12px 0;color:var(--text-secondary);font-size:13px;">This will permanently delete <strong>all data</strong> from the database — records, tags, files, attachments, settings, and widgets. This action cannot be undone. This action won't clear your backups.</p>
                <div class="modal-actions">
                    <button class="btn btn-danger" id="btn-start-reset">Reset All Data</button>
                </div>
            </div>
            <div id="backup-status" class="status-msg"></div>
        `;
    }

    return { getModalHTML };
})();
