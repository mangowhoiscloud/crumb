// BootScene — procedurally renders all sprite textures via Canvas API and
// registers them as Phaser textures (`this.textures.addCanvas(name, canvas)`).
// Zero binary asset files emitted by the build (procedural-first envelope).
import { TUNING } from '../config/tuning.js';

export class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  preload() { /* no asset files */ }

  create() {
    const palette = TUNING.palette;
    this._mkKirby(palette);
    this._mkEnemies(palette);
    this._mkBoss(palette);
    this._mkProjectiles(palette);
    this._mkAbilityFx(palette);
    this._mkParallax(palette);
    this._mkGround(palette);
    this._mkParticle(palette);

    // Hand off to MenuScene.
    this.scene.start('MenuScene');
  }

  _addCanvas(name, w, h, draw) {
    if (this.textures.exists(name)) return;
    const tex = this.textures.createCanvas(name, w, h);
    draw(tex.getContext(), w, h);
    tex.refresh();
  }

  _mkKirby(palette) {
    this._addCanvas('kirby', 24, 24, (ctx) => {
      ctx.fillStyle = palette.primary;
      ctx.beginPath(); ctx.arc(12, 12, 10, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = palette.outline; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(12, 12, 10, 0, Math.PI * 2); ctx.stroke();
      // eyes
      ctx.fillStyle = palette.outline;
      ctx.fillRect(8, 9, 2, 4);
      ctx.fillRect(14, 9, 2, 4);
      // cheeks
      ctx.fillStyle = palette.accent;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(6, 14, 2, 1);
      ctx.fillRect(16, 14, 2, 1);
      ctx.globalAlpha = 1;
      // mouth
      ctx.strokeStyle = palette.outline;
      ctx.beginPath(); ctx.moveTo(10, 16); ctx.quadraticCurveTo(12, 18, 14, 16); ctx.stroke();
      // feet
      ctx.fillStyle = palette.accent;
      ctx.fillRect(7, 21, 4, 2);
      ctx.fillRect(13, 21, 4, 2);
    });
  }

  _mkEnemies(palette) {
    // Waddler — round tan body
    this._addCanvas('enemy-waddler', 24, 24, (ctx) => {
      ctx.fillStyle = palette.enemy_tan;
      ctx.beginPath(); ctx.arc(12, 14, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = palette.outline; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(12, 14, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = palette.outline;
      ctx.fillRect(8, 11, 2, 3);
      ctx.fillRect(14, 11, 2, 3);
      ctx.beginPath(); ctx.moveTo(10, 17); ctx.quadraticCurveTo(12, 19, 14, 17); ctx.stroke();
    });
    // Flier — winged tan
    this._addCanvas('enemy-flier', 24, 24, (ctx) => {
      ctx.fillStyle = palette.enemy_tan;
      ctx.beginPath(); ctx.arc(12, 12, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = palette.outline; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(12, 12, 7, 0, Math.PI * 2); ctx.stroke();
      // wings
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.moveTo(5, 12); ctx.lineTo(0, 8); ctx.lineTo(2, 14); ctx.fill();
      ctx.beginPath(); ctx.moveTo(19, 12); ctx.lineTo(24, 8); ctx.lineTo(22, 14); ctx.fill();
      ctx.fillStyle = palette.outline;
      ctx.fillRect(9, 10, 2, 3);
      ctx.fillRect(13, 10, 2, 3);
    });
    // Spikee — black ball with spikes (Gordo-style)
    this._addCanvas('enemy-spikee', 24, 24, (ctx) => {
      ctx.fillStyle = palette.outline;
      ctx.beginPath(); ctx.arc(12, 12, 8, 0, Math.PI * 2); ctx.fill();
      // spikes
      const N = 8;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        const x1 = 12 + Math.cos(a) * 8;
        const y1 = 12 + Math.sin(a) * 8;
        const x2 = 12 + Math.cos(a) * 12;
        const y2 = 12 + Math.sin(a) * 12;
        ctx.strokeStyle = palette.outline; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      ctx.fillStyle = palette.accent;
      ctx.fillRect(9, 10, 2, 2);
      ctx.fillRect(13, 10, 2, 2);
    });
    // Burner — fire-headed
    this._addCanvas('enemy-burner', 24, 24, (ctx) => {
      ctx.fillStyle = palette.accent;
      ctx.beginPath(); ctx.arc(12, 12, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFCC55';
      ctx.beginPath(); ctx.moveTo(12, 4); ctx.lineTo(8, 12); ctx.lineTo(16, 12); ctx.fill();
      ctx.strokeStyle = palette.outline; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(12, 12, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = palette.outline;
      ctx.fillRect(9, 12, 2, 3);
      ctx.fillRect(13, 12, 2, 3);
    });
    // Slasher — sword-bearing knight
    this._addCanvas('enemy-slasher', 24, 24, (ctx) => {
      ctx.fillStyle = palette.enemy_tan;
      ctx.beginPath(); ctx.arc(12, 14, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = palette.outline; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(12, 14, 7, 0, Math.PI * 2); ctx.stroke();
      // helmet
      ctx.fillStyle = '#9CB6D6';
      ctx.fillRect(7, 6, 10, 6);
      ctx.strokeRect(7, 6, 10, 6);
      // sword
      ctx.fillStyle = '#DDDDDD';
      ctx.fillRect(20, 12, 4, 1);
      ctx.fillRect(22, 11, 1, 3);
      ctx.fillStyle = palette.outline;
      ctx.fillRect(9, 9, 2, 2);
      ctx.fillRect(13, 9, 2, 2);
    });
  }

  _mkBoss(palette) {
    this._addCanvas('whispy', 64, 96, (ctx) => {
      // trunk
      ctx.fillStyle = '#8B6B47';
      ctx.fillRect(20, 24, 24, 72);
      ctx.strokeStyle = palette.outline; ctx.lineWidth = 1;
      ctx.strokeRect(20, 24, 24, 72);
      // foliage
      ctx.fillStyle = palette.secondary;
      ctx.beginPath(); ctx.arc(32, 24, 26, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = palette.outline;
      ctx.beginPath(); ctx.arc(32, 24, 26, 0, Math.PI * 2); ctx.stroke();
      // eyes (sleeping but waking)
      ctx.fillStyle = palette.outline;
      ctx.fillRect(24, 50, 4, 4);
      ctx.fillRect(36, 50, 4, 4);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(25, 51, 2, 2);
      ctx.fillRect(37, 51, 2, 2);
      // grin
      ctx.strokeStyle = palette.outline; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(26, 64); ctx.quadraticCurveTo(32, 70, 38, 64); ctx.stroke();
    });
  }

  _mkProjectiles(palette) {
    this._addCanvas('spit-star', 14, 14, (ctx) => {
      ctx.fillStyle = '#FFEE88';
      ctx.beginPath();
      const cx = 7, cy = 7, r1 = 6, r2 = 3;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? r1 : r2;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = palette.outline; ctx.lineWidth = 1; ctx.stroke();
    });
    this._addCanvas('apple', 16, 16, (ctx) => {
      ctx.fillStyle = palette.accent;
      ctx.beginPath(); ctx.arc(8, 9, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = palette.outline;
      ctx.beginPath(); ctx.arc(8, 9, 6, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#5A8A3F';
      ctx.fillRect(8, 2, 2, 3);
    });
  }

  _mkAbilityFx(palette) {
    this._addCanvas('fx-sword', 28, 18, (ctx) => {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.moveTo(0, 9); ctx.lineTo(28, 4); ctx.lineTo(28, 14); ctx.fill();
      ctx.strokeStyle = palette.outline; ctx.stroke();
    });
    this._addCanvas('fx-fire', 64, 12, (ctx) => {
      const grd = ctx.createLinearGradient(0, 0, 64, 0);
      grd.addColorStop(0, '#FFCC55');
      grd.addColorStop(1, palette.accent);
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(64, 0); ctx.lineTo(64, 12); ctx.fill();
    });
    this._addCanvas('fx-spark', 64, 64, (ctx) => {
      ctx.strokeStyle = '#FFEE55'; ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(32, 32);
        ctx.lineTo(32 + Math.cos(a) * 28, 32 + Math.sin(a) * 28);
        ctx.stroke();
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(32, 32, 4, 0, Math.PI * 2); ctx.fill();
    });
  }

  _mkParallax(palette) {
    // sky-gradient — full-canvas vertical gradient
    const W = TUNING.viewport.logical_width_px;
    const H = TUNING.viewport.logical_height_px;
    this._addCanvas('parallax-sky', W, H, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#C8E8FF');
      g.addColorStop(1, palette.background);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    });
    // cloud-puffs — repeating tile
    this._addCanvas('parallax-clouds', 256, 96, (ctx) => {
      ctx.fillStyle = '#FFFFFF';
      for (let i = 0; i < 5; i++) {
        const cx = (i * 53 + 30) % 256;
        const cy = (i * 31 + 20) % 96;
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.arc(cx + 12, cy + 4, 10, 0, Math.PI * 2);
        ctx.arc(cx - 12, cy + 4, 10, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    // mid-trees-hills
    this._addCanvas('parallax-mid', 320, 160, (ctx) => {
      ctx.fillStyle = palette.secondary;
      ctx.beginPath();
      ctx.moveTo(0, 160);
      for (let x = 0; x <= 320; x += 16) {
        const y = 100 + Math.sin(x / 40) * 20;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(320, 160); ctx.fill();
      // little trees
      ctx.fillStyle = '#7DB890';
      for (let i = 0; i < 6; i++) {
        const x = 30 + i * 56;
        const y = 100 + Math.sin(x / 40) * 20 - 8;
        ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
      }
    });
    // fg-grass-tufts
    this._addCanvas('parallax-fg', 256, 32, (ctx) => {
      ctx.fillStyle = '#7DB890';
      for (let i = 0; i < 16; i++) {
        const x = i * 16 + 6;
        ctx.beginPath();
        ctx.moveTo(x, 32);
        ctx.lineTo(x - 4, 22);
        ctx.lineTo(x + 4, 22);
        ctx.fill();
      }
    });
  }

  _mkGround(palette) {
    this._addCanvas('ground-tile', 32, 32, (ctx) => {
      ctx.fillStyle = '#A56A40';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#7DB890';
      ctx.fillRect(0, 0, 32, 6);
      ctx.strokeStyle = palette.outline; ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, 32, 32);
    });
  }

  _mkParticle(palette) {
    this._addCanvas('particle', 6, 6, (ctx) => {
      ctx.fillStyle = palette.primary;
      ctx.beginPath(); ctx.arc(3, 3, 3, 0, Math.PI * 2); ctx.fill();
    });
  }
}
