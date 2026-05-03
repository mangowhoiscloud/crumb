import { TUNING } from './tuning.js';

export function buildPhaserConfig(scenes) {
  return {
    type: Phaser.AUTO,
    parent: 'game-root',
    backgroundColor: TUNING.palette.background,
    width: TUNING.viewport.logical_width_px,
    height: TUNING.viewport.logical_height_px,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: TUNING.physics.gravity_y },
        debug: false
      }
    },
    render: { pixelArt: false, antialias: true, roundPixels: true },
    input: { activePointers: 4 },
    fps: { target: 60, forceSetTimeOut: false },
    scene: scenes
  };
}
