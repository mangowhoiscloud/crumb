import { BootScene } from '../scenes/BootScene.js';
import { MenuScene } from '../scenes/MenuScene.js';
import { GameScene } from '../scenes/GameScene.js';
import { GameOverScene } from '../scenes/GameOverScene.js';

const DESIGN_W = 384;
const DESIGN_H = 640;

export function buildGameConfig() {
  const reducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#3D2817',
    width: DESIGN_W,
    height: DESIGN_H,
    pixelArt: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: DESIGN_W,
      height: DESIGN_H,
      min: { width: 320, height: 533 },
      max: { width: 428, height: 760 }
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false
      }
    },
    input: {
      activePointers: 2
    },
    fps: {
      target: 60,
      forceSetTimeOut: false
    },
    render: {
      antialias: true,
      powerPreference: 'high-performance'
    },
    scene: [BootScene, MenuScene, GameScene, GameOverScene],
    callbacks: {
      postBoot: (game) => {
        game.registry.set('reducedMotion', reducedMotion);
      }
    }
  };
}

export const DESIGN = { W: DESIGN_W, H: DESIGN_H };
