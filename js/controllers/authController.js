/**
 * AuthController — handles authentication flow on app load.
 */
const AuthController = (() => {
    let authResolve = null;
    let authReject = null;

    /**
     * Returns a promise that resolves when authentication is complete
     */
    function authenticate() {
        return new Promise((resolve, reject) => {
            authResolve = resolve;
            authReject = reject;
            checkAuthStatus();
        });
    }

    async function checkAuthStatus() {
        try {
            const authEnabled = await AuthService.isAuthEnabled();
            const skippedRecently = await AuthService.isAuthSkippedRecently();

            if (!authEnabled) {
                // If user skipped recently, don't show setup
                if (skippedRecently) {
                    completeAuth();
                } else {
                    // Show setup dialog
                    showSetup();
                }
            } else {
                // Show login dialog
                showLogin();
            }
        } catch (err) {
            console.error('Auth status check failed:', err);
            authReject?.(err);
        }
    }

    async function showSetup() {
        const webAuthnAvailable = await AuthService.isWebAuthnAvailable();

        if (!webAuthnAvailable) {
            // WebAuthn is not available - show unavailable screen
            document.getElementById('app').innerHTML = AuthView.getSetupUnavailableHTML();
            
            // Bind the skip button for unavailable case
            const skipBtn = document.getElementById('auth-skip-btn');
            skipBtn.addEventListener('click', async () => {
                try {
                    console.log('User chose to continue without authentication');
                    await AuthService.markAuthSkipped();
                    completeAuth();
                } catch (err) {
                    console.error('Failed to mark auth as skipped:', err);
                    completeAuth();
                }
            });
            return;
        }

        // Show setup UI in full app container
        document.getElementById('app').innerHTML = AuthView.getSetupHTML();

        const setupBtn = document.getElementById('auth-setup-btn');
        const skipBtn = document.getElementById('auth-skip-btn');
        const errorMsg = document.getElementById('auth-error');

        setupBtn.addEventListener('click', async () => {
            setupBtn.disabled = true;
            setupBtn.textContent = 'Setting up...';
            errorMsg.style.display = 'none';

            try {
                await AuthService.setupAuth();
                completeAuth();
            } catch (err) {
                console.error('Setup failed:', err);
                errorMsg.textContent = err.message || 'Setup failed. Please try again.';
                errorMsg.style.display = 'block';
                setupBtn.disabled = false;
                setupBtn.textContent = 'Complete Setup';
            }
        });

        skipBtn.addEventListener('click', async () => {
            try {
                console.log('User chose to skip authentication setup');
                await AuthService.markAuthSkipped();
                completeAuth();
            } catch (err) {
                console.error('Failed to mark auth as skipped:', err);
                completeAuth();
            }
        });
    }

    async function showLogin() {
        // Check if WebAuthn is available
        const webAuthnAvailable = await AuthService.isWebAuthnAvailable();
        if (!webAuthnAvailable) {
            document.getElementById('app').innerHTML = AuthView.getLoginUnavailableHTML();
            return;
        }

        // Show login UI in full app container
        document.getElementById('app').innerHTML = AuthView.getLoginHTML();

        const authBtn = document.getElementById('auth-btn');
        const errorMsg = document.getElementById('auth-login-error');

        authBtn.addEventListener('click', async () => {
            authBtn.disabled = true;
            authBtn.textContent = 'Authenticating...';
            errorMsg.style.display = 'none';

            try {
                const authenticated = await AuthService.authenticate();
                if (authenticated) {
                    completeAuth();
                } else {
                    errorMsg.textContent = 'Authentication cancelled or failed';
                    errorMsg.style.display = 'block';
                    authBtn.disabled = false;
                    authBtn.textContent = 'Authenticate';
                }
            } catch (err) {
                console.error('Authentication failed:', err);
                errorMsg.textContent = err.message || 'Authentication failed';
                errorMsg.style.display = 'block';
                authBtn.disabled = false;
                authBtn.textContent = 'Authenticate';
            }
        });

        authBtn.focus();
    }

    function completeAuth() {
        // Clear the auth UI
        document.getElementById('app').innerHTML = '';
        document.getElementById('app-header').style.display = '';
        document.getElementById('bottom-nav').style.display = '';
        authResolve?.();
    }

    return { authenticate };
})();
