export class ScoreManager {
  constructor(scene, tuning) {
    this.scene = scene;
    this.t = tuning;
    this.value = 0;
    this.rage = 0;
    this.comboTier = 0;       // index into combo_multipliers
    this.lastKillAt = 0;
  }

  registerKill(nowMs, berserkerActive) {
    // combo: extend tier if within window
    if (nowMs - this.lastKillAt <= this.t.scoring.combo_window_ms) {
      this.comboTier = Math.min(this.comboTier + 1, this.t.scoring.combo_multipliers.length - 1);
    } else {
      this.comboTier = 1; // first chained kill becomes tier 1 (×1.2)
    }
    this.lastKillAt = nowMs;

    const combo = this.t.scoring.combo_multipliers[this.comboTier] || 1;
    const berserkerMult = berserkerActive ? this.t.berserker.score_multiplier : 1;
    const gained = Math.max(1, Math.round(this.t.scoring.base_kill_score * combo * berserkerMult));
    this.value += gained;
    return gained;
  }

  addRage(amount) {
    this.rage = Math.min(this.t.rage.cap, this.rage + amount);
  }

  tick(nowMs) {
    if (this.lastKillAt && nowMs - this.lastKillAt > this.t.scoring.combo_window_ms) {
      this.comboTier = 0;
    }
  }

  persistBest() {
    const prev = parseInt(localStorage.getItem('reba.best') || '0', 10);
    const best = Math.max(prev, this.value);
    try { localStorage.setItem('reba.best', String(best)); } catch (_) {}
    return best;
  }
}
