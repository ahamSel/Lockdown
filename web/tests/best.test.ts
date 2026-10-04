import { describe, expect, it } from 'vitest';
import { createBestTracker } from '../src/best';

describe('best score tracker', () => {
  it('still reports a new best after the best was saved mid-run (e.g. on pause)', () => {
    const saved: number[] = [];
    const best = createBestTracker(0, (v) => saved.push(v));
    best.startRun();
    best.record(4); // pause saves the running score
    expect(best.value).toBe(4);
    expect(best.isNewBest(4)).toBe(true);
    expect(saved).toEqual([4]);
  });

  it('is not a new best when the run did not beat the previous best', () => {
    const best = createBestTracker(50, () => {});
    best.startRun();
    best.record(30);
    expect(best.isNewBest(30)).toBe(false);
    expect(best.value).toBe(50);
  });

  it('compares each run against the best from before that run', () => {
    const best = createBestTracker(0, () => {});
    best.startRun();
    best.record(10);
    best.startRun();
    best.record(8);
    expect(best.isNewBest(8)).toBe(false);
  });
});
