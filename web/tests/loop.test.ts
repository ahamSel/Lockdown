import { describe, expect, it } from 'vitest';
import { planSteps } from '../src/loop';

const STEP = 1 / 60;

describe('planSteps', () => {
  it('runs one step per 1/60 s frame', () => {
    const p = planSteps(0, STEP, STEP, 0.25);
    expect(p.steps).toBe(1);
    expect(p.acc).toBeCloseTo(0, 9);
  });

  it('carries leftover time into the next frame', () => {
    const p = planSteps(0, 0.025, STEP, 0.25);
    expect(p.steps).toBe(1);
    expect(p.acc).toBeCloseTo(0.025 - STEP, 9);
    expect(p.alpha).toBeCloseTo((0.025 - STEP) / STEP, 6);
  });

  it('caps a long stall instead of spiralling', () => {
    expect(planSteps(0, 10, STEP, 0.25).steps).toBe(15);
  });

  it('ignores negative deltas', () => {
    expect(planSteps(0, -1, STEP, 0.25).steps).toBe(0);
  });
});
