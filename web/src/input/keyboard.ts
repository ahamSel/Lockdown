import type { Vec } from '../game/types';

// Physical key codes, so ZQSD on AZERTY keyboards works too.
const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const UP = ['KeyW', 'ArrowUp'];
const DOWN = ['KeyS', 'ArrowDown'];
const MOVE = new Set([...LEFT, ...RIGHT, ...UP, ...DOWN]);

export interface Keyboard {
  dir(): Vec;
  dispose(): void;
}

export function createKeyboard(target: EventTarget): Keyboard {
  const held = new Set<string>();
  const onDown = (e: Event) => {
    const code = (e as KeyboardEvent).code;
    if (!MOVE.has(code)) return;
    held.add(code);
    e.preventDefault();
  };
  const onUp = (e: Event) => {
    held.delete((e as KeyboardEvent).code);
  };
  const onBlur = () => held.clear();

  target.addEventListener('keydown', onDown);
  target.addEventListener('keyup', onUp);
  target.addEventListener('blur', onBlur);

  const any = (codes: string[]) => codes.some((c) => held.has(c));
  return {
    dir() {
      const x = (any(RIGHT) ? 1 : 0) - (any(LEFT) ? 1 : 0);
      const y = (any(UP) ? 1 : 0) - (any(DOWN) ? 1 : 0);
      const m = Math.hypot(x, y);
      return m > 0 ? { x: x / m, y: y / m } : { x: 0, y: 0 };
    },
    dispose() {
      target.removeEventListener('keydown', onDown);
      target.removeEventListener('keyup', onUp);
      target.removeEventListener('blur', onBlur);
    },
  };
}
