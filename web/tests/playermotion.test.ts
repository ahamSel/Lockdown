import { describe, expect, it } from 'vitest';
import { createPlayerMotion } from '../src/render/playermotion';

function run(m: ReturnType<typeof createPlayerMotion>, vx: number, vy: number, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 120) m.update(vx, vy, 1 / 120);
}

describe('player squash and stretch', () => {
  it('stretches along the direction it moves', () => {
    const m = createPlayerMotion();
    run(m, 7, 0, 0.5);
    const p = m.pose();
    expect(p.along).toBeGreaterThan(1.05);
    expect(p.across).toBeLessThan(1);
    expect(p.angle).toBeCloseTo(0, 2);
  });

  it('overshoots into a squash when it stops, then settles square', () => {
    const m = createPlayerMotion();
    run(m, 7, 0, 0.5);
    let min = Infinity;
    for (let t = 0; t < 0.3; t += 1 / 120) {
      m.update(0, 0, 1 / 120);
      min = Math.min(min, m.pose().along);
    }
    expect(min).toBeLessThan(0.995);
    run(m, 0, 0, 1);
    expect(m.pose().along).toBeCloseTo(1, 2);
  });

  it('squashes and flashes white when hit, and the flash is brief', () => {
    const m = createPlayerMotion();
    m.hit(1, 0);
    run(m, 0, 0, 0.03);
    expect(m.pose().along).toBeLessThan(0.95);
    expect(m.pose().flash).toBeGreaterThan(0);
    run(m, 0, 0, 0.2);
    expect(m.pose().flash).toBe(0);
  });

  it('ignores zero or negative time steps', () => {
    const m = createPlayerMotion();
    m.update(7, 0, 0);
    m.update(7, 0, -1);
    expect(m.pose().along).toBe(1);
  });
});
