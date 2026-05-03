export class Slash extends Phaser.GameObjects.Image {
  constructor(scene, x, y, angleRad, radiusPx, tuning) {
    super(scene, x, y, 'slash');
    scene.add.existing(this);
    this.setOrigin(0.5);
    this.setDepth(600);
    this.setRotation(angleRad);
    // base texture is 80px; scale to match desired radius
    const baseR = 28; // arc center radius in the texture
    const targetR = radiusPx;
    this.setScale(targetR / baseR);
    this.setAlpha(1);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: this.scaleX * 1.18,
      scaleY: this.scaleY * 1.18,
      duration: tuning.slash.animation_ms,
      ease: 'Quad.Out',
      onComplete: () => this.destroy()
    });
  }

  update() { /* tween-driven */ }
}
