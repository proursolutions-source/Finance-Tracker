const CACHE_NAME = 'moneyflow-v1.0.1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching app assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        })
    );
    self.clients.claim();
});

// Fetch event
// - Navigations (HTML shell) use network-first, so a new deploy is picked up
//   immediately instead of being stuck on a stale index.html that references
//   asset hashes which no longer exist on the server after a rebuild.
// - Everything else (hashed JS/CSS/wasm assets) is safe to serve cache-first,
//   since Vite content-hashes their filenames.
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Only cache GET requests
    if (request.method !== 'GET') return;

    // Skip chrome-extension and other non-http(s) requests
    if (!request.url.startsWith('http')) return;

    // Never cache cross-origin requests (Supabase auth/REST/storage, etc.) —
    // these responses vary per signed-in user via the Authorization header,
    // which a cache keyed only on URL ignores. Caching them previously caused
    // one user's cached auth/profile/table data to be served back to a
    // different user signed in later on the same device. Let the browser's
    // own network stack handle these untouched.
    if (new URL(request.url).origin !== self.location.origin) return;

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    if (networkResponse.ok) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
                    }
                    return networkResponse;
                })
                .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
        );
        return;
    }

    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(request).then((networkResponse) => {
                // Cache successful responses
                if (networkResponse.ok) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Offline fallback for HTML pages
                if (request.headers.get('accept')?.includes('text/html')) {
                    return caches.match('/index.html');
                }
            });
        })
    );
});

// Handle messages from app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
