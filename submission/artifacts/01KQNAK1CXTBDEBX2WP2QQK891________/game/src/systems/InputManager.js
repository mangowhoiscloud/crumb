export class InputManager {
  constructor(scene, tuning) {
    this.scene = scene;
    this.t = tuning;
    this._downAt = 0;
    this._downX = 0;
    this._downY = 0;

    scene.input.on('pointerdown', (p) => this._onDown(p));
    scene.input.on('pointerup', (p) => this._onUp(p));
  }

  _onDown(p) {
    this._downAt = this.scene.time.now;
    this._downX = p.x;
    this._downY = p.y;
    this.scene.doSlash(p.x, p.y);
  }

  _onUp(p) {
    const dt = this.scene.time.now - this._downAt;
    const dx = p.x - this._downX;
    const dy = p.y - this._downY;
    const dist = Math.hypot(dx, dy);

    if (dist >= this.t.player.swipe_min_px && dt <= this.t.player.swipe_max_duration_ms) {
      const angle = Math.atan2(dy, dx);
      this.scene.doDash(angle);
    }
  }
}
