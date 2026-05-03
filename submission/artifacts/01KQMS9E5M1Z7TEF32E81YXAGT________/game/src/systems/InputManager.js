// InputManager.js — Phaser already routes pointerup to each Tile.
// This module sets the global pointer config (touch-action: none is in CSS,
// activePointers is in gameConfig). It also adds simple haptic on iOS Safari
// and a keyboard fallback for desktop QA.

export class InputManager {
  constructor(scene) {
    this.scene = scene;
    // Vibration feedback on supported devices
    this.canVibrate = !!(navigator.vibrate);

    // Disable Phaser's default pinch / double-tap zoom (CSS already handles this).
    if (scene.input && scene.input.keyboard) {
      // ESC pauses
      scene.input.keyboard.on('keydown-ESC', () => {
        const gs = scene;
        if (gs.scene.isPaused()) gs.scene.resume();
        else gs.scene.pause();
      });
    }
  }

  haptic(intensity = 'light') {
    if (!this.canVibrate) return;
    const map = { light: 8, medium: 18, heavy: 32 };
    navigator.vibrate(map[intensity] || 8);
  }
}
