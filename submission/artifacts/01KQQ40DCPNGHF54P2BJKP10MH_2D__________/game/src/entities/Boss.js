// Whispy Wood — stationary tree boss + apple projectile dropper + Flier summoner.
// Spec AC6: trunk_contact_damage = 0; apples drop every 2500 ms with 200 ms predictive lead;
//          summons one Flier every 3000 ms.
import { TUNING } from '../config/tuning.js';
import { Flier } from './Enemies.js';

export class WhispyWood {
  constructor(scene, x, y) {
    this.scene = scene;
    this.cfg = TUNING.boss_whispy_wood;
    const playerHasSword = scene.player && scene.player.abilityHeld === 'sword';
    this.hp = playerHasSword ? this.cfg.hp_with_sword : this.cfg.hp_base;
    this.maxHp = this.hp;
    this.dead = false;

    this.sprite = scene.physics.add.sprite(x, y, 'whispy');
    this.sprite.setImmovable(true);
    this.sprite.body.allowGravity = false;
    this.sprite.body.setSize(48, 96).setOffset(4, 8);
    this.sprite.setDepth(45);
    this.sprite.bossRef = this;

    // HP bar above tree
    const palette = TUNING.palette;
    this.hpBg = scene.add.rectangle(x, y - 60, 64, 6, 0x000000, 0.5).setDepth(80);
    this.hpFg = scene.add.rectangle(x - 32, y - 60, 64, 6, Phaser.Display.Color.HexStringToColor(palette.accent).color, 1).setOrigin(0, 0.5).setDepth(81);

    this.lastApple = scene.time.now + this.cfg.intro_ms; // wait through intro
    this.lastSummon = scene.time.now + this.cfg.intro_ms;
  }

  update(_dt) {
    if (this.dead) return;
    const now = this.scene.time.now;
    if (now - this.lastApple >= this.cfg.apple_interval_ms) {
      this.lastApple = now;
      this._dropApple();
    }
    if (now - this.lastSummon >= this.cfg.summon_interval_ms) {
      this.lastSummon = now;
      this._summonFlier();
    }
    // refresh hp bar width
    const ratio = Math.max(0, this.hp / this.maxHp);
    this.hpFg.scaleX = ratio;
  }

  _dropApple() {
    if (!this.scene.player || !this.scene.spawnApple) return;
    const player = this.scene.player.sprite;
    const lead = (player.body.velocity.x || 0) * (this.cfg.apple_predict_lead_ms / 1000);
    const targetX = player.x + lead;
    this.scene.spawnApple(targetX, this.sprite.y - 80);
  }

  _summonFlier() {
    const x = this.sprite.x - 240;
    const y = -16; // off-screen top
    const f = new Flier(this.scene, x, y);
    if (this.scene.enemies) this.scene.enemies.push(f);
  }

  damage(amount) {
    if (this.dead) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(120, () => this.sprite.clearTint());
    if (this.hp <= 0) this.kill();
    return true;
  }

  kill() {
    if (this.dead) return;
    this.dead = true;
    this.sprite.destroy();
    this.hpBg.destroy();
    this.hpFg.destroy();
    if (this.scene.onBossDefeated) this.scene.onBossDefeated();
  }
}
