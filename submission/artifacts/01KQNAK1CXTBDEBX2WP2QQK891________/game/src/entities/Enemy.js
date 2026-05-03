export class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'enemy');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setSize(18, 18);
    this.setOffset(5, 5);
    this.setCollideWorldBounds(true);
    this.setDepth(400);
    this.speed = 50;
    this._dying = false;
  }

  setSpeed(v) { this.speed = v; }

  chase(tx, ty) {
    if (this._dying) return;
    const dx = tx - this.x, dy = ty - this.y;
    const len = Math.hypot(dx, dy) || 1;
    this.setVelocity((dx / len) * this.speed, (dy / len) * this.speed);
  }

  knockback(fromX, fromY) {
    const dx = this.x - fromX, dy = this.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    this.setVelocity((dx / len) * 220, (dy / len) * 220);
  }

  flashAndKill(flashMs) {
    if (this._dying) return;
    this._dying = true;
    this.setVelocity(0, 0);
    this.setTintFill(0xF4E8D0);
    this.scene.tweens.add({
      targets: this, scale: 1.4, alpha: 0, duration: flashMs * 4,
      onComplete: () => this.destroy()
    });
  }
}
