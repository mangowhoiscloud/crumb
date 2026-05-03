// Kirby-flavored player — state machine: idle|run|jump|float|inhale|mouthful|spit|hurt|dead.
// All spec ACs that involve the player live here:
//   AC2 movement, AC3 5-jump float, AC4 inhale, AC5 copy ability.
import { TUNING } from '../config/tuning.js';

const STATE = Object.freeze({
  IDLE: 'idle', RUN: 'run', JUMP: 'jump', FLOAT: 'float',
  INHALE: 'inhale', MOUTHFUL: 'mouthful', SPIT: 'spit',
  HURT: 'hurt', DEAD: 'dead'
});

export class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.cfg = TUNING.player;

    // build sprite from procedural texture made in BootScene ("kirby")
    this.sprite = scene.physics.add.sprite(x, y, 'kirby');
    this.sprite.setCollideWorldBounds(true);
    this.sprite.body.setSize(20, 20).setOffset(2, 2);
    this.sprite.setDepth(50);
    this.sprite.player = this;

    this.state = STATE.IDLE;
    this.facing = 1;        // +1 right, -1 left
    this.hp = this.cfg.max_hp;
    this.lives = TUNING.lives.starting;
    this.invincibleUntil = 0;
    this.dead = false;

    // jump / float
    this.airJumpsUsed = 0;          // 0..5; 6th tap → exhale
    this.coyoteUntil = 0;
    this.jumpBufferUntil = 0;
    this.exhaleUntil = 0;            // while > now → forced 80 px/s descent + animation
    this.wasOnFloor = false;

    // inhale / mouthful
    this.inhaleHoldStart = 0;
    this.inhaling = false;
    this.mouthfulSource = null;       // 'Waddler' | 'Slasher' | 'Burner' | 'Flier' | 'Spikee'
    this.mouthfulUntil = 0;
    this.swallowHoldStart = 0;

    // ability
    this.abilityHeld = null;          // 'sword' | 'fire' | 'spark' | null
    this.abilityCooldownUntil = 0;
    this.abilityHoldStart = 0;
  }

  isInvincible() { return this.scene.time.now < this.invincibleUntil; }
  isAlive() { return !this.dead; }

  damage(amount = 1) {
    if (this.isInvincible() || this.dead) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.invincibleUntil = this.scene.time.now + this.cfg.iframes_ms;
    if (this.hp <= 0) {
      this._loseLife();
    } else {
      this.state = STATE.HURT;
      this.sprite.setTint(0xffffff);
      this.scene.tweens.add({ targets: this.sprite, alpha: { from: 1, to: 0.4 }, yoyo: true, repeat: 4, duration: 120,
        onComplete: () => { this.sprite.alpha = 1; this.sprite.clearTint(); if (this.state === STATE.HURT) this.state = STATE.IDLE; } });
    }
    return true;
  }

  _loseLife() {
    this.lives -= 1;
    if (this.lives <= 0) {
      this.dead = true;
      this.state = STATE.DEAD;
      this.sprite.body.setVelocity(0, 0);
      this.sprite.body.allowGravity = false;
      return;
    }
    // respawn
    this.hp = this.cfg.max_hp;
    this.airJumpsUsed = 0;
    this.mouthfulSource = null;
    this.abilityHeld = null;
    this.sprite.setPosition(TUNING.lives.respawn_x_px, TUNING.lives.respawn_y_px);
    this.sprite.body.setVelocity(0, 0);
    this.invincibleUntil = this.scene.time.now + this.cfg.iframes_ms;
    this.state = STATE.IDLE;
  }

  /** Called every frame from GameScene.update(). dt in ms. */
  update(dt, input) {
    if (this.dead) return;
    const now = this.scene.time.now;
    const onFloor = this.sprite.body.blocked.down || this.sprite.body.touching.down;

    // coyote / land
    if (onFloor) {
      this.coyoteUntil = now + TUNING.platformer_juice.coyote_ms;
      if (!this.wasOnFloor) {
        this.airJumpsUsed = 0;
        this.exhaleUntil = 0;
      }
    }
    this.wasOnFloor = onFloor;

    // --- horizontal movement (AC2) ---
    let vx = 0;
    if (this.state !== STATE.HURT && this.state !== STATE.INHALE && this.state !== STATE.MOUTHFUL) {
      if (input.isLeft())  { vx -= this.cfg.walk_speed_px_s; this.facing = -1; }
      if (input.isRight()) { vx += this.cfg.walk_speed_px_s; this.facing = 1; }
    } else if (this.state === STATE.MOUTHFUL) {
      // can shuffle slowly while mouthful
      if (input.isLeft())  { vx -= this.cfg.walk_speed_px_s * 0.6; this.facing = -1; }
      if (input.isRight()) { vx += this.cfg.walk_speed_px_s * 0.6; this.facing = 1; }
    }
    this.sprite.body.setVelocityX(vx);
    this.sprite.setFlipX(this.facing < 0);

    // --- jump / float (AC3) ---
    if (input.jumpJustDown()) {
      this._handleJump(now);
    }
    if (now < this.exhaleUntil) {
      // forced slow descent during 200 ms exhale animation
      this.sprite.body.setVelocityY(this.cfg.float_descent_velocity_px_s);
      this.sprite.body.allowGravity = false;
    } else if (!onFloor && this.state === STATE.FLOAT && this.airJumpsUsed >= this.cfg.float_max_air_jumps) {
      // after exhale window: slow descent until landing
      const vy = this.sprite.body.velocity.y;
      this.sprite.body.setVelocityY(Math.max(vy, this.cfg.float_descent_velocity_px_s));
      this.sprite.body.allowGravity = true;
    } else {
      this.sprite.body.allowGravity = true;
    }

    // --- inhale (AC4) ---
    this._handleInhale(now, input);

    // --- mouthful + ability action (AC5) ---
    this._handleAction(now, input);

    // --- state transitions for visuals ---
    if (this.state !== STATE.HURT && this.state !== STATE.DEAD) {
      if (this.state === STATE.INHALE || this.state === STATE.MOUTHFUL || this.state === STATE.SPIT) {
        // keep
      } else if (!onFloor) {
        if (this.airJumpsUsed > 0) this.state = STATE.FLOAT;
        else this.state = STATE.JUMP;
      } else if (Math.abs(vx) > 1) {
        this.state = STATE.RUN;
      } else {
        this.state = STATE.IDLE;
      }
    }

    // mouthful expiry → auto-spit
    if (this.state === STATE.MOUTHFUL && now >= this.mouthfulUntil) {
      this._spitStar();
    }

    // visually puff up while mouthful
    const targetScale = this.state === STATE.MOUTHFUL ? 1.15 : 1.0;
    this.sprite.scaleX += (targetScale - this.sprite.scaleX) * 0.15;
    this.sprite.scaleY += (targetScale - this.sprite.scaleY) * 0.15;
  }

  _handleJump(now) {
    if (this.state === STATE.HURT || this.state === STATE.MOUTHFUL || this.state === STATE.INHALE) return;
    const onFloor = this.sprite.body.blocked.down || this.sprite.body.touching.down;
    const canCoyote = now <= this.coyoteUntil;
    if (onFloor || canCoyote) {
      this.sprite.body.setVelocityY(this.cfg.jump_velocity_px_s);
      this.airJumpsUsed = 0;
      this.state = STATE.JUMP;
      this.coyoteUntil = 0;
      if (this.scene.audio) this.scene.audio.sfxJump();
      return;
    }
    // air-jump (float)
    if (this.airJumpsUsed < this.cfg.float_max_air_jumps) {
      this.airJumpsUsed += 1;
      this.sprite.body.setVelocityY(this.cfg.float_jump_velocity_px_s);
      this.state = STATE.FLOAT;
      if (this.scene.audio) this.scene.audio.sfxFloat();
    } else {
      // 6th tap → forced exhale (200 ms) then slow descent
      this.exhaleUntil = now + this.cfg.float_exhale_animation_ms;
      this.sprite.body.setVelocityY(0);
      this.state = STATE.FLOAT;
      if (this.scene.audio) this.scene.audio.sfxInhale();
    }
  }

  _handleInhale(now, input) {
    if (this.state === STATE.MOUTHFUL || this.state === STATE.HURT) {
      this.inhaling = false;
      this.inhaleHoldStart = 0;
      return;
    }
    const downNow = input.isInhaleDown();
    if (downNow) {
      if (!this.inhaling) {
        this.inhaling = true;
        this.inhaleHoldStart = now;
      } else if (now - this.inhaleHoldStart >= TUNING.inhale.hold_threshold_ms) {
        // try to capture nearest enemy in cone
        if (this.state !== STATE.INHALE) {
          this.state = STATE.INHALE;
          if (this.scene.audio) this.scene.audio.sfxInhale();
          if (this.scene.beginInhalePull) this.scene.beginInhalePull(this);
        }
      }
    } else {
      if (this.state === STATE.INHALE) this.state = STATE.IDLE;
      this.inhaling = false;
      this.inhaleHoldStart = 0;
    }
  }

  /**
   * Called by GameScene when an enemy collides with the inhale cone. Pulls
   * the enemy in and converts to mouthful.
   */
  receiveMouthful(enemyType) {
    if (this.state === STATE.MOUTHFUL) return false;
    this.mouthfulSource = enemyType;
    this.mouthfulUntil = this.scene.time.now + TUNING.inhale.mouthful_swallow_window_ms;
    this.state = STATE.MOUTHFUL;
    this.inhaling = false;
    return true;
  }

  _handleAction(now, input) {
    const justDown = input.actionJustDown();
    const downNow = input.isActionDown();
    if (downNow) {
      if (this.abilityHoldStart === 0) this.abilityHoldStart = now;
    } else {
      if (this.abilityHoldStart > 0 && this.abilityHeld) {
        const held = now - this.abilityHoldStart;
        if (held >= TUNING.ability_discard_hold_ms) {
          this.abilityHeld = null; // discard ability
        }
      }
      this.abilityHoldStart = 0;
    }

    if (this.state === STATE.MOUTHFUL) {
      if (justDown) {
        this._swallowOrSpit(input);
      } else if (downNow && this.abilityHoldStart > 0
                 && (now - this.abilityHoldStart) >= TUNING.inhale.swallow_hold_ms) {
        this._swallow();
      }
    } else if (justDown && this.abilityHeld) {
      this._useAbility(now);
    }
  }

  _swallowOrSpit(input) {
    // Tap (no hold): spit star projectile.
    // Tap-and-immediately-released after threshold = swallow path; handled separately.
    // For simplicity, default tap = spit; long-hold (handled in _handleAction) = swallow.
    this._spitStar();
  }

  _swallow() {
    if (this.state !== STATE.MOUTHFUL) return;
    const src = this.mouthfulSource;
    const drop = (TUNING.enemies[src] || {}).ability_drop || null;
    this.mouthfulSource = null;
    this.mouthfulUntil = 0;
    this.state = STATE.IDLE;
    if (drop) {
      this.abilityHeld = drop;
      if (this.scene.audio) this.scene.audio.sfxAbility();
      if (this.scene.flashHud) this.scene.flashHud('ABILITY: ' + drop.toUpperCase());
    } else {
      if (this.scene.audio) this.scene.audio.sfxSwallow();
    }
  }

  _spitStar() {
    if (this.state !== STATE.MOUTHFUL) return;
    this.state = STATE.SPIT;
    this.mouthfulSource = null;
    this.mouthfulUntil = 0;
    if (this.scene.spawnSpitStar) {
      this.scene.spawnSpitStar(this.sprite.x + this.facing * 12, this.sprite.y, this.facing);
    }
    if (this.scene.audio) this.scene.audio.sfxSpit();
    this.scene.time.delayedCall(150, () => { if (this.state === STATE.SPIT) this.state = STATE.IDLE; });
  }

  _useAbility(now) {
    if (now < this.abilityCooldownUntil) return;
    const which = this.abilityHeld;
    const cfg = TUNING.abilities[which];
    if (!cfg) return;
    this.abilityCooldownUntil = now + (cfg.cooldown_ms || cfg.duration_ms || 250);
    if (this.scene.spawnAbilityFx) this.scene.spawnAbilityFx(this, which);
  }

  /** Returns the inhale cone — used by GameScene for hit-detection vs enemies. */
  inhaleCone() {
    const range = TUNING.inhale.range_px;
    const halfDeg = TUNING.inhale.cone_deg / 2;
    return {
      x: this.sprite.x, y: this.sprite.y,
      facing: this.facing, range, halfDeg
    };
  }

  isInhaling() { return this.state === STATE.INHALE; }
  isMouthful() { return this.state === STATE.MOUTHFUL; }
  position() { return { x: this.sprite.x, y: this.sprite.y }; }
}

export const PLAYER_STATES = STATE;
