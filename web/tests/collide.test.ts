import { describe, expect, it } from 'vitest';
import { circleSquare } from '../src/game/collide';

describe('circleSquare', () => {
  it('returns null when apart', () => {
    expect(circleSquare(1, 0, 0.1, 0, 0, 0.25)).toBeNull();
  });

  it('reports a side contact with an outward normal', () => {
    const c = circleSquare(0.3, 0, 0.1, 0, 0, 0.25)!;
    expect(c.nx).toBeCloseTo(1);
    expect(c.ny).toBeCloseTo(0);
    expect(c.depth).toBeCloseTo(0.05);
  });

  it('pushes a centre inside the square out along the shallowest axis', () => {
    const c = circleSquare(0, -0.2, 0.1, 0, 0, 0.25)!;
    expect(c.nx).toBe(0);
    expect(c.ny).toBe(-1);
    expect(c.depth).toBeCloseTo(0.15);
  });
});
