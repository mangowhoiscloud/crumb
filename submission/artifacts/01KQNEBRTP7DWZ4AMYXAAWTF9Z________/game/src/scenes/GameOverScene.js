// GameOverScene: shows final score / kills / Retry button via the DOM
// overlay (#game-over-ui) — required by AC4 ("DOM shows score/kills/Retry").
// Phaser side renders only a dim background; all interactive UI is HTML for
// guaranteed accessibility (44×44 hit zone, real <button>).

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
    this._retryHandler = null;
  }

  init(data) {
    this.payload = data || { score: 0, kills: 0, elapsed_s: 0, reason: 'survived' };
    this.tuning = this.registry.get('tuning');
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.cameras.main.setBackgroundColor(this.tuning.colors.background);
    this.cameras.main.fadeIn(this.motionMs(this.tuning.motion_ms.game_over_fade), 0, 0, 0);

    // Mark scene globally (AC4).
    if (window.__GAME__) window.__GAME__.scene = 'GameOverScene';

    // Dim Phaser layer; HTML overlay carries the actual UI (real DOM elements
    // for AC4: "DOM shows final score, kill count, and a Retry button").
    this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.45).setDepth(0);

    this.populateOverlay();

    // Wire retry button.
    const btn = document.getElementById('retry-button');
    if (btn) {
      // Replace with a fresh node to drop any prior listeners (re-entry safe).
      const fresh = btn.cloneNode(true);
      btn.parentNode.replaceChild(fresh, btn);
      this._retryHandler = (ev) => {
        if (ev) ev.preventDefault();
        this.handleRetry();
      };
      fresh.addEventListener('click', this._retryHandler);
      fresh.addEventListener('touchend', this._retryHandler, { passive: false });
    }
  }

  populateOverlay() {
    const overlay = document.getElementById('game-over-ui');
    const scoreEl = document.getElementById('final-score');
    const killsEl = document.getElementById('final-kills');
    const timeEl = document.getElementById('final-time');
    if (scoreEl) scoreEl.textContent = `SCORE: ${this.payload.score}`;
    if (killsEl) killsEl.textContent = `KILLS: ${this.payload.kills}`;
    if (timeEl) timeEl.textContent = `TIME: ${this.payload.elapsed_s}s`;
    if (overlay) overlay.classList.add('show');
  }

  handleRetry() {
    const overlay = document.getElementById('game-over-ui');
    if (overlay) overlay.classList.remove('show');
    if (window.__GAME__) {
      window.__GAME__.scene = 'GameScene';
      window.__GAME__.score = 0;
      window.__GAME__.rage = 0;
      window.__GAME__.berserker_active = false;
      window.__GAME__.berserker_cooldown = 0;
      window.__GAME__.hp = 100;
      window.__GAME__.elapsed_s = 0;
      window.__GAME__.kill_count = 0;
      window.__GAME_BOOT_TS__ = (typeof performance !== 'undefined' && performance.now)
        ? performance.now()
        : Date.now();
    }
    this.scene.start('GameScene');
  }

  motionMs(value) {
    const reduced = (typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (reduced && this.tuning.motion_ms.reduced_motion_halve_all) {
      return Math.max(1, Math.round(value / 2));
    }
    return value;
  }
}
