// MenuScene.js — title + start button + best score readout (localStorage).

const BEST_KEY = 'cat-tap-match3-v1.best';

export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    const { width, height } = this.scale;
    const tuning = window.__TUNING__;
    const palette = tuning.palette;

    this.cameras.main.setBackgroundColor(palette.bg_frame);

    // Title
    this.add.text(width / 2, height * 0.22, '고양이 퍼즐', {
      fontFamily: 'system-ui, "Apple SD Gothic Neo", sans-serif',
      fontSize: '36px', fontStyle: 'bold', color: palette.text_primary
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.30, 'Cat Match 3 — 60s round', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px', color: palette.text_secondary
    }).setOrigin(0.5);

    // Decorative tile cluster
    const decoTypes = ['white', 'black', 'yellow', 'gray', 'calico'];
    decoTypes.forEach((t, i) => {
      const tile = this.add.image(width / 2 + (i - 2) * 52, height * 0.45, `tile-${t}`);
      tile.setScale(1.0);
      this.tweens.add({
        targets: tile, y: tile.y - 6, duration: 900 + i * 80, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
    });

    // Best score
    const best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
    this.add.text(width / 2, height * 0.58, `Best: ${best.toLocaleString()}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px', color: palette.text_secondary
    }).setOrigin(0.5);

    // Start button (≥ 44×44 hit zone)
    const btnW = 200, btnH = 56;
    const btnBg = this.add.rectangle(width / 2, height * 0.74, btnW, btnH, 0xFFB627)
      .setStrokeStyle(2, 0x7A4D00)
      .setInteractive({ useHandCursor: true });
    btnBg.setOrigin(0.5);
    // Rounded look via graphics overlay
    const g = this.add.graphics();
    g.fillStyle(0xFFB627, 1).fillRoundedRect(width / 2 - btnW / 2, height * 0.74 - btnH / 2, btnW, btnH, 14);
    g.lineStyle(2, 0x7A4D00, 1).strokeRoundedRect(width / 2 - btnW / 2, height * 0.74 - btnH / 2, btnW, btnH, 14);
    btnBg.setAlpha(0.001); // keep hit area, hide stroke

    this.add.text(width / 2, height * 0.74, '시작하기', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px', fontStyle: 'bold', color: palette.text_primary
    }).setOrigin(0.5);

    btnBg.on('pointerup', () => this.startGame());

    // Tap-anywhere fallback (mobile-friendly)
    this.input.keyboard.on('keydown-ENTER', () => this.startGame());

    // Hint
    this.add.text(width / 2, height * 0.86, '같은 고양이 3개 이상 연결을 탭!', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px', color: palette.text_secondary
    }).setOrigin(0.5);

    // URL query: ?t=<n> overrides time_limit_s for testing AC6.
    const params = new URLSearchParams(window.location.search);
    const tParam = parseInt(params.get('t') || '', 10);
    if (!Number.isNaN(tParam) && tParam > 0) {
      window.__TIME_OVERRIDE__ = tParam;
    }

    // Auto-start if ?autostart=1
    if (params.get('autostart') === '1') {
      this.time.delayedCall(100, () => this.startGame());
    }
  }

  startGame() {
    this.scene.start('GameScene');
  }
}
