const CACHE_NAME = 'bra-alpes-v30';
const TILE_CACHE = 'bra-tiles-v1';
const IMG_CACHE = 'bra-images-v1';
const MAX_TILE_CACHE_SIZE = 2000; // max cached tiles
const MAX_IMG_CACHE_SIZE = 500;

const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/data.js',
  './js/map.js',
  './js/panel.js',
  './js/layers.js',
  './js/offline.js',
  './js/app.js',
  './data/massifs.geojson',
  './manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Install: pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  var keepCaches = [CACHE_NAME, TILE_CACHE, IMG_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => keepCaches.indexOf(name) === -1)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Trim a cache to a maximum number of entries (FIFO)
async function trimCache(cacheName, maxSize) {
  var cache = await caches.open(cacheName);
  var keys = await cache.keys();
  if (keys.length > maxSize) {
    // Delete oldest entries (first in list)
    var toDelete = keys.length - maxSize;
    for (var i = 0; i < toDelete; i++) {
      await cache.delete(keys[i]);
    }
  }
}

function isTileRequest(url) {
  return url.hostname.includes('tile.opentopomap.org') ||
    url.hostname === 'data.geopf.fr' ||
    url.hostname.includes('openslopemap.org');
}

function isBRAImage(url) {
  return url.pathname.includes('/data/bra/img/');
}

function isBRAData(url) {
  return url.pathname.includes('/data/bra/') && !isBRAImage(url);
}

// Fetch strategy per resource type
self.addEventListener('fetch', (event) => {
  var url = new URL(event.request.url);

  // Tile requests: cache-first, long-lived
  if (isTileRequest(url)) {
    event.respondWith(
      caches.open(TILE_CACHE).then((cache) => {
        return cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone());
              // Trim asynchronously — don't block
              trimCache(TILE_CACHE, MAX_TILE_CACHE_SIZE);
            }
            return response;
          }).catch(() => {
            // Offline: return a transparent 1x1 PNG as fallback
            return new Response(
              Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRElFTkSuQmCC'), c => c.charCodeAt(0)),
              { headers: { 'Content-Type': 'image/png' } }
            );
          });
        });
      })
    );
    return;
  }

  // BRA images: cache-first with network update
  if (isBRAImage(url)) {
    event.respondWith(
      caches.open(IMG_CACHE).then((cache) => {
        return cache.match(event.request).then((cached) => {
          var fetchPromise = fetch(event.request).then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone());
              trimCache(IMG_CACHE, MAX_IMG_CACHE_SIZE);
            }
            return response;
          }).catch(() => null);

          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // BRA data files: network first, fallback to cache
  if (isBRAData(url)) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((response) => {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Overpass API: cache responses for 7 days
  if (url.hostname.includes('overpass-api')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          }).catch(() => cached);
        });
      })
    );
    return;
  }

  // Static assets: cache first, fallback to network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((response) => {
        if (response.ok && event.request.method === 'GET') {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      });
    })
  );
});
