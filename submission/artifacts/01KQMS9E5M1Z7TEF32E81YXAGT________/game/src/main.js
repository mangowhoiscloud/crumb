// main.js — Phaser bootstrap. Loads tuning.json then registers scenes.
import { loadTuning, buildPhaserConfig } from './config/gameConfig.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';

async function start() {
  const tuning = await loadTuning();
  // Stash tuning on window for scenes (Phaser's registry would also work).
  window.__TUNING__ = tuning;

  const config = buildPhaserConfig([BootScene, MenuScene, GameScene, GameOverScene]);
  const game = new Phaser.Game(config);
  window.__GAME__ = game;

  // Hide loading splash once Phaser boots.
  game.events.once('ready', () => {
    const splash = document.getElementById('loading');
    if (splash) splash.classList.add('hidden');
  });
  // Fallback: hide splash after first scene's create.
  setTimeout(() => {
    const splash = document.getElementById('loading');
    if (splash) splash.classList.add('hidden');
  }, 800);

  // Wire pause button (visual only — pauses GameScene if active).
  const pauseBtn = document.getElementById('pause');
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      const gs = game.scene.getScene('GameScene');
      if (gs && gs.scene.isActive()) {
        if (gs.scene.isPaused()) gs.scene.resume();
        else gs.scene.pause();
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
