// Bat — violet flying enemy, 70 px/s, slight sinusoidal weave + 6Hz wing flap.

export default class Bat extends Phaser.GameObjects.Image {
  constructor(scene, x, y, tuning) {
    super(scene, x, y, 'bat');
    this.scene = scene;
    this.kind = 'bat';
    this.config = tuning.enemies.bat;
    this.hp = this.config.hp;
    this.alive = true;
    this.weaveT = Math.random() * 1.0;
    this.flapT = 0;
    this.setDepth(16);
  }

  tick(dt, targetX, targetY) {
    if (!this.alive) return;
    this.flapT += dt;
    const flapScaleY = 1 + Math.sin(this.flapT * Math.PI * 2 * 6) * 0.18;
    this.scaleY = flapScaleY;

    this.weaveT += dt;
    const weave = Math.sin(this.weaveT * Math.PI * 2 / 0.7) * 18;

    const dx = (targetX + weave) - this.x;
    const dy = targetY - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const v = this.config.speed_px_per_s * dt;
    this.x += (dx / d) * v;
    this.y += (dy / d) * v;
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) this.alive = false;
  }
}
