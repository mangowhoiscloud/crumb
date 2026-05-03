import { TUNING } from '../config/tuning.js';
import { getAudio } from '../systems/AudioManager.js';

export class GameOverScene extends Phaser.Scene {
  constructor() { super({ key: 'GameOverScene' }); }

  create(data) {
    const palette = TUNING.palette;
    const W = TUNING.viewport.logical_width_px;
    const H = TUNING.viewport.logical_height_px;
    this.cameras.main.setBackgroundColor('#3A2840');

    this.add.text(W / 2, H / 2 - 40, 'GAME OVER', {
      fontFamily: 'system-ui', fontSize: '32px', fontStyle: 'bold',
      color: palette.primary, stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5);

    this.add.text(W / 2, H / 2, `Score: ${data?.score ?? 0}`, {
      fontFamily: 'system-ui', fontSize: '16px', color: '#FFFFFF'
    }).setOrigin(0.5);

    const btn = this.add.rectangle(W / 2, H / 2 + 50, 180, 36,
      Phaser.Display.Color.HexStringToColor(palette.primary).color)
      .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(palette.outline).color);
    this.add.text(W / 2, H / 2 + 50, 'RETRY', {
      fontFamily: 'system-ui', fontSize: '18px', fontStyle: 'bold', color: palette.text
    }).setOrigin(0.5);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.scene.start('MenuScene'));

    this.input.keyboard.once('keydown-SPACE', () => this.scene.start('MenuScene'));
    this.input.keyboard.once('keydown-ENTER', () => this.scene.start('MenuScene'));

    getAudio().sfxGameOver();
  }
}
