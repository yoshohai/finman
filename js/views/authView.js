/**
 * AuthView — UI for WebAuthn authentication setup and login.
 */
const AuthView = (() => {
    function getSetupHTML() {
        return `
            <div id="auth-setup" >
                <h2 style="text-align: center; margin-bottom: 20px;">Secure Your Data</h2>
                <p style="color: #666; text-align: center; margin-bottom: 20px;">
                    Set up authentication (fingerprint, face, or security key) to secure your financial data.
                </p>
                
                <button id="auth-setup-btn" style="
                    width: 100%; padding: 12px; background: #4CAF50; color: white;
                    border: none; border-radius: 4px; font-size: 16px; cursor: pointer;
                    margin-bottom: 10px;
                ">Complete Setup</button>

                <button id="auth-skip-btn" style="
                    width: 100%; padding: 12px; background: #999; color: white;
                    border: none; border-radius: 4px; font-size: 16px; cursor: pointer;
                ">Skip for Now</button>

                <p id="auth-error" style="color: red; text-align: center; margin-top: 10px; display: none;"></p>
            </div>
        `;
    }

    function getSetupUnavailableHTML() {
        return `
            <div id="auth-unavailable" style="padding: 20px; max-width: 400px;">
                <h2 style="text-align: center; margin-bottom: 20px; color: #c0392b;">Setup Not Possible</h2>
                <p style="color: #666; text-align: center; margin-bottom: 20px;">
                    Authentication (WebAuthn) is not available on this device. 
                    Please use a device with WebAuthn capabilities.
                </p>
                
                <button id="auth-skip-btn" style="
                    width: 100%; padding: 12px; background: #999; color: white;
                    border: none; border-radius: 4px; font-size: 16px; cursor: pointer;
                ">Continue Without Authentication</button>
            </div>
        `;
    }

    function getLoginHTML() {
        return `
            <div id="auth-login" style="padding: 20px; max-width: 400px;">
                <p style="color: #666; text-align: center; margin-bottom: 20px;">
                    Use your authentication to unlock.
                </p>
                
                <button id="auth-btn" style="
                    width: 100%; padding: 12px; background: #4CAF50; color: white;
                    border: none; border-radius: 4px; font-size: 16px; cursor: pointer;
                ">Authenticate</button>

                <p id="auth-login-error" style="color: red; text-align: center; margin-top: 10px; display: none;"></p>
            </div>
        `;
    }

    function getLoginUnavailableHTML() {
        return `
            <div id="auth-login-unavailable" style="padding: 20px; max-width: 400px;">
                <h2 style="text-align: center; margin-bottom: 20px; color: #c0392b;">Authentication Unavailable</h2>
                <p style="color: #666; text-align: center; margin-bottom: 20px;">
                    Authentication (WebAuthn) is not available on this device. 
                    Please use the device where you set up authentication.
                </p>
                
                <p style="color: #999; text-align: center; font-size: 14px;">
                    Contact support if you need assistance.
                </p>
            </div>
        `;
    }

    return {
        getSetupHTML,
        getSetupUnavailableHTML,
        getLoginHTML,
        getLoginUnavailableHTML,
    };
})();
