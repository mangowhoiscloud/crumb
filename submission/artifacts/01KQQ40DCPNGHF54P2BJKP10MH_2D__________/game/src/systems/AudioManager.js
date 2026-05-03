// Procedural Web Audio — 1 BGM lead+bass + 4 SFX (jump / inhale / hit / victory).
// Zero asset bytes. Lookahead clock from AudioContext.currentTime (Chris Wilson pattern).
import { POOLS } from './JuiceManager.js';

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.bgmTimer = null;
    this.bgmStep = 0;
    this.unlocked = false;
    this.activeVoices = 0;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) return this.ctx;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);
    } catch { this.ctx = null; }
    return this.ctx;
  }

  unlock() {
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    this.unlocked = true;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain) this.masterGain.gain.value = this.muted ? 0 : 0.5;
  }

  _voice() {
    if (this.activeVoices >= POOLS.AUDIO_VOICE) return false;
    this.activeVoices += 1;
    return true;
  }

  _release() { this.activeVoices = Math.max(0, this.activeVoices - 1); }

  _playOsc({ type = 'square', freq = 440, dur = 0.1, vol = 0.2, pitchTo = null }) {
    const ctx = this.ensure(); if (!ctx) return;
    if (!this._voice()) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    if (pitchTo) osc.frequency.linearRampToValueAtTime(pitchTo, ctx.currentTime + dur);
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.005);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
    osc.connect(g); g.connect(this.masterGain);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
    osc.onended = () => { this._release(); osc.disconnect(); g.disconnect(); };
  }

  _playNoise({ dur = 0.12, vol = 0.25 }) {
    const ctx = this.ensure(); if (!ctx) return;
    if (!this._voice()) return;
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = buf;
    g.gain.value = vol;
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
    src.connect(g); g.connect(this.masterGain);
    src.start();
    src.onended = () => { this._release(); src.disconnect(); g.disconnect(); };
  }

  sfxJump()    { this._playOsc({ type: 'square',   freq: 480, pitchTo: 880, dur: 0.08, vol: 0.18 }); }
  sfxFloat()   { this._playOsc({ type: 'triangle', freq: 360, pitchTo: 540, dur: 0.10, vol: 0.14 }); }
  sfxInhale()  { this._playOsc({ type: 'sawtooth', freq: 600, pitchTo: 200, dur: 0.25, vol: 0.18 }); }
  sfxSwallow() { this._playOsc({ type: 'sine',     freq: 220, pitchTo: 110, dur: 0.18, vol: 0.20 }); }
  sfxSpit()    { this._playOsc({ type: 'square',   freq: 720, pitchTo: 540, dur: 0.10, vol: 0.18 }); }
  sfxHit()     { this._playNoise({ dur: 0.12, vol: 0.22 }); }
  sfxAbility() { this._playOsc({ type: 'square',   freq: 660, pitchTo: 990, dur: 0.20, vol: 0.20 }); }
  sfxVictory() {
    const notes = [261.63, 329.63, 392.00, 523.25]; // C-E-G-C
    notes.forEach((f, i) => {
      const ctx = this.ensure(); if (!ctx) return;
      setTimeout(() => this._playOsc({ type: 'square', freq: f, dur: 0.30, vol: 0.22 }), i * 300);
    });
  }
  sfxGameOver() { this._playOsc({ type: 'sawtooth', freq: 220, pitchTo: 80, dur: 0.6, vol: 0.22 }); }

  startBGM() {
    const ctx = this.ensure(); if (!ctx) return;
    if (this.bgmTimer) return;
    // C-major arpeggio loop @ 120 bpm, eighth-notes => 250 ms each
    const arp  = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63];
    const bass = [130.81, 196.00];
    const stepMs = 250;
    this.bgmStep = 0;
    this.bgmTimer = setInterval(() => {
      const c = this.ensure(); if (!c) return;
      const lead = arp[this.bgmStep % arp.length];
      const low  = bass[Math.floor(this.bgmStep / 2) % bass.length];
      this._playOsc({ type: 'square',   freq: lead, dur: 0.20, vol: 0.10 });
      if (this.bgmStep % 2 === 0) {
        this._playOsc({ type: 'triangle', freq: low,  dur: 0.40, vol: 0.10 });
      }
      this.bgmStep += 1;
    }, stepMs);
  }

  stopBGM() {
    if (this.bgmTimer) { clearInterval(this.bgmTimer); this.bgmTimer = null; }
  }
}

let _shared = null;
export function getAudio() {
  if (!_shared) _shared = new AudioManager();
  return _shared;
}
