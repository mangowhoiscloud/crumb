import { buildGameConfig } from './config/gameConfig.js';

(function bootGame() {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', bootGame, { once: true });
    return;
  }
  if (typeof Phaser === 'undefined') {
    document.body.insertAdjacentHTML('beforeend',
      '<div style="position:fixed;inset:0;display:flex;align-items:center;' +
      'justify-content:center;color:#F4E8D0;background:#3D2817;font:600 16px system-ui">' +
      'Loading… (Phaser CDN unreachable)</div>'
    );
    return;
  }
  const game = new Phaser.Game(buildGameConfig());
  window.__GAME__ = game;
})();