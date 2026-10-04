import { describe, expect, it } from 'vitest';
import { createFx } from '../src/render/fx';
import { quietWorld } from './helpers';

function peakShake(fx: ReturnType<typeof createFx>): number {
  let peak = 0;
  for (let i = 0; i < 400; i++) {
    const o = fx.shakeOffset();
    peak = Math.max(peak, Math.abs(o.x), Math.abs(o.y));
  }
  return peak;
}

describe('screen shake', () => {
  it('shakes about 0.15 units on a hit, as the spec asks', () => {
    const fx = createFx(false);
    fx.handle([{ type: 'hit', x: 0, y: 0, hp: 19 }], quietWorld());
    const peak = peakShake(fx);
    expect(peak).toBeGreaterThan(0.12);
    expect(peak).toBeLessThanOrEqual(0.16);
  });

  it('settles within half a second', () => {
    const fx = createFx(false);
    const world = quietWorld();
    fx.handle([{ type: 'hit', x: 0, y: 0, hp: 19 }], world);
    fx.update(0.5, world);
    expect(peakShake(fx)).toBe(0);
  });

  it('does not shake with reduced motion', () => {
    const fx = createFx(true);
    fx.handle([{ type: 'hit', x: 0, y: 0, hp: 19 }], quietWorld());
    expect(peakShake(fx)).toBe(0);
  });
});

describe('effect timing', () => {
  it('never draws a negative radius, even after a negative frame delta', () => {
    const fx = createFx(false);
    const world = quietWorld();
    fx.handle([{ type: 'spawnBall', x: 0, y: 0 }, { type: 'split', x: 1, y: 1, r: 0.1 }], world);
    fx.update(-0.05, world); // a rAF timestamp can be earlier than the clock read at startup
    const radii: number[] = [];
    const noop = () => {};
    const ctx = {
      globalAlpha: 1,
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 1,
      beginPath: noop,
      stroke: noop,
      fill: noop,
      fillRect: noop,
      arc: (_x: number, _y: number, r: number) => radii.push(r),
    };
    fx.draw(ctx as unknown as CanvasRenderingContext2D);
    expect(radii.length).toBeGreaterThan(0);
    for (const r of radii) expect(r).toBeGreaterThanOrEqual(0);
  });
});

describe('bounce effects', () => {
  it('marks the wall (and only the wall) when a ball bounces', () => {
    const fx = createFx(false);
    fx.handle([{ type: 'bounce', x: 8, y: 1, axis: 0, side: 1, r: 0.1 }], quietWorld());
    expect(fx.stats().marks).toBe(1);
    expect(fx.stats().rings).toBe(0);
    fx.update(0.25, quietWorld());
    expect(fx.stats().marks).toBe(1); // ticks stay visible a little longer than a quarter second
    fx.update(0.2, quietWorld());
    expect(fx.stats().marks).toBe(0);
  });

  it('skips bounce effects once the arena is crowded', () => {
    const fx = createFx(false);
    const world = quietWorld();
    for (let i = 0; i < 60; i++) world.balls.push({ ...world.balls[0] });
    fx.handle([{ type: 'bounce', x: 8, y: 1, axis: 0, side: 1, r: 0.1 }], world);
    expect(fx.stats().marks).toBe(0);
    expect(fx.stats().rings).toBe(0);
  });
});
