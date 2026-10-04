import type { Ball, Bounds, Vec } from '../game/types';
import { clamp01, easeOutBack, lerp } from './tween';

/** World-seconds a freshly split ball takes to pop in (with a little overshoot). */
export const POP_TIME = 0.18;
/** A ball starts flattening when its edge is within this fraction of its radius from a wall. */
const SQUASH_ZONE = 0.35;
/** How much a ball flattens when it is pressed right against a wall. */
const SQUASH_MAX = 0.22;

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

export function ballPose(ball: Ball, alpha: number, b: Bounds): BallPose {
  let { x, y } = ballPosition(ball, alpha);
  let r = ball.scale / 2;
  if (ball.active && ball.age < POP_TIME) r *= easeOutBack(clamp01(ball.age / POP_TIME));

  // Nearest wall: gap from the ball's edge, which side, and the wall normal's axis.
  const gaps: [number, number, number][] = [
    [x - r - b.minX, -1, 0],
    [b.maxX - (x + r), 1, 0],
    [y - r - b.minY, -1, 1],
    [b.maxY - (y + r), 1, 1],
  ];
  let [gap, side, axis] = gaps[0];
  for (const g of gaps) if (g[0] < gap) [gap, side, axis] = g;

  if (r <= 0 || gap >= r * SQUASH_ZONE) return { x, y, rx: r, ry: r, angle: 0 };

  // Flatten along the wall normal, keeping the wall-side edge where it is so the ball stays on the wall.
  const amount = 1 - Math.max(0, gap) / (r * SQUASH_ZONE);
  const rx = r * (1 - SQUASH_MAX * amount);
  const ry = r * (1 + SQUASH_MAX * amount * 0.5);
  const shift = (r - rx) * side;
  if (axis === 0) x += shift;
  else y += shift;
  return { x, y, rx, ry, angle: axis === 0 ? 0 : Math.PI / 2 };
}
