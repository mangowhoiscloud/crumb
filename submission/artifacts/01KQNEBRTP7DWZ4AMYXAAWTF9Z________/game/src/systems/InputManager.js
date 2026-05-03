// InputManager — wires Phaser pointerdown to a single onTap(x, y) callback.
// Spec.md "Tap input" requires that a browser-dispatched
// `PointerEvent('pointerdown')` reaches the Phaser input system; Phaser's
// `this.input.on('pointerdown', ...)` is the supported channel.

export default class InputManager {
  constructor(scene, onTap) {
    this.scene = scene;
    this.onTap = onTap;
    scene.input.on('pointerdown', this.handlePointerDown, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.detach, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.detach, this);
  }

  handlePointerDown(pointer) {
    if (!this.onTap) return;
    this.onTap(pointer.worldX, pointer.worldY);
  }

  detach() {
    if (this.scene && this.scene.input) {
      this.scene.input.off('pointerdown', this.handlePointerDown, this);
    }
    this.onTap = null;
    this.scene = null;
  }
}
