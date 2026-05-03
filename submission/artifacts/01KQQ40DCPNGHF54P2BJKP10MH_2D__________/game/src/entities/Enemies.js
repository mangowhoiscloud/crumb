// Five enemy archetypes from tuning.json: Waddler, Flier, Spikee, Burner, Slasher.
// All sprites use procedural textures generated in BootScene.
import { TUNING } from '../config/tuning.js';

class Enemy {
  constructor(scene, x, y, type, textureKey) {
    this.scene = scene;
    this.type = type;
    this.cfg = TUNING.enemies[type];
    this.sprite = scene.physics.add.sprite(x, y, textureKey);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.body.setSize(20, 20).setOffset(2, 2);
    this.sprite.setDepth(40);
    this.sprite.enemyRef = this;
    this.hp = this.cfg.hp;       // -1 = invincible (Spikee)
    this.alive = true;
    this.dir = -1;               // walk left
  }
  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }
  damage(amount) {
    if (this.hp < 0 || !this.alive) return false; // invincible
    this.hp -= amount;
    if (this.hp <= 0) this.kill();
    return true;
  }
  kill() {
    if (!this.alive) return;
    this.alive = false;
    this.sprite.destroy();
  }
  consumeForMouthful() {
    // Returns the type so the player can resolve ability_drop.
    if (!this.alive || this.hp < 0) return null;
    const t = this.type;
    this.kill();
    return t;
  }
  update(_dt) { /* override */ }
}

export class Waddler extends Enemy {
  constructor(scene, x, y) { super(scene, x, y, 'Waddler', 'enemy-waddler'); }
  update(_dt) {
    if (!this.alive) return;
    const v = this.cfg.walk_speed_px_s * this.dir;
    this.sprite.body.setVelocityX(v);
    if (this.sprite.body.blocked.left)  { this.dir = +1; this.sprite.setFlipX(false); }
    if (this.sprite.body.blocked.right) { this.dir = -1; this.sprite.setFlipX(true); }
  }
}

export class Flier extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'Flier', 'enemy-flier');
    this.sprite.body.allowGravity = false;
    this.baseY = y;
    this.t0 = scene.time.now;
  }
  update(_dt) {
    if (!this.alive) return;
    const v = this.cfg.walk_speed_px_s * this.dir;
    this.sprite.body.setVelocityX(v);
    const elapsed = this.scene.time.now - this.t0;
    const phase = (elapsed / this.cfg.sine_period_ms) * Math.PI * 2;
    this.sprite.y = this.baseY + Math.sin(phase) * this.cfg.sine_amplitude_px;
    if (this.sprite.x < -32 || this.sprite.x > TUNING.level.logical_width_px + 32) {
      this.dir *= -1;
      this.sprite.setFlipX(this.dir > 0);
    }
  }
}

export class Spikee extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'Spikee', 'enemy-spikee');
    this.sprite.body.allowGravity = false;
    this.sprite.setImmovable(true);
  }
  update(_dt) {
    if (!this.alive) return;
    this.sprite.body.setVelocity(0, 0);
  }
}

export class Burner extends Enemy {
  constructor(scene, x, y) { super(scene, x, y, 'Burner', 'enemy-burner'); }
  update(_dt) {
    if (!this.alive) return;
    const v = this.cfg.walk_speed_px_s * this.dir;
    this.sprite.body.setVelocityX(v);
    if (this.sprite.body.blocked.left)  { this.dir = +1; this.sprite.setFlipX(false); }
    if (this.sprite.body.blocked.right) { this.dir = -1; this.sprite.setFlipX(true); }
  }
}

export class Slasher extends Enemy {
  constructor(scene, x, y) { super(scene, x, y, 'Slasher', 'enemy-slasher'); }
  update(_dt) {
    if (!this.alive) return;
    const v = this.cfg.walk_speed_px_s * this.dir;
    this.sprite.body.setVelocityX(v);
    if (this.sprite.body.blocked.left)  { this.dir = +1; this.sprite.setFlipX(false); }
    if (this.sprite.body.blocked.right) { this.dir = -1; this.sprite.setFlipX(true); }
  }
}

export const ENEMY_CTORS = { Waddler, Flier, Spikee, Burner, Slasher };

export function spawnEnemy(scene, type, x, y) {
  const Ctor = ENEMY_CTORS[type];
  if (!Ctor) return null;
  return new Ctor(scene, x, y);
}
