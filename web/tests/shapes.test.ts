import { describe, expect, it } from 'vitest';
import { roundedSquare } from '../src/render/shapes';

describe('roundedSquare', () => {
  it('draws without ctx.roundRect (Safari before 16)', () => {
    const calls: string[] = [];
    const ctx = {
      moveTo: () => calls.push('moveTo'),
      arcTo: () => calls.push('arcTo'),
      closePath: () => calls.push('closePath'),
    };
    expect(() => roundedSquare(ctx as unknown as CanvasRenderingContext2D, 0.2, 0.05)).not.toThrow();
    expect(calls.filter((c) => c === 'arcTo')).toHaveLength(4);
  });

  it('uses ctx.roundRect when the browser has it', () => {
    const calls: unknown[][] = [];
    const ctx = { roundRect: (...args: unknown[]) => calls.push(args) };
    roundedSquare(ctx as unknown as CanvasRenderingContext2D, 0.2, 0.05);
    expect(calls).toEqual([[-0.2, -0.2, 0.4, 0.4, 0.05]]);
  });
});
