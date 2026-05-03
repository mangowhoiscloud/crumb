// Tile.js — single tile sprite with colorblind-redundant face_shape silhouette.
// Backed by the Canvas-rendered texture from BootScene. Wraps the sprite in a
// container so we can apply scale/alpha tweens without nuking the hit area.

export class Tile extends Phaser.GameObjects.Container {
  constructor(scene, x, y, type, special = null) {
    super(scene, x, y);
    this.scene = scene;
    this.type = type;
    this.special = special;
    this.row = -1;
    this.col = -1;

    this.repaint();
    this.setSize(scene.tuning.tile_size_px, scene.tuning.tile_size_px);
    // Hit zone = full tile size, comfortably above the 44 CSS px floor.
    this.setInteractive(
      new Phaser.Geom.Rectangle(-scene.tuning.tile_size_px / 2, -scene.tuning.tile_size_px / 2,
        scene.tuning.tile_size_px, scene.tuning.tile_size_px),
      Phaser.Geom.Rectangle.Contains
    );
    this.on('pointerup', () => this.scene.onTilePointerUp(this));
  }

  repaint() {
    if (this.spriteImg) this.remove(this.spriteImg, true);
    const key = this.special ? `tile-${this.special}` : `tile-${this.type}`;
    this.spriteImg = this.scene.add.image(0, 0, key);
    this.add(this.spriteImg);
  }
}
