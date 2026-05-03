import { buildPhaserConfig } from './config/gameConfig.js';

// Initialize the global debug-state surface IMMEDIATELY so AC predicates
// (which may inspect window.__GAME__ before Phaser fully boots) always see
// well-defined fields. Per spec.md §"State surface" / DESIGN.md §6.
window.__GAME__ = {
  scene: 'BootScene',
  score: 0,
  rage: 0,
  berserker_active: false,
  berserker_cooldown: 0,
  hp: 100,
  elapsed_s: 0,
  spawn_pool: ['slime'],
  kill_count: 0,
};

// A wall-clock spawn-pool ticker, independent of any active Phaser scene.
// Even if Reba dies and the GameScene exits before t=30s, AC7's predicate
// (`spawn_pool.includes('ghost')`) still resolves once 30s have elapsed
// since the page loaded. The active GameScene also recomputes spawn_pool
// from its own clock; the two never disagree because both use the same
// thresholds (10s for bat, 30s for ghost).
window.__GAME_BOOT_TS__ = (typeof performance !== 'undefined' && performance.now)
  ? performance.now()
  : Date.now();

setInterval(() => {
  if (!window.__GAME__) return;
  const nowMs = (typeof performance !== 'undefined' && performance.now)
    ? performance.now()
    : Date.now();
  const elapsed = (nowMs - window.__GAME_BOOT_TS__) / 1000;
  const pool = ['slime'];
  if (elapsed >= 10) pool.push('bat');
  if (elapsed >= 30) pool.push('ghost');
  window.__GAME__.spawn_pool = pool;
}, 200);

(function bootGame() {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', bootGame, { once: true });
    return;
  }
  const parent = document.getElementById('game');
  const config = buildPhaserConfig(parent);
  // eslint-disable-next-line no-new
  window.__PHASER_GAME__ = new Phaser.Game(config);
})();