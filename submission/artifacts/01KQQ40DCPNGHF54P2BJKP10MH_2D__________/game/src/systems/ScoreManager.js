// Tracks score, run start time, generates seeds. ScoreManager hands the snapshot
// to PersistenceManager.saveRun() on run completion.
export class ScoreManager {
  constructor() {
    this.score = 0;
    this.startedAt = Date.now();
    this.seed = this._mkSeed();
  }
  reset() { this.score = 0; this.startedAt = Date.now(); this.seed = this._mkSeed(); }
  add(delta) { this.score = Math.max(0, this.score + (delta | 0)); return this.score; }
  durationMs() { return Date.now() - this.startedAt; }
  snapshot() { return { score: this.score, duration_ms: this.durationMs(), seed: this.seed }; }
  _mkSeed() {
    return Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
  }
}
