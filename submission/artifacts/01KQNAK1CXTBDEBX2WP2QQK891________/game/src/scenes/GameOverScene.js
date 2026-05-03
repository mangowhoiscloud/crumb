import { DESIGN } from '../config/gameConfig.js';

export class GameOverScene extends Phaser.Scene {
  constructor() { super({ key: 'GameOverScene' }); }

  create(data) {
    const t = this.registry.get('tuning');
    const P = t.palette;
    const W = DESIGN.W, H = DESIGN.H;

    // dim overlay
    this.add.rectangle(W/2, H/2, W, H, 0x1A0F08, 0.78).setDepth(0);

    const headline = data.win ? 'YOU WIN' : (data.reason === 'loss-hp' ? 'KO' : 'TIME UP');
    const headlineColor = data.win ? P.primary : P.accent;

    this.add.text(W/2, H * 0.30, headline, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '54px',
      fontStyle: 'bold',
      color: headlineColor,
      stroke: P.secondary, strokeThickness: 6
    }).setOrigin(0.5).setAlpha(0).setScale(0.6).setDepth(10).setName('headline');

    const head = this.children.getByName('headline');
    this.tweens.add({
      targets: head, alpha: 1, scale: 1, duration: 360, ease: 'Back.Out'
    });

    this.add.text(W/2, H * 0.42, 'SCORE  ' + data.score, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '32px',
      fontStyle: 'bold',
      color: P.primary,
      stroke: P.secondary, strokeThickness: 4
    }).setOrigin(0.5).setDepth(10);

    this.add.text(W/2, H * 0.50, 'KILLS  ' + data.kills + '   ·   BEST  ' + data.best, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: P.text
    }).setOrigin(0.5).setDepth(10);

    // RESTART button (≥ 44×44, hit zone 200×60)
    const btn = this.add.rectangle(W/2, H * 0.70, 200, 60, 0xD62828)
      .setStrokeStyle(3, 0x1A0F08)
      .setInteractive({ useHandCursor: true })
      .setDepth(10);
    this.add.text(W/2, H * 0.70, 'RESTART', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
      color: P.primary,
      stroke: P.secondary, strokeThickness: 3
    }).setOrigin(0.5).setDepth(11);

    btn.on('pointerover', () => btn.setFillStyle(0xE73838));
    btn.on('pointerout', () => btn.setFillStyle(0xD62828));
    btn.on('pointerdown', () => {
      btn.setFillStyle(0xB01818);
      this.time.delayedCall(80, () => {
        this.scene.start('GameScene');
      });
    });

    // Menu link
    const menuBtn = this.add.text(W/2, H * 0.80, '↶ MENU', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: P.text
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(10);
    menuBtn.on('pointerdown', () => this.scene.start('MenuScene'));

    // aria
    const mirror = document.getElementById('aria-mirror');
    if (mirror) {
      mirror.textContent = (data.win ? 'You win.' : 'Game over.') +
        ' Score ' + data.score + '. Best ' + data.best + '. Tap RESTART to play again.';
    }

    // expose end state for AC predicates
    window.__GAME_END__ = { ...data, has_restart: true };
  }
}
