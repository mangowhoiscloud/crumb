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
  './src/scenes/MenuScene.js',
  './src/scenes/GameScene.js',
  './src/scenes/GameOverScene.js',
  './src/entities/Player.js',
  './src/entities/Enemy.js',
  './src/entities/Slash.js',
  './src/systems/AudioManager.js',
  './src/systems/ScoreManager.js',
  './src/systems/InputManager.js',
  'https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        ASSETS.map((url) =>
          cache.add(url).catch(() => null)
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((hit) => {
      if (hit) return hit;
      return fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
