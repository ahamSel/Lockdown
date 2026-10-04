import { CONFIG } from '../src/game/config';
import { createWorld, spawnBall, step } from '../src/game/sim';
import type { Vec, World } from '../src/game/types';

export const STEP = CONFIG.step;
export const ZERO: Vec = { x: 0, y: 0 };

/**
 * A 16:9 world whose only ball is parked, motionless and never splitting, in a corner.
 * Keeping one ball around stops the "cleared all balls" rule from kicking in.
 */
export function quietWorld(seed = 1): World {
  const world = createWorld({ aspect: 16 / 9, seed });
  world.balls = [];
  world.events = [];
  spawnBall(world, world.halfW - 1, world.halfH - 1, { active: true, scale: 0.2, splitTimer: Infinity });
  return world;
}

export function run(world: World, seconds: number, input: Vec = ZERO): void {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i++) step(world, input, STEP);
}
