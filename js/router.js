/**
 * Hash-based SPA Router.
 * Maps hash paths to controller init functions.
 */
const Router = (() => {
    const routes = {
        '/dashboard': () => DashboardController.init(),
        '/records': () => RecordsController.init(),
        '/files': () => FilesController.init(),
        '/settings': () => SettingsController.init(),
    };

    function navigate() {
        const hash = window.location.hash.slice(1) || '/dashboard';
        const handler = routes[hash] || routes['/dashboard'];

        // Update active nav
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.getAttribute('data-page') === hash.slice(1));
        });

        handler();
    }

    function init() {
        window.addEventListener('hashchange', navigate);
        navigate();
    }

    return { init };
})();
