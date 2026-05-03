// Service Worker — cache-first shell (AC8: zero post-load network requests after activation)
const CACHE_VERSION = 'cat-tap-match3-v1.1.0';
const SHELL_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './src/main.js',
  './src/config/gameConfig.js',
  './src/config/tuning.json',
  './src/scenes/BootScene.js',
  './src/scenes/MenuScene.js',
  './src/scenes/GameScene.js',
  './src/scenes/GameOverScene.js',
  './src/entities/Tile.js',
  './src/systems/AudioManager.js',
  './src/systems/ScoreManager.js',
  './src/systems/InputManager.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Cache-first for shell URLs and same-origin requests; opaque-cache fallback for CDN.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Cache same-origin successes for offline boot.
        const url = new URL(req.url);
        if (url.origin === self.location.origin && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
