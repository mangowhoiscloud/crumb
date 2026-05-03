// ScoreManager — append-only score tracker. The combo / berserker multipliers
// are computed in GameScene; this system only adds + persists the running total
// and the per-session best.

const STORAGE_KEY = 'reba-berserker-best-score';

export default class ScoreManager {
  constructor(/* tuning */ _tuning) {
    this.value = 0;
    this.best = 0;
    try {
      const raw = window.localStorage && window.localStorage.getItem(STORAGE_KEY);
      this.best = raw ? parseInt(raw, 10) || 0 : 0;
    } catch (_e) {
      this.best = 0;
    }
  }

  add(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.value += amount;
    if (this.value > this.best) {
      this.best = this.value;
      try {
        if (window.localStorage) window.localStorage.setItem(STORAGE_KEY, String(this.best));
      } catch (_e) {
        /* ignore quota errors */
      }
    }
  }

  reset() {
    this.value = 0;
  }
}
