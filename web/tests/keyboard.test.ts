import { describe, expect, it } from 'vitest';
import { createKeyboard } from '../src/input/keyboard';

function key(target: EventTarget, type: 'keydown' | 'keyup', code: string): Event {
  const e = Object.assign(new Event(type, { cancelable: true }), { code });
  target.dispatchEvent(e);
  return e;
}

describe('keyboard', () => {
  it('maps WASD and arrows to a unit direction', () => {
    const t = new EventTarget();
    const kb = createKeyboard(t);
    key(t, 'keydown', 'KeyD');
    expect(kb.dir()).toEqual({ x: 1, y: 0 });
    key(t, 'keydown', 'ArrowUp');
    expect(kb.dir().x).toBeCloseTo(Math.SQRT1_2);
    expect(kb.dir().y).toBeCloseTo(Math.SQRT1_2);
    key(t, 'keyup', 'KeyD');
    expect(kb.dir()).toEqual({ x: 0, y: 1 });
  });

  it('cancels opposite keys', () => {
    const t = new EventTarget();
    const kb = createKeyboard(t);
    key(t, 'keydown', 'KeyA');
    key(t, 'keydown', 'ArrowRight');
    expect(kb.dir().x).toBe(0);
  });

  it('releases every key when the window loses focus', () => {
    const t = new EventTarget();
    const kb = createKeyboard(t);
    key(t, 'keydown', 'KeyS');
    t.dispatchEvent(new Event('blur'));
    expect(kb.dir()).toEqual({ x: 0, y: 0 });
  });

  it('stops movement keys from scrolling the page', () => {
    const t = new EventTarget();
    createKeyboard(t);
    expect(key(t, 'keydown', 'ArrowDown').defaultPrevented).toBe(true);
    expect(key(t, 'keydown', 'KeyQ').defaultPrevented).toBe(false);
  });
});
