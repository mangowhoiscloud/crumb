export class AudioManager {
  constructor(scene, tuning) {
    this.scene = scene;
    this.t = tuning;
    this.ctx = null;
    this.bgmGain = null;
    this.unlocked = false;
  }

  unlock() {
    if (this.unlocked) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.unlocked = true;
      this._startBgm();
    } catch (e) { /* ignore — silent run */ }
  }

  _startBgm() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    this.bgmGain = ctx.createGain();
    this.bgmGain.gain.value = 0.04;
    this.bgmGain.connect(ctx.destination);

    // Simple looped two-bar arpeggio
    const baseHz = 110; // A2
    const seq = [0, 7, 12, 7, 3, 10, 12, 10]; // semitones
    const stepMs = 220;
    let step = 0;
    const tick = () => {
      if (!this.ctx) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      const semitone = seq[step % seq.length];
      o.frequency.value = baseHz * Math.pow(2, semitone / 12);
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.20, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + stepMs / 1000);
      o.connect(g); g.connect(this.bgmGain);
      o.start();
      o.stop(ctx.currentTime + stepMs / 1000);
      step++;
    };
    this._bgmInterval = setInterval(tick, stepMs);
  }

  stop() {
    if (this._bgmInterval) clearInterval(this._bgmInterval);
    if (this.ctx) {
      try { this.ctx.close(); } catch (_) {}
      this.ctx = null;
    }
  }

  play(key) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    let dur = 0.10, freq = 600, type = 'square', peak = 0.18;

    if (key === 'slash') {
      type = 'sawtooth'; freq = 520; dur = 0.06; peak = 0.16;
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(freq * 0.4, ctx.currentTime + dur);
    } else if (key === 'hit') {
      type = 'square'; freq = 180; dur = 0.16; peak = 0.22;
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + dur);
    } else if (key === 'kill') {
      type = 'triangle'; freq = 880; dur = 0.10; peak = 0.18;
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + dur);
    } else if (key === 'berserker_trigger') {
      type = 'sawtooth'; freq = 220; dur = 0.45; peak = 0.25;
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      o.frequency.linearRampToValueAtTime(110, ctx.currentTime + dur);
    } else if (key === 'game_over') {
      type = 'sine'; freq = 440; dur = 0.6; peak = 0.22;
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + dur);
    } else {
      o.frequency.value = freq;
    }

    o.type = type;
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(peak, ctx.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }
}
