// ScoreManager.js — score + cascade multiplier (numbers from tuning.json).

export class ScoreManager {
  constructor(tuning) {
    this.tuning = tuning;
    this.score = 0;
    this.lastChainStep = 0;
  }

  add(points) {
    this.score += points;
  }

  reset() {
    this.score = 0;
    this.lastChainStep = 0;
  }

  multiplierFor(chainStep) {
    return Math.min(
      this.tuning.scoring.cascade_multiplier_max,
      1 + chainStep * this.tuning.scoring.cascade_multiplier_step
    );
  }
}
