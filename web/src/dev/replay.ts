// Dev-only recorded runs (see tools/capture): one character per sim step, so a run replays exactly.
import type { Vec } from '../game/types';

export interface Replay {
  /** The world's random seed and aspect ratio when the run was planned. */
  seed: number;
  aspect: number;
  /** Per step: '.' for no input, or 'a'..'p' for one of 16 world-space directions (a = +x, counter-clockwise). */
  dirs: string;
}

export const REPLAY_DIRS = 16;

export function encodeDir(dir: number): string {
  return dir < 0 ? '.' : String.fromCharCode(97 + dir);
}

export function replayInput(r: Pick<Replay, 'dirs'>, step: number): Vec {
  const c = r.dirs.charCodeAt(step) - 97;
  if (!(c >= 0 && c < REPLAY_DIRS)) return { x: 0, y: 0 };
  const a = (c / REPLAY_DIRS) * Math.PI * 2;
  return { x: Math.cos(a), y: Math.sin(a) };
}
