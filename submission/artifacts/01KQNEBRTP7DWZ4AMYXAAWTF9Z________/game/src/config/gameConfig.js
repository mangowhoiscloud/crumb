import BootScene from '../scenes/BootScene.js';
import GameScene from '../scenes/GameScene.js';
import GameOverScene from '../scenes/GameOverScene.js';

export const VIEWPORT = {
  width: 390,
  height: 720,
  minWidth: 320,
  maxWidth: 428,
};

export function buildPhaserConfig(parent) {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#1a0f2e',
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: 0 },
        debug: false,
      },
    },
    input: {
      activePointers: 1,
      smoothFactor: 0,
    },
    fps: {
      target: 60,
      forceSetTimeOut: false,
    },
    render: {
      pixelArt: false,
      antialias: true,
    },
    scene: [BootScene, GameScene, GameOverScene],
  };
}
