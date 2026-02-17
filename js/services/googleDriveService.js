/**
 * GoogleDriveService — Handles Google Drive integration.
 * Requires CLIENT_ID and API_KEY from Google Cloud Console.
 */
const GoogleDriveService = (() => {
    // TODO: User must replace these with their own credentials
    const CLIENT_ID = 'YOUR_CLIENT_ID';
    const API_KEY = 'YOUR_API_KEY';
    const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
    const SCOPES = 'https://www.googleapis.com/auth/drive.file';

    let gapiLoaded = false;
    let gisInited = false;

    async function loadGapi() {
        if (gapiLoaded) return;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = () => {
                gapi.load('client:auth2', async () => {
                    try {
                        await gapi.client.init({
                            apiKey: API_KEY,
                            clientId: CLIENT_ID,
                            discoveryDocs: DISCOVERY_DOCS,
                            scope: SCOPES
                        });
                        gapiLoaded = true;
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                });
            };
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }

    async function signIn() {
        // Check if config is present
        if (CLIENT_ID === 'YOUR_CLIENT_ID') {
            alert('Google Drive integration requires a Client ID. Please configure it in js/services/googleDriveService.js');
            return false;
        }
        await loadGapi();
        const authInstance = gapi.auth2.getAuthInstance();
        if (!authInstance.isSignedIn.get()) {
            await authInstance.signIn();
        }
        return authInstance.isSignedIn.get();
    }

    async function signOut() {
        if (!gapiLoaded) return;
        const authInstance = gapi.auth2.getAuthInstance();
        await authInstance.signOut();
    }

    function isSignedIn() {
        if (!gapiLoaded) return false;
        return gapi.auth2.getAuthInstance().isSignedIn.get();
    }

    /**
     * Upload JSON content as a file.
     * Searches for existing file with same name to update it, or creates new.
     */
    async function uploadFile(filename, content) {
        if (!isSignedIn()) {
            const success = await signIn();
            if (!success) throw new Error('User not signed in');
        }

        // Check if file exists to update it
        const existing = await findFile(filename);
        const fileId = existing ? existing.id : null;

        const metadata = {
            name: filename,
            mimeType: 'application/json'
        };

        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";

        const multipartRequestBody =
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            content +
            close_delim;

        const request = gapi.client.request({
            'path': fileId ? `/upload/drive/v3/files/${fileId}` : '/upload/drive/v3/files',
            'method': fileId ? 'PATCH' : 'POST',
            'params': { 'uploadType': 'multipart' },
            'headers': {
                'Content-Type': 'multipart/related; boundary="' + boundary + '"'
            },
            'body': multipartRequestBody
        });

        return request.then(response => response.result);
    }

    async function findFile(filename) {
        const response = await gapi.client.drive.files.list({
            q: `name = '${filename}' and trashed = false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });
        const files = response.result.files;
        return files && files.length > 0 ? files[0] : null;
    }

    async function listBackups() {
        if (!isSignedIn()) {
            const success = await signIn();
            if (!success) throw new Error('User not signed in');
        }
        const response = await gapi.client.drive.files.list({
            q: "name contains 'finance_manager_backup' and trashed = false",
            fields: 'files(id, name, createdTime)',
            orderBy: 'createdTime desc',
            spaces: 'drive'
        });
        return response.result.files;
    }

    async function downloadFile(fileId) {
        if (!isSignedIn()) {
            const success = await signIn();
            if (!success) throw new Error('User not signed in');
        }
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });
        // gapi.client.request returns parsed body if json, but here we want raw text?
        // alt=media returns the content.
        return response.body;
    }

    return { signIn, signOut, isSignedIn, uploadFile, listBackups, downloadFile };
})();
