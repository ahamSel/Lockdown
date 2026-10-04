/** Squash & stretch for the player square: a damped spring on how stretched it is along its motion. */

export interface PlayerPose {
  /** Axis of the stretch (radians, world space). */
  angle: number;
  /** Scale along the axis (>1 stretched, <1 squashed) and across it. */
  along: number;
  across: number;
  /** 1 right after a hit, fading to 0. */
  flash: number;
}

export interface PlayerMotion {
  update(vx: number, vy: number, dt: number): void;
  /** `dx, dy` points the way the hit pushes the player (from the ball toward the player). */
  hit(dx: number, dy: number): void;
  pose(): PlayerPose;
  reset(): void;
}

const MAX_STRETCH = 0.14;
const REF_SPEED = 12;
const STIFFNESS = 420;
const DAMPING = 16; // underdamped, so stopping overshoots into a small squash
const HIT_SQUASH = 5;
const FLASH_TIME = 0.08;
const SUBSTEP = 1 / 240;

export function createPlayerMotion(): PlayerMotion {
  let dirX = 1;
  let dirY = 0;
  let a = 0;
  let av = 0;
  let flash = 0;

  return {
    update(vx, vy, dt) {
      if (dt <= 0) return;
      const speed = Math.hypot(vx, vy);
      if (speed > 0.5) {
        // Ease the axis toward the direction of travel so turns don't snap.
        const k = 1 - Math.exp(-25 * dt);
        const nx = dirX + (vx / speed - dirX) * k;
        const ny = dirY + (vy / speed - dirY) * k;
        const m = Math.hypot(nx, ny) || 1;
        dirX = nx / m;
        dirY = ny / m;
      }
      const target = Math.min(speed / REF_SPEED, 1) * MAX_STRETCH;
      for (let left = dt; left > 0; left -= SUBSTEP) {
        const h = Math.min(left, SUBSTEP);
        av += (STIFFNESS * (target - a) - DAMPING * av) * h;
        a += av * h;
      }
      flash = Math.max(0, flash - dt);
    },
    hit(dx, dy) {
      const m = Math.hypot(dx, dy);
      if (m > 0) {
        dirX = dx / m;
        dirY = dy / m;
      }
      av -= HIT_SQUASH;
      flash = FLASH_TIME;
    },
    pose() {
      return { angle: Math.atan2(dirY, dirX), along: 1 + a, across: 1 / (1 + a), flash: flash / FLASH_TIME };
    },
    reset() {
      dirX = 1;
      dirY = 0;
      a = 0;
      av = 0;
      flash = 0;
    },
  };
}
