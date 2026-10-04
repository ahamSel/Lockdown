import { CONFIG } from './config';
import type { Bounds } from './types';

/** The shorter screen side is always CONFIG.shortSide units, so portrait phones get a tall arena. */
export function worldHalfSize(aspect: number): { halfW: number; halfH: number } {
  const half = CONFIG.shortSide / 2;
  return aspect >= 1 ? { halfW: half * aspect, halfH: half } : { halfW: half, halfH: half / aspect };
}

/** Playable area inside the walls, shrunk by `inset` on every side. */
export function bounds(world: { halfW: number; halfH: number }, inset = 0): Bounds {
  const w = CONFIG.wallThickness / 2 + inset;
  return { minX: -world.halfW + w, maxX: world.halfW - w, minY: -world.halfH + w, maxY: world.halfH - w };
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
