/**
 * Service Worker for Personal Finance Manager
 * Enables offline functionality by caching app resources
 */

const CACHE_NAME = 'finman-v3';
const CACHE_URLS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/db.js',
  '/js/router.js',
  '/js/controllers/authController.js',
  '/js/controllers/dashboardController.js',
  '/js/controllers/filesController.js',
  '/js/controllers/recordsController.js',
  '/js/controllers/settingsController.js',
  '/js/dao/fileDao.js',
  '/js/dao/recordAttachmentDao.js',
  '/js/dao/recordDao.js',
  '/js/dao/settingsDao.js',
  '/js/dao/tagDao.js',
  '/js/services/authService.js',
  '/js/services/backupService.js',
  '/js/services/fileService.js',
  '/js/services/googleDriveService.js',
  '/js/services/recordService.js',
  '/js/services/settingsService.js',
  '/js/services/tagService.js',
  '/js/services/widgetService.js',
  '/js/utils/dateFilterUtil.js',
  '/js/views/authView.js',
  '/js/views/backupView.js',
  '/js/views/dashboardView.js',
  '/js/views/dateFilterView.js',
  '/js/views/filesView.js',
  '/js/views/recordsView.js',
  '/js/views/settingsView.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching app resources');
        return cache.addAll(CACHE_URLS);
      })
      .then(() => {
        console.log('[ServiceWorker] Skip waiting');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[ServiceWorker] Install failed:', err);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[ServiceWorker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - network-first strategy
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Network request succeeded - cache and return it
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch((error) => {
        // Network failed - try to serve from cache
        console.log('[ServiceWorker] Network failed, serving from cache:', error);
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // No cache available either
            throw error;
          });
      })
  );
});
