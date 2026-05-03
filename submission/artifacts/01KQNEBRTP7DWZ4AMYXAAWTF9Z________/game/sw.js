const CACHE = 'reba-berserker-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.svg',
  './icon-512.svg',
  './src/main.js',
  './src/config/gameConfig.js',
  './src/config/tuning.json',
  './src/scenes/BootScene.js',
  './src/scenes/GameScene.js',
  './src/scenes/GameOverScene.js',
  './src/entities/Reba.js',
  './src/entities/Slime.js',
  './src/entities/Bat.js',
  './src/entities/Ghost.js',
  './src/systems/AudioManager.js',
  './src/systems/ScoreManager.js',
  './src/systems/InputManager.js',
  'https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        ASSETS.map((url) =>
          cache.add(url).catch(() => { /* tolerate offline-install of CDN */ })
        )
      )
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
