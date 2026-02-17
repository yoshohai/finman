/**
 * Modal helper
 */
const Modal = {
    open(title, bodyHTML) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = bodyHTML;
        document.getElementById('modal-overlay').classList.remove('hidden');
    },
    close() {
        document.getElementById('modal-overlay').classList.add('hidden');
        document.getElementById('modal-body').innerHTML = '';
    }
};

/**
 * App bootstrap.
 * Opens the database, then handles authentication, then starts the router.
 */
(async () => {
    try {
        await DB.getDB();
        
        // Authenticate user before showing app
        await AuthController.authenticate();
        
        Router.init();
        
        // Setup settings button
        document.getElementById('settings-btn').addEventListener('click', () => {
            window.location.hash = '#/settings';
        });
    } catch (err) {
        console.error('Failed to initialize app:', err);
        document.getElementById('app').innerHTML =
            '<p style="padding:20px;color:red;">Failed to initialize application. Please refresh the page.</p>';
    }

    // Global modal close
    document.getElementById('modal-close').addEventListener('click', Modal.close);
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) Modal.close();
    });
})();
