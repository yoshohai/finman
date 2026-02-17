/**
 * SettingsController — handles settings page.
 */
const SettingsController = (() => {
    async function init() {
        document.getElementById('page-title').textContent = 'Settings';
        const app = document.getElementById('app');
        const html = await SettingsView.render();
        app.innerHTML = html;
        bindEvents();
    }

    async function bindEvents() {
        const enableBtn = document.getElementById('settings-enable-auth-btn');
        const resetBtn = document.getElementById('settings-reset-auth-btn');
        const disableBtn = document.getElementById('settings-disable-auth-btn');
        const backupBtn = document.getElementById('settings-backup-btn');

        if (enableBtn) {
            enableBtn.addEventListener('click', enableAuthentication);
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', resetAuthentication);
        }

        if (disableBtn) {
            disableBtn.addEventListener('click', disableAuthentication);
        }

        if (backupBtn) {
            backupBtn.addEventListener('click', openBackupModal);
        }
    }

    async function enableAuthentication() {
        const webAuthnAvailable = await AuthService.isWebAuthnAvailable();
        if (!webAuthnAvailable) {
            alert('WebAuthn is not available on this device');
            return;
        }

        Modal.open('Enable Authentication', `
            <div style="padding: 20px; text-align: center;">
                <p style="color: #666; margin-bottom: 20px;">
                    Follow the prompts to set up authentication.
                </p>
                <button id="setup-auth-btn" style="
                    width: 100%; padding: 12px; background: #4CAF50; color: white;
                    border: none; border-radius: 4px; font-size: 16px; cursor: pointer; margin-bottom: 10px;
                ">Begin Setup</button>
                <p id="setup-error" style="color: red; display: none;"></p>
            </div>
        `);

        const setupBtn = document.getElementById('setup-auth-btn');
        const errorMsg = document.getElementById('setup-error');

        setupBtn.addEventListener('click', async () => {
            setupBtn.disabled = true;
            setupBtn.textContent = 'Setting up...';
            errorMsg.style.display = 'none';

            try {
                await AuthService.setupAuth();
                Modal.close();
                init(); // Refresh settings page
            } catch (err) {
                console.error('Setup failed:', err);
                errorMsg.textContent = err.message || 'Setup failed. Please try again.';
                errorMsg.style.display = 'block';
                setupBtn.disabled = false;
                setupBtn.textContent = 'Begin Setup';
            }
        });
    }

    async function resetAuthentication() {
        if (confirm('Re-register authentication? You will need to authenticate again.')) {
            try {
                await AuthService.disableAuth();
                await setTimeout(() => {}, 500); // Brief delay
                await AuthService.setupAuth();
                init(); // Refresh settings page
            } catch (err) {
                alert('Failed to reset authentication: ' + (err.message || 'Unknown error'));
                console.error('Reset auth failed:', err);
            }
        }
    }

    async function disableAuthentication() {
        if (confirm('Are you sure? This will remove all authentication protection.')) {
            try {
                await AuthService.disableAuth();
                init(); // Refresh settings page
            } catch (err) {
                alert('Failed to disable authentication');
                console.error('Disable auth failed:', err);
            }
        }
    }

    function openBackupModal() {
        Modal.open('Backup & Restore', BackupView.getModalHTML());
        bindBackupEvents();
        updateDriveStatus();
    }

    function bindBackupEvents() {
        // Tabs
        document.querySelectorAll('.backup-tab').forEach(t => {
            t.addEventListener('click', (e) => {
                document.querySelectorAll('.backup-tab').forEach(x => x.classList.remove('active'));
                e.target.classList.add('active');
                const tab = e.target.dataset.tab;
                document.querySelectorAll('.backup-panel').forEach(p => p.classList.add('hidden'));
                document.getElementById('tab-' + tab).classList.remove('hidden');
            });
        });

        // Backup Dest Radio
        document.querySelectorAll('input[name="backup-dest"]').forEach(r => {
            r.addEventListener('change', (e) => {
                const isDrive = e.target.value === 'drive';
                document.getElementById('backup-drive-auth').classList.toggle('hidden', !isDrive);
            });
        });

        // Drive Sign In (Backup)
        document.getElementById('btn-drive-signin').addEventListener('click', async () => {
            try {
                const success = await GoogleDriveService.signIn();
                updateDriveStatus();
            } catch (e) {
                alert('Sign in failed: ' + e.message);
            }
        });

        // Start Backup
        document.getElementById('btn-start-backup').addEventListener('click', async () => {
            const dest = document.querySelector('input[name="backup-dest"]:checked').value;
            const btn = document.getElementById('btn-start-backup');
            const status = document.getElementById('backup-status');

            btn.disabled = true;
            status.textContent = 'Exporting data...';

            try {
                const json = await BackupService.exportData();
                const filename = `finance_backup_${new Date().toISOString().slice(0, 10)}.json`;

                if (dest === 'file') {
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(url);
                    status.textContent = 'Backup file downloaded.';
                } else {
                    status.textContent = 'Uploading to Drive...';
                    await GoogleDriveService.uploadFile(filename, json);
                    status.textContent = 'Backup saved to Google Drive.';
                }
            } catch (e) {
                console.error(e);
                status.textContent = 'Error: ' + e.message;
            } finally {
                btn.disabled = false;
            }
        });

        // Restore Source Radio
        document.querySelectorAll('input[name="restore-src"]').forEach(r => {
            r.addEventListener('change', (e) => {
                const isDrive = e.target.value === 'drive';
                document.getElementById('restore-file-section').classList.toggle('hidden', isDrive);
                document.getElementById('restore-drive-section').classList.toggle('hidden', !isDrive);
                if (isDrive) updateDriveStatus();
            });
        });

        // Drive Sign In (Restore)
        document.getElementById('btn-drive-signin-restore').addEventListener('click', async () => {
            try {
                await GoogleDriveService.signIn();
                updateDriveStatus();
            } catch (e) {
                alert('Sign in failed: ' + e.message);
            }
        });

        // Refresh Drive List
        document.getElementById('btn-refresh-drive').addEventListener('click', loadDriveBackups);

        // Reset DB
        const btnReset = document.getElementById('btn-start-reset');
        if (btnReset) {
            btnReset.addEventListener('click', async () => {
                if (!confirm('Are you sure? This will permanently delete ALL data. This cannot be undone.')) return;
                const btn = document.getElementById('btn-start-reset');
                const status = document.getElementById('backup-status');
                btn.disabled = true;
                status.textContent = 'Resetting database...';
                try {
                    const db = await DB.getDB();
                    const storeNames = Array.from(db.objectStoreNames);
                    const tx = db.transaction(storeNames, 'readwrite');
                    storeNames.forEach(name => tx.objectStore(name).clear());
                    await new Promise((resolve, reject) => {
                        tx.oncomplete = resolve;
                        tx.onerror = () => reject(tx.error);
                    });
                    status.textContent = 'All data cleared! Reloading...';
                    setTimeout(() => window.location.reload(), 1500);
                } catch (e) {
                    console.error(e);
                    status.textContent = 'Error: ' + e.message;
                    btn.disabled = false;
                }
            });
        }

        // Start Restore
        const btnRestore = document.getElementById('btn-start-restore');
        if (btnRestore) {
            btnRestore.addEventListener('click', async () => {
                const srcInput = document.querySelector('input[name="restore-src"]:checked');
                const stratInput = document.querySelector('input[name="restore-strat"]:checked');
                
                if (!srcInput || !stratInput) {
                    alert('Please select restore options');
                    return;
                }
                
                const src = srcInput.value;
                const strat = stratInput.value;
                const btn = document.getElementById('btn-start-restore');
                const status = document.getElementById('backup-status');

                if (!confirm(`Are you sure you want to restore? Strategy: ${strat.toUpperCase()}`)) return;

                btn.disabled = true;
                status.textContent = 'Restoring...';

                try {
                    let json = '';
                    if (src === 'file') {
                        const fileInput = document.getElementById('restore-file-input');
                        if (!fileInput.files.length) throw new Error('No file selected.');
                        json = await readFileText(fileInput.files[0]);
                    } else {
                        const fileId = document.getElementById('restore-drive-select').value;
                        if (!fileId) throw new Error('No backup selected.');
                        status.textContent = 'Downloading from Drive...';
                        json = await GoogleDriveService.downloadFile(fileId);
                    }

                    status.textContent = 'Importing data...';
                    await BackupService.importData(json, strat);
                    status.textContent = 'Restore complete! Reloading...';
                    setTimeout(() => window.location.reload(), 1500);

                } catch (e) {
                    console.error(e);
                    status.textContent = 'Error: ' + e.message;
                    btn.disabled = false;
                }
            });
        }
    }

    function updateDriveStatus() {
        const signedIn = GoogleDriveService.isSignedIn();
        const signInBtns = [document.getElementById('btn-drive-signin'), document.getElementById('btn-drive-signin-restore')];

        signInBtns.forEach(btn => {
            if (btn) {
                if (signedIn) {
                    btn.textContent = 'Signed In';
                    btn.disabled = true;
                    btn.classList.add('btn-success');
                } else {
                    btn.textContent = 'Sign In to Google';
                    btn.disabled = false;
                    btn.classList.remove('btn-success');
                }
            }
        });

        if (signedIn) {
            if (!document.getElementById('restore-drive-section').classList.contains('hidden')) {
                loadDriveBackups();
            }
        }
    }

    async function loadDriveBackups() {
        const select = document.getElementById('restore-drive-select');
        select.innerHTML = '<option>Loading...</option>';
        try {
            const files = await GoogleDriveService.listBackups();
            if (!files || !files.length) {
                select.innerHTML = '<option value="">No backups found</option>';
                return;
            }
            select.innerHTML = files.map(f =>
                `<option value="${f.id}">${f.name} (${new Date(f.createdTime).toLocaleString()})</option>`
            ).join('');
            document.getElementById('restore-drive-list').classList.remove('hidden');
        } catch (e) {
            select.innerHTML = '<option>Error loading backups</option>';
            console.error(e);
        }
    }

    function readFileText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    return { init };
})();
