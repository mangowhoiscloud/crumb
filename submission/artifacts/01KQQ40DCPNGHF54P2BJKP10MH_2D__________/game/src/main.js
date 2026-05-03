import { buildPhaserConfig } from './config/gameConfig.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { VictoryScene } from './scenes/VictoryScene.js';

const config = buildPhaserConfig([
  BootScene, MenuScene, GameScene, GameOverScene, VictoryScene
]);

const game = new Phaser.Game(config);
window.__PHASER_GAME__ = game;

const bootMsg = document.getElementById('boot-msg');
if (bootMsg) bootMsg.style.display = 'none';
