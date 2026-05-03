// Reba — player avatar, anchored center-bottom.
// DESIGN.md §7: 56x56 procedural sprite, idle bob 2px @ 1Hz, 80ms thrust on tap.

export default class Reba extends Phaser.GameObjects.Image {
  constructor(scene, x, y, tuning) {
    super(scene, x, y, 'reba');
    this.scene = scene;
    this.tuning = tuning;
    this.hp = tuning.player.starting_hp;
    this.alive = true;
    this.anchorY = y;
    this.bobT = 0;
    this.thrustT = 0;
    this.thrustOriginY = y;
    this.setDepth(20);
  }

  tick(dt) {
    this.bobT += dt;
    const bob = Math.sin(this.bobT * Math.PI * 2) * 2; // 1Hz, 2px amplitude
    if (this.thrustT > 0) {
      this.thrustT = Math.max(0, this.thrustT - dt);
      const thrustOffset = (this.thrustT / 0.08) * -4;
      this.y = this.anchorY + bob + thrustOffset;
    } else {
      this.y = this.anchorY + bob;
    }
  }

  thrustTowards(/* tx */ _tx, /* ty */ _ty) {
    this.thrustT = 0.08;
  }
}
