import { bounds } from './arena';
import { circleSquare } from './collide';
import { CONFIG } from './config';
import { applyPowerup, playerSize, POWERUP_IDS } from './powerups';
import type { PowerupId, World } from './types';

/** Ages, expires and collects pickups, then runs the spawn schedule. Uses real time. */
export function updatePickups(world: World, dt: number): void {
  const cfg = CONFIG.pickup;
  const p = world.player;
  const half = playerSize(p) / 2;

  let write = 0;
  for (const pk of world.pickups) {
    pk.age += dt;
    if (pk.age >= cfg.lifetime) {
      world.events.push({ type: 'expire', kind: pk.kind, x: pk.x, y: pk.y });
      continue;
    }
    if (p.alive && circleSquare(pk.x, pk.y, cfg.size / 2, p.x, p.y, half)) {
      applyPowerup(world, pk.kind);
      world.events.push({ type: 'pickup', kind: pk.kind, x: pk.x, y: pk.y });
      continue;
    }
    world.pickups[write++] = pk;
  }
  world.pickups.length = write;

  if (!p.alive) return;
  if (!world.pickupsStarted) {
    if (world.time < cfg.startDelay) return;
    world.pickupsStarted = true;
    spawnPickup(world);
    world.pickupClock = world.rng.pick(cfg.intervals);
    return;
  }
  world.pickupClock -= dt;
  if (world.pickupClock > 0) return;
  const count = world.rng.int(cfg.minBatch, cfg.maxBatch + 1);
  for (let i = 0; i < count; i++) spawnPickup(world);
  world.pickupClock = world.rng.pick(cfg.intervals);
}

export function spawnPickup(world: World, kind: PowerupId = world.rng.pick(POWERUP_IDS)): void {
  const cfg = CONFIG.pickup;
  const b = bounds(world, cfg.edgeMargin);
  const p = world.player;
  let x = 0;
  let y = 0;
  for (let i = 0; i < 30; i++) {
    x = world.rng.range(b.minX, b.maxX);
    y = world.rng.range(b.minY, b.maxY);
    if (Math.hypot(x - p.x, y - p.y) >= cfg.minPlayerDist) break;
  }
  world.pickups.push({ id: world.nextId++, kind, x, y, age: 0 });
  world.events.push({ type: 'spawnPickup', kind, x, y });
}
