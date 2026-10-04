import { describe, expect, it } from 'vitest';
import { bounds } from '../src/game/arena';
import { drainEvents, spawnBall, step } from '../src/game/sim';
import { ballPose, ballPosition, POP_TIME, WOBBLE } from '../src/render/ballpose';
import { quietWorld, STEP, ZERO } from './helpers';

describe('ball wall contact', () => {
  it('reflects the overshoot instead of parking the ball on the wall', () => {
    const world = quietWorld();
    const b = bounds(world);
    const ball = spawnBall(world, b.maxX - 0.1 - 0.1, -3, { active: true, scale: 0.2, vx: 10, age: 1 });
    step(world, ZERO, STEP);
    const travel = 10 * STEP;
    expect(ball.vx).toBeCloseTo(-10);
    expect(ball.x + 0.1).toBeCloseTo(b.maxX - (travel - 0.1), 6);
    expect(ball.hitF).toBeCloseTo(0.1 / travel, 6);
  });

  it('is drawn touching the wall at the moment of contact', () => {
    const world = quietWorld();
    const b = bounds(world);
    const ball = spawnBall(world, b.maxX - 0.1 - 0.1, -3, { active: true, scale: 0.2, vx: 10, age: 1 });
    step(world, ZERO, STEP);
    const p = ballPosition(ball, ball.hitF);
    expect(p.x + 0.1).toBeCloseTo(b.maxX, 6);
    // Before and after contact it is on the way in / out, never through the wall.
    expect(ballPosition(ball, ball.hitF / 2).x + 0.1).toBeLessThan(b.maxX);
    expect(ballPosition(ball, (1 + ball.hitF) / 2).x + 0.1).toBeLessThan(b.maxX);
  });

  it('is flattened against the wall at the moment of contact', () => {
    const world = quietWorld();
    const b = bounds(world);
    const ball = spawnBall(world, b.maxX - 0.1 - 0.1, -3, { active: true, scale: 0.2, vx: 10, age: 1 });
    step(world, ZERO, STEP);
    const pose = ballPose(ball, ball.hitF, b, STEP);
    expect(pose.rx).toBeLessThan(0.065); // squashed by about half: visible even on a small ball
    // 3 places: the ball also grows a hair (growRate × step) after touching the wall.
    expect(pose.x + pose.rx).toBeCloseTo(b.maxX, 3);
  });

  it('springs back with a stretch after leaving the wall, then settles round', () => {
    const world = quietWorld();
    const b = bounds(world);
    const ball = spawnBall(world, 0, 0, { active: true, scale: 0.2, age: 1, bounceAxis: 0, bounceSide: 1 });
    ball.bounceT = WOBBLE.period / 2;
    expect(ballPose(ball, 1, b, STEP).rx).toBeGreaterThan(0.1);
    ball.bounceT = WOBBLE.life + 0.01;
    expect(ballPose(ball, 1, b, STEP).rx).toBeCloseTo(0.1);
  });

  it('records how long ago it touched the wall, and which wall', () => {
    const world = quietWorld();
    const b = bounds(world);
    const ball = spawnBall(world, b.maxX - 0.1 - 0.1, -3, { active: true, scale: 0.2, vx: 10, age: 1 });
    step(world, ZERO, STEP);
    expect(ball.bounceT).toBeCloseTo((1 - ball.hitF) * STEP, 9);
    expect(ball.bounceAxis).toBe(0);
    expect(ball.bounceSide).toBe(1);
    const ev = drainEvents(world).find((e) => e.type === 'bounce');
    expect(ev).toMatchObject({ axis: 0, side: 1, r: 0.1 });
  });

  it('stays round away from the walls', () => {
    const world = quietWorld();
    const ball = spawnBall(world, 0, 2, { active: true, scale: 0.2, age: 1 });
    const pose = ballPose(ball, 1, bounds(world), STEP);
    expect(pose.rx).toBeCloseTo(0.1);
    expect(pose.ry).toBeCloseTo(0.1);
  });
});

describe('split pop', () => {
  it('overshoots its size briefly right after a split, then settles', () => {
    const world = quietWorld();
    const ball = spawnBall(world, 0, 2, { active: true, scale: 0.2, age: POP_TIME * 0.6 });
    expect(ballPose(ball, 1, bounds(world), STEP).rx).toBeGreaterThan(0.1);
    ball.age = POP_TIME;
    expect(ballPose(ball, 1, bounds(world), STEP).rx).toBeCloseTo(0.1);
  });

  it('starts split children at age 0', () => {
    const world = quietWorld();
    spawnBall(world, 3, 2, { active: true, scale: 0.2, splitTimer: 0.01, age: 5 });
    step(world, ZERO, STEP);
    const children = world.balls.filter((b) => b.splitTimer !== Infinity);
    expect(children).toHaveLength(3);
    for (const c of children) expect(c.age).toBeLessThan(0.05);
  });
});
