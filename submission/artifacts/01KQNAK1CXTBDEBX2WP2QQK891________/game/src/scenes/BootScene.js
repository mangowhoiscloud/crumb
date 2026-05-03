export class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  preload() {
    this.load.json('tuning', './src/config/tuning.json');
  }

  create() {
    const tuning = this.cache.json.get('tuning');
    this.registry.set('tuning', tuning);

    const PALETTE = tuning.palette;
    this._makePlayerTexture(PALETTE);
    this._makeEnemyTexture(PALETTE);
    this._makeSlashTexture(PALETTE);
    this._makeHeartTexture(PALETTE);
    this._makePixelTexture(PALETTE);

    this.scene.start('MenuScene');
  }

  _makePlayerTexture(P) {
    const W = 36, H = 44;
    const tex = this.textures.createCanvas('player', W, H);
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, W, H);
    // body cape
    ctx.fillStyle = P.accent;
    ctx.fillRect(8, 18, 20, 22);
    // head
    ctx.fillStyle = P.primary;
    ctx.beginPath();
    ctx.arc(W/2, 14, 8, 0, Math.PI * 2);
    ctx.fill();
    // body fill
    ctx.fillStyle = P.primary;
    ctx.fillRect(11, 20, 14, 18);
    // outline
    ctx.strokeStyle = P.secondary;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(11, 20, 14, 18);
    ctx.beginPath();
    ctx.arc(W/2, 14, 8, 0, Math.PI * 2);
    ctx.stroke();
    // sword (vertical)
    ctx.fillStyle = P.primary;
    ctx.fillRect(W/2 - 1.5, 4, 3, 12);
    ctx.strokeStyle = P.secondary;
    ctx.strokeRect(W/2 - 1.5, 4, 3, 12);
    // legs
    ctx.fillStyle = P.secondary;
    ctx.fillRect(13, 38, 4, 4);
    ctx.fillRect(19, 38, 4, 4);
    tex.refresh();
  }

  _makeEnemyTexture(P) {
    const W = 28, H = 28;
    const tex = this.textures.createCanvas('enemy', W, H);
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, W, H);
    // dark body
    ctx.fillStyle = '#5A3520';
    ctx.beginPath();
    ctx.arc(W/2, H/2, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = P.secondary;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // angry red eyes
    ctx.fillStyle = P.accent;
    ctx.beginPath(); ctx.arc(W/2 - 4, H/2 - 2, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(W/2 + 4, H/2 - 2, 2.5, 0, Math.PI * 2); ctx.fill();
    // teeth
    ctx.fillStyle = P.primary;
    ctx.fillRect(W/2 - 3, H/2 + 3, 2, 2);
    ctx.fillRect(W/2 + 1, H/2 + 3, 2, 2);
    tex.refresh();
  }

  _makeSlashTexture(P) {
    const W = 80, H = 80;
    const tex = this.textures.createCanvas('slash', W, H);
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, W, H);
    // crescent slash arc
    ctx.strokeStyle = P.primary;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(W/2, H/2, 28, -0.6, 0.6);
    ctx.stroke();
    ctx.strokeStyle = P.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W/2, H/2, 28, -0.6, 0.6);
    ctx.stroke();
    tex.refresh();
  }

  _makeHeartTexture(P) {
    const W = 18, H = 16;
    const tex = this.textures.createCanvas('heart', W, H);
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = P.accent;
    // two lobes + triangle
    ctx.beginPath();
    ctx.arc(5.5, 6, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.arc(12.5, 6, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(2, 7); ctx.lineTo(W/2, 14); ctx.lineTo(16, 7); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = P.secondary;
    ctx.lineWidth = 1;
    ctx.stroke();
    tex.refresh();
  }

  _makePixelTexture(P) {
    const tex = this.textures.createCanvas('pixel', 4, 4);
    const ctx = tex.getContext();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 4, 4);
    tex.refresh();
  }
}
