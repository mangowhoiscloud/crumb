import { TUNING } from '../config/tuning.js';
import { bestScore } from '../systems/PersistenceManager.js';
import { getAudio } from '../systems/AudioManager.js';

export class MenuScene extends Phaser.Scene {
  constructor() { super({ key: 'MenuScene' }); }

  async create() {
    const palette = TUNING.palette;
    const W = TUNING.viewport.logical_width_px;
    const H = TUNING.viewport.logical_height_px;

    this.cameras.main.setBackgroundColor(palette.background);
    this.add.image(W / 2, H / 2, 'parallax-sky').setDisplaySize(W, H);

    // title
    this.add.text(W / 2, H / 2 - 90, 'KIRBY SIDESCROLL', {
      fontFamily: 'system-ui',
      fontSize: '28px',
      fontStyle: 'bold',
      color: palette.text,
      stroke: '#FFFFFF',
      strokeThickness: 4
    }).setOrigin(0.5);
    this.add.text(W / 2, H / 2 - 60, 'v1', {
      fontFamily: 'system-ui',
      fontSize: '14px',
      color: palette.text
    }).setOrigin(0.5);

    // kirby preview
    const kirby = this.add.sprite(W / 2, H / 2 - 16, 'kirby').setScale(2.5);
    this.tweens.add({ targets: kirby, y: H / 2 - 24, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.easeInOut' });

    // best score readout
    let best = 0;
    try { best = await bestScore(); } catch { best = 0; }
    this.add.text(W / 2, H / 2 + 40, `Best: ${best}`, {
      fontFamily: 'system-ui',
      fontSize: '16px',
      color: palette.text
    }).setOrigin(0.5);

    // start button
    const btn = this.add.rectangle(W / 2, H / 2 + 80, 200, 44, Phaser.Display.Color.HexStringToColor(palette.primary).color)
      .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(palette.outline).color);
    this.add.text(W / 2, H / 2 + 80, 'START', {
      fontFamily: 'system-ui',
      fontSize: '20px',
      fontStyle: 'bold',
      color: palette.text
    }).setOrigin(0.5);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this._start());

    this.add.text(W / 2, H - 40, 'Move: ←→ / WASD   Jump: Space/W (5-jump float)', {
      fontFamily: 'system-ui', fontSize: '11px', color: palette.text
    }).setOrigin(0.5);
    this.add.text(W / 2, H - 24, 'Inhale: Z   Action: X (tap=spit, hold=swallow, long-hold=discard)', {
      fontFamily: 'system-ui', fontSize: '11px', color: palette.text
    }).setOrigin(0.5);

    this.input.keyboard.once('keydown-ENTER', () => this._start());
    this.input.keyboard.once('keydown-SPACE', () => this._start());

    // Unlock audio on first interaction.
    const unlockOnce = () => { getAudio().unlock(); };
    this.input.once('pointerdown', unlockOnce);
    this.input.keyboard.once('keydown', unlockOnce);
  }

  _start() {
    this.scene.start('GameScene');
  }
}
