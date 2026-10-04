import { describe, expect, it } from 'vitest';
import { bounds } from '../src/game/arena';
import { spawnBall, step } from '../src/game/sim';
import { ballPose, ballPosition, POP_TIME } from '../src/render/ballpose';
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

  it('flattens against a wall it touches without pulling away from it', () => {
    const world = quietWorld();
    const b = bounds(world);
    const ball = spawnBall(world, b.maxX - 0.1, -3, { active: true, scale: 0.2, age: 1 });
    const pose = ballPose(ball, 1, b);
    expect(pose.rx).toBeLessThan(0.1);
    expect(pose.x + pose.rx).toBeCloseTo(b.maxX, 6);
  });

  it('stays round away from the walls', () => {
    const world = quietWorld();
    const ball = spawnBall(world, 0, 2, { active: true, scale: 0.2, age: 1 });
    const pose = ballPose(ball, 1, bounds(world));
    expect(pose.rx).toBeCloseTo(0.1);
    expect(pose.ry).toBeCloseTo(0.1);
  });
});

describe('split pop', () => {
  it('overshoots its size briefly right after a split, then settles', () => {
    const world = quietWorld();
    const ball = spawnBall(world, 0, 2, { active: true, scale: 0.2, age: POP_TIME * 0.6 });
    expect(ballPose(ball, 1, bounds(world)).rx).toBeGreaterThan(0.1);
    ball.age = POP_TIME;
    expect(ballPose(ball, 1, bounds(world)).rx).toBeCloseTo(0.1);
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
