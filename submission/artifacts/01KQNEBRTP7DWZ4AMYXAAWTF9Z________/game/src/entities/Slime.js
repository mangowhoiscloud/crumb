// Slime — round mint-cyan blob. Walks toward Reba at 35 px/s; 1 wobble / 800ms.

export default class Slime extends Phaser.GameObjects.Image {
  constructor(scene, x, y, tuning) {
    super(scene, x, y, 'slime');
    this.scene = scene;
    this.kind = 'slime';
    this.config = tuning.enemies.slime;
    this.hp = this.config.hp;
    this.alive = true;
    this.wobbleT = Math.random() * 0.8;
    this.setDepth(15);
  }

  tick(dt, targetX, targetY) {
    if (!this.alive) return;
    this.wobbleT += dt;
    const sx = 1 + Math.sin(this.wobbleT * Math.PI * 2 / 0.8) * 0.06;
    const sy = 1 - Math.sin(this.wobbleT * Math.PI * 2 / 0.8) * 0.06;
    this.scaleX = sx;
    this.scaleY = sy;

    const dx = targetX - this.x;
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
