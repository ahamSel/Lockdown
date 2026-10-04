/** Adds a rounded square of half-size `h` centred on the origin to the current path. */
export function roundedSquare(ctx: CanvasRenderingContext2D, h: number, radius: number): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(-h, -h, 2 * h, 2 * h, radius);
    return;
  }
  // Safari before 16 has no roundRect.
  ctx.moveTo(-h + radius, -h);
  ctx.arcTo(h, -h, h, h, radius);
  ctx.arcTo(h, h, -h, h, radius);
  ctx.arcTo(-h, h, -h, -h, radius);
  ctx.arcTo(-h, -h, h, -h, radius);
  ctx.closePath();
}
