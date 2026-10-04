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
