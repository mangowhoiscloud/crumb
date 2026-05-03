// BootScene.js — procedurally generates cat tile sprites via Canvas API
// (OpusGameLabs/game-creator pattern), so no binary asset emit is required.
// Each face_shape (tuning.json::palette.tiles.<type>.face_shape) maps to a
// distinct silhouette that survives color-blind simulation (DESIGN.md §5).

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    const tuning = window.__TUNING__;
    const palette = tuning.palette;
    const tileSize = tuning.tile_size_px;

    // Generate one canvas texture per tile type.
    for (const type of tuning.tile_types) {
      const def = palette.tiles[type];
      const canvas = this.makeTileCanvas(tileSize, def);
      this.textures.addCanvas(`tile-${type}`, canvas);
    }

    // Special textures
    this.textures.addCanvas('tile-bomb_paw', this.makeBombCanvas(tileSize));
    this.textures.addCanvas('tile-locked_box', this.makeLockedCanvas(tileSize));

    // Particle texture (warm glow)
    this.textures.addCanvas('particle-glow', this.makeParticleCanvas(palette.particle_glow));
  }

  create() {
    // Hide splash early (main.js also has a fallback timer).
    const splash = document.getElementById('loading');
    if (splash) splash.classList.add('hidden');
    this.scene.start('MenuScene');
  }

  // ------- canvas painters -------

  makeTileCanvas(size, def) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');

    // Rounded square base
    const r = size * 0.18;
    this.roundedRect(ctx, 1, 1, size - 2, size - 2, r);
    ctx.fillStyle = def.fill;
    ctx.fill();
    ctx.strokeStyle = def.outline;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Face shape silhouette — colorblind redundancy
    this.drawFaceShape(ctx, size, def);

    // Eyes
    const eyeY = size * 0.46;
    const eyeOff = size * 0.18;
    ctx.fillStyle = def.outline;
    this.dot(ctx, size / 2 - eyeOff, eyeY, size * 0.05);
    this.dot(ctx, size / 2 + eyeOff, eyeY, size * 0.05);

    // Nose
    ctx.fillStyle = def.accent;
    this.dot(ctx, size / 2, size * 0.58, size * 0.045);

    // Mouth (small W)
    ctx.strokeStyle = def.outline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(size * 0.42, size * 0.66);
    ctx.quadraticCurveTo(size * 0.5, size * 0.74, size * 0.58, size * 0.66);
    ctx.stroke();

    return c;
  }

  drawFaceShape(ctx, size, def) {
    const cx = size / 2;
    const cy = size * 0.48;
    const headR = size * 0.34;

    ctx.save();
    ctx.fillStyle = def.fill;
    ctx.strokeStyle = def.outline;
    ctx.lineWidth = 2;

    switch (def.face_shape) {
      case 'round': {
        ctx.beginPath();
        ctx.arc(cx, cy, headR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Small round ears
        this.ear(ctx, cx - headR * 0.7, cy - headR * 0.6, size * 0.10, size * 0.10, def);
        this.ear(ctx, cx + headR * 0.7, cy - headR * 0.6, size * 0.10, size * 0.10, def);
        break;
      }
      case 'triangle_ears_tall': {
        ctx.beginPath();
        ctx.arc(cx, cy, headR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Tall pointy ears
        this.triEar(ctx, cx - headR * 0.6, cy - headR * 0.4, size * 0.12, size * 0.22, -0.2, def);
        this.triEar(ctx, cx + headR * 0.6, cy - headR * 0.4, size * 0.12, size * 0.22, 0.2, def);
        break;
      }
      case 'long_striped': {
        // Slightly elongated head + 3 stripes
        ctx.save();
        ctx.scale(1, 1.1);
        ctx.beginPath();
        ctx.arc(cx, cy / 1.1, headR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        this.triEar(ctx, cx - headR * 0.55, cy - headR * 0.5, size * 0.10, size * 0.18, -0.1, def);
        this.triEar(ctx, cx + headR * 0.55, cy - headR * 0.5, size * 0.10, size * 0.18, 0.1, def);
        // Stripes
        ctx.strokeStyle = def.accent;
        ctx.lineWidth = 2;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(cx - headR * 0.4, cy + i * size * 0.06);
          ctx.lineTo(cx + headR * 0.4, cy + i * size * 0.06);
          ctx.stroke();
        }
        break;
      }
      case 'flat_persian': {
        // Wide, flat head
        ctx.save();
        ctx.scale(1.15, 0.92);
        ctx.beginPath();
        ctx.arc(cx / 1.15, cy / 0.92, headR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        // Tiny tufted ears
        this.ear(ctx, cx - headR * 0.85, cy - headR * 0.4, size * 0.08, size * 0.08, def);
        this.ear(ctx, cx + headR * 0.85, cy - headR * 0.4, size * 0.08, size * 0.08, def);
        break;
      }
      case 'tufted': {
        ctx.beginPath();
        ctx.arc(cx, cy, headR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Pointy + tufted (split) ears
        this.triEar(ctx, cx - headR * 0.6, cy - headR * 0.5, size * 0.13, size * 0.20, -0.25, def);
        this.triEar(ctx, cx + headR * 0.6, cy - headR * 0.5, size * 0.13, size * 0.20, 0.25, def);
        // Calico patches
        ctx.fillStyle = def.accent;
        this.dot(ctx, cx - headR * 0.4, cy + headR * 0.25, size * 0.10);
        ctx.fillStyle = '#3D1F08';
        this.dot(ctx, cx + headR * 0.35, cy - headR * 0.05, size * 0.07);
        break;
      }
    }
    ctx.restore();
  }

  ear(ctx, x, y, w, h, def) {
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx.fillStyle = def.fill;
    ctx.fill();
    ctx.strokeStyle = def.outline;
    ctx.stroke();
  }

  triEar(ctx, x, y, w, h, skew, def) {
    ctx.beginPath();
    ctx.moveTo(x - w + skew * 4, y + h);
    ctx.lineTo(x + skew * 8, y - h);
    ctx.lineTo(x + w + skew * 4, y + h);
    ctx.closePath();
    ctx.fillStyle = def.fill;
    ctx.fill();
    ctx.strokeStyle = def.outline;
    ctx.stroke();
  }

  dot(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  makeBombCanvas(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    // Glowing paw — gold gradient
    const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.5);
    g.addColorStop(0, '#FFF1A8');
    g.addColorStop(0.5, '#FFB627');
    g.addColorStop(1, '#7A4D00');
    this.roundedRect(ctx, 1, 1, size - 2, size - 2, size * 0.18);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#7A4D00';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Paw — 4 toe beans + main pad
    ctx.fillStyle = '#2D2D2D';
    const cx = size / 2, cy = size * 0.58;
    this.dot(ctx, cx, cy, size * 0.16); // pad
    this.dot(ctx, cx - size * 0.20, cy - size * 0.18, size * 0.07);
    this.dot(ctx, cx - size * 0.07, cy - size * 0.26, size * 0.07);
    this.dot(ctx, cx + size * 0.07, cy - size * 0.26, size * 0.07);
    this.dot(ctx, cx + size * 0.20, cy - size * 0.18, size * 0.07);
    return c;
  }

  makeLockedCanvas(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    this.roundedRect(ctx, 1, 1, size - 2, size - 2, size * 0.18);
    ctx.fillStyle = '#6B5D45';
    ctx.fill();
    ctx.strokeStyle = '#3D2F1A';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Lock body
    ctx.fillStyle = '#FFD66B';
    this.roundedRect(ctx, size * 0.28, size * 0.42, size * 0.44, size * 0.36, size * 0.06);
    ctx.fill();
    // Shackle
    ctx.strokeStyle = '#FFD66B';
    ctx.lineWidth = size * 0.06;
    ctx.beginPath();
    ctx.arc(size / 2, size * 0.42, size * 0.14, Math.PI, 0);
    ctx.stroke();
    return c;
  }

  makeParticleCanvas(color) {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 16);
    g.addColorStop(0, color);
    g.addColorStop(0.6, color + '80');
    g.addColorStop(1, color + '00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }
}
