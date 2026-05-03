import { TUNING } from '../config/tuning.js';
import { Player } from '../entities/Player.js';
import { spawnEnemy } from '../entities/Enemies.js';
import { WhispyWood } from '../entities/Boss.js';
import { SpitStar, Apple, spawnAbilityFx } from '../entities/Projectiles.js';
import { InputManager } from '../systems/InputManager.js';
import { JuiceManager } from '../systems/JuiceManager.js';
import { getAudio } from '../systems/AudioManager.js';
import { ScoreManager } from '../systems/ScoreManager.js';
import { saveRun, topScores, bestScore } from '../systems/PersistenceManager.js';

export class GameScene extends Phaser.Scene {
  constructor() { super({ key: 'GameScene' }); }

  create() {
    const palette = TUNING.palette;
    const W = TUNING.level.logical_width_px;
    const H = TUNING.viewport.logical_height_px;
    const VW = TUNING.viewport.logical_width_px;

    this.physics.world.setBounds(0, 0, W, H);
    this.cameras.main.setBounds(0, 0, W, H);

    // --- parallax (4 layers, scrollFactors 0.0 / 0.2 / 0.5 / 1.5) ---
    this.parallax = [];
    this.parallax.push(this.add.tileSprite(0, 0, VW, H, 'parallax-sky').setOrigin(0, 0).setScrollFactor(0).setDepth(0));
    this.parallax.push(this.add.tileSprite(0, 40, W, 96, 'parallax-clouds').setOrigin(0, 0).setScrollFactor(0.2).setDepth(1));
    this.parallax.push(this.add.tileSprite(0, H - 200, W, 160, 'parallax-mid').setOrigin(0, 0).setScrollFactor(0.5).setDepth(2));
    this.parallax.push(this.add.tileSprite(0, H - 64, W * 2, 32, 'parallax-fg').setOrigin(0, 0).setScrollFactor(1.5).setDepth(48));

    // --- ground ---
    const gy = TUNING.level.ground_y_px;
    this.ground = this.physics.add.staticGroup();
    for (let x = 0; x < W; x += 32) {
      const tile = this.ground.create(x + 16, gy + 16, 'ground-tile');
      tile.refreshBody();
    }

    // --- score / audio ---
    this.score = new ScoreManager();
    this.audio = getAudio();
    this.audio.startBGM();
    this.juice = new JuiceManager(this);

    // --- player ---
    this.player = new Player(this, TUNING.lives.respawn_x_px, TUNING.lives.respawn_y_px);
    this.physics.add.collider(this.player.sprite, this.ground);

    // --- enemies ---
    this.enemies = [];
    for (const ent of TUNING.level.enemy_spawn_plan) {
      const e = spawnEnemy(this, ent.type, ent.x, ent.y);
      if (e) {
        this.enemies.push(e);
        if (e.type !== 'Flier' && e.type !== 'Spikee') {
          this.physics.add.collider(e.sprite, this.ground);
        }
      }
    }

    // --- projectiles ---
    this.spitStars = [];
    this.apples = [];
    this.abilityFxList = [];

    // --- camera ---
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setBackgroundColor(palette.background);

    // --- input ---
    this.input_ = new InputManager(this);

    // --- HUD ---
    this._buildHUD();

    // --- boss ---
    this.boss = null;
    this.bossTriggered = false;
    this.bossDefeated = false;

    // --- runtime overlap handlers ---
    this.physics.add.overlap(this.player.sprite, this._enemySpriteGroupSentinel(), null, null, this);
    // we'll do per-frame cone + overlap checks in update for control over inhale logic.

    // --- expose debug hook (DESIGN.md §9 / spec AC1-debug-hook) ---
    window.__GAME__ = {
      player: this.player.sprite,
      boss: null,
      abilityHeld: null,
      livesRemaining: this.player.lives,
      scene: this,
      persistence: { saveRun, topScores, bestScore },
      teleportPlayer: (x, y) => this.player.sprite.setPosition(x, y),
      forceAbility: (name) => { this.player.abilityHeld = name; this._refreshHud(); }
    };
    Object.defineProperty(window.__GAME__.player, 'state', {
      get: () => this.player.state,
      configurable: true
    });
    Object.defineProperty(window.__GAME__.player, 'hp', {
      get: () => this.player.hp,
      configurable: true
    });
    Object.defineProperty(window.__GAME__, 'abilityHeld', {
      get: () => this.player.abilityHeld,
      configurable: true
    });
    Object.defineProperty(window.__GAME__, 'livesRemaining', {
      get: () => this.player.lives,
      configurable: true
    });
    Object.defineProperty(window.__GAME__, 'boss', {
      get: () => (this.boss && !this.boss.dead ? this.boss.sprite : null),
      configurable: true
    });

    this.events.once('shutdown', () => {
      try { delete window.__GAME__; } catch {}
      this.audio.stopBGM();
    });
  }

