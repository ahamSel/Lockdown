import type { Vec } from '../game/types';

export interface JoystickView {
  ax: number;
  ay: number;
  kx: number;
  ky: number;
  radius: number;
}

export interface Joystick {
  dir(): Vec;
  view(): JoystickView | null;
  setEnabled(on: boolean): void;
  dispose(): void;
}

const DEAD_ZONE = 0.08;

/**
 * Floating joystick: press anywhere on `el` to set the anchor, drag to steer.
 * Dragging past the radius pulls the anchor along so you never run out of room.
 */
export function createJoystick(el: HTMLElement, radius = 56): Joystick {
  let enabled = false;
  let pointerId: number | null = null;
  let ax = 0;
  let ay = 0;
  let kx = 0;
  let ky = 0;

  const local = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onDown = (e: PointerEvent) => {
    if (!enabled || pointerId !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerId = e.pointerId;
    const p = local(e);
    ax = kx = p.x;
    ay = ky = p.y;
    el.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    const p = local(e);
    kx = p.x;
    ky = p.y;
    const dx = kx - ax;
    const dy = ky - ay;
    const d = Math.hypot(dx, dy);
    if (d > radius) {
      ax = kx - (dx / d) * radius;
      ay = ky - (dy / d) * radius;
    }
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId === pointerId) pointerId = null;
  };

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);

  return {
    dir() {
      if (pointerId === null) return { x: 0, y: 0 };
      const dx = (kx - ax) / radius;
      const dy = (ky - ay) / radius;
      const m = Math.hypot(dx, dy);
      if (m < DEAD_ZONE) return { x: 0, y: 0 };
      const s = m > 1 ? 1 / m : 1;
      return { x: dx * s, y: -dy * s }; // screen y points down, world y points up
    },
    view() {
      if (pointerId === null) return null;
      return { ax, ay, kx, ky, radius };
    },
    setEnabled(on) {
      enabled = on;
      if (!on) pointerId = null;
    },
    dispose() {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    },
  };
}
