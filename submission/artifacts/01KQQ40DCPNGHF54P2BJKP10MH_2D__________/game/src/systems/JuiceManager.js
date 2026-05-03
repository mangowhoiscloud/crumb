// Juice / vibe constants per agents/specialists/game-vibe.md (profile C — sidescroll-2d).
// Reduced-motion fallback collapses shake to 0 and clamps hit-stop ≤ 8 ms.
import { TUNING, isReducedMotion } from '../config/tuning.js';

export const TIMINGS = {
  ANTICIPATION_MS: 80,
  FOLLOWTHROUGH_MS: 200,
  HIT_PAUSE_MS: TUNING.platformer_juice.hit_stop_player_ms, // 32 — profile C player damage
  HIT_PAUSE_ENEMY_MS: TUNING.platformer_juice.hit_stop_enemy_ms, // 16
  HIT_PAUSE_RESTORE_MS: TUNING.platformer_juice.hit_stop_restore_ms,
  COMBO_FLASH_MS: 80,
  TAP_BOUNCE_MS: 200,
  TWEEN_DEFAULT_MS: 200
};

export const SHAKE = {
  SMALL:  { px: TUNING.platformer_juice.shake_minor_px, dur_ms: TUNING.platformer_juice.shake_lerp_in_ms },
  MEDIUM: { px: TUNING.platformer_juice.shake_major_px, dur_ms: 150 },
  LARGE:  { px: TUNING.platformer_juice.shake_death_px, dur_ms: TUNING.platformer_juice.shake_lerp_out_ms + 50 }
};

export const POOLS = {
  PARTICLE: 50,    // profile C override
  PROJECTILE: 80,
  AUDIO_VOICE: 8
};

export class JuiceManager {
  constructor(scene) {
    this.scene = scene;
    this.reduced = isReducedMotion();
    this.hitStopTimer = null;
  }

  shake(level = 'SMALL') {
    if (this.reduced) return;
    const cfg = SHAKE[level] || SHAKE.SMALL;
    const cam = this.scene.cameras.main;
    cam.shake(cfg.dur_ms, cfg.px / 200);
  }

  hitStopPlayer() {
    const ms = this.reduced
      ? Math.min(TIMINGS.HIT_PAUSE_MS, TUNING.accessibility.reduced_motion_hit_stop_max_ms)
      : TIMINGS.HIT_PAUSE_MS;
    this._freezeFor(ms);
  }

  hitStopEnemy() {
    const ms = this.reduced
      ? Math.min(TIMINGS.HIT_PAUSE_ENEMY_MS, TUNING.accessibility.reduced_motion_hit_stop_max_ms)
      : TIMINGS.HIT_PAUSE_ENEMY_MS;
    this._freezeFor(ms);
  }

  _freezeFor(ms) {
    if (ms <= 0) return;
    if (this.scene.physics && this.scene.physics.world) {
      this.scene.physics.world.timeScale = 0;
      if (this.hitStopTimer) this.hitStopTimer.remove(false);
      this.hitStopTimer = this.scene.time.delayedCall(ms, () => {
        this.scene.physics.world.timeScale = 1;
        this.hitStopTimer = null;
      });
    }
  }

  tapBounce(target) {
    if (!target) return;
    this.scene.tweens.add({
      targets: target,
      scaleX: { from: 1, to: 1.18 },
      scaleY: { from: 1, to: 1.18 },
      yoyo: true,
      duration: TIMINGS.TAP_BOUNCE_MS / 2,
      ease: 'Sine.easeOut'
    });
  }
}
