import { describe, expect, it } from 'vitest';
import { encodeDir, replayInput } from '../src/dev/replay';

describe('recorded runs (dev replay)', () => {
  it('turns each step character back into the same input', () => {
    const r = { dirs: encodeDir(-1) + encodeDir(0) + encodeDir(4) + encodeDir(8) };
    expect(replayInput(r, 0)).toEqual({ x: 0, y: 0 });
    expect(replayInput(r, 1).x).toBeCloseTo(1);
    expect(replayInput(r, 2).y).toBeCloseTo(1);
    expect(replayInput(r, 3).x).toBeCloseTo(-1);
  });

  it('gives no input once the recording runs out', () => {
    expect(replayInput({ dirs: 'a' }, 5)).toEqual({ x: 0, y: 0 });
  });
});
