/**
 * AuthService — handles authentication using WebAuthn only.
 */
const AuthService = (() => {
    const AUTH_STORE = 'auth';
    const AUTH_KEY = 'auth_config';
    const AUTH_SKIP_KEY = 'auth_setup_skipped';
    const SKIP_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

    /**
     * Convert ArrayBuffer to base64 string
     */
    function arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Convert base64 string to Uint8Array
     */
    function base64ToUint8Array(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    /**
     * Check if authentication is enabled
     */
    async function isAuthEnabled() {
        const db = await DB.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(AUTH_STORE, 'readonly');
            const req = tx.objectStore(AUTH_STORE).get(AUTH_KEY);
            req.onsuccess = () => {
                const config = req.result;
                resolve(config && config.enabled === true);
            };
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * Get authentication config
     */
    async function getAuthConfig() {
        const db = await DB.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(AUTH_STORE, 'readonly');
            const req = tx.objectStore(AUTH_STORE).get(AUTH_KEY);
            req.onsuccess = () => resolve(req.result || {});
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * Check if WebAuthn is available
     */
    async function isWebAuthnAvailable() {
        return window.PublicKeyCredential !== undefined &&
            navigator.credentials !== undefined;
    }

    /**
     * Register WebAuthn credential
     */
    async function registerWebAuthn() {
        const available = await isWebAuthnAvailable();
        if (!available) {
            throw new Error('WebAuthn not available on this device');
        }

        try {
            const credential = await navigator.credentials.create({
                publicKey: {
                    challenge: new Uint8Array(32).map(() => Math.floor(Math.random() * 256)),
                    rp: {
                        name: 'Personal Finance Manager',
                        id: window.location.hostname,
                    },
                    user: {
                        id: new Uint8Array(16).map(() => Math.floor(Math.random() * 256)),
                        name: 'user@finman.local',
                        displayName: 'User',
                    },
                    pubKeyCredParams: [{ type: 'public-key', alg: -7 }], // ES256
                    timeout: 60000,
                    attestation: 'direct',
                    userVerification: 'preferred',
                },
            });

            if (!credential) {
                throw new Error('WebAuthn enrollment was cancelled');
            }

            // Store rawId as base64 string for persistence
            const credentialIdBase64 = arrayBufferToBase64(credential.rawId);
            return {
                id: credential.id,
                rawIdBase64: credentialIdBase64,
            };
        } catch (err) {
            console.error('WebAuthn registration error:', err);
            throw err;
        }
    }

    /**
     * Setup authentication with WebAuthn
     */
    async function setupAuth() {
        const available = await isWebAuthnAvailable();
        if (!available) {
            throw new Error('WebAuthn is required but not available on this device');
        }

        try {
            const credential = await registerWebAuthn();
            const db = await DB.getDB();

            const config = {
                key: AUTH_KEY,
                enabled: true,
                credentialId: credential.rawIdBase64,
                createdAt: new Date().toISOString(),
            };

            return new Promise((resolve, reject) => {
                const tx = db.transaction(AUTH_STORE, 'readwrite');
                const req = tx.objectStore(AUTH_STORE).put(config);
                req.onsuccess = () => resolve(config);
                req.onerror = () => reject(req.error);
            });
        } catch (err) {
            throw err;
        }
    }

    /**
     * Authenticate using WebAuthn
     */
    async function authenticate() {
        const config = await getAuthConfig();
        if (!config.credentialId) {
            throw new Error('WebAuthn not registered');
        }

        const available = await isWebAuthnAvailable();
        if (!available) {
            throw new Error('WebAuthn not available');
        }

        try {
            // Convert stored base64 credential ID back to Uint8Array
            const credentialIdBytes = base64ToUint8Array(config.credentialId);

            const assertion = await navigator.credentials.get({
                publicKey: {
                    challenge: new Uint8Array(32).map(() => Math.floor(Math.random() * 256)),
                    timeout: 60000,
                    userVerification: 'preferred',
                    allowCredentials: [
                        {
                            type: 'public-key',
                            id: credentialIdBytes,
                        },
                    ],
                },
            });

            return assertion != null;
        } catch (err) {
            console.error('WebAuthn authentication error:', err);
            if (err.name === 'NotAllowedError') {
                return false; // User cancelled
            }
            throw err;
        }
    }

    /**
     * Mark that the user skipped auth setup
     */
    async function markAuthSkipped() {
        const db = await DB.getDB();
        const skipRecord = {
            key: AUTH_SKIP_KEY,
            timestamp: Date.now(),
        };
        return new Promise((resolve, reject) => {
            const tx = db.transaction(AUTH_STORE, 'readwrite');
            const req = tx.objectStore(AUTH_STORE).put(skipRecord);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * Check if auth setup was skipped recently (within 24 hours)
     */
    async function isAuthSkippedRecently() {
        const db = await DB.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(AUTH_STORE, 'readonly');
            const req = tx.objectStore(AUTH_STORE).get(AUTH_SKIP_KEY);
            req.onsuccess = () => {
                const skipRecord = req.result;
                if (skipRecord && skipRecord.timestamp) {
                    const timeElapsed = Date.now() - skipRecord.timestamp;
                    resolve(timeElapsed < SKIP_DURATION_MS);
                } else {
                    resolve(false);
                }
            };
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * Clear the auth skip record
     */
    async function clearAuthSkip() {
        const db = await DB.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(AUTH_STORE, 'readwrite');
            const req = tx.objectStore(AUTH_STORE).delete(AUTH_SKIP_KEY);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * Disable authentication
     */
    async function disableAuth() {
        const db = await DB.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(AUTH_STORE, 'readwrite');
            const req = tx.objectStore(AUTH_STORE).delete(AUTH_KEY);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    return {
        isAuthEnabled,
        getAuthConfig,
        setupAuth,
        authenticate,
        isWebAuthnAvailable,
        disableAuth,
        markAuthSkipped,
        isAuthSkippedRecently,
        clearAuthSkip,
    };
})();
