import { CONFIG } from '../game/config';
import type { Ball, Bounds, Vec } from '../game/types';
import { clamp01, easeOutBack, lerp } from './tween';

/** World-seconds a freshly split ball takes to pop in (with a little overshoot). */
export const POP_TIME = 0.18;
/**
 * Jelly wobble after a wall bounce: flattened at contact, a quick stretch back, then round again.
 * Deformation along the wall normal is amp · e^(−t/decay) · cos(2πt/period), for `life` seconds.
 */
export const WOBBLE = { amp: 0.45, decay: 0.07, period: 0.16, hold: 0.04, life: 0.18 };

/** How much a ball stretches along its direction of travel at normal speed (2× at Time×2, capped). */
export const MOVE_STRETCH = 0.16;
/** After the wobble, the motion stretch eases back in over this long. */
const STRETCH_EASE_IN = 0.12;
/** A freshly split ball grows into its stretch over this long. */
const STRETCH_GROW_IN = 0.25;

const smooth = (t: number) => t * t * (3 - 2 * t);

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
export function ballPose(ball: Ball, alpha: number, b: Bounds, stepWorld: number): BallPose {
  let { x, y } = ballPosition(ball, alpha);
  let r = ball.scale / 2;
  if (ball.active && ball.age < POP_TIME) r *= easeOutBack(clamp01(ball.age / POP_TIME));
  if (r <= 0) return { x, y, rx: r, ry: r, angle: 0 };

  // Time since the wall contact, at the moment being drawn (negative = contact is later in this step).
  const t = ball.bounceT - (1 - alpha) * stepWorld;

  if (t >= 0 && t < WOBBLE.life) {
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

  // Otherwise stretch along the direction of travel. Before a contact later in this step, the ball
  // was still moving the pre-bounce way, so mirror the velocity on the bounce axis.
  let vx = ball.vx;
  let vy = ball.vy;
  if (t < 0) {
    if (ball.bounceAxis === 0) vx = -vx;
    else vy = -vy;
  }
  const speed = Math.hypot(vx, vy);
  if (!ball.active || speed === 0) return { x, y, rx: r, ry: r, angle: 0 };
  const timeScale = stepWorld / CONFIG.step;
  let k = MOVE_STRETCH * Math.min(2, (speed * timeScale) / CONFIG.ball.speed);
  if (t >= WOBBLE.life) k *= smooth(clamp01((t - WOBBLE.life) / STRETCH_EASE_IN));
  k *= smooth(clamp01(ball.age / STRETCH_GROW_IN));
  const angle = Math.atan2(vy, vx);
  k = fitInsideWalls(x, y, r, k, angle, b);
  return { x, y, rx: r * (1 + k), ry: r / (1 + k), angle };
}

/** Half-extents of an ellipse (a along `angle`, b across) on the x and y axes. */
function extents(a: number, bb: number, angle: number): [number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [Math.hypot(a * c, bb * s), Math.hypot(a * s, bb * c)];
}

/** Largest stretch ≤ k whose ellipse stays inside the walls (the round ball always fits). */
function fitInsideWalls(x: number, y: number, r: number, k: number, angle: number, b: Bounds): number {
  const room = Math.min(x - b.minX, b.maxX - x, y - b.minY, b.maxY - y);
  if (room >= r * (1 + k)) return k; // far from every wall
  const fits = (kk: number) => {
    const [ex, ey] = extents(r * (1 + kk), r / (1 + kk), angle);
    return x - ex >= b.minX && x + ex <= b.maxX && y - ey >= b.minY && y + ey <= b.maxY;
  };
  if (fits(k)) return k;
  let lo = 0;
  let hi = k;
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}
