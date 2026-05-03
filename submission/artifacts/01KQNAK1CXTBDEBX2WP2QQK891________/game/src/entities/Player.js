export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setSize(20, 26);
    this.setOffset(8, 12);
    this.setCollideWorldBounds(true);
    this.setDamping(true);
    this.setDrag(0.85);
    this.setMaxVelocity(260);
    this.setDepth(500);

    const t = scene.registry.get('tuning');
    this.hp = t.player.max_hp;
    this.invulnUntil = 0;
    this.scene_ = scene;
  }

  faceTo(angleRad) {
    // flip horizontally based on aim direction
    const facingRight = Math.cos(angleRad) >= 0;
    this.setFlipX(!facingRight);
  }

  dash(angle, distancePx, invulnMs) {
    const dx = Math.cos(angle) * distancePx;
    const dy = Math.sin(angle) * distancePx;
    this.scene_.tweens.add({
      targets: this,
      x: Phaser.Math.Clamp(this.x + dx, 16, this.scene_.W - 16),
      y: Phaser.Math.Clamp(this.y + dy, 100, this.scene_.H - 16),
      duration: 180,
      ease: 'Quad.Out'
    });
    this.invulnUntil = Math.max(this.invulnUntil, this.scene_.time.now + invulnMs);
    // visible dash trail (after-image)
    const after = this.scene_.add.image(this.x, this.y, 'player')
      .setAlpha(0.5).setDepth(490).setTint(0xD62828);
    this.scene_.tweens.add({
      targets: after, alpha: 0, duration: invulnMs,
      onComplete: () => after.destroy()
    });
  }

  takeHit(iframeMs) {
    this.hp = Math.max(0, this.hp - 1);
    this.invulnUntil = this.scene_.time.now + iframeMs;
    // flash
    this.setTintFill(0xD62828);
    this.scene_.time.delayedCall(60, () => {
      this.clearTint();
    });
    // blink during i-frames
    this.scene_.tweens.add({
      targets: this, alpha: 0.4, yoyo: true, repeat: 2,
      duration: iframeMs / 6,
      onComplete: () => this.setAlpha(1)
    });
  }
}
