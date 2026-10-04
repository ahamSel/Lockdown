const PREFIX = 'gwa.';

function read(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(PREFIX + key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(PREFIX + key, value);
  } catch {
    // Storage is blocked (private mode, sandboxed iframe): the game works, the value just isn't kept.
  }
}

export function readNumber(key: string, fallback: number): number {
  const raw = read(key);
  if (raw === null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function writeNumber(key: string, value: number): void {
  write(key, String(value));
}

export function readBool(key: string, fallback: boolean): boolean {
  const raw = read(key);
  return raw === '1' ? true : raw === '0' ? false : fallback;
}

export function writeBool(key: string, value: boolean): void {
  write(key, value ? '1' : '0');
}