  _enemySpriteGroupSentinel() {
    // Phaser requires a target for physics.add.overlap; we drive collision detection
    // ourselves in update() so just register an empty group here.
    if (!this._sentinel) this._sentinel = this.physics.add.group();
    return this._sentinel;
  }

  _buildHUD() {
    const palette = TUNING.palette;
    const VW = TUNING.viewport.logical_width_px;
    this.hud = {};
    this.hud.hp = this.add.text(8, 6, '', { fontFamily: 'system-ui', fontSize: '14px', color: palette.text })
      .setScrollFactor(0).setDepth(900);
    this.hud.ability = this.add.text(VW / 2, 6, 'ABILITY: —', { fontFamily: 'system-ui', fontSize: '14px', color: palette.text })
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(900);
    this.hud.lives = this.add.text(VW - 8, 6, '', { fontFamily: 'system-ui', fontSize: '14px', color: palette.text })
      .setOrigin(1, 0).setScrollFactor(0).setDepth(900);
    this.hud.score = this.add.text(VW - 8, 24, '', { fontFamily: 'system-ui', fontSize: '12px', color: palette.text })
      .setOrigin(1, 0).setScrollFactor(0).setDepth(900);
    this.hud.flash = this.add.text(VW / 2, 36, '', { fontFamily: 'system-ui', fontSize: '12px', color: palette.accent, fontStyle: 'bold' })
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(901);
    this._refreshHud();
  }

  _refreshHud() {
    this.hud.hp.setText('HP ' + '♥'.repeat(this.player.hp) + '·'.repeat(Math.max(0, TUNING.player.max_hp - this.player.hp)));
    this.hud.ability.setText('ABILITY: ' + (this.player.abilityHeld ? this.player.abilityHeld.toUpperCase() : '—'));
    this.hud.lives.setText('LIVES x' + this.player.lives);
    this.hud.score.setText('SCORE ' + this.score.score);
  }

  flashHud(text) {
    this.hud.flash.setText(text);
    this.hud.flash.alpha = 1;
    this.tweens.add({ targets: this.hud.flash, alpha: 0, duration: 1200, delay: 600 });
  }

  // ---- public API consumed by Player ----
  beginInhalePull(player) {
    // visual cue: tween a small "wind" graphic forward (cheap, just a tween)
    if (!this._inhaleFxTimer) this._inhaleFxTimer = this.time.now;
  }

  spawnSpitStar(x, y, dir) {
    const s = new SpitStar(this, x, y, dir);
    this.spitStars.push(s);
  }

  spawnAbilityFx(player, abilityKey) {
    const fx = spawnAbilityFx(this, player, abilityKey);
    if (fx) {
      this.abilityFxList.push(fx);
      this.time.delayedCall(1100, () => {
        this.abilityFxList = this.abilityFxList.filter((f) => f !== fx);
      });
    }
  }

  spawnApple(x, y) {
    const a = new Apple(this, x, y);
    this.apples.push(a);
    this.physics.add.collider(a.sprite, this.ground, () => a.kill());
  }

  // ---- main update loop ----
  update(_time, dt) {
    if (this.player.dead) {
      this._endRun(false);
      return;
    }

    this.player.update(dt, this.input_);

    // boss trigger
    if (!this.bossTriggered && this.player.sprite.x >= TUNING.level.boss_arena_trigger_x_px) {
      this._startBossArena();
    }
    if (this.boss) this.boss.update(dt);

    // enemies
    for (const e of this.enemies) {
      if (e.alive) e.update(dt);
    }
    this.enemies = this.enemies.filter((e) => e.alive);

    // inhale cone capture (AC4)
    if (this.player.isInhaling()) {
      this._processInhaleCone();
    }

    // projectiles
    for (const s of this.spitStars) s.update();
    this.spitStars = this.spitStars.filter((s) => s.alive);
    for (const a of this.apples) a.update();
    this.apples = this.apples.filter((a) => a.alive);

    // overlaps (manual, controllable)
    this._checkPlayerEnemyContact();
    this._checkSpitStarHits();
    this._checkAppleHits();
    this._checkAbilityFxHits();

    if (this.input_.pauseJustDown()) {
      // simple pause: toggle physics + audio
      if (this.physics.world.isPaused) { this.physics.world.resume(); this.audio.startBGM(); }
      else                              { this.physics.world.pause();  this.audio.stopBGM(); }
    }

    this._refreshHud();
  }

