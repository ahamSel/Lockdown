import { describe, expect, it } from 'vitest';
import { bounds } from '../src/game/arena';
import { CONFIG } from '../src/game/config';
import { createWorld, drainEvents, resizeWorld, spawnBall, step } from '../src/game/sim';
import { quietWorld, run, STEP, ZERO } from './helpers';

describe('balls', () => {
  it('seed ball spawns away from the player, grows in, then launches at full speed', () => {
    const world = createWorld({ aspect: 16 / 9, seed: 3 });
    expect(world.balls).toHaveLength(1);
    const ball = world.balls[0];
    expect(ball.active).toBe(false);
    expect(Math.hypot(ball.x, ball.y)).toBeGreaterThanOrEqual(CONFIG.ball.minSpawnDist);
    run(world, CONFIG.ball.growInTime + 0.05);
    expect(ball.active).toBe(true);
    expect(ball.scale).toBeGreaterThanOrEqual(CONFIG.ball.seedScale);
    expect(ball.scale).toBeLessThan(CONFIG.ball.seedScale + 0.01);
    expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(CONFIG.ball.speed);
  });

  it('splits into 3 fresh balls after 10 world-seconds and scores 3', () => {
    const world = createWorld({ aspect: 16 / 9, seed: 5 });
    world.balls = [];
    spawnBall(world, 3, 2, { active: true, scale: 0.2 });
    run(world, CONFIG.ball.splitInterval - 0.1);
    expect(world.balls).toHaveLength(1);
    run(world, 0.2);
    expect(world.balls).toHaveLength(3);
    for (const b of world.balls) {
      expect(b.scale).toBeCloseTo(CONFIG.ball.seedScale, 1);
      expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(CONFIG.ball.speed);
    }
    expect(world.score).toBe(CONFIG.score.start + CONFIG.score.perSplit);
    expect(drainEvents(world).some((e) => e.type === 'split')).toBe(true);
  });

  it('does not split past the cap, and stops growing while it waits', () => {
    const world = createWorld({ aspect: 16 / 9, seed: 5 });
    world.balls = [];
    world.maxBalls = 3;
    spawnBall(world, 3, 2, { active: true, scale: 0.2, splitTimer: 0.05 });
    spawnBall(world, 3, -2, { active: true, scale: 0.2, splitTimer: 0.05 });
    spawnBall(world, -3, 2, { active: true, scale: 0.2, splitTimer: 0.05 });
    run(world, 0.5);
    expect(world.balls).toHaveLength(3);
    const scale = world.balls[0].scale;
    run(world, 1);
    expect(world.balls[0].scale).toBe(scale);
  });

  it('awards no split score once the player is dead', () => {
    const world = createWorld({ aspect: 16 / 9, seed: 5 });
    world.balls = [];
    world.player.alive = false;
    spawnBall(world, 3, 2, { active: true, scale: 0.2, splitTimer: 0.05 });
    run(world, 0.1);
    expect(world.balls).toHaveLength(3);
    expect(world.score).toBe(CONFIG.score.start);
  });

  it('bounces off walls without losing speed', () => {
    const world = quietWorld();
    const b = bounds(world);
    const ball = spawnBall(world, b.maxX - 0.2, -3, { active: true, scale: 0.2, vx: 10, vy: 0 });
    run(world, 0.1);
    expect(ball.vx).toBeCloseTo(-10);
    expect(ball.x + ball.scale / 2).toBeLessThanOrEqual(b.maxX);
  });
});

describe('time scale', () => {
  it('Time×2 runs balls twice as fast', () => {
    const world = quietWorld();
    world.player.timers.timeFast = 100;
    spawnBall(world, 3, 2, { active: true, scale: 0.2 });
    run(world, 4.9);
    expect(world.balls).toHaveLength(2);
    run(world, 0.2);
    expect(world.balls).toHaveLength(4);
  });

  it('Time÷2 runs balls at half speed', () => {
    const world = quietWorld();
    world.player.timers.timeSlow = 100;
    spawnBall(world, 3, 2, { active: true, scale: 0.2 });
    run(world, 10.1);
    expect(world.balls).toHaveLength(2);
    run(world, 10);
    expect(world.balls).toHaveLength(4);
  });

  it('never changes player speed or powerup timers', () => {
    const world = quietWorld();
    world.player.timers.timeFast = 100;
    run(world, 0.5, { x: 1, y: 0 });
    expect(world.player.x).toBeCloseTo(3.5, 1);
    expect(world.player.timers.timeFast).toBeCloseTo(99.5, 1);
  });
});

