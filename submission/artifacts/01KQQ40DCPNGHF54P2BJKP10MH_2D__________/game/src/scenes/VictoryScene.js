import { TUNING } from '../config/tuning.js';
import { getAudio } from '../systems/AudioManager.js';
import { topScores } from '../systems/PersistenceManager.js';

export class VictoryScene extends Phaser.Scene {
  constructor() { super({ key: 'VictoryScene' }); }

  async create(data) {
    const palette = TUNING.palette;
    const W = TUNING.viewport.logical_width_px;
    const H = TUNING.viewport.logical_height_px;
    this.cameras.main.setBackgroundColor(palette.background);
    this.add.image(W / 2, H / 2, 'parallax-sky').setDisplaySize(W, H);

    this.add.text(W / 2, 50, 'VICTORY!', {
      fontFamily: 'system-ui', fontSize: '36px', fontStyle: 'bold',
      color: palette.text, stroke: '#FFFFFF', strokeThickness: 4
    }).setOrigin(0.5);

    this.add.text(W / 2, 90, 'Whispy Wood defeated.', {
      fontFamily: 'system-ui', fontSize: '14px', color: palette.text
    }).setOrigin(0.5);

    // kirby celebrating
    const kirby = this.add.sprite(W / 2, 130, 'kirby').setScale(2);
    this.tweens.add({ targets: kirby, y: 120, yoyo: true, repeat: -1, duration: 300 });

    this.add.text(W / 2, 170, `Score: ${data?.score ?? 0}`, {
      fontFamily: 'system-ui', fontSize: '18px', color: palette.text
    }).setOrigin(0.5);

    // top-10 leaderboard from local persistence
    let scores = [];
    try { scores = await topScores(5); } catch { scores = []; }
    const list = scores.slice(0, 5).map((r, i) => `${i + 1}. ${r.score}  (${(r.duration_ms / 1000).toFixed(1)}s)`);
    if (list.length) {
      this.add.text(W / 2, 200, 'BEST RUNS', {
        fontFamily: 'system-ui', fontSize: '12px', color: palette.text, fontStyle: 'bold'
      }).setOrigin(0.5);
      list.forEach((line, idx) => {
        this.add.text(W / 2, 218 + idx * 14, line, {
          fontFamily: 'system-ui', fontSize: '11px', color: palette.text
        }).setOrigin(0.5);
      });
    }

    const btn = this.add.rectangle(W / 2, H - 30, 180, 32,
      Phaser.Display.Color.HexStringToColor(palette.primary).color)
      .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(palette.outline).color);
    this.add.text(W / 2, H - 30, 'PLAY AGAIN', {
      fontFamily: 'system-ui', fontSize: '14px', fontStyle: 'bold', color: palette.text
    }).setOrigin(0.5);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.scene.start('MenuScene'));

    this.input.keyboard.once('keydown-SPACE', () => this.scene.start('MenuScene'));
    this.input.keyboard.once('keydown-ENTER', () => this.scene.start('MenuScene'));

    getAudio().sfxVictory();
  }
}
