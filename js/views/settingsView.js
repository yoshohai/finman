/**
 * SettingsView — renders settings UI.
 */
const SettingsView = (() => {
    async function render() {
        const authEnabled = await AuthService.isAuthEnabled();
        const webAuthnAvailable = await AuthService.isWebAuthnAvailable();

        return `
            <div>                
                <div style="border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; margin-top: 16px;">
                    <h3>Authentication</h3>
                    
                    ${authEnabled ? `
                        <div style="margin: 12px 0;">
                            <p style="color: #666; font-size: 14px; margin-bottom: 8px;">
                                ✓ Authentication is <strong>enabled</strong>
                            </p>
                        </div>
                        
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            ${webAuthnAvailable ? `
                                <button id="settings-reset-auth-btn" class="btn btn-sm" style="background: #2196F3; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                                    Re-register Authentication
                                </button>
                            ` : ''}
                            <button id="settings-disable-auth-btn" class="btn btn-sm" style="background: #c0392b; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                                Disable Authentication
                            </button>
                        </div>
                    ` : `
                        <p style="color: #666; font-size: 14px; margin-bottom: 12px;">
                           Authentication is not enabled. Set it up to secure your data.
                        </p>
                        ${webAuthnAvailable ? `
                            <button id="settings-enable-auth-btn" class="btn btn-sm" style="background: #4CAF50; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                                Enable Authentication
                            </button>
                        ` : `
                            <p style="color: #999; font-size: 14px;">
                                Authentication is not available on this device.
                            </p>
                        `}
                    `}
                </div>

                <div style="border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; margin-top: 16px;">
                    <h3>Backup & Restore</h3>
                    
                    <p style="color: #666; font-size: 14px; margin-bottom: 12px;">
                        Backup your financial data to your device or cloud storage and restore it anytime.
                    </p>
                    
                    <button id="settings-backup-btn" class="btn btn-sm" style="background: #FF9800; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                        Backup & Restore
                    </button>
                </div>
            </div>
        `;
    }

    return {
        render,
    };
})();
