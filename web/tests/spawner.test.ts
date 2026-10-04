import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/game/config';
import { drainEvents } from '../src/game/sim';
import { spawnPickup, updatePickups } from '../src/game/spawner';
import { quietWorld, STEP } from './helpers';

describe('pickup spawning', () => {
  it('starts 13 s in with a single pickup', () => {
    const world = quietWorld();
    world.time = CONFIG.pickup.startDelay - 0.1;
    updatePickups(world, STEP);
    expect(world.pickups).toHaveLength(0);
    world.time = CONFIG.pickup.startDelay;
    updatePickups(world, STEP);
    expect(world.pickups).toHaveLength(1);
    expect(CONFIG.pickup.intervals).toContain(world.pickupClock);
  });

  it('spawns batches of 1 to 4 when the clock runs out', () => {
    const world = quietWorld();
    world.pickupsStarted = true;
    world.pickupClock = 0.01;
    updatePickups(world, 0.02);
    expect(world.pickups.length).toBeGreaterThanOrEqual(1);
    expect(world.pickups.length).toBeLessThanOrEqual(4);
  });

  it('never spawns on top of the player', () => {
    const world = quietWorld();
    for (let i = 0; i < 50; i++) spawnPickup(world);
    for (const p of world.pickups) expect(Math.hypot(p.x, p.y)).toBeGreaterThanOrEqual(CONFIG.pickup.minPlayerDist);
  });

  it('expires uncollected pickups after 12 s', () => {
    const world = quietWorld();
    spawnPickup(world, 'health');
    drainEvents(world);
    updatePickups(world, CONFIG.pickup.lifetime);
    expect(world.pickups).toHaveLength(0);
    expect(drainEvents(world).some((e) => e.type === 'expire')).toBe(true);
  });

  it('collects a pickup the player touches', () => {
    const world = quietWorld();
    world.pickups.push({ id: 999, kind: 'shield', x: 0, y: 0, age: 0 });
    updatePickups(world, STEP);
    expect(world.pickups).toHaveLength(0);
    expect(world.player.timers.shield).toBe(CONFIG.powerup.duration);
    expect(drainEvents(world).some((e) => e.type === 'pickup' && e.kind === 'shield')).toBe(true);
  });
});
