// Keyboard (arrow + WASD + space + z + x + esc) AND touch DPad overlay.
// Touch overlay only shown on `pointer: coarse`.
import { TUNING } from '../config/tuning.js';

export class InputManager {
  constructor(scene) {
    this.scene = scene;

    // --- keyboard ---
    this.keys = scene.input.keyboard.addKeys({
      LEFT: Phaser.Input.Keyboard.KeyCodes.LEFT,
      RIGHT: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      UP: Phaser.Input.Keyboard.KeyCodes.UP,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      W: Phaser.Input.Keyboard.KeyCodes.W,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
      Z: Phaser.Input.Keyboard.KeyCodes.Z,
      X: Phaser.Input.Keyboard.KeyCodes.X,
      ESC: Phaser.Input.Keyboard.KeyCodes.ESC
    });

    // --- touch state ---
    this.touch = { left: false, right: false, jump: false, inhale: false, action: false };
    this.touchEnabled = this._isCoarse();
    if (this.touchEnabled) this._buildDPad();
  }

  _isCoarse() {
    try { return window.matchMedia('(pointer: coarse)').matches; } catch { return false; }
  }

  _buildDPad() {
    const w = TUNING.viewport.logical_width_px;
    const h = TUNING.viewport.logical_height_px;
    const hit = TUNING.input.touch_hit_zone_min_px;
    const palette = TUNING.palette;
    const s = this.scene;

    const make = (x, y, label, key) => {
      const r = s.add.rectangle(x, y, hit, hit, 0x3A2840, 0.35).setScrollFactor(0).setDepth(1000);
      r.setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(palette.text).color, 0.6);
      const t = s.add.text(x, y, label, { fontSize: '14px', color: palette.primary, fontFamily: 'system-ui' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(1001);
      r.setInteractive();
      r.on('pointerdown', () => { this.touch[key] = true; });
      r.on('pointerup',   () => { this.touch[key] = false; });
      r.on('pointerout',  () => { this.touch[key] = false; });
      return { r, t };
    };

    // bottom-left dpad
    make(36, h - 56, '◄', 'left');
    make(36 + hit + 4, h - 56, '►', 'right');
    // bottom-right action cluster
    make(w - 36 - hit*2 - 8, h - 56, 'Z', 'inhale');
    make(w - 36 - hit - 4, h - 56, 'X', 'action');
    make(w - 36, h - 56, 'JMP', 'jump');
  }

  isLeft()    { return this.keys.LEFT.isDown  || this.keys.A.isDown || this.touch.left; }
  isRight()   { return this.keys.RIGHT.isDown || this.keys.D.isDown || this.touch.right; }
  isJumpDown(){ return this.keys.SPACE.isDown || this.keys.W.isDown || this.keys.UP.isDown || this.touch.jump; }
  isInhaleDown() { return this.keys.Z.isDown || this.touch.inhale; }
  isActionDown() { return this.keys.X.isDown || this.touch.action; }

  // Edge triggers — call once per frame, returns true exactly on key-down transition.
  jumpJustDown() {
    return Phaser.Input.Keyboard.JustDown(this.keys.SPACE)
        || Phaser.Input.Keyboard.JustDown(this.keys.W)
        || Phaser.Input.Keyboard.JustDown(this.keys.UP)
        || this._touchEdge('jump');
  }
  actionJustDown() {
    return Phaser.Input.Keyboard.JustDown(this.keys.X) || this._touchEdge('action');
  }
  pauseJustDown() {
    return Phaser.Input.Keyboard.JustDown(this.keys.ESC);
  }

  _touchEdge(key) {
    if (!this._touchPrev) this._touchPrev = { jump: false, action: false, inhale: false };
    const cur = !!this.touch[key];
    const prev = !!this._touchPrev[key];
    this._touchPrev[key] = cur;
    return cur && !prev;
  }
}
