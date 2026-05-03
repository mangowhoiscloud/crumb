// Cache-first service worker — offline guarantee for AC9.
const CACHE = 'kirby-sidescroll-v1-cache-1';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.svg',
  './icon-512.svg',
  './src/main.js',
  './src/config/gameConfig.js',
  './src/config/tuning.js',
  './src/scenes/BootScene.js',
  './src/scenes/MenuScene.js',
  './src/scenes/GameScene.js',
  './src/scenes/GameOverScene.js',
  './src/scenes/VictoryScene.js',
  './src/entities/Player.js',
  './src/entities/Enemies.js',
  './src/entities/Boss.js',
  './src/entities/Projectiles.js',
  './src/systems/AudioManager.js',
  './src/systems/InputManager.js',
  './src/systems/JuiceManager.js',
  './src/systems/PersistenceManager.js',
  './src/systems/ScoreManager.js',
  'https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js',
  'https://esm.sh/dexie@4'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        PRECACHE.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => null)
        )
      )
    ).then(() => self.skipWaiting())
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
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        if (res.ok && (req.url.startsWith(self.location.origin) ||
                       req.url.startsWith('https://cdn.jsdelivr.net') ||
                       req.url.startsWith('https://esm.sh'))) {
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached || new Response('offline', { status: 503 }));
    })
  );
});
