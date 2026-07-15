const CACHE_NAME = 'qasimabad-v33';
const ASSETS = [
    './',
    './index.html',
    './app.js',
    './style.css',
    './manifest.json',
    './sindh_monogram.webp',
    'https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=Instrument+Serif:ital@0;1&display=swap',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    // Only intercept GET requests
    if (event.request.method !== 'GET') return;
    
    // Ignore Firebase Firestore / Auth requests so they fall through to the SDK
    if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('identitytoolkit.googleapis.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // Return cached version or fetch from network
                return cachedResponse || fetch(event.request).then(response => {
                    // Only cache valid, non-opaque responses (status 200, basic/cors type)
                    // Map tiles from ESRI might be opaque, so caching them blindly throws an error
                    if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
                        return caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, response.clone());
                            return response;
                        });
                    }
                    return response;
                });
            })
            .catch(() => {
                // If network fails and it's not in cache, ignore silently (offline mode)
                console.warn("Network and cache failed for:", event.request.url);
            })
    );
});
