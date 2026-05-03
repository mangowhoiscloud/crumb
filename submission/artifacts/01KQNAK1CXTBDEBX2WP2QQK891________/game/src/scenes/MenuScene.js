import { DESIGN } from '../config/gameConfig.js';

export class MenuScene extends Phaser.Scene {
  constructor() { super({ key: 'MenuScene' }); }

  create() {
    const t = this.registry.get('tuning');
    const P = t.palette;
    const W = DESIGN.W, H = DESIGN.H;

    this.cameras.main.setBackgroundColor(P.background);

    // Vignette frame
    const frame = this.add.graphics();
    frame.lineStyle(2, 0x1A0F08, 1);
    frame.strokeRect(8, 8, W - 16, H - 16);

    this.add.text(W / 2, 100, 'REBA', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '64px',
      fontStyle: 'bold',
      color: P.primary,
      stroke: P.secondary, strokeThickness: 6
    }).setOrigin(0.5);

    this.add.text(W / 2, 160, 'BERSERKER', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '32px',
      fontStyle: 'bold',
      color: P.accent,
      stroke: P.secondary, strokeThickness: 4
    }).setOrigin(0.5);

    this.add.text(W / 2, 220, '레바의 모험 — 버서커 모드', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: P.text,
      alpha: 0.85
    }).setOrigin(0.5);

    // Best score
    const best = parseInt(localStorage.getItem('reba.best') || '0', 10);
    this.add.text(W / 2, 260, 'BEST  ' + best, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: P.primary
    }).setOrigin(0.5);

    // Start button (≥ 44×44)
    const btnW = 200, btnH = 60;
    const btnX = W / 2, btnY = H / 2 + 80;
    const btn = this.add.rectangle(btnX, btnY, btnW, btnH, 0xD62828)
      .setStrokeStyle(3, 0x1A0F08)
      .setInteractive({ useHandCursor: true });
    const btnLabel = this.add.text(btnX, btnY, 'START', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
      color: P.primary,
      stroke: P.secondary, strokeThickness: 3
    }).setOrigin(0.5);

    btn.on('pointerover', () => btn.setFillStyle(0xE73838));
    btn.on('pointerout', () => btn.setFillStyle(0xD62828));
    btn.on('pointerdown', () => {
      btn.setFillStyle(0xB01818);
      this.time.delayedCall(80, () => this.scene.start('GameScene'));
    });

    // How-to
    const help = [
      'TAP  =  슬래시 (가까운 적)',
      'SWIPE  =  대시 (200ms 무적)',
      '10킬  =  버서커! (8s · ×3 점수)',
      '60초 안에 50점이면 WIN.'
    ];
    this.add.text(W / 2, H - 100, help.join('\n'), {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: P.text,
      align: 'center',
      lineSpacing: 6
    }).setOrigin(0.5);

    // Aria mirror
    const mirror = document.getElementById('aria-mirror');
    if (mirror) mirror.textContent = 'Reba Berserker title screen. Best score ' + best + '. Tap START to play.';
  }
}