describe('player', () => {
  it('normalises diagonal input', () => {
    const world = quietWorld();
    run(world, 0.5, { x: 1, y: 1 });
    expect(Math.hypot(world.player.x, world.player.y)).toBeCloseTo(3.5, 1);
  });

  it('stays inside the walls', () => {
    const world = quietWorld();
    run(world, 3, { x: 1, y: 0 });
    expect(world.player.x).toBeCloseTo(bounds(world, CONFIG.player.size / 2).maxX);
  });

  it('loses 1 HP per hit, with a short invulnerability window', () => {
    const world = quietWorld();
    const first = spawnBall(world, 0.5, 0, { active: true, scale: 0.2, vx: -10 });
    step(world, ZERO, STEP);
    expect(world.player.hp).toBe(19);
    expect(first.vx).toBeGreaterThan(0);
    expect(drainEvents(world).some((e) => e.type === 'hit')).toBe(true);

    spawnBall(world, -0.3, 0, { active: true, scale: 0.2, vx: 10 });
    step(world, ZERO, STEP);
    expect(world.player.hp).toBe(19);

    run(world, 0.7);
    spawnBall(world, 0.5, 0, { active: true, scale: 0.2, vx: -10 });
    step(world, ZERO, STEP);
    expect(world.player.hp).toBe(18);
  });

  it('Shield blocks damage', () => {
    const world = quietWorld();
    world.player.timers.shield = 10;
    spawnBall(world, 0.5, 0, { active: true, scale: 0.2, vx: -10 });
    step(world, ZERO, STEP);
    expect(world.player.hp).toBe(20);
    expect(drainEvents(world).some((e) => e.type === 'blocked')).toBe(true);
  });

  it('Fire destroys touched balls without damage', () => {
    const world = quietWorld();
    world.player.timers.fire = 10;
    spawnBall(world, 0.5, 0, { active: true, scale: 0.2, vx: -10 });
    step(world, ZERO, STEP);
    expect(world.balls).toHaveLength(1); // only the parked ball is left
    expect(world.player.hp).toBe(20);
    expect(drainEvents(world).some((e) => e.type === 'burn')).toBe(true);
  });

  it('dies at 0 HP, clears its powerups, and emits death', () => {
    const world = quietWorld();
    world.player.hp = 1;
    world.player.timers.timeFast = 5;
    spawnBall(world, 0.5, 0, { active: true, scale: 0.2, vx: -10 });
    step(world, ZERO, STEP);
    expect(world.player.alive).toBe(false);
    expect(world.player.timers.timeFast).toBe(0);
    expect(drainEvents(world).some((e) => e.type === 'death')).toBe(true);
  });
});

describe('clearing the board', () => {
  it('awards a bonus and spawns a new seed ball away from the player', () => {
    const world = createWorld({ aspect: 16 / 9, seed: 9 });
    world.balls = [];
    world.player.timers.fire = 10;
    spawnBall(world, 0.5, 0, { active: true, scale: 0.2, vx: -10 });
    step(world, ZERO, STEP);
    expect(world.balls).toHaveLength(1);
    expect(world.balls[0].active).toBe(false);
    expect(Math.hypot(world.balls[0].x - world.player.x, world.balls[0].y - world.player.y)).toBeGreaterThanOrEqual(
      CONFIG.ball.minSpawnDist,
    );
    expect(world.score).toBe(CONFIG.score.start + CONFIG.score.clearBonus);
    expect(drainEvents(world).some((e) => e.type === 'cleared')).toBe(true);
  });
});

describe('resizeWorld', () => {
  it('keeps the player and every ball inside the walls when the screen narrows', () => {
    const world = quietWorld();
    world.player.x = 8;
    spawnBall(world, 8.3, 0, { active: true, scale: 0.2 });
    resizeWorld(world, 9 / 16);
    expect(world.halfW).toBe(5);
    const pb = bounds(world, CONFIG.player.size / 2);
    expect(world.player.x).toBeLessThanOrEqual(pb.maxX);
    const b = bounds(world);
    for (const ball of world.balls) {
      expect(ball.x + ball.scale / 2).toBeLessThanOrEqual(b.maxX + 1e-9);
      expect(ball.y + ball.scale / 2).toBeLessThanOrEqual(b.maxY + 1e-9);
    }
  });
});
