// GameScene.js — main loop. Owns the 6×6 board, tap → flood-fill → cascade,
// timer, urgency cues, and DOM mirror sync (the AC test harness reads the
// mirror, not the canvas).
//
// Iron Law mapping (every block traces to a spec.md AC):
//   AC1 → create() builds 36 tiles + initial DOM mirror + HUD strings
//   AC2 → handleTileTap() flood-fill ≥3, clear within 250ms, +30 score
//   AC3 → resolveCascades() chains with 180ms (±30) delay
//   AC4 → onMatch4 spawns bomb_paw; tapping bomb clears 3×3
//   AC5 → onMatch5Plus triggers screen-wide one-color clear < 600ms
//   AC6 → finishRound() opens modal in <800ms with Win/Game Over branch
//   AC7 → updateUrgency() pulses border 2Hz + timer color #E04848 in last 10s
//   AC8 → no runtime fetches beyond the SW-cached shell

import { deriveLayout } from '../config/gameConfig.js';
import { Tile } from '../entities/Tile.js';
import { ScoreManager } from '../systems/ScoreManager.js';
import { InputManager } from '../systems/InputManager.js';
import { AudioManager } from '../systems/AudioManager.js';

const BEST_KEY = 'cat-tap-match3-v1.best';

export class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    this.tuning = window.__TUNING__;
    this.layout = deriveLayout(this.tuning);
    this.palette = this.tuning.palette;
    this.scoreManager = new ScoreManager(this.tuning);
    this.audio = new AudioManager();
    this.audio.startMusic();

    this.cameras.main.setBackgroundColor(this.palette.bg_board);

    // Board origin so it sits centered with safe-area top inset for HUD.
    const { width, height } = this.scale;
    this.boardX = (width - this.layout.boardWidth) / 2;
    this.boardY = (height - this.layout.boardHeight) / 2 + 12;

    // Board frame (decorative)
    const frame = this.add.graphics();
    frame.fillStyle(0xF0E5D2, 1);
    frame.fillRoundedRect(this.boardX - 12, this.boardY - 12,
      this.layout.boardWidth + 24, this.layout.boardHeight + 24, 18);

    // 2D tile array — board[r][c] = Tile | null
    this.board = Array.from({ length: this.layout.rows }, () =>
      Array.from({ length: this.layout.cols }, () => null));

    // Initial fill — avoid immediate ≥3 clusters at load.
    this.populateInitial();

    // AC1 — DOM mirror (36 entries on initial load)
    this.syncDomMirror();

    // HUD
    const timeLimit = window.__TIME_OVERRIDE__ || this.tuning.time_limit_s;
    this.timeRemaining = timeLimit;
    this.totalTime = timeLimit;
    this.updateHud();

    // Timer — 100ms tick (smooth countdown without frame jitter)
    this.tickEvent = this.time.addEvent({
      delay: 100, loop: true, callback: this.onTick, callbackScope: this
    });
    this.startTime = this.time.now;
    this.gameOver = false;

    // Input router
    this.inputManager = new InputManager(this);

    // Bind modal buttons
    this.bindModalButtons();

    // Hide modal in case of restart
    document.getElementById('modal-overlay').classList.remove('show');
    document.body.classList.remove('urgency');

    // Reduced motion check
    this.reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ---------- board init ----------

  populateInitial() {
    const types = this.tuning.tile_types;
    for (let r = 0; r < this.layout.rows; r++) {
      for (let c = 0; c < this.layout.cols; c++) {
        let pick;
        let safety = 0;
        do {
          pick = types[Math.floor(Math.random() * types.length)];
          safety++;
        } while (safety < 32 && this.wouldFormMatch(r, c, pick));
        this.board[r][c] = this.spawnTile(r, c, pick, false);
      }
    }
  }

  wouldFormMatch(r, c, type) {
    // Check if placing `type` at (r,c) creates an existing 3-in-a-row with already-placed neighbors.
    const left2 = c >= 2 && this.board[r][c - 1] && this.board[r][c - 2]
      && this.board[r][c - 1].type === type && this.board[r][c - 2].type === type;
    const up2 = r >= 2 && this.board[r - 1][c] && this.board[r - 2][c]
      && this.board[r - 1][c].type === type && this.board[r - 2][c].type === type;
    return left2 || up2;
  }

  spawnTile(r, c, type, animate = true, special = null) {
    const x = this.boardX + c * (this.layout.tileSize + this.layout.tileGap) + this.layout.tileSize / 2;
    const y = this.boardY + r * (this.layout.tileSize + this.layout.tileGap) + this.layout.tileSize / 2;
    const tile = new Tile(this, x, y, type, special);
    tile.row = r;
    tile.col = c;
    if (animate) {
      tile.setScale(0);
      this.tweens.add({
        targets: tile, scale: this.tuning.motion.tile_spring_overshoot,
        duration: this.tuning.motion.tile_pop_in_ms * 0.7,
        ease: 'Back.easeOut',
        onComplete: () => this.tweens.add({ targets: tile, scale: 1, duration: 80 })
      });
    }
    this.add.existing(tile);
    return tile;
  }

  // ---------- DOM mirror (AC test surface) ----------

  syncDomMirror() {
    const mirror = document.getElementById('board-mirror');
    if (!mirror) return;
    mirror.innerHTML = '';
    for (let r = 0; r < this.layout.rows; r++) {
      for (let c = 0; c < this.layout.cols; c++) {
        const t = this.board[r][c];
        if (!t) continue;
        const div = document.createElement('div');
        div.setAttribute('data-tile', '');
        div.setAttribute('data-row', String(r));
        div.setAttribute('data-col', String(c));
        div.setAttribute('data-type', t.type);
        if (t.special) div.setAttribute('data-special', t.special);
        mirror.appendChild(div);
      }
    }
  }

  // ---------- HUD ----------

  updateHud() {
    const timeEl = document.getElementById('hud-time');
    const scoreEl = document.getElementById('hud-score');
    if (timeEl) timeEl.textContent = `time = ${this.timeRemaining.toFixed(1)}s`;
    if (scoreEl) scoreEl.textContent = `score = ${this.scoreManager.score}`;
  }

  // ---------- timer ----------

  onTick() {
    if (this.gameOver) return;
    this.timeRemaining = Math.max(0, this.timeRemaining - 0.1);
    this.updateHud();
    this.updateUrgency();
    this.applyDifficultyPhase();
    if (this.timeRemaining <= 0) {
      this.finishRound();
    }
  }

  // AC7 — last 10s urgency
  updateUrgency() {
    const urgent = this.timeRemaining <= this.tuning.urgency.threshold_s && this.timeRemaining > 0;
    if (urgent && !this._urgent) {
      document.body.classList.add('urgency');
      document.getElementById('hud').classList.add('urgency');
      this._urgent = true;
      this.audio.setTempoMultiplier(this.tuning.urgency.tempo_multiplier);
    } else if (!urgent && this._urgent) {
      document.body.classList.remove('urgency');
      document.getElementById('hud').classList.remove('urgency');
      this._urgent = false;
    }
  }

  applyDifficultyPhase() {
    const elapsed = this.totalTime - this.timeRemaining;
    const phase = this.tuning.difficulty_curve.find(p => elapsed >= p.from_s && elapsed < p.to_s);
    this.currentPhase = phase ? phase.phase : '0_15s';
  }

  // ---------- input ----------

  onTilePointerUp(tile) {
    if (this.gameOver || this.cascading) return;
    if (tile.special === 'bomb_paw') {
      this.detonateBomb(tile);
      return;
    }
    if (tile.special === 'locked_box') {
      tile.locked_taps = (tile.locked_taps || 0) + 1;
      if (tile.locked_taps >= this.tuning.specials.locked_box.taps_to_unlock) {
        // Convert to a random basic tile
        const types = this.tuning.tile_types;
        tile.special = null;
        tile.type = types[Math.floor(Math.random() * types.length)];
        tile.repaint();
        this.syncDomMirror();
      } else {
        // Shake feedback
        this.tweens.add({ targets: tile, x: tile.x + 3, duration: 40, yoyo: true, repeat: 2 });
        this.audio.sfx('tap');
      }
      return;
    }
    // AC2 — flood-fill cluster
    const cluster = this.findCluster(tile.row, tile.col, tile.type);
    if (cluster.length >= 3) {
      this.clearCluster(cluster, /*chainStep=*/0);
    } else {
      // Subtle shake — invalid pick
      this.tweens.add({ targets: tile, x: tile.x + 2, duration: 40, yoyo: true, repeat: 1 });
      this.audio.sfx('miss');
    }
  }

  // ---------- flood-fill 4-neighbor ----------

  findCluster(startR, startC, type) {
    const seen = new Set();
    const out = [];
    const stack = [[startR, startC]];
    while (stack.length) {
      const [r, c] = stack.pop();
      const key = r * 100 + c;
      if (seen.has(key)) continue;
      if (r < 0 || r >= this.layout.rows || c < 0 || c >= this.layout.cols) continue;
      const t = this.board[r][c];
      if (!t || t.special) continue; // specials don't cluster
      if (t.type !== type) continue;
      seen.add(key);
      out.push(t);
      stack.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
    }
    return out;
  }

  // ---------- clear + cascade (AC2, AC3, AC4, AC5) ----------

  clearCluster(cluster, chainStep) {
    this.cascading = true;
    const size = cluster.length;
    const chainBonus = 1 + Math.min(this.tuning.scoring.cascade_multiplier_max - 1,
      chainStep * this.tuning.scoring.cascade_multiplier_step);
    let baseScore;
    if (size === 3) baseScore = this.tuning.scoring.match_3;
    else if (size === 4) baseScore = this.tuning.scoring.match_4;
    else baseScore = this.tuning.scoring.match_5_plus;
    const gained = Math.round(baseScore * chainBonus);
    this.scoreManager.add(gained);
    this.updateHud();

    // AC2: synchronously remove DOM mirror entries so test-harness sees count drop within 250ms.
    this.markDomCleared(cluster);

    // SFX with pitch escalation per chain
    this.audio.sfx('pop', chainStep);

    // Particle burst at average position
    const avgX = cluster.reduce((s, t) => s + t.x, 0) / cluster.length;
    const avgY = cluster.reduce((s, t) => s + t.y, 0) / cluster.length;
    this.spawnBurst(avgX, avgY, gained);

    // Phaser tween destroy (pop animation, ≤ 250ms)
    const popMs = this.reducedMotion ? 60 : Math.min(this.tuning.motion.tile_pop_in_ms - 30, 220);
    cluster.forEach(t => {
      this.board[t.row][t.col] = null;
      this.tweens.add({
        targets: t, scale: 0, alpha: 0.2, duration: popMs,
        ease: 'Back.easeIn',
        onComplete: () => t.destroy()
      });
    });

    // AC4 — match-4 spawns bomb_paw at the clearedCells[0]
    if (size === 4) {
      const target = cluster[0];
      this.time.delayedCall(popMs + 20, () => {
        const bomb = this.spawnTile(target.row, target.col, target.type, true, 'bomb_paw');
        this.board[target.row][target.col] = bomb;
        this.syncDomMirror();
      });
    }

    // AC5 — match-5+ → screen-wide one-color clear (< 600ms total)
    if (size >= 5) {
      const types = this.tuning.tile_types.filter(t => cluster[0].type !== t);
      const targetType = types[Math.floor(Math.random() * types.length)];
      this.time.delayedCall(popMs + 20, () => this.screenWideClear(targetType));
    }

    // AC3 — cascade: drop + refill + check for new clusters with 180ms delay per chain step
    const cascadeDelay = this.tuning.motion.cascade_delay_ms;
    this.time.delayedCall(popMs + 20, () => {
      this.applyGravity();
      this.refillTopRows();
      this.syncDomMirror();
      this.time.delayedCall(cascadeDelay, () => {
        const next = this.findAnyCluster();
        if (next) {
          this.clearCluster(next, chainStep + 1);
        } else {
          this.cascading = false;
          // Reset chain multiplier display
        }
      });
    });
  }

  markDomCleared(cluster) {
    const mirror = document.getElementById('board-mirror');
    if (!mirror) return;
    cluster.forEach(t => {
      const node = mirror.querySelector(`[data-tile][data-row="${t.row}"][data-col="${t.col}"]`);
      if (node) node.remove();
    });
    // Update score in DOM right now (AC2 — within 250ms means well within 1s)
    const scoreEl = document.getElementById('hud-score');
    if (scoreEl) scoreEl.textContent = `score = ${this.scoreManager.score}`;
  }

  findAnyCluster() {
    for (let r = 0; r < this.layout.rows; r++) {
      for (let c = 0; c < this.layout.cols; c++) {
        const t = this.board[r][c];
        if (!t || t.special) continue;
        const cl = this.findCluster(r, c, t.type);
        if (cl.length >= 3) return cl;
      }
    }
    return null;
  }

  applyGravity() {
    for (let c = 0; c < this.layout.cols; c++) {
      for (let r = this.layout.rows - 1; r >= 0; r--) {
        if (this.board[r][c] === null) {
          // Find next non-null above
          for (let rr = r - 1; rr >= 0; rr--) {
            if (this.board[rr][c]) {
              const moving = this.board[rr][c];
              this.board[r][c] = moving;
              this.board[rr][c] = null;
              moving.row = r;
              const targetY = this.boardY + r * (this.layout.tileSize + this.layout.tileGap) + this.layout.tileSize / 2;
              const fallSpeedMult = (this._urgent ? 1.3 : 1.0);
              this.tweens.add({
                targets: moving, y: targetY,
                duration: 220 / fallSpeedMult, ease: 'Quad.easeIn'
              });
              break;
            }
          }
        }
      }
    }
  }

  refillTopRows() {
    const types = this.tuning.tile_types;
    const elapsed = this.totalTime - this.timeRemaining;
    const lockedAfter = this.tuning.specials.locked_box.enabled_after_s;
    const bombAfter = this.tuning.specials.bomb_paw.enabled_after_s;

    for (let c = 0; c < this.layout.cols; c++) {
      for (let r = 0; r < this.layout.rows; r++) {
        if (this.board[r][c] === null) {
          const type = types[Math.floor(Math.random() * types.length)];
          let special = null;
          if (elapsed >= lockedAfter && Math.random() < this.tuning.specials.locked_box.spawn_pct) {
            special = 'locked_box';
          } else if (elapsed >= bombAfter && Math.random() < this.tuning.specials.bomb_paw.spawn_pct) {
            special = 'bomb_paw';
          }
          const tile = this.spawnTile(r, c, type, true, special);
          // Start above board for fall-in feel
          const yStart = this.boardY - 32 - r * 6;
          tile.y = yStart;
          const targetY = this.boardY + r * (this.layout.tileSize + this.layout.tileGap) + this.layout.tileSize / 2;
          this.tweens.add({
            targets: tile, y: targetY, duration: 260, ease: 'Quad.easeIn'
          });
          this.board[r][c] = tile;
        }
      }
    }
  }

  // AC4 — bomb detonation: 3×3 area clear centered on bomb
  detonateBomb(bomb) {
    const radius = this.tuning.specials.bomb_paw.clear_radius;
    const cluster = [];
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        const r = bomb.row + dr;
        const c = bomb.col + dc;
        if (r < 0 || r >= this.layout.rows || c < 0 || c >= this.layout.cols) continue;
        const t = this.board[r][c];
        if (!t) continue;
        cluster.push(t);
      }
    }
    if (cluster.length === 0) return;

    // Score: treat as match_5_plus baseline scaled by area
    const gained = Math.round(this.tuning.scoring.match_5_plus * 1.0);
    this.scoreManager.add(gained);
    this.updateHud();

    this.markDomCleared(cluster);
    this.audio.sfx('boom');

    // Camera shake
    const shake = this.tuning.feedback.screen_shake_max_px;
    this.cameras.main.shake(180, shake / 200);

    const popMs = this.reducedMotion ? 50 : 220;
    cluster.forEach(t => {
      this.board[t.row][t.col] = null;
      this.tweens.add({
        targets: t, scale: 0, alpha: 0.2, duration: popMs,
        onComplete: () => t.destroy()
      });
    });

    this.time.delayedCall(popMs + 20, () => {
      this.applyGravity();
      this.refillTopRows();
      this.syncDomMirror();
      this.time.delayedCall(this.tuning.motion.cascade_delay_ms, () => {
        const next = this.findAnyCluster();
        if (next) this.clearCluster(next, 1);
        else this.cascading = false;
      });
    });
  }

  // AC5 — screen-wide one-color clear < 600ms
  screenWideClear(targetType) {
    const cluster = [];
    for (let r = 0; r < this.layout.rows; r++) {
      for (let c = 0; c < this.layout.cols; c++) {
        const t = this.board[r][c];
        if (t && !t.special && t.type === targetType) cluster.push(t);
      }
    }
    if (cluster.length === 0) return;

    const gained = cluster.length * this.tuning.scoring.match_3;
    this.scoreManager.add(gained);
    this.updateHud();
    this.markDomCleared(cluster);
    this.audio.sfx('superClear');

    // Flash overlay (visual only, fits in 600ms budget)
    const flashG = this.add.graphics();
    flashG.fillStyle(0xFFE9A8, 0.6);
    flashG.fillRect(0, 0, this.scale.width, this.scale.height);
    flashG.setDepth(100);
    this.tweens.add({
      targets: flashG, alpha: 0, duration: this.tuning.motion.screen_wide_clear_ms - 100,
      onComplete: () => flashG.destroy()
    });

    const popMs = this.reducedMotion ? 50 : Math.min(this.tuning.motion.screen_wide_clear_ms - 200, 380);
    cluster.forEach(t => {
      this.board[t.row][t.col] = null;
      this.tweens.add({
        targets: t, scale: 0, alpha: 0.2, duration: popMs,
        onComplete: () => t.destroy()
      });
    });
  }

  spawnBurst(x, y, score) {
    if (this.reducedMotion) return;
    const t = this.add.text(x, y - 20, `+${score}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px', fontStyle: 'bold', color: this.palette.accent_warm,
      stroke: this.palette.text_primary, strokeThickness: 3
    }).setOrigin(0.5);
    this.tweens.add({
      targets: t, y: y - 60, alpha: 0,
      duration: this.tuning.motion.particle_fade_ms,
      ease: 'Quad.easeOut',
      onComplete: () => t.destroy()
    });
  }

  // AC6 — round end → modal in <800ms
  finishRound() {
    if (this.gameOver) return;
    this.gameOver = true;
    if (this.tickEvent) this.tickEvent.remove();
    document.body.classList.remove('urgency');
    document.getElementById('hud').classList.remove('urgency');

    // Persist best score
    const best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
    if (this.scoreManager.score > best) {
      localStorage.setItem(BEST_KEY, String(this.scoreManager.score));
    }

    const modal = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const sub = document.getElementById('modal-sub');
    const scoreEl = document.getElementById('modal-score');
    const primary = document.getElementById('modal-primary');
    const secondary = document.getElementById('modal-secondary');

    const won = this.scoreManager.score >= this.tuning.win_threshold;
    if (won) {
      title.textContent = 'Win';
      sub.textContent = '축하합니다! 목표 달성';
      primary.textContent = 'Play Again';
      secondary.textContent = 'Home';
    } else {
      title.textContent = 'Game Over';
      sub.textContent = `최종 점수 (목표 ${this.tuning.win_threshold.toLocaleString()})`;
      primary.textContent = 'Retry';
      secondary.textContent = 'Home';
    }
    scoreEl.textContent = this.scoreManager.score.toLocaleString();

    // Render within modal_delay_ms budget (default 800ms; we use ~50ms tween).
    const modalDelay = Math.min(this.tuning.motion.gameover_modal_delay_ms, 200);
    setTimeout(() => modal.classList.add('show'), modalDelay);

    this.audio.sfx(won ? 'win' : 'lose');
    this.audio.stopMusic();
  }

  bindModalButtons() {
    const primary = document.getElementById('modal-primary');
    const secondary = document.getElementById('modal-secondary');
    const modal = document.getElementById('modal-overlay');
    const onPrimary = () => {
      modal.classList.remove('show');
      this.scene.restart();
    };
    const onSecondary = () => {
      modal.classList.remove('show');
      this.scene.start('MenuScene');
    };
    // Replace with cloned nodes to drop prior listeners on restart.
    const newPrimary = primary.cloneNode(true);
    const newSecondary = secondary.cloneNode(true);
    primary.parentNode.replaceChild(newPrimary, primary);
    secondary.parentNode.replaceChild(newSecondary, secondary);
    newPrimary.addEventListener('click', onPrimary);
    newSecondary.addEventListener('click', onSecondary);
  }
}
