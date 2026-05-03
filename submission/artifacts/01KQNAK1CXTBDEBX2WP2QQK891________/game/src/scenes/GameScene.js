import { DESIGN } from '../config/gameConfig.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Slash } from '../entities/Slash.js';
import { AudioManager } from '../systems/AudioManager.js';
import { ScoreManager } from '../systems/ScoreManager.js';
import { InputManager } from '../systems/InputManager.js';

export class GameScene extends Phaser.Scene {
  constructor() { super({ key: 'GameScene' }); }

  create() {
    const t = this.registry.get('tuning');
    this.t = t;
    const P = t.palette;
    const W = DESIGN.W, H = DESIGN.H;
    this.W = W; this.H = H;

    this.cameras.main.setBackgroundColor(P.background);

    // arena floor pattern (for visual depth)
    this._drawArenaFloor(P);

    // Top HUD area
    const hudTop = t.viewport.safe_area_top_px;
    this._drawHud(P, hudTop);

    // entities
    this.player = new Player(this, W / 2, H * 0.55);
    this.enemies = this.physics.add.group({ classType: Enemy, runChildUpdate: true });
    this.slashes = this.add.group({ classType: Slash, runChildUpdate: true });

    // overlap: enemy ↔ player
    this.physics.add.overlap(this.player, this.enemies, this._onPlayerHit, null, this);

    // managers
    this.audio = new AudioManager(this, t);
    this.score = new ScoreManager(this, t);
    this.input_ = new InputManager(this, t);

    // berserker state
    this.berserkerActive = false;
    this.berserkerEndsAt = 0;
    this.tintOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0xD62828, 0).setDepth(900);
    this.berserkerCallout = this.add.text(W / 2, H / 2 - 80, t.hud.rage_callout_text, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '40px',
      fontStyle: 'bold',
      color: P.primary,
      stroke: P.accent, strokeThickness: 6
    }).setOrigin(0.5).setDepth(950).setAlpha(0);

    // game timing
    this.runStartedAt = this.time.now;
    this.runEndedAt = null;
    this.endStateShown = false;
    this.lastSpawnAt = 0;
    this.kills = 0;

    // hit-stop state
    this.frozenUntil = 0;

    // shake state (single-shake cap)
    this.shakeUntil = 0;

    // expose state for AC predicates / verifier
    window.__GAME_STATE__ = () => ({
      kills: this.kills,
      score: this.score.value,
      hp: this.player.hp,
      rage: this.score.rage,
      timer_s: this._timerS(),
      berserker: this.berserkerActive,
      enemies_alive: this.enemies.countActive(true),
      ended: !!this.runEndedAt
    });

    this._updateHud();
    this._updateAria('Run started. 60 seconds. Tap to slash, swipe to dash.');

    // attempt audio start on first input (browser autoplay policy)
    this.input.once('pointerdown', () => this.audio.unlock());
  }

  _drawArenaFloor(P) {
    const g = this.add.graphics();
    g.fillStyle(0x4D341F, 1);
    g.fillRect(0, 90, this.W, this.H - 90);
    // subtle plank lines
    g.lineStyle(1, 0x2E1C0F, 0.6);
    for (let y = 110; y < this.H; y += 28) {
      g.lineBetween(0, y, this.W, y);
    }
    // edge fade
    g.lineStyle(2, 0x1A0F08, 1);
    g.strokeRect(2, 90, this.W - 4, this.H - 92);
  }

  _drawHud(P, top) {
    // pause button (top-left, 44×44)
    const pauseSize = 44;
    this.pauseBtn = this.add.rectangle(8 + pauseSize/2, top + pauseSize/2, pauseSize, pauseSize, 0x1A0F08, 0.5)
      .setStrokeStyle(2, 0xF4E8D0)
      .setInteractive({ useHandCursor: true })
      .setDepth(800);
    this.add.text(8 + pauseSize/2, top + pauseSize/2, '⏸', {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: P.primary
    }).setOrigin(0.5).setDepth(801);
    this.pauseBtn.on('pointerdown', () => this._togglePause());

    // timer (top-center)
    this.timerText = this.add.text(this.W / 2, top + 16, '0:60', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: P.primary,
      stroke: P.secondary, strokeThickness: 3
    }).setOrigin(0.5, 0).setDepth(800);

    // HP hearts (top-right)
    this.heartIcons = [];
    const hpX = this.W - 14;
    for (let i = 0; i < 3; i++) {
      const ico = this.add.image(hpX - i * 22, top + 18, 'heart').setDepth(800);
      this.heartIcons.push(ico);
    }

    // rage bar (full-width band)
    const rageY = top + pauseSize + 6;
    this.rageBg = this.add.rectangle(this.W / 2, rageY + 6, this.W - 16, 12, 0x1A0F08, 0.85)
      .setStrokeStyle(1, 0xF4E8D0).setDepth(800);
    this.rageFill = this.add.rectangle(8, rageY + 6, 1, 10, 0xD62828)
      .setOrigin(0, 0.5).setDepth(801);
    this.rageGlyph = this.add.text(this.W - 14, rageY + 6, 'RAGE', {
      fontFamily: 'system-ui, sans-serif', fontSize: '10px', fontStyle: 'bold', color: P.primary
    }).setOrigin(1, 0.5).setDepth(802);

    // score
    this.scoreText = this.add.text(this.W - 8, rageY + 26, 'SCORE 0', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: P.primary,
      stroke: P.secondary, strokeThickness: 3
    }).setOrigin(1, 0).setDepth(800);

    // combo readout
    this.comboText = this.add.text(8, rageY + 26, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: P.accent,
      stroke: P.secondary, strokeThickness: 2
    }).setOrigin(0, 0).setDepth(800);
  }

  update(_, dt) {
    if (this.runEndedAt) return;
    if (this.scene.isPaused()) return;

    const now = this.time.now;
    const tSec = this._timerS();

    // hit-stop freeze
    if (now < this.frozenUntil) {
      this.physics.world.isPaused = true;
    } else {
      this.physics.world.isPaused = false;
    }

    // berserker timer
    if (this.berserkerActive && now >= this.berserkerEndsAt) {
      this._endBerserker();
    }

    // spawn cadence (linear ramp 1500 → 600 across 60s)
    const ramp = Phaser.Math.Clamp(tSec / this.t.spawn.ramp_over_s, 0, 1);
    const spawnInterval = Phaser.Math.Linear(
      this.t.spawn.interval_start_ms,
      this.t.spawn.interval_end_ms,
      ramp
    );
    if (now - this.lastSpawnAt >= spawnInterval) {
      this._spawnEnemy(tSec);
      this.lastSpawnAt = now;
    }

    // 60s timeout
    if (tSec >= this.t.session.duration_s) {
      this._endRun(this.score.value >= this.t.session.win_score_threshold ? 'win' : 'loss-time');
    }

    // combo decay
    this.score.tick(now);

    // update HUD
    this._updateHud();

    // chase enemies toward player
    this.enemies.children.iterate((e) => {
      if (!e || !e.active) return;
      e.chase(this.player.x, this.player.y);
    });
  }

  _timerS() {
    return Math.min(
      this.t.session.duration_s,
      Math.floor((this.time.now - this.runStartedAt) / 1000)
    );
  }

  _spawnEnemy(tSec) {
    if (this.runEndedAt) return;
    // warm-up: only one enemy on screen for first 5s
    if (tSec < this.t.spawn.warmup_single_enemy_until_s) {
      if (this.enemies.countActive(true) >= 1) return;
    }
    // pick edge
    const edge = Phaser.Math.Between(0, 3);
    let x, y;
    const margin = 16;
    if (edge === 0) { x = Phaser.Math.Between(margin, this.W - margin); y = 100; }
    else if (edge === 1) { x = this.W - margin; y = Phaser.Math.Between(110, this.H - margin); }
    else if (edge === 2) { x = Phaser.Math.Between(margin, this.W - margin); y = this.H - margin; }
    else { x = margin; y = Phaser.Math.Between(110, this.H - margin); }

    const e = new Enemy(this, x, y);
    this.enemies.add(e, true);
    const speed = Phaser.Math.Between(this.t.spawn.enemy_speed_min, this.t.spawn.enemy_speed_max);
    e.setSpeed(speed);
  }

  doSlash(targetX, targetY) {
    if (this.runEndedAt) return;
    if (this.time.now < this.frozenUntil) return;

    // find nearest enemy
    let nearest = null, ndist = Infinity;
    this.enemies.children.iterate((e) => {
      if (!e || !e.active) return;
      const dx = e.x - this.player.x, dy = e.y - this.player.y;
      const d = dx*dx + dy*dy;
      if (d < ndist) { ndist = d; nearest = e; }
    });

    let aimX = targetX, aimY = targetY;
    if (nearest) { aimX = nearest.x; aimY = nearest.y; }

    const angle = Math.atan2(aimY - this.player.y, aimX - this.player.x);
    const radius = this.t.slash.base_radius_px *
      (this.berserkerActive ? this.t.berserker.slash_radius_multiplier : 1);

    const slash = new Slash(this, this.player.x, this.player.y, angle, radius, this.t);
    this.slashes.add(slash);
    this.player.faceTo(angle);

    this.audio.play('slash');

    // check kills inside slash radius
    const r2 = radius * radius;
    let killedThisSwing = 0;
    this.enemies.children.iterate((e) => {
      if (!e || !e.active) return;
      const dx = e.x - this.player.x, dy = e.y - this.player.y;
      // dot product with slash direction must be positive (front-facing arc 180°)
      const dot = dx * Math.cos(angle) + dy * Math.sin(angle);
      if (dot < -8) return;
      if (dx*dx + dy*dy <= r2) {
        this._killEnemy(e);
        killedThisSwing++;
      }
    });

    if (killedThisSwing > 0) {
      // hit-stop + screen shake (capped during berserker)
      this._hitStop(this.t.slash.hit_stop_ms);
      const amp = this.berserkerActive
        ? this.t.slash.shake_amplitude_px * this.t.slash.berserker_shake_amplitude_multiplier
        : this.t.slash.shake_amplitude_px;
      this._shake(this.t.slash.shake_duration_ms, amp);
    }
  }

  doDash(angle) {
    if (this.runEndedAt) return;
    this.player.dash(angle, this.t.player.dash_distance_px, this.t.player.dash_invuln_ms);
  }

  _killEnemy(e) {
    // white flash before destroy
    e.flashAndKill(this.t.motion.white_flash_ms);
    this.kills++;
    this.audio.play('kill');

    const gained = this.score.registerKill(this.time.now, this.berserkerActive);
    this._popText('+' + gained, e.x, e.y - 12);

    // rage
    this.score.addRage(this.t.rage.per_kill);
    if (!this.berserkerActive && this.score.rage >= this.t.rage.auto_trigger_at) {
      this._startBerserker();
    }
  }

  _startBerserker() {
    if (this.berserkerActive) return;
    this.berserkerActive = true;
    const dur = this.t.berserker.duration_ms +
      Phaser.Math.Between(-this.t.berserker.duration_jitter_ms, this.t.berserker.duration_jitter_ms);
    this.berserkerEndsAt = this.time.now + dur;

    // Tint at rgba(214,40,40,0.30) immediately (AC3 — same frame as 10th kill).
    // Use full fillAlpha and rely on the GameObject alpha for the 0.30 mix so the
    // fade-out tween (which animates GameObject alpha) can drive the exit cleanly.
    this.tintOverlay.setFillStyle(0xD62828, 1);
    this.tintOverlay.setAlpha(0.30);

    // Berserker callout (visible same frame)
    this.berserkerCallout.setAlpha(1).setScale(0.3);
    this.tweens.add({
      targets: this.berserkerCallout,
      scale: 1.2,
      duration: 240,
      ease: 'Back.Out',
      yoyo: false
    });
    this.tweens.add({
      targets: this.berserkerCallout,
      alpha: 0,
      duration: 800,
      delay: 600,
      ease: 'Quad.In'
    });

    this.audio.play('berserker_trigger');
    this._updateAria('Berserker active. Score x3.');
  }

  _endBerserker() {
    this.berserkerActive = false;
    // fade-out tint over 400ms
    this.tweens.add({
      targets: this.tintOverlay,
      alpha: 0,
      duration: this.t.berserker.tint_fadeout_ms,
      ease: 'Quad.Out'
    });
    // reset rage
    this.score.rage = 0;
    this._updateAria('Berserker ended.');
  }

  _hitStop(ms) {
    this.frozenUntil = Math.max(this.frozenUntil, this.time.now + ms);
  }

  _shake(ms, amp) {
    const reduced = this.registry.get('reducedMotion');
    if (reduced) amp = amp * this.t.motion.reduced_motion_shake_multiplier;
    if (this.time.now < this.shakeUntil) return; // single-shake cap
    this.shakeUntil = this.time.now + ms;
    this.cameras.main.shake(ms, amp / 200);
  }

  _onPlayerHit(_player, enemy) {
    if (this.runEndedAt) return;
    if (this.player.invulnUntil > this.time.now) return;
    this.player.takeHit(this.t.player.iframe_after_hit_ms);
    this.audio.play('hit');

    // visible HP heart removal
    if (this.heartIcons.length > this.player.hp) {
      const ico = this.heartIcons.pop();
      this.tweens.add({
        targets: ico,
        alpha: 0,
        scale: 0.4,
        duration: 220,
        onComplete: () => ico.destroy()
      });
    }

    if (this.player.hp <= 0) {
      this._endRun('loss-hp');
    }

    // push enemy back
    enemy.knockback(this.player.x, this.player.y);
  }

  _popText(s, x, y) {
    const t = this.add.text(x, y, s, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: this.berserkerActive ? '#F4E8D0' : '#D62828',
      stroke: '#1A0F08', strokeThickness: 2
    }).setOrigin(0.5).setDepth(700);
    this.tweens.add({
      targets: t,
      y: y - 24,
      alpha: 0,
      duration: 600,
      onComplete: () => t.destroy()
    });
  }

  _updateHud() {
    // timer countdown
    const remain = Math.max(0, this.t.session.duration_s - this._timerS());
    const m = Math.floor(remain / 60);
    const s = remain % 60;
    this.timerText.setText(m + ':' + (s < 10 ? '0' + s : s));

    // rage bar
    const ragePct = Phaser.Math.Clamp(this.score.rage / this.t.rage.cap, 0, 1);
    const fullW = this.W - 16;
    this.rageFill.width = Math.max(1, fullW * ragePct);
    if (ragePct >= 1 && !this.berserkerActive) {
      this.rageFill.setFillStyle(0xF4E8D0);
    } else if (this.berserkerActive) {
      this.rageFill.setFillStyle(0xF4E8D0);
    } else {
      this.rageFill.setFillStyle(0xD62828);
    }

    // score
    this.scoreText.setText('SCORE ' + this.score.value);

    // combo readout
    if (this.score.comboTier > 0) {
      this.comboText.setText('x' + this.t.scoring.combo_multipliers[this.score.comboTier].toFixed(1) + ' COMBO');
    } else {
      this.comboText.setText('');
    }
  }

  _updateAria(msg) {
    const mirror = document.getElementById('aria-mirror');
    if (mirror) {
      const remain = Math.max(0, this.t.session.duration_s - this._timerS());
      mirror.textContent = msg + ' Score ' + this.score.value +
        '. HP ' + this.player.hp + '. Time ' + remain + 's.';
    }
  }

  _endRun(reason) {
    if (this.runEndedAt) return;
    this.runEndedAt = this.time.now;
    this.audio.play('game_over');
    this.input.removeAllListeners('pointerdown');
    this.input.removeAllListeners('pointerup');
    this.enemies.children.iterate((e) => { if (e && e.active) e.setVelocity(0, 0); });
    this.physics.world.isPaused = true;

    const newBest = this.score.persistBest();
    const data = {
      reason,
      score: this.score.value,
      best: newBest,
      kills: this.kills,
      win: reason === 'win'
    };
    // brief delay so the death frame reads (kept under AC7's 100ms ceiling)
    this.time.delayedCall(60, () => {
      this.scene.start('GameOverScene', data);
    });
  }

  _togglePause() {
    if (this.runEndedAt) return;
    if (this.scene.isPaused()) this.scene.resume();
    else this.scene.pause();
  }
}
