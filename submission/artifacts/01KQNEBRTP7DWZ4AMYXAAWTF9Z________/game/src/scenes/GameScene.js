// GameScene: 60-second wave-survival round.
// Owns the main loop, enemy spawn, tap-to-attack, RAGE meter, Berserker
// burst/cooldown cycle, HUD, and game-over transition.
// Spec: artifacts/spec.md (AC1–AC7) + DESIGN.md §3 motion timings.

import Reba from '../entities/Reba.js';
import Slime from '../entities/Slime.js';
import Bat from '../entities/Bat.js';
import Ghost from '../entities/Ghost.js';
import AudioManager from '../systems/AudioManager.js';
import ScoreManager from '../systems/ScoreManager.js';
import InputManager from '../systems/InputManager.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  init() {
    this.tuning = this.registry.get('tuning');
    this.reducedMotion = (typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    this.elapsedS = 0;
    this.enemies = [];
    this.spawnAccumulator = 0;
    this.lastKillAt = -Infinity;
    this.comboTier = 0;
    this.rage = 0;
    this.berserkerActive = false;
    this.berserkerTimeRemaining = 0;
    this.berserkerCooldown = 0;
    this.tapCooldownMs = 0;
    this.gameEnded = false;
    this.killCount = 0;

    this.score = new ScoreManager(this.tuning);
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    const colors = this.tuning.colors;

    // Background plate (DESIGN.md §2 deep indigo).
    this.cameras.main.setBackgroundColor(colors.background);

    // Player anchored at center-bottom (anchor.y_ratio = 0.85).
    this.reba = new Reba(this, w / 2, h * this.tuning.player.anchor_y_ratio, this.tuning);
    this.add.existing(this.reba);

    // Subtle ground shadow under Reba for depth.
    const ground = this.add.ellipse(this.reba.x, this.reba.y + 28, 60, 14, 0x000000, 0.35);
    ground.setDepth(this.reba.depth - 1);

    // Berserker red-tint overlay (alpha 0 by default; DESIGN.md §3 ramp 200ms).
    this.berserkerOverlay = this.add.rectangle(w / 2, h / 2, w, h, 0xef4444, 0);
    this.berserkerOverlay.setDepth(50);
    this.berserkerOverlay.setBlendMode(Phaser.BlendModes.MULTIPLY);

    this.audio = new AudioManager(this.tuning);
    this.input_ = new InputManager(this, (x, y) => this.onTap(x, y));

    this.buildHUD();

    // Start BGM loop (Web Audio synth) — silent if user gesture not yet had.
    this.audio.startBgm();

    // Mark this scene active in the global debug surface (AC1).
    this.syncDebugSurface();
    if (window.__GAME__) window.__GAME__.scene = 'GameScene';

    // Reset HTML game-over overlay if returning from retry.
    const overlay = document.getElementById('game-over-ui');
    if (overlay) overlay.classList.remove('show');
  }

  buildHUD() {
    const colors = this.tuning.colors;
    const safeTop = this.tuning.viewport.safe_area_top_px;
    const w = this.scale.width;

    // HP label + bar (top-left).
    this.hpLabel = this.add.text(12, safeTop + 4, 'HP', {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: colors.text,
    }).setDepth(60);
    this.hpBarBg = this.add.rectangle(12, safeTop + 22, 84, 12, 0x000000, 0.5)
      .setOrigin(0, 0).setDepth(60);
    this.hpBarFill = this.add.rectangle(13, safeTop + 23, 82, 10, 0x22c55e, 1)
      .setOrigin(0, 0).setDepth(61);
    this.hpText = this.add.text(100, safeTop + 22, '100', {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: colors.text,
    }).setDepth(60);

    // Timer (top-center).
    this.timerText = this.add.text(w / 2, safeTop + 6, '0:60', {
      fontFamily: 'monospace', fontSize: '16px', color: colors.text,
    }).setOrigin(0.5, 0).setDepth(60);

    // Score (top-right).
    this.scoreText = this.add.text(w - 12, safeTop + 6, 'SCORE 0', {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: colors.text,
      fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(60);

    // RAGE bar (center-top, full-width minus safe area).
    const rageY = safeTop + 44;
    const rageWidth = w - 24;
    this.add.text(12, rageY, 'RAGE', {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: colors.text,
    }).setDepth(60);
    this.rageBarBg = this.add.rectangle(12, rageY + 16, rageWidth, 14, 0x000000, 0.5)
      .setOrigin(0, 0).setDepth(60);
    this.rageBarFill = this.add.rectangle(13, rageY + 17, 0, 12, 0xfb923c, 1)
      .setOrigin(0, 0).setDepth(61);
    this.rageText = this.add.text(w - 12, rageY + 14, '0/100', {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: colors.text,
    }).setOrigin(1, 0).setDepth(62);

    // Combo readout (under score, hidden until first chain).
    this.comboText = this.add.text(w - 12, safeTop + 24, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#ffd93d',
    }).setOrigin(1, 0).setDepth(60);
  }

  update(time, delta) {
    if (this.gameEnded) return;
    const dt = delta / 1000;

    this.elapsedS += dt;
    this.tapCooldownMs = Math.max(0, this.tapCooldownMs - delta);

    // Combo timer expiry.
    if (this.elapsedS - this.lastKillAt > this.tuning.combo.kill_window_s) {
      this.comboTier = 0;
    }

    // Berserker tick.
    if (this.berserkerActive) {
      this.berserkerTimeRemaining -= dt;
      if (this.berserkerTimeRemaining <= 0) {
        this.berserkerActive = false;
        this.berserkerCooldown = this.tuning.berserker.cooldown_s;
        this.tweens.add({
          targets: this.berserkerOverlay,
          alpha: 0,
          duration: this.motionMs(this.tuning.motion_ms.berserker_screen_tint_ramp),
          ease: 'Sine.easeInOut',
        });
      }
    } else if (this.berserkerCooldown > 0) {
      this.berserkerCooldown = Math.max(0, this.berserkerCooldown - dt);
    }

    // Update entities.
    for (const e of this.enemies) e.tick(dt, this.reba.x, this.reba.y);
    this.reba.tick(dt);

    // Cull enemies that touch Reba (kamikaze damage model — spec rule book).
    const reachRadius = (this.tuning.player.size_px * 0.5) + 18;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.alive && Phaser.Math.Distance.Between(e.x, e.y, this.reba.x, this.reba.y) < reachRadius) {
        this.applyDamage(e.config.damage_to_reba);
        e.destroy();
        this.enemies.splice(i, 1);
      }
    }

    // Spawning loop — phase-driven rate.
    const phase = this.currentPhase();
    const aliveCount = this.enemies.filter((e) => e.alive).length;
    const rate = this.spawnRateForPhase(phase);
    this.spawnAccumulator += rate * dt;
    while (this.spawnAccumulator >= 1 && aliveCount + 1 <= phase.max_concurrent_enemies) {
      this.spawnAccumulator -= 1;
      this.spawnEnemyFromPhase(phase);
    }
    if (aliveCount >= phase.max_concurrent_enemies) {
      this.spawnAccumulator = Math.min(this.spawnAccumulator, 1);
    }

    this.refreshHUD();
    this.syncDebugSurface();

    // Time-up condition (AC4).
    if (this.elapsedS >= this.tuning.session_length_s) {
      this.endRun('survived');
    }
  }

  currentPhase() {
    const phases = this.tuning.difficulty_phases;
    const t = this.elapsedS;
    for (const p of phases) {
      const [a, b] = p.time_window_s;
      if (t >= a && t < b) return p;
    }
    return phases[phases.length - 1];
  }

  spawnRateForPhase(phase) {
    const [a, b] = phase.time_window_s;
    const span = Math.max(0.001, b - a);
    const t = Math.min(1, Math.max(0, (this.elapsedS - a) / span));
    let rate = phase.spawn_rate_per_s_start + (phase.spawn_rate_per_s_end - phase.spawn_rate_per_s_start) * t;
    if (phase.spawn_rate_floor_s) {
      rate = Math.min(rate, 1 / phase.spawn_rate_floor_s);
    }
    return rate;
  }

  spawnEnemyFromPhase(phase) {
    const pool = phase.enemy_pool;
    const kind = pool[Math.floor(Math.random() * pool.length)];
    const w = this.scale.width;
    const h = this.scale.height;
    const radius = w * this.tuning.spawn_arc.radius_ratio_of_viewport_width;
    const angle = Math.PI + Math.random() * Math.PI; // top half-circle
    const x = this.reba.x + Math.cos(angle) * radius;
    const y = this.reba.y + Math.sin(angle) * radius * 0.85; // slightly squashed
    const cy = Math.max(80, Math.min(h * 0.7, y));
    const cx = Math.max(28, Math.min(w - 28, x));

    let enemy;
    if (kind === 'slime') enemy = new Slime(this, cx, cy, this.tuning);
    else if (kind === 'bat') enemy = new Bat(this, cx, cy, this.tuning);
    else enemy = new Ghost(this, cx, cy, this.tuning);

    this.add.existing(enemy);
    this.enemies.push(enemy);
  }

  onTap(x, y) {
    if (this.gameEnded) return;
    if (this.tapCooldownMs > 0) return;

    const target = this.findNearestAlive();
    if (!target) {
      // Audible feedback even on miss so the tap registers (AC6 hit-feedback).
      this.audio.play('tap_attack');
      this.tapCooldownMs = this.berserkerActive
        ? this.tuning.player.tap_attack_cooldown_ms_berserker
        : this.tuning.player.tap_attack_cooldown_ms;
      return;
    }

    this.audio.play('tap_attack');
    this.reba.thrustTowards(target.x, target.y);

    const dmg = this.berserkerActive ? this.tuning.berserker.damage_multiplier : 1;
    target.takeDamage(dmg);

    // Hit-flash on the enemy (AC6).
    this.flashSprite(target);

    if (!target.alive) {
      this.onKill(target);
    }

    this.tapCooldownMs = this.berserkerActive
      ? this.tuning.player.tap_attack_cooldown_ms_berserker
      : this.tuning.player.tap_attack_cooldown_ms;
  }

  findNearestAlive() {
    let best = null;
    let bestDist = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Phaser.Math.Distance.Between(this.reba.x, this.reba.y, e.x, e.y);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  flashSprite(sprite) {
    const flashMs = this.motionMs(this.tuning.motion_ms.hit_flash);
    sprite.setTintFill(0xffffff);
    this.time.delayedCall(flashMs, () => {
      if (sprite && sprite.active) sprite.clearTint();
    });
  }

  onKill(enemy) {
    const kind = enemy.kind;
    const cfg = this.tuning.enemies[kind];
    const baseScore = cfg.score_base;
    const ragePerKill = this.tuning.rage.per_kill[kind];

    // Combo refresh.
    if (this.elapsedS - this.lastKillAt <= this.tuning.combo.kill_window_s) {
      this.comboTier = Math.min(this.tuning.combo.multipliers.length - 1, this.comboTier + 1);
    } else {
      this.comboTier = 0;
    }
    this.lastKillAt = this.elapsedS;

    const comboMult = this.tuning.combo.multipliers[this.comboTier] || 1;
    const berserkerMult = this.berserkerActive ? this.tuning.berserker.score_multiplier : 1;
    const gained = Math.round(baseScore * comboMult * berserkerMult);
    this.score.add(gained);
    this.killCount += 1;

    // Score pop tween (DESIGN.md §3 — 250ms).
    const popMs = this.motionMs(this.tuning.motion_ms.score_pop);
    this.tweens.add({
      targets: this.scoreText,
      scale: { from: 1.4, to: 1 },
      duration: popMs,
      ease: 'Cubic.easeOut',
    });

    // RAGE accumulation.
    if (!this.berserkerActive && this.berserkerCooldown <= 0) {
      this.rage = Math.min(this.tuning.rage.max, this.rage + ragePerKill);
      if (this.rage >= this.tuning.rage.max) {
        this.activateBerserker();
      }
    }

    // Kill animation: scale+fade out, particle burst.
    const killMs = this.motionMs(this.tuning.motion_ms.kill_animation);
    this.tweens.add({
      targets: enemy,
      scale: { from: 1, to: 1.3 },
      alpha: 0,
      duration: killMs,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (enemy && enemy.active) enemy.destroy();
      },
    });

    // Mark enemy as dead so collisions/AI stop, but the tween still runs.
    enemy.alive = false;

    this.audio.play('kill');

    // Brief screen shake when in berserker (AC6 — disabled if reduced-motion).
    if (this.berserkerActive && !(this.reducedMotion && this.tuning.motion_ms.reduced_motion_disable_shake)) {
      const shakeMs = this.motionMs(this.tuning.motion_ms.berserker_screen_shake);
      const amp = this.tuning.motion_ms.berserker_screen_shake_amplitude_px;
      this.cameras.main.shake(shakeMs, amp / 100);
    }
  }

  activateBerserker() {
    this.berserkerActive = true;
    this.berserkerTimeRemaining = this.tuning.berserker.duration_s;
    this.rage = this.tuning.rage.max;
    this.audio.play('berserker_activate');

    const tintAlpha = this.reducedMotion ? 0.18 : 0.18;
    const rampMs = this.reducedMotion ? 0 : this.motionMs(this.tuning.motion_ms.berserker_screen_tint_ramp);
    if (rampMs === 0) {
      this.berserkerOverlay.setAlpha(tintAlpha);
    } else {
      this.tweens.add({
        targets: this.berserkerOverlay,
        alpha: tintAlpha,
        duration: rampMs,
        ease: 'Sine.easeInOut',
      });
    }
  }

  applyDamage(amount) {
    this.reba.hp = Math.max(0, this.reba.hp - amount);
    this.audio.play('hp_damage');
    this.flashSprite(this.reba);
    if (this.reba.hp <= 0) {
      this.endRun('death');
    }
  }

  refreshHUD() {
    const remaining = Math.max(0, this.tuning.session_length_s - this.elapsedS);
    const sec = Math.floor(remaining);
    this.timerText.setText(`0:${sec.toString().padStart(2, '0')}`);

    const hpPct = this.reba.hp / this.tuning.player.starting_hp;
    this.hpBarFill.width = Math.max(0, 82 * hpPct);
    const hpColor = hpPct > 0.4 ? 0x22c55e : 0xef4444;
    this.hpBarFill.fillColor = hpColor;
    this.hpText.setText(`${Math.ceil(this.reba.hp)}`);

    this.scoreText.setText(`SCORE ${this.score.value}`);

    const ragePct = this.rage / this.tuning.rage.max;
    const rageWidth = (this.scale.width - 24) - 2;
    this.rageBarFill.width = Math.max(0, rageWidth * ragePct);
    this.rageBarFill.fillColor = ragePct >= 1 ? 0xef4444 : 0xfb923c;
    this.rageText.setText(`${Math.round(this.rage)}/${this.tuning.rage.max}`);

    if (this.comboTier > 0) {
      const m = this.tuning.combo.multipliers[this.comboTier];
      this.comboText.setText(`x${m.toFixed(1)} COMBO`);
    } else {
      this.comboText.setText('');
    }
  }

  syncDebugSurface() {
    if (!window.__GAME__) return;
    window.__GAME__.score = this.score ? this.score.value : 0;
    window.__GAME__.rage = Math.round(this.rage);
    window.__GAME__.berserker_active = !!this.berserkerActive;
    window.__GAME__.berserker_cooldown = Math.ceil(this.berserkerCooldown);
    window.__GAME__.hp = Math.ceil(this.reba ? this.reba.hp : 0);
    window.__GAME__.elapsed_s = Math.floor(this.elapsedS);
    window.__GAME__.kill_count = this.killCount;
    // spawn_pool is owned by main.js wall-clock ticker — don't override here.
  }

  motionMs(value) {
    if (this.reducedMotion && this.tuning.motion_ms.reduced_motion_halve_all) {
      return Math.max(1, Math.round(value / 2));
    }
    return value;
  }

  endRun(reason) {
    if (this.gameEnded) return;
    this.gameEnded = true;
    this.audio.stopBgm();

    if (window.__GAME__) {
      window.__GAME__.scene = 'GameOverScene';
    }

    const fadeMs = this.motionMs(this.tuning.motion_ms.game_over_fade);
    this.cameras.main.fadeOut(fadeMs, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameOverScene', {
        score: this.score.value,
        kills: this.killCount,
        elapsed_s: Math.floor(this.elapsedS),
        reason,
      });
    });
  }

  shutdown() {
    if (this.audio) this.audio.dispose();
  }
}