  _processInhaleCone() {
    const cone = this.player.inhaleCone();
    let captured = null;
    let bestDist = Infinity;
    for (const e of this.enemies) {
      if (!e.alive || e.hp < 0) continue; // skip Spikee
      const dx = e.x - cone.x;
      const dy = e.y - cone.y;
      const dist = Math.hypot(dx, dy);
      if (dist > cone.range) continue;
      // forward cone: dx must align with facing
      if (Math.sign(dx) !== Math.sign(cone.facing) && dx !== 0) continue;
      const ang = Math.atan2(dy, Math.abs(dx)) * 180 / Math.PI;
      if (Math.abs(ang) > cone.halfDeg) continue;
      if (dist < bestDist) { bestDist = dist; captured = e; }
    }
    if (captured) {
      // pull velocity toward player
      const dx = this.player.sprite.x - captured.sprite.x;
      const dy = this.player.sprite.y - captured.sprite.y;
      const len = Math.hypot(dx, dy) || 1;
      const speed = TUNING.inhale.pull_speed_px_s;
      captured.sprite.body.setVelocity(dx / len * speed, dy / len * speed);
      // when within ~14 px → consume
      if (bestDist < 14) {
        const enemyType = captured.consumeForMouthful();
        if (enemyType) {
          this.player.receiveMouthful(enemyType);
          this.audio.sfxSwallow();
        }
      }
    }
  }

  _checkPlayerEnemyContact() {
    if (this.player.isInvincible() || this.player.dead) return;
    const ps = this.player.sprite;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (Phaser.Geom.Intersects.RectangleToRectangle(ps.getBounds(), e.sprite.getBounds())) {
        // Spikee, Burner, Slasher etc all do contact damage
        const dmg = e.cfg.damage || 1;
        if (this.player.damage(dmg)) {
          this.juice.hitStopPlayer();
          this.juice.shake('MEDIUM');
          this.audio.sfxHit();
          this._refreshHud();
        }
        break;
      }
    }
  }

  _checkSpitStarHits() {
    for (const s of this.spitStars) {
      if (!s.alive) continue;
      // vs enemies
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (Phaser.Geom.Intersects.RectangleToRectangle(s.sprite.getBounds(), e.sprite.getBounds())) {
          if (e.damage(s.damageValue)) {
            s.hit();
            this.juice.hitStopEnemy();
            this.audio.sfxHit();
            this.score.add(50);
            break;
          } else {
            // hit invincible (Spikee) → bounce / die
            s.hit();
          }
        }
      }
      // vs boss
      if (this.boss && !this.boss.dead && s.alive) {
        if (Phaser.Geom.Intersects.RectangleToRectangle(s.sprite.getBounds(), this.boss.sprite.getBounds())) {
          this.boss.damage(s.damageValue);
          s.hit();
          this.juice.hitStopEnemy();
          this.juice.shake('SMALL');
          this.audio.sfxHit();
          this.score.add(100);
        }
      }
    }
  }

  _checkAppleHits() {
    if (this.player.isInvincible() || this.player.dead) return;
    const ps = this.player.sprite;
    for (const a of this.apples) {
      if (!a.alive) continue;
      if (Phaser.Geom.Intersects.RectangleToRectangle(a.sprite.getBounds(), ps.getBounds())) {
        if (this.player.damage(a.damageValue)) {
          a.hit();
          this.juice.hitStopPlayer();
          this.juice.shake('MEDIUM');
          this.audio.sfxHit();
        }
      }
    }
  }

  _checkAbilityFxHits() {
    for (const fx of this.abilityFxList) {
      if (!fx || !fx.active) continue;
      // vs enemies
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (Phaser.Geom.Intersects.RectangleToRectangle(fx.getBounds(), e.sprite.getBounds())) {
          if (e.damage(fx.fxRef.damage)) {
            this.juice.hitStopEnemy();
            this.audio.sfxHit();
            this.score.add(50);
          }
        }
      }
      // vs boss
      if (this.boss && !this.boss.dead) {
        if (Phaser.Geom.Intersects.RectangleToRectangle(fx.getBounds(), this.boss.sprite.getBounds())) {
          this.boss.damage(fx.fxRef.damage);
          this.juice.hitStopEnemy();
          this.juice.shake('SMALL');
          this.score.add(100);
        }
      }
    }
  }

  _startBossArena() {
    this.bossTriggered = true;
    const x = TUNING.level.logical_width_px - 96;
    const y = TUNING.level.ground_y_px - 48;
    this.boss = new WhispyWood(this, x, y);
    this.physics.add.collider(this.player.sprite, this.boss.sprite, () => {
      // trunk_contact_damage = 0 — explicit AC6 invariant; do nothing
    });
    this.juice.shake('LARGE');
    this.cameras.main.flash(TUNING.boss_whispy_wood.intro_ms, 255, 230, 200, 0.4);
    this.flashHud('!! WHISPY WOOD !!');
  }

  onBossDefeated() {
    if (this.bossDefeated) return;
    this.bossDefeated = true;
    this.score.add(500);
    this.audio.sfxVictory();
    this.juice.shake('LARGE');
    this.time.delayedCall(400, () => this._endRun(true));
  }

  async _endRun(victory) {
    if (this._ended) return;
    this._ended = true;
    this.audio.stopBGM();
    const snap = this.score.snapshot();
    let savedId = null;
    try { savedId = await saveRun(snap); } catch (err) { console.warn('saveRun', err); }
    const target = victory ? 'VictoryScene' : 'GameOverScene';
    this.scene.start(target, { ...snap, savedId, boss: victory });
  }
}
