// Service Worker for Progressive Web App
// Implements caching strategies for offline support and performance

const CACHE_NAME = 'expresswash-v2';
const RUNTIME_CACHE = 'expresswash-runtime';
const IMAGE_CACHE = 'expresswash-images';
const API_CACHE = 'expresswash-api';
const API_CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes

// Assets to cache immediately on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
];

// Install event - precache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_NAME, RUNTIME_CACHE, IMAGE_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return cacheNames.filter((cacheName) => !currentCaches.includes(cacheName));
    }).then((cachesToDelete) => {
      return Promise.all(cachesToDelete.map((cacheToDelete) => {
        return caches.delete(cacheToDelete);
      }));
    }).then(() => self.clients.claim())
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle Supabase API requests (cross-origin) with NetworkFirst + cache expiration
  if (url.hostname.includes('supabase')) {
    event.respondWith(networkFirstWithExpiry(request, API_CACHE, API_CACHE_MAX_AGE));
    return;
  }

  // Skip other cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Local API requests - Network First, fallback to cache
  if (url.pathname.startsWith('/api')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Images - Cache First, fallback to network
  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // Static assets - Cache First
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font'
  ) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  // HTML pages - Network First with cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Default - Network First
  event.respondWith(networkFirst(request));
});

// Network First Strategy with cache expiration
async function networkFirstWithExpiry(request, cacheName, maxAge) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.status === 200) {
      const cloned = networkResponse.clone();
      const cache = await caches.open(cacheName);
      // Store response with timestamp header for expiry checking
      const headers = new Headers(cloned.headers);
      headers.set('sw-cache-timestamp', Date.now().toString());
      const timedResponse = new Response(await cloned.blob(), {
        status: cloned.status,
        statusText: cloned.statusText,
        headers,
      });
      cache.put(request, timedResponse);
    }

    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      // Check if cached response has expired
      const cachedTime = cachedResponse.headers.get('sw-cache-timestamp');
      if (cachedTime && (Date.now() - parseInt(cachedTime, 10)) > maxAge) {
        // Expired — delete and return error
        const cache = await caches.open(cacheName);
        cache.delete(request);
      } else {
        return cachedResponse;
      }
    }

    return new Response(JSON.stringify({ error: 'Network unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Network First Strategy
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // If it's a navigation request and no cache, show offline page
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }

    // Return error response
    return new Response('Network error', {
      status: 408,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

// Cache First Strategy
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    return new Response('Resource not available', {
      status: 404,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  }
});

async function syncOrders() {
  // Implementation for syncing pending orders when back online
  console.log('Syncing pending orders...');
}

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Expresswash';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: data.url,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.notification.data) {
    event.waitUntil(
      clients.openWindow(event.notification.data)
    );
  }
});
