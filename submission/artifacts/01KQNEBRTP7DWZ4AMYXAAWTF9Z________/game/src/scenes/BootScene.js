// BootScene: load tuning.json + generate procedural sprite textures
// (Reba / slime / bat / ghost / particle) via Canvas API, then auto-start
// GameScene. No blocking menu — spec.md AC1 requires `scene === 'GameScene'`
// shortly after load.

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    this.load.json('tuning', 'src/config/tuning.json');
  }

  create() {
    const tuning = this.cache.json.get('tuning');
    this.registry.set('tuning', tuning);

    this.generateRebaTexture(tuning.colors.reba);
    this.generateSlimeTexture(tuning.colors.slime);
    this.generateBatTexture(tuning.colors.bat);
    this.generateGhostTexture(tuning.colors.ghost);
    this.generateParticleTexture(tuning.colors.text);
    this.generateRetryButtonTexture(tuning.colors.reba);

    if (window.__GAME__) window.__GAME__.scene = 'BootScene';

    // Hand off to GameScene on the next frame so the texture cache is settled.
    this.time.delayedCall(10, () => this.scene.start('GameScene'));
  }

  generateRebaTexture(rebaHex) {
    const size = 56;
    const canvas = this.textures.createCanvas('reba', size, size).getCanvas();
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    // Body (rounded rectangle, warm yellow)
    ctx.fillStyle = rebaHex;
    this._roundedRect(ctx, 12, 26, 32, 26, 6);
    ctx.fill();

    // Head (circle)
    ctx.beginPath();
    ctx.arc(28, 20, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#fde68a';
    ctx.fill();

    // Goggles strap
    ctx.fillStyle = '#1f2937';
    this._roundedRect(ctx, 12, 16, 32, 8, 2);
    ctx.fill();

    // Goggles lenses
    ctx.fillStyle = '#0ea5e9';
    ctx.beginPath();
    ctx.arc(22, 20, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(34, 20, 4, 0, Math.PI * 2);
    ctx.fill();

    // Glints
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(20.5, 18.5, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(32.5, 18.5, 1.2, 0, Math.PI * 2); ctx.fill();

    // Boots
    ctx.fillStyle = '#5b21b6';
    ctx.fillRect(14, 48, 10, 6);
    ctx.fillRect(32, 48, 10, 6);

    this.textures.get('reba').refresh();
  }

  generateSlimeTexture(slimeHex) {
    const size = 48;
    const canvas = this.textures.createCanvas('slime', size, size).getCanvas();
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    // Body (round blob)
    ctx.fillStyle = slimeHex;
    ctx.beginPath();
    ctx.ellipse(24, 26, 18, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(18, 20, 6, 4, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#1f2937';
    ctx.beginPath(); ctx.arc(19, 26, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(29, 26, 2.4, 0, Math.PI * 2); ctx.fill();

    // Mouth
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(24, 32, 4, 0, Math.PI);
    ctx.stroke();

    this.textures.get('slime').refresh();
  }

  generateBatTexture(batHex) {
    const size = 48;
    const canvas = this.textures.createCanvas('bat', size, size).getCanvas();
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    // Wings (triangles)
    ctx.fillStyle = batHex;
    ctx.beginPath();
    ctx.moveTo(4, 24);
    ctx.lineTo(20, 14);
    ctx.lineTo(20, 32);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(44, 24);
    ctx.lineTo(28, 14);
    ctx.lineTo(28, 32);
    ctx.closePath();
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.ellipse(24, 24, 7, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#fde047';
    ctx.beginPath(); ctx.arc(21, 22, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(27, 22, 1.6, 0, Math.PI * 2); ctx.fill();

    // Fangs
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(22, 28); ctx.lineTo(23, 32); ctx.lineTo(24, 28); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(25, 28); ctx.lineTo(26, 32); ctx.lineTo(27, 28); ctx.closePath(); ctx.fill();

    this.textures.get('bat').refresh();
  }

  generateGhostTexture(ghostHex) {
    const size = 48;
    const canvas = this.textures.createCanvas('ghost', size, size).getCanvas();
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    // Body (teardrop)
    ctx.fillStyle = ghostHex;
    ctx.beginPath();
    ctx.arc(24, 22, 14, Math.PI, 0);
    ctx.lineTo(38, 38);
    ctx.lineTo(33, 34);
    ctx.lineTo(28, 38);
    ctx.lineTo(24, 34);
    ctx.lineTo(20, 38);
    ctx.lineTo(15, 34);
    ctx.lineTo(10, 38);
    ctx.closePath();
    ctx.fill();

    // Hollow eyes
    ctx.fillStyle = '#1a0f2e';
    ctx.beginPath(); ctx.arc(19, 22, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(29, 22, 3, 0, Math.PI * 2); ctx.fill();

    this.textures.get('ghost').refresh();
  }

  generateParticleTexture(textHex) {
    const size = 8;
    const canvas = this.textures.createCanvas('particle', size, size).getCanvas();
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = textHex;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.fill();
    this.textures.get('particle').refresh();
  }

  generateRetryButtonTexture(rebaHex) {
    const w = 88;
    const h = 56;
    const canvas = this.textures.createCanvas('retry-bg', w, h).getCanvas();
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = rebaHex;
    this._roundedRect(ctx, 0, 0, w, h, 12);
    ctx.fill();
    this.textures.get('retry-bg').refresh();
  }

  _roundedRect(ctx, x, y, w, h, r) {
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
}
