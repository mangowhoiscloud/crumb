// GameOverScene.js — currently the modal lives in DOM (#modal-overlay) for
// AC6 testability, so this scene is a thin Phaser placeholder that simply
// transitions back to MenuScene if invoked. Kept registered so the multi-file
// envelope (spec.md §4) tree is exactly satisfied.

export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }

  create(data = {}) {
    // The DOM modal is the source of truth for AC6; if this scene is ever
    // reached directly (e.g. URL deep-link), bounce back to the menu.
    this.scene.start('MenuScene');
  }
}
