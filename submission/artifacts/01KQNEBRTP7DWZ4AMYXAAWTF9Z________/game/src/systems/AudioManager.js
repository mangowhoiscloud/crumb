// AudioManager — Web Audio synth for BGM (chiptune ostinato 132 BPM) and 4 SFX.
// Spec: artifacts/spec.md "Audio" + DESIGN.md §6 "audio: Web Audio synth — 1 BGM lead + 4 SFX".
// All sound is procedurally generated; no external `<audio src>` files.

const NOTE = (semitonesFromA4) => 440 * Math.pow(2, semitonesFromA4 / 12);

export default class AudioManager {
  constructor(tuning) {
    this.tuning = tuning;
    this.ctx = null;
    this.bgmGain = null;
    this.sfxGain = null;
    this.bgmTimer = null;
    this.bgmStep = 0;
    this.bgmEnabled = false;
    this.disposed = false;
  }

  ensureCtx() {
    if (this.ctx) return this.ctx;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.05;
      this.bgmGain.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.18;
      this.sfxGain.connect(this.ctx.destination);
      return this.ctx;
    } catch (_e) {
      this.ctx = null;
      return null;
    }
  }

  startBgm() {
    this.bgmEnabled = true;
    this.tickBgm();
  }

  stopBgm() {
    this.bgmEnabled = false;
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  tickBgm() {
    if (!this.bgmEnabled || this.disposed) return;
    const ctx = this.ensureCtx();
    const tempo = this.tuning.audio.bgm.tempo_bpm || 132;
    const stepMs = (60 / tempo) * 1000 / 2; // 8th notes
    if (ctx && ctx.state !== 'suspended') {
      // Minor-pent ostinato: A3-C4-D4-E4-G4-E4-D4-C4 looping.
      const pattern = [
        NOTE(-12), NOTE(-9), NOTE(-7), NOTE(-5),
        NOTE(-2), NOTE(-5), NOTE(-7), NOTE(-9),
      ];
      const freq = pattern[this.bgmStep % pattern.length];
      this.bgmStep += 1;
      this.playOsc({
        type: 'square',
        freq,
        durationMs: stepMs * 0.85,
        attackMs: 4,
        releaseMs: 60,
        gainTarget: this.bgmGain,
        peak: 0.6,
      });
    }
    this.bgmTimer = setTimeout(() => this.tickBgm(), stepMs);
  }

  play(name) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      // Don't error if user gesture hasn't unlocked the context.
      ctx.resume().catch(() => {});
      return;
    }
    switch (name) {
      case 'tap_attack':
        this.playOsc({ type: 'square', freq: 660, durationMs: 60, attackMs: 2, releaseMs: 30, peak: 0.5 });
        break;
      case 'kill':
        this.playSweep({ fromFreq: 880, toFreq: 1320, durationMs: 110, peak: 0.6 });
        break;
      case 'berserker_activate':
        this.playSweep({ fromFreq: 220, toFreq: 880, durationMs: 240, peak: 0.7, type: 'sawtooth' });
        break;
      case 'hp_damage':
        this.playSweep({ fromFreq: 440, toFreq: 110, durationMs: 200, peak: 0.6, type: 'square' });
        break;
      default:
        break;
    }
  }

  playOsc({ type = 'square', freq, durationMs, attackMs = 5, releaseMs = 60, peak = 0.6, gainTarget = null }) {
    if (!this.ctx || this.disposed) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + attackMs / 1000);
    gain.gain.linearRampToValueAtTime(0.0001, now + (durationMs + releaseMs) / 1000);
    osc.connect(gain);
    gain.connect(gainTarget || this.sfxGain);
    osc.start(now);
    osc.stop(now + (durationMs + releaseMs) / 1000 + 0.05);
  }

  playSweep({ fromFreq, toFreq, durationMs, peak = 0.5, type = 'square' }) {
    if (!this.ctx || this.disposed) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(fromFreq, now);
    osc.frequency.linearRampToValueAtTime(toFreq, now + durationMs / 1000);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.005);
    gain.gain.linearRampToValueAtTime(0.0001, now + durationMs / 1000);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.05);
  }

  dispose() {
    this.disposed = true;
    this.stopBgm();
    if (this.ctx) {
      try { this.ctx.close(); } catch (_e) { /* noop */ }
      this.ctx = null;
    }
  }
}
