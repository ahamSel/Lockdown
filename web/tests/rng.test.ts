import { describe, expect, it } from 'vitest';
import { createRng } from '../src/game/rng';

describe('createRng', () => {
  it('fork() continues from the same point without affecting the original', () => {
    const a = createRng(7);
    a.next();
    const b = a.fork();
    const fromFork = [b.next(), b.next(), b.next()];
    expect([a.next(), a.next(), a.next()]).toEqual(fromFork);
  });

  it('is deterministic for a given seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 5; i++) expect(a.next()).toBe(b.next());
  });

  it('keeps int() inside [min, max)', () => {
    const rng = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const n = rng.int(1, 5);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThan(5);
    }
  });

  it('pick() always returns one of the items', () => {
    const rng = createRng(7);
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 100; i++) expect(items).toContain(rng.pick(items));
  });
});
