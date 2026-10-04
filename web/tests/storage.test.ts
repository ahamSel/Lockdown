import { afterEach, describe, expect, it, vi } from 'vitest';
import { readBool, readNumber, writeBool, writeNumber } from '../src/storage';

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('storage', () => {
  it('round-trips numbers and booleans', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    writeNumber('best', 42);
    expect(readNumber('best', 0)).toBe(42);
    writeBool('muted', true);
    expect(readBool('muted', false)).toBe(true);
  });

  it('falls back on garbage values', () => {
    const s = fakeStorage();
    s.setItem('gwa.best', 'abc');
    vi.stubGlobal('localStorage', s);
    expect(readNumber('best', 7)).toBe(7);
  });

  it('survives storage that throws (private mode)', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('SecurityError');
      },
      setItem() {
        throw new Error('QuotaExceededError');
      },
    });
    expect(readNumber('best', 3)).toBe(3);
    expect(() => writeNumber('best', 5)).not.toThrow();
  });

  it('survives a localStorage getter that throws (sandboxed iframe)', () => {
    const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError');
      },
    });
    try {
      expect(readNumber('best', 9)).toBe(9);
      expect(() => writeBool('muted', true)).not.toThrow();
    } finally {
      if (desc) Object.defineProperty(globalThis, 'localStorage', desc);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });
});
