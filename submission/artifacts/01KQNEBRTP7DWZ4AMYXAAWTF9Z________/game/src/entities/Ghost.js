// Ghost — pale wisp that teleports toward Reba every 1.5s instead of walking.
// Stationary between teleports; takes 2 hits to kill.

export default class Ghost extends Phaser.GameObjects.Image {
  constructor(scene, x, y, tuning) {
    super(scene, x, y, 'ghost');
    this.scene = scene;
    this.kind = 'ghost';
    this.config = tuning.enemies.ghost;
    this.hp = this.config.hp;
    this.alive = true;
    this.teleportClock = this.config.teleport_interval_s;
    this.fadeT = 0;
    this.fadeMode = 'idle'; // 'fading-out' | 'fading-in' | 'idle'
    this.setAlpha(1);
    this.setDepth(17);
  }

  tick(dt, targetX, targetY) {
    if (!this.alive) return;
    this.teleportClock -= dt;

    if (this.fadeMode === 'fading-out') {
      this.fadeT += dt;
      this.setAlpha(Math.max(0, 1 - this.fadeT / 0.08));
      if (this.fadeT >= 0.08) {
        // Teleport: step ~50px closer to Reba.
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const d = Math.hypot(dx, dy) || 1;
        const step = 60;
        this.x += (dx / d) * step;
        this.y += (dy / d) * step;
        this.fadeMode = 'fading-in';
        this.fadeT = 0;
      }
    } else if (this.fadeMode === 'fading-in') {
      this.fadeT += dt;
      this.setAlpha(Math.min(1, this.fadeT / 0.12));
      if (this.fadeT >= 0.12) {
        this.fadeMode = 'idle';
        this.fadeT = 0;
        this.teleportClock = this.config.teleport_interval_s;
      }
    } else if (this.teleportClock <= 0) {
      this.fadeMode = 'fading-out';
      this.fadeT = 0;
    }
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) this.alive = false;
  }
}
