// Spit star (player → enemies/boss) + Apple (boss → player) + Ability FX hit-boxes.
import { TUNING } from '../config/tuning.js';

export class SpitStar {
  constructor(scene, x, y, dir) {
    this.scene = scene;
    this.dir = dir >= 0 ? 1 : -1;
    this.sprite = scene.physics.add.sprite(x, y, 'spit-star');
    this.sprite.body.allowGravity = false;
    this.sprite.body.setSize(10, 10).setOffset(2, 2);
    this.sprite.setDepth(60);
    this.sprite.body.setVelocityX(this.dir * TUNING.spit_star.velocity_px_s);
    this.alive = true;
    this.dieAt = scene.time.now + TUNING.spit_star.lifetime_ms;
    this.sprite.starRef = this;
    this.damageValue = TUNING.spit_star.damage;
  }
  update() {
    if (!this.alive) return;
    if (this.scene.time.now >= this.dieAt) { this.kill(); return; }
    this.sprite.rotation += 0.2;
  }
  hit() { this.kill(); }
  kill() {
    if (!this.alive) return;
    this.alive = false;
    this.sprite.destroy();
  }
}

export class Apple {
  constructor(scene, x, y) {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, 'apple');
    this.sprite.body.setSize(12, 12).setOffset(2, 2);
    this.sprite.body.setVelocityY(TUNING.boss_whispy_wood.apple_velocity_px_s);
    this.sprite.setDepth(55);
    this.sprite.appleRef = this;
    this.alive = true;
    this.damageValue = TUNING.boss_whispy_wood.apple_damage;
  }
  update() {
    if (!this.alive) return;
    if (this.sprite.y > TUNING.viewport.logical_height_px + 32) this.kill();
  }
  hit() { this.kill(); }
  kill() {
    if (!this.alive) return;
    this.alive = false;
    this.sprite.destroy();
  }
}

/** Ability hit-box FX (sword swing / fire breath / spark burst).
 *  Returns a short-lived sprite that GameScene's overlap handler treats as a damage source. */
export function spawnAbilityFx(scene, player, abilityKey) {
  const cfg = TUNING.abilities[abilityKey];
  if (!cfg) return null;
  const px = player.sprite.x + player.facing * 14;
  const py = player.sprite.y;
  const tex = abilityKey === 'sword' ? 'fx-sword'
            : abilityKey === 'fire'  ? 'fx-fire'
            : 'fx-spark';
  const fx = scene.physics.add.sprite(px, py, tex);
  fx.body.allowGravity = false;
  fx.setDepth(70);
  fx.setFlipX(player.facing < 0);
  fx.fxRef = { ability: abilityKey, damage: cfg.damage };
  // hit-box dimensions per ability
  if (abilityKey === 'sword')      fx.body.setSize(cfg.range_px, 18);
  else if (abilityKey === 'fire')  fx.body.setSize(cfg.range_px, 12);
  else                              fx.body.setSize(cfg.radius_px * 2, cfg.radius_px * 2);
  // lifetime
  const ttl = abilityKey === 'sword' ? 180
            : abilityKey === 'fire'  ? cfg.duration_ms
            : cfg.duration_ms;
  scene.tweens.add({ targets: fx, alpha: { from: 1, to: 0 }, duration: ttl, onComplete: () => fx.destroy() });
  return fx;
}
