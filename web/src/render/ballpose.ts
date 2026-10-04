import type { Ball, Bounds, Vec } from '../game/types';
import { clamp01, easeOutBack, lerp } from './tween';

/** World-seconds a freshly split ball takes to pop in (with a little overshoot). */
export const POP_TIME = 0.18;
/**
 * Jelly wobble after a wall bounce: flattened at contact, a quick stretch back, then round again.
 * Deformation along the wall normal is amp · e^(−t/decay) · cos(2πt/period).
 */
export const WOBBLE = { amp: 0.32, decay: 0.055, period: 0.13, hold: 0.03, life: 0.3 };

export interface BallPose {
  x: number;
  y: number;
  /** Radius along `angle` (the wall normal when squashed). */
  rx: number;
  ry: number;
  angle: number;
}

/**
 * Where to draw the ball between the last two sim states. If it bounced during the last step, the path
 * goes through the exact contact point, so the ball is seen touching the wall instead of cutting the corner.
 */
export function ballPosition(ball: Ball, alpha: number): Vec {
  if (ball.hitF < 0) return { x: lerp(ball.px, ball.x, alpha), y: lerp(ball.py, ball.y, alpha) };
  if (alpha <= ball.hitF) {
    const t = ball.hitF > 0 ? alpha / ball.hitF : 1;
    return { x: lerp(ball.px, ball.hitX, t), y: lerp(ball.py, ball.hitY, t) };
  }
  const t = ball.hitF < 1 ? (alpha - ball.hitF) / (1 - ball.hitF) : 1;
  return { x: lerp(ball.hitX, ball.x, t), y: lerp(ball.hitY, ball.y, t) };
}

/** `stepWorld` is the world time one sim step covers (step × time scale). */
export function ballPose(ball: Ball, alpha: number, _bounds: Bounds, stepWorld: number): BallPose {
  let { x, y } = ballPosition(ball, alpha);
  let r = ball.scale / 2;
  if (ball.active && ball.age < POP_TIME) r *= easeOutBack(clamp01(ball.age / POP_TIME));

  // Time since the wall contact, at the moment being drawn (negative = contact is later in this step).
  const t = ball.bounceT - (1 - alpha) * stepWorld;
  if (r <= 0 || t < 0 || t > WOBBLE.life) return { x, y, rx: r, ry: r, angle: 0 };

  const d = WOBBLE.amp * Math.exp(-t / WOBBLE.decay) * Math.cos(((2 * Math.PI) / WOBBLE.period) * t);
  const rx = r * (1 - d);
  const ry = r * (1 + d * 0.6);
  // Right at impact, keep the flattened side pressed on the wall instead of shrinking away from it.
  const anchor = Math.max(0, 1 - t / WOBBLE.hold);
  const shift = (r - rx) * ball.bounceSide * anchor;
  if (ball.bounceAxis === 0) x += shift;
  else y += shift;
  return { x, y, rx, ry, angle: ball.bounceAxis === 0 ? 0 : Math.PI / 2 };
}
