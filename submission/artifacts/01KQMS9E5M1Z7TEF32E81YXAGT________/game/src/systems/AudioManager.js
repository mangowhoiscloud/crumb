// AudioManager.js — Web Audio synth: 1 BGM lead + 4 SFX (pop / boom /
// superClear / win|lose). DESIGN.md §6 forbids external <audio src> /
// .mp3 / .ogg. SFX pitch escalates with chain step (feedback.sfx_pitch_*).

const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0]; // C D E G A — playful

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.musicTimer = null;
    this.tempoMul = 1.0;
    this._step = 0;
  }

  ensure() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.18;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.5;
    this.musicGain.connect(this.master);
  }

  // BGM: simple looped pentatonic phrase, gentle square waves.
  startMusic() {
    this.ensure();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.musicTimer) clearInterval(this.musicTimer);
    let i = 0;
    const baseStepMs = 360;
    const tick = () => {
      if (!this.ctx) return;
      const stepMs = baseStepMs / this.tempoMul;
      const note = PENTATONIC[i % PENTATONIC.length];
      this.tone(note, 0.18, 'triangle', this.musicGain, 0.16);
      // Bass on every other step (octave below)
      if (i % 2 === 0) this.tone(note / 2, 0.22, 'sine', this.musicGain, 0.10);
      i++;
    };
    this.musicTimer = setInterval(tick, baseStepMs);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  setTempoMultiplier(mul) {
    this.tempoMul = mul;
  }

  // SFX
  sfx(kind, chainStep = 0) {
    this.ensure();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    switch (kind) {
      case 'pop': {
        const semis = Math.min(5, chainStep);
        const base = 660 * Math.pow(2, semis / 12);
        this.tone(base, 0.10, 'square', this.master, 0.12);
        this.tone(base * 1.5, 0.06, 'triangle', this.master, 0.08);
        break;
      }
      case 'tap': {
        this.tone(440, 0.06, 'square', this.master, 0.08);
        break;
      }
      case 'miss': {
        this.tone(220, 0.08, 'sawtooth', this.master, 0.06);
        break;
      }
      case 'boom': {
        // Noise burst for bomb
        this.noiseBurst(0.18, 0.20);
        this.tone(110, 0.18, 'sawtooth', this.master, 0.14);
        break;
      }
      case 'superClear': {
        // Ascending arpeggio
        [0, 4, 7, 12].forEach((semi, idx) => {
          setTimeout(() => this.tone(440 * Math.pow(2, semi / 12), 0.12, 'triangle', this.master, 0.12), idx * 60);
        });
        break;
      }
      case 'win': {
        [0, 4, 7, 12, 16].forEach((semi, idx) => {
          setTimeout(() => this.tone(523.25 * Math.pow(2, semi / 12), 0.20, 'triangle', this.master, 0.16), idx * 90);
        });
        break;
      }
      case 'lose': {
        [0, -3, -7].forEach((semi, idx) => {
          setTimeout(() => this.tone(330 * Math.pow(2, semi / 12), 0.30, 'sawtooth', this.master, 0.10), idx * 140);
        });
        break;
      }
    }
  }

  tone(freq, durSec, type, dest, peakGain = 0.15) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = 0;
    osc.connect(g);
    g.connect(dest || this.master);
    const now = this.ctx.currentTime;
    g.gain.linearRampToValueAtTime(peakGain, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + durSec);
    osc.start(now);
    osc.stop(now + durSec + 0.02);
  }

  noiseBurst(durSec, peakGain = 0.2) {
    if (!this.ctx) return;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * durSec, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = peakGain;
    src.connect(g);
    g.connect(this.master);
    src.start();
  }
}
