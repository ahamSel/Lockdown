# Game Without Art Web Remake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the 2021 Unity game "Game Without Art" as a polished TypeScript + Canvas 2D browser game in `web/`, shippable as an itch.io HTML5 zip.

**Architecture:** A pure, DOM-free simulation (`src/game/`) steps a `World` at a fixed 60 Hz and emits typed events. Rendering (`src/render/`), effects, audio, and a DOM overlay UI consume world state and events. `main.ts` owns the loop and a small screen state machine.

**Tech Stack:** TypeScript 7, Vite 8, Vitest 5, Canvas 2D, WebAudio. No runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-03-web-remake-design.md`

## Global Constraints

- All web code lives in `web/`. Do not modify anything under `Assets/`, `Packages/`, `ProjectSettings/`, or `UserSettings/`.
- No runtime dependencies. Dev dependencies only: `typescript`, `vite`, `vitest`.
- No image or audio files ship. Visuals are shapes and flat colours; sounds are synthesised.
- Palette (exact): background `#0063ff`, walls `#ffffff`, player `#00ff05`, balls `#ff0c00`, Health `#ff00b5`, Shield `#000cff`, Time×2 `#ffe900`, Time/2 `#7f00ff`, Raze `#000000`, Fire `#ff8b00`, Shrink `#a7ff00`, Grow `#ffffff`, SpeedUp `#7f7f7f`, SlowDown `#7a3300`.
- World: 10 units across the shorter screen side, origin centre, +y up, walls 0.5 thick on the edges, fixed step 1/60 s, frame delta capped at 0.25 s.
- Ball: speed 10, seed scale 0.2, grow-in 1.6 s, growth 1/30 scale per world-second, split into 3 every 10 world-seconds, cap 729, radius = scale / 2.
- Player: 0.5 square, speed 7, HP 20, 0.6 s invulnerability after a hit.
- Powerups: start at 13 s, batches of 1–4 every 2/4/6/8/10 s, lifetime 12 s (blink last 2 s), timed effects 10 s and stacking, Time/2 = 0.5×.
- Vite `base: './'` so the build runs from any folder (itch).
- Best score and mute go through `src/storage.ts`, never raw `localStorage`.

## Review Focus

1. **Long stall or tab switch mid-run.** Expect no time jump (frame delta capped, no spiral) and the game auto-pauses. Pinned by `tests/loop.test.ts` (Task 4) plus the manual check in Task 8.
2. **Phone rotated or window resized mid-game.** Expect the player, balls, and pickups to stay inside the walls. Pinned by the `resizeWorld` test in `tests/sim.test.ts` (Task 3).
3. **`localStorage` blocked** (Safari private mode, sandboxed itch iframe). Expect the game to work normally; best score just isn't kept. Pinned by `tests/storage.test.ts` (Task 4).
4. **Keys held during alt-tab, or arrows scrolling the itch page.** Expect keys to release on blur and movement keys not to scroll the page. Pinned by `tests/keyboard.test.ts` (Task 4).
5. **Tapping HUD or menu buttons on touch.** Expect buttons to act without starting the joystick or moving the player. The joystick only listens on the canvas and is only enabled while playing. Checked manually in Task 8.

---

## File Map

| File | Responsibility |
|---|---|
| `web/package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore` | Tooling |
| `web/src/game/config.ts` | Every tuning number and base colour |
| `web/src/game/rng.ts` | Seedable RNG |
| `web/src/game/types.ts` | World, Ball, Player, Pickup, SimEvent types |
| `web/src/game/arena.ts` | World size from aspect, inner bounds, clamp |
| `web/src/game/collide.ts` | Circle vs square contact |
| `web/src/game/powerups.ts` | Powerup table, derived player stats, `applyPowerup` |
| `web/src/game/sim.ts` | `createWorld`, `step`, `resizeWorld`, `drainEvents`, balls, player, collisions |
| `web/src/game/spawner.ts` | Pickup spawning, ageing, collection |
| `web/src/loop.ts` | Fixed-step planning |
| `web/src/storage.ts` | Safe localStorage |
| `web/src/input/keyboard.ts`, `touch.ts` | Keyboard and floating joystick |
| `web/src/render/tween.ts`, `fx.ts`, `renderer.ts` | Easing and colour helpers, particles and shake, canvas drawing |
| `web/src/ui/screens.ts`, `styles.css`, `web/index.html` | DOM screens and HUD |
| `web/src/audio/sfx.ts` | Synthesised sounds |
| `web/src/main.ts` | Boot, loop, state machine |
| `web/scripts/zip-itch.mjs` | itch zip |
| `web/tests/*.test.ts` | Unit tests |

---

### Task 1: Scaffold, config, RNG

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/.gitignore`
- Create: `web/src/game/config.ts`, `web/src/game/rng.ts`
- Test: `web/tests/rng.test.ts`

**Interfaces:**
- Produces: `CONFIG` (shape below), `createRng(seed?: number): Rng` with `next()`, `range(min,max)`, `int(min,maxExclusive)`, `pick(items)`, `angle()`.

- [ ] **Step 1: Create tooling files**

`web/package.json`:
```json
{
  "name": "game-without-art",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "itch": "npm run build && node scripts/zip-itch.mjs"
  }
}
```

`web/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

`web/vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  test: { include: ['tests/**/*.test.ts'] },
});
```

`web/.gitignore`:
```
node_modules/
dist/
*.zip
```

- [ ] **Step 2: Install dev dependencies**

Run: `cd web && npm install -D typescript vite vitest`
Expected: installs without errors. If `npx tsc -v` fails or rejects the tsconfig under TypeScript 7, install `typescript@5` instead.

- [ ] **Step 3: Write `web/src/game/config.ts`**

```ts
export const CONFIG = {
  /** World units across the shorter screen side (the Unity camera's orthographic size 5). */
  shortSide: 10,
  wallThickness: 0.5,
  step: 1 / 60,
  maxFrame: 0.25,
  player: {
    size: 0.5,
    shrinkSize: 0.2,
    growSize: 0.8,
    speed: 7,
    fastSpeed: 12,
    slowSpeed: 2,
    hp: 20,
    invulnTime: 0.6,
  },
  ball: {
    speed: 10,
    seedScale: 0.2,
    growInTime: 1.6,
    growRate: 1 / 30,
    splitInterval: 10,
    splitCount: 3,
    maxBalls: 729,
    demoMaxBalls: 81,
    minSpawnDist: 3,
  },
  pickup: {
    startDelay: 13,
    intervals: [2, 4, 6, 8, 10],
    minBatch: 1,
    maxBatch: 4,
    lifetime: 12,
    blinkTime: 2,
    size: 0.55,
    minPlayerDist: 1,
    edgeMargin: 0.6,
  },
  powerup: {
    duration: 10,
    healthAmount: 5,
    razeKeep: 3,
    fastTime: 2,
    slowTime: 0.5,
  },
  score: {
    start: 1,
    perSplit: 3,
    clearBonus: 25,
  },
  colors: {
    background: '#0063ff',
    wall: '#ffffff',
    player: '#00ff05',
    ball: '#ff0c00',
  },
} as const;
```

- [ ] **Step 4: Write the failing RNG test** `web/tests/rng.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { createRng } from '../src/game/rng';

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 5; i++) expect(a.next()).toBe(b.next());
  });

  it('keeps int() inside [min, max)', () => {
    const rng = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const n = rng.int(1, 5);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThan(5);
    }
  });

  it('pick() always returns one of the items', () => {
    const rng = createRng(7);
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 100; i++) expect(items).toContain(rng.pick(items));
  });
});
```

- [ ] **Step 5: Run it to see it fail**

Run: `cd web && npx vitest run tests/rng.test.ts`
Expected: FAIL (cannot resolve `../src/game/rng`).

- [ ] **Step 6: Write `web/src/game/rng.ts`**

```ts
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  range(min: number, max: number): number;
  int(min: number, maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
  angle(): number;
}

/** mulberry32: tiny, fast, and seedable so tests are deterministic. */
export function createRng(seed = Date.now()): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, maxExclusive) => min + Math.floor(next() * (maxExclusive - min)),
    pick: (items) => items[Math.floor(next() * items.length)],
    angle: () => next() * Math.PI * 2,
  };
}
```

- [ ] **Step 7: Run the tests and typecheck**

Run: `cd web && npx vitest run && npx tsc --noEmit`
Expected: 3 tests PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add web
git commit -m "web: scaffold Vite + TS project with config and seeded RNG"
```

---

### Task 2: Types, arena, collision, powerup table

**Files:**
- Create: `web/src/game/types.ts`, `web/src/game/arena.ts`, `web/src/game/collide.ts`, `web/src/game/powerups.ts`
- Test: `web/tests/collide.test.ts`, `web/tests/powerups.test.ts`

**Interfaces:**
- Consumes: `CONFIG`, `Rng`.
- Produces:
  - Types `Vec`, `PowerupId`, `TimedPowerupId`, `Ball`, `Player`, `Pickup`, `SimEvent`, `World`, `Bounds` (below).
  - `worldHalfSize(aspect: number): { halfW: number; halfH: number }`, `bounds(world: { halfW: number; halfH: number }, inset?: number): Bounds`, `clamp(v, lo, hi): number`.
  - `circleSquare(cx, cy, r, sx, sy, half): Contact | null` where `Contact = { nx: number; ny: number; depth: number }` (normal points from square to circle).
  - `POWERUPS: Record<PowerupId, PowerupDef>`, `POWERUP_IDS`, `TIMED_IDS`, `emptyTimers()`, `playerSize(p: Player)`, `playerSpeed(p: Player)`, `worldTimeScale(p: Player)`, `activePowerups(p: Player): { id: TimedPowerupId; remaining: number }[]`, `applyPowerup(world: World, kind: PowerupId): void`.

- [ ] **Step 1: Write `web/src/game/types.ts`**

```ts
import type { Rng } from './rng';

export interface Vec {
  x: number;
  y: number;
}

export type PowerupId =
  | 'health'
  | 'shield'
  | 'fire'
  | 'timeFast'
  | 'timeSlow'
  | 'raze'
  | 'shrink'
  | 'grow'
  | 'speedUp'
  | 'slowDown';

export type TimedPowerupId = Exclude<PowerupId, 'health' | 'raze'>;

export interface Ball {
  id: number;
  x: number;
  y: number;
  /** Position at the start of the last step, for render interpolation. */
  px: number;
  py: number;
  vx: number;
  vy: number;
  /** Radius is scale / 2 (a Unity circle sprite is 1 unit across). */
  scale: number;
  /** False while the ball is growing in. */
  active: boolean;
  /** World-seconds until this ball splits. */
  splitTimer: number;
  /** Seconds since the last wall bounce, used for the squash effect. */
  bounceAge: number;
  bounceAngle: number;
}

export interface Player {
  x: number;
  y: number;
  px: number;
  py: number;
  hp: number;
  alive: boolean;
  invuln: number;
  timers: Record<TimedPowerupId, number>;
}

export interface Pickup {
  id: number;
  kind: PowerupId;
  x: number;
  y: number;
  age: number;
}

export type SimEvent =
  | { type: 'spawnBall'; x: number; y: number }
  | { type: 'split'; x: number; y: number; r: number }
  | { type: 'bounce'; x: number; y: number }
  | { type: 'hit'; x: number; y: number; hp: number }
  | { type: 'blocked'; x: number; y: number }
  | { type: 'burn'; x: number; y: number; r: number }
  | { type: 'death'; x: number; y: number }
  | { type: 'cleared'; x: number; y: number }
  | { type: 'spawnPickup'; kind: PowerupId; x: number; y: number }
  | { type: 'pickup'; kind: PowerupId; x: number; y: number }
  | { type: 'expire'; kind: PowerupId; x: number; y: number }
  | { type: 'raze'; removed: Vec[] };

export interface World {
  rng: Rng;
  /** Title-screen world: no player, no pickups, fewer balls. */
  demo: boolean;
  halfW: number;
  halfH: number;
  /** Real seconds since the world was created. */
  time: number;
  score: number;
  maxBalls: number;
  nextId: number;
  player: Player;
  balls: Ball[];
  pickups: Pickup[];
  /** Real seconds until the next pickup batch, once spawning has started. */
  pickupClock: number;
  pickupsStarted: boolean;
  events: SimEvent[];
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}
```

- [ ] **Step 2: Write `web/src/game/arena.ts`**

```ts
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
```

- [ ] **Step 3: Write the failing collision test** `web/tests/collide.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { circleSquare } from '../src/game/collide';

describe('circleSquare', () => {
  it('returns null when apart', () => {
    expect(circleSquare(1, 0, 0.1, 0, 0, 0.25)).toBeNull();
  });

  it('reports a side contact with an outward normal', () => {
    const c = circleSquare(0.3, 0, 0.1, 0, 0, 0.25)!;
    expect(c.nx).toBeCloseTo(1);
    expect(c.ny).toBeCloseTo(0);
    expect(c.depth).toBeCloseTo(0.05);
  });

  it('pushes a centre inside the square out along the shallowest axis', () => {
    const c = circleSquare(0, -0.2, 0.1, 0, 0, 0.25)!;
    expect(c.nx).toBe(0);
    expect(c.ny).toBe(-1);
    expect(c.depth).toBeCloseTo(0.15);
  });
});
```

- [ ] **Step 4: Run it to see it fail**

Run: `cd web && npx vitest run tests/collide.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 5: Write `web/src/game/collide.ts`**

```ts
export interface Contact {
  nx: number;
  ny: number;
  depth: number;
}

/** Circle (cx, cy, r) vs axis-aligned square (sx, sy, half-size). Normal points from the square to the circle. */
export function circleSquare(cx: number, cy: number, r: number, sx: number, sy: number, half: number): Contact | null {
  const qx = Math.max(sx - half, Math.min(cx, sx + half));
  const qy = Math.max(sy - half, Math.min(cy, sy + half));
  const dx = cx - qx;
  const dy = cy - qy;
  const d2 = dx * dx + dy * dy;
  if (d2 > r * r) return null;
  if (d2 > 1e-12) {
    const d = Math.sqrt(d2);
    return { nx: dx / d, ny: dy / d, depth: r - d };
  }
  // Centre is inside the square: push out along the axis of least penetration.
  const ox = half - Math.abs(cx - sx);
  const oy = half - Math.abs(cy - sy);
  if (ox < oy) return { nx: Math.sign(cx - sx) || 1, ny: 0, depth: ox + r };
  return { nx: 0, ny: Math.sign(cy - sy) || 1, depth: oy + r };
}
```

- [ ] **Step 6: Write the failing powerup-helper test** `web/tests/powerups.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/game/config';
import { activePowerups, emptyTimers, playerSize, playerSpeed, POWERUPS, worldTimeScale } from '../src/game/powerups';
import type { Player, TimedPowerupId } from '../src/game/types';

function player(timers: Partial<Record<TimedPowerupId, number>> = {}): Player {
  return { x: 0, y: 0, px: 0, py: 0, hp: 20, alive: true, invuln: 0, timers: { ...emptyTimers(), ...timers } };
}

describe('powerup table', () => {
  it('keeps the original 2021 colours', () => {
    expect(POWERUPS.health.color).toBe('#ff00b5');
    expect(POWERUPS.shield.color).toBe('#000cff');
    expect(POWERUPS.timeFast.color).toBe('#ffe900');
    expect(POWERUPS.timeSlow.color).toBe('#7f00ff');
    expect(POWERUPS.raze.color).toBe('#000000');
    expect(POWERUPS.fire.color).toBe('#ff8b00');
    expect(POWERUPS.shrink.color).toBe('#a7ff00');
    expect(POWERUPS.grow.color).toBe('#ffffff');
    expect(POWERUPS.speedUp.color).toBe('#7f7f7f');
    expect(POWERUPS.slowDown.color).toBe('#7a3300');
  });
});

describe('derived player stats', () => {
  it('size follows grow / shrink', () => {
    expect(playerSize(player())).toBe(CONFIG.player.size);
    expect(playerSize(player({ grow: 1 }))).toBe(CONFIG.player.growSize);
    expect(playerSize(player({ shrink: 1 }))).toBe(CONFIG.player.shrinkSize);
  });

  it('speed follows speed up / slow down', () => {
    expect(playerSpeed(player())).toBe(7);
    expect(playerSpeed(player({ speedUp: 1 }))).toBe(12);
    expect(playerSpeed(player({ slowDown: 1 }))).toBe(2);
  });

  it('time scale is 2 for Time×2 and 0.5 for Time÷2', () => {
    expect(worldTimeScale(player())).toBe(1);
    expect(worldTimeScale(player({ timeFast: 1 }))).toBe(2);
    expect(worldTimeScale(player({ timeSlow: 1 }))).toBe(0.5);
  });

  it('lists active powerups longest first, ties in table order', () => {
    const list = activePowerups(player({ shield: 3, grow: 7, speedUp: 7 }));
    expect(list.map((a) => a.id)).toEqual(['grow', 'speedUp', 'shield']);
  });
});
```

- [ ] **Step 7: Run it to see it fail**

Run: `cd web && npx vitest run tests/powerups.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 8: Write `web/src/game/powerups.ts`**

```ts
import { CONFIG } from './config';
import type { Player, PowerupId, TimedPowerupId, World } from './types';

export interface PowerupDef {
  id: PowerupId;
  label: string;
  color: string;
  description: string;
  timed: boolean;
  /** Collecting this powerup ends the opposite one. */
  cancels?: TimedPowerupId;
}

export const POWERUPS: Record<PowerupId, PowerupDef> = {
  health: { id: 'health', label: 'Health', color: '#ff00b5', timed: false, description: 'Adds 5 health points' },
  shield: { id: 'shield', label: 'Shield', color: '#000cff', timed: true, cancels: 'fire', description: 'Shields you from the balls' },
  fire: { id: 'fire', label: 'Fire', color: '#ff8b00', timed: true, cancels: 'shield', description: 'Destroys the balls you touch' },
  timeFast: { id: 'timeFast', label: 'Time ×2', color: '#ffe900', timed: true, cancels: 'timeSlow', description: 'Speeds up time (you are not affected)' },
  timeSlow: { id: 'timeSlow', label: 'Time ÷2', color: '#7f00ff', timed: true, cancels: 'timeFast', description: 'Slows down time (you are not affected)' },
  raze: { id: 'raze', label: 'Raze', color: '#000000', timed: false, description: 'Destroys all balls except 3' },
  shrink: { id: 'shrink', label: 'Shrink', color: '#a7ff00', timed: true, cancels: 'grow', description: 'Makes you smaller' },
  grow: { id: 'grow', label: 'Grow', color: '#ffffff', timed: true, cancels: 'shrink', description: 'Makes you bigger' },
  speedUp: { id: 'speedUp', label: 'Speed up', color: '#7f7f7f', timed: true, cancels: 'slowDown', description: 'Makes you faster' },
  slowDown: { id: 'slowDown', label: 'Slow down', color: '#7a3300', timed: true, cancels: 'speedUp', description: 'Makes you slower' },
};

export const POWERUP_IDS = Object.keys(POWERUPS) as PowerupId[];
export const TIMED_IDS = POWERUP_IDS.filter((id) => POWERUPS[id].timed) as TimedPowerupId[];

export function emptyTimers(): Record<TimedPowerupId, number> {
  return { shield: 0, fire: 0, timeFast: 0, timeSlow: 0, shrink: 0, grow: 0, speedUp: 0, slowDown: 0 };
}

export function playerSize(p: Player): number {
  if (p.timers.grow > 0) return CONFIG.player.growSize;
  if (p.timers.shrink > 0) return CONFIG.player.shrinkSize;
  return CONFIG.player.size;
}

export function playerSpeed(p: Player): number {
  if (p.timers.speedUp > 0) return CONFIG.player.fastSpeed;
  if (p.timers.slowDown > 0) return CONFIG.player.slowSpeed;
  return CONFIG.player.speed;
}

/** World time multiplier. The player always moves in real time. */
export function worldTimeScale(p: Player): number {
  if (p.timers.timeFast > 0) return CONFIG.powerup.fastTime;
  if (p.timers.timeSlow > 0) return CONFIG.powerup.slowTime;
  return 1;
}

/** Active timed powerups, longest remaining first (stable sort keeps table order on ties). */
export function activePowerups(p: Player): { id: TimedPowerupId; remaining: number }[] {
  return TIMED_IDS.filter((id) => p.timers[id] > 0)
    .map((id) => ({ id, remaining: p.timers[id] }))
    .sort((a, b) => b.remaining - a.remaining);
}

export function applyPowerup(world: World, kind: PowerupId): void {
  const p = world.player;
  if (kind === 'health') {
    p.hp += CONFIG.powerup.healthAmount;
    return;
  }
  if (kind === 'raze') {
    raze(world);
    return;
  }
  const cancels = POWERUPS[kind].cancels;
  if (cancels) p.timers[cancels] = 0;
  p.timers[kind] += CONFIG.powerup.duration;
}

function raze(world: World): void {
  const keep = CONFIG.powerup.razeKeep;
  const balls = world.balls;
  if (balls.length <= keep) return;
  // Partial Fisher–Yates so the survivors are random.
  for (let i = 0; i < keep; i++) {
    const j = world.rng.int(i, balls.length);
    [balls[i], balls[j]] = [balls[j], balls[i]];
  }
  const removed = balls.splice(keep).map((b) => ({ x: b.x, y: b.y }));
  world.events.push({ type: 'raze', removed });
}
```

- [ ] **Step 9: Run tests and typecheck**

Run: `cd web && npx vitest run && npx tsc --noEmit`
Expected: all PASS, no type errors.

- [ ] **Step 10: Commit**

```bash
git add web
git commit -m "web: add world types, arena bounds, collision and powerup table"
```

---

### Task 3: Simulation (balls, player, collisions, pickups, resize)

**Files:**
- Create: `web/src/game/sim.ts`, `web/src/game/spawner.ts`
- Test: `web/tests/helpers.ts`, `web/tests/sim.test.ts`, `web/tests/spawner.test.ts`, extend `web/tests/powerups.test.ts`

**Interfaces:**
- Consumes: everything from Task 2.
- Produces:
  - `createWorld(opts: { aspect: number; seed?: number; demo?: boolean }): World`
  - `step(world: World, input: Vec, dt: number): void`
  - `drainEvents(world: World): SimEvent[]` (returns and clears)
  - `resizeWorld(world: World, aspect: number): void`
  - `createBall(world, x, y, init?: Partial<Omit<Ball, 'id' | 'x' | 'y' | 'px' | 'py'>>): Ball` (not added), `spawnBall(...)` (added), `spawnSeedBall(world): Ball`
  - `updatePickups(world: World, dt: number): void`, `spawnPickup(world: World, kind?: PowerupId): void`

- [ ] **Step 1: Write test helpers** `web/tests/helpers.ts`

```ts
import { CONFIG } from '../src/game/config';
import { createWorld, spawnBall, step } from '../src/game/sim';
import type { Vec, World } from '../src/game/types';

export const STEP = CONFIG.step;
export const ZERO: Vec = { x: 0, y: 0 };

/**
 * A 16:9 world whose only ball is parked, motionless and never splitting, in a corner.
 * Keeping one ball around stops the "cleared all balls" rule from kicking in.
 */
export function quietWorld(seed = 1): World {
  const world = createWorld({ aspect: 16 / 9, seed });
  world.balls = [];
  world.events = [];
  spawnBall(world, world.halfW - 1, world.halfH - 1, { active: true, scale: 0.2, splitTimer: Infinity });
  return world;
}

export function run(world: World, seconds: number, input: Vec = ZERO): void {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i++) step(world, input, STEP);
}
```

- [ ] **Step 2: Write the failing simulation tests** `web/tests/sim.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { bounds } from '../src/game/arena';
import { CONFIG } from '../src/game/config';
import { createWorld, drainEvents, resizeWorld, spawnBall, step } from '../src/game/sim';
import { quietWorld, run, STEP, ZERO } from './helpers';

describe('balls', () => {
  it('seed ball spawns away from the player, grows in, then launches at full speed', () => {
    const world = createWorld({ aspect: 16 / 9, seed: 3 });
    expect(world.balls).toHaveLength(1);
    const ball = world.balls[0];
    expect(ball.active).toBe(false);
    expect(Math.hypot(ball.x, ball.y)).toBeGreaterThanOrEqual(CONFIG.ball.minSpawnDist);
    run(world, CONFIG.ball.growInTime + 0.05);
    expect(ball.active).toBe(true);
    expect(ball.scale).toBeGreaterThanOrEqual(CONFIG.ball.seedScale);
    expect(ball.scale).toBeLessThan(CONFIG.ball.seedScale + 0.01);
    expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(CONFIG.ball.speed);
  });

  it('splits into 3 fresh balls after 10 world-seconds and scores 3', () => {
    const world = createWorld({ aspect: 16 / 9, seed: 5 });
    world.balls = [];
    spawnBall(world, 3, 2, { active: true, scale: 0.2 });
    run(world, CONFIG.ball.splitInterval - 0.1);
    expect(world.balls).toHaveLength(1);
    run(world, 0.2);
    expect(world.balls).toHaveLength(3);
    for (const b of world.balls) {
      expect(b.scale).toBeCloseTo(CONFIG.ball.seedScale, 1);
      expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(CONFIG.ball.speed);
    }
    expect(world.score).toBe(CONFIG.score.start + CONFIG.score.perSplit);
    expect(drainEvents(world).some((e) => e.type === 'split')).toBe(true);
  });

  it('does not split past the cap, and stops growing while it waits', () => {
    const world = createWorld({ aspect: 16 / 9, seed: 5 });
    world.balls = [];
    world.maxBalls = 3;
    spawnBall(world, 3, 2, { active: true, scale: 0.2, splitTimer: 0.05 });
    spawnBall(world, 3, -2, { active: true, scale: 0.2, splitTimer: 0.05 });
    spawnBall(world, -3, 2, { active: true, scale: 0.2, splitTimer: 0.05 });
    run(world, 0.5);
    expect(world.balls).toHaveLength(3);
    const scale = world.balls[0].scale;
    run(world, 1);
    expect(world.balls[0].scale).toBe(scale);
  });

  it('awards no split score once the player is dead', () => {
    const world = createWorld({ aspect: 16 / 9, seed: 5 });
    world.balls = [];
    world.player.alive = false;
    spawnBall(world, 3, 2, { active: true, scale: 0.2, splitTimer: 0.05 });
    run(world, 0.1);
    expect(world.balls).toHaveLength(3);
    expect(world.score).toBe(CONFIG.score.start);
  });

  it('bounces off walls without losing speed', () => {
    const world = quietWorld();
    const b = bounds(world);
    const ball = spawnBall(world, b.maxX - 0.2, -3, { active: true, scale: 0.2, vx: 10, vy: 0 });
    run(world, 0.1);
    expect(ball.vx).toBeCloseTo(-10);
    expect(ball.x + ball.scale / 2).toBeLessThanOrEqual(b.maxX);
  });
});

describe('time scale', () => {
  it('Time×2 runs balls twice as fast', () => {
    const world = quietWorld();
    world.player.timers.timeFast = 100;
    spawnBall(world, 3, 2, { active: true, scale: 0.2 });
    run(world, 4.9);
    expect(world.balls).toHaveLength(2);
    run(world, 0.2);
    expect(world.balls).toHaveLength(4);
  });

  it('Time÷2 runs balls at half speed', () => {
    const world = quietWorld();
    world.player.timers.timeSlow = 100;
    spawnBall(world, 3, 2, { active: true, scale: 0.2 });
    run(world, 10.1);
    expect(world.balls).toHaveLength(2);
    run(world, 10);
    expect(world.balls).toHaveLength(4);
  });

  it('never changes player speed or powerup timers', () => {
    const world = quietWorld();
    world.player.timers.timeFast = 100;
    run(world, 0.5, { x: 1, y: 0 });
    expect(world.player.x).toBeCloseTo(3.5, 1);
    expect(world.player.timers.timeFast).toBeCloseTo(99.5, 1);
  });
});

describe('player', () => {
  it('normalises diagonal input', () => {
    const world = quietWorld();
    run(world, 0.5, { x: 1, y: 1 });
    expect(Math.hypot(world.player.x, world.player.y)).toBeCloseTo(3.5, 1);
  });

  it('stays inside the walls', () => {
    const world = quietWorld();
    run(world, 3, { x: 1, y: 0 });
    expect(world.player.x).toBeCloseTo(bounds(world, CONFIG.player.size / 2).maxX);
  });

  it('loses 1 HP per hit, with a short invulnerability window', () => {
    const world = quietWorld();
    const first = spawnBall(world, 0.5, 0, { active: true, scale: 0.2, vx: -10 });
    step(world, ZERO, STEP);
    expect(world.player.hp).toBe(19);
    expect(first.vx).toBeGreaterThan(0);
    expect(drainEvents(world).some((e) => e.type === 'hit')).toBe(true);

    spawnBall(world, -0.3, 0, { active: true, scale: 0.2, vx: 10 });
    step(world, ZERO, STEP);
    expect(world.player.hp).toBe(19);

    run(world, 0.7);
    spawnBall(world, 0.5, 0, { active: true, scale: 0.2, vx: -10 });
    step(world, ZERO, STEP);
    expect(world.player.hp).toBe(18);
  });

  it('Shield blocks damage', () => {
    const world = quietWorld();
    world.player.timers.shield = 10;
    spawnBall(world, 0.5, 0, { active: true, scale: 0.2, vx: -10 });
    step(world, ZERO, STEP);
    expect(world.player.hp).toBe(20);
    expect(drainEvents(world).some((e) => e.type === 'blocked')).toBe(true);
  });

  it('Fire destroys touched balls without damage', () => {
    const world = quietWorld();
    world.player.timers.fire = 10;
    spawnBall(world, 0.5, 0, { active: true, scale: 0.2, vx: -10 });
    step(world, ZERO, STEP);
    expect(world.balls).toHaveLength(1); // only the parked ball is left
    expect(world.player.hp).toBe(20);
    expect(drainEvents(world).some((e) => e.type === 'burn')).toBe(true);
  });

  it('dies at 0 HP, clears its powerups, and emits death', () => {
    const world = quietWorld();
    world.player.hp = 1;
    world.player.timers.timeFast = 5;
    spawnBall(world, 0.5, 0, { active: true, scale: 0.2, vx: -10 });
    step(world, ZERO, STEP);
    expect(world.player.alive).toBe(false);
    expect(world.player.timers.timeFast).toBe(0);
    expect(drainEvents(world).some((e) => e.type === 'death')).toBe(true);
  });
});

describe('clearing the board', () => {
  it('awards a bonus and spawns a new seed ball away from the player', () => {
    const world = createWorld({ aspect: 16 / 9, seed: 9 });
    world.balls = [];
    world.player.timers.fire = 10;
    spawnBall(world, 0.5, 0, { active: true, scale: 0.2, vx: -10 });
    step(world, ZERO, STEP);
    expect(world.balls).toHaveLength(1);
    expect(world.balls[0].active).toBe(false);
    expect(Math.hypot(world.balls[0].x - world.player.x, world.balls[0].y - world.player.y)).toBeGreaterThanOrEqual(
      CONFIG.ball.minSpawnDist,
    );
    expect(world.score).toBe(CONFIG.score.start + CONFIG.score.clearBonus);
    expect(drainEvents(world).some((e) => e.type === 'cleared')).toBe(true);
  });
});

describe('resizeWorld', () => {
  it('keeps the player and every ball inside the walls when the screen narrows', () => {
    const world = quietWorld();
    world.player.x = 8;
    spawnBall(world, 8.3, 0, { active: true, scale: 0.2 });
    resizeWorld(world, 9 / 16);
    expect(world.halfW).toBe(5);
    const pb = bounds(world, CONFIG.player.size / 2);
    expect(world.player.x).toBeLessThanOrEqual(pb.maxX);
    const b = bounds(world);
    for (const ball of world.balls) {
      expect(ball.x + ball.scale / 2).toBeLessThanOrEqual(b.maxX + 1e-9);
      expect(ball.y + ball.scale / 2).toBeLessThanOrEqual(b.maxY + 1e-9);
    }
  });
});
```

- [ ] **Step 3: Write the failing spawner tests** `web/tests/spawner.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/game/config';
import { drainEvents } from '../src/game/sim';
import { spawnPickup, updatePickups } from '../src/game/spawner';
import { quietWorld, STEP } from './helpers';

describe('pickup spawning', () => {
  it('starts 13 s in with a single pickup', () => {
    const world = quietWorld();
    world.time = CONFIG.pickup.startDelay - 0.1;
    updatePickups(world, STEP);
    expect(world.pickups).toHaveLength(0);
    world.time = CONFIG.pickup.startDelay;
    updatePickups(world, STEP);
    expect(world.pickups).toHaveLength(1);
    expect(CONFIG.pickup.intervals).toContain(world.pickupClock);
  });

  it('spawns batches of 1 to 4 when the clock runs out', () => {
    const world = quietWorld();
    world.pickupsStarted = true;
    world.pickupClock = 0.01;
    updatePickups(world, 0.02);
    expect(world.pickups.length).toBeGreaterThanOrEqual(1);
    expect(world.pickups.length).toBeLessThanOrEqual(4);
  });

  it('never spawns on top of the player', () => {
    const world = quietWorld();
    for (let i = 0; i < 50; i++) spawnPickup(world);
    for (const p of world.pickups) expect(Math.hypot(p.x, p.y)).toBeGreaterThanOrEqual(CONFIG.pickup.minPlayerDist);
  });

  it('expires uncollected pickups after 12 s', () => {
    const world = quietWorld();
    spawnPickup(world, 'health');
    drainEvents(world);
    updatePickups(world, CONFIG.pickup.lifetime);
    expect(world.pickups).toHaveLength(0);
    expect(drainEvents(world).some((e) => e.type === 'expire')).toBe(true);
  });

  it('collects a pickup the player touches', () => {
    const world = quietWorld();
    world.pickups.push({ id: 999, kind: 'shield', x: 0, y: 0, age: 0 });
    updatePickups(world, STEP);
    expect(world.pickups).toHaveLength(0);
    expect(world.player.timers.shield).toBe(CONFIG.powerup.duration);
    expect(drainEvents(world).some((e) => e.type === 'pickup' && e.kind === 'shield')).toBe(true);
  });
});
```

- [ ] **Step 4: Append the `applyPowerup` tests** to `web/tests/powerups.test.ts`

Add `applyPowerup` to the existing `../src/game/powerups` import, add `import { spawnBall } from '../src/game/sim';` and `import { quietWorld } from './helpers';`, then append:

```ts
describe('applyPowerup', () => {
  it('stacks timed powerups', () => {
    const world = quietWorld();
    applyPowerup(world, 'shield');
    applyPowerup(world, 'shield');
    expect(world.player.timers.shield).toBe(20);
  });

  it.each([
    ['shield', 'fire'],
    ['fire', 'shield'],
    ['timeFast', 'timeSlow'],
    ['timeSlow', 'timeFast'],
    ['grow', 'shrink'],
    ['shrink', 'grow'],
    ['speedUp', 'slowDown'],
    ['slowDown', 'speedUp'],
  ] as const)('%s is cancelled by %s', (first, second) => {
    const world = quietWorld();
    applyPowerup(world, first);
    applyPowerup(world, second);
    expect(world.player.timers[first]).toBe(0);
    expect(world.player.timers[second]).toBe(10);
  });

  it('Health adds 5 HP', () => {
    const world = quietWorld();
    applyPowerup(world, 'health');
    expect(world.player.hp).toBe(25);
  });

  it('Raze leaves exactly 3 balls and reports the rest', () => {
    const world = quietWorld();
    for (let i = 0; i < 9; i++) spawnBall(world, -4 + i, 3, { active: true, scale: 0.2 });
    applyPowerup(world, 'raze');
    expect(world.balls).toHaveLength(3);
    const ev = world.events.find((e) => e.type === 'raze');
    expect(ev && ev.type === 'raze' && ev.removed.length).toBe(7);
  });

  it('Raze leaves fewer than 3 balls alone', () => {
    const world = quietWorld();
    spawnBall(world, 2, 2, { active: true, scale: 0.2 });
    applyPowerup(world, 'raze');
    expect(world.balls).toHaveLength(2);
    expect(world.events.some((e) => e.type === 'raze')).toBe(false);
  });
});
```

- [ ] **Step 5: Run them to see them fail**

Run: `cd web && npx vitest run`
Expected: FAIL (cannot resolve `../src/game/sim` / `spawner`).

- [ ] **Step 6: Write `web/src/game/spawner.ts`**

```ts
import { bounds } from './arena';
import { circleSquare } from './collide';
import { CONFIG } from './config';
import { applyPowerup, playerSize, POWERUP_IDS } from './powerups';
import type { PowerupId, World } from './types';

/** Ages, expires and collects pickups, then runs the spawn schedule. Uses real time. */
export function updatePickups(world: World, dt: number): void {
  const cfg = CONFIG.pickup;
  const p = world.player;
  const half = playerSize(p) / 2;

  let write = 0;
  for (const pk of world.pickups) {
    pk.age += dt;
    if (pk.age >= cfg.lifetime) {
      world.events.push({ type: 'expire', kind: pk.kind, x: pk.x, y: pk.y });
      continue;
    }
    if (p.alive && circleSquare(pk.x, pk.y, cfg.size / 2, p.x, p.y, half)) {
      applyPowerup(world, pk.kind);
      world.events.push({ type: 'pickup', kind: pk.kind, x: pk.x, y: pk.y });
      continue;
    }
    world.pickups[write++] = pk;
  }
  world.pickups.length = write;

  if (!p.alive) return;
  if (!world.pickupsStarted) {
    if (world.time < cfg.startDelay) return;
    world.pickupsStarted = true;
    spawnPickup(world);
    world.pickupClock = world.rng.pick(cfg.intervals);
    return;
  }
  world.pickupClock -= dt;
  if (world.pickupClock > 0) return;
  const count = world.rng.int(cfg.minBatch, cfg.maxBatch + 1);
  for (let i = 0; i < count; i++) spawnPickup(world);
  world.pickupClock = world.rng.pick(cfg.intervals);
}

export function spawnPickup(world: World, kind: PowerupId = world.rng.pick(POWERUP_IDS)): void {
  const cfg = CONFIG.pickup;
  const b = bounds(world, cfg.edgeMargin);
  const p = world.player;
  let x = 0;
  let y = 0;
  for (let i = 0; i < 30; i++) {
    x = world.rng.range(b.minX, b.maxX);
    y = world.rng.range(b.minY, b.maxY);
    if (Math.hypot(x - p.x, y - p.y) >= cfg.minPlayerDist) break;
  }
  world.pickups.push({ id: world.nextId++, kind, x, y, age: 0 });
  world.events.push({ type: 'spawnPickup', kind, x, y });
}
```

- [ ] **Step 7: Write `web/src/game/sim.ts`**

```ts
import { bounds, clamp, worldHalfSize } from './arena';
import { circleSquare } from './collide';
import { CONFIG } from './config';
import { emptyTimers, playerSize, playerSpeed, TIMED_IDS, worldTimeScale } from './powerups';
import { createRng } from './rng';
import { updatePickups } from './spawner';
import type { Ball, Bounds, SimEvent, Vec, World } from './types';

export interface WorldOptions {
  aspect: number;
  seed?: number;
  demo?: boolean;
}

type BallInit = Partial<Omit<Ball, 'id' | 'x' | 'y' | 'px' | 'py'>>;

export function createWorld(opts: WorldOptions): World {
  const { halfW, halfH } = worldHalfSize(opts.aspect);
  const demo = opts.demo ?? false;
  const world: World = {
    rng: createRng(opts.seed),
    demo,
    halfW,
    halfH,
    time: 0,
    score: CONFIG.score.start,
    maxBalls: demo ? CONFIG.ball.demoMaxBalls : CONFIG.ball.maxBalls,
    nextId: 1,
    player: { x: 0, y: 0, px: 0, py: 0, hp: CONFIG.player.hp, alive: !demo, invuln: 0, timers: emptyTimers() },
    balls: [],
    pickups: [],
    pickupClock: 0,
    pickupsStarted: false,
    events: [],
  };
  spawnSeedBall(world);
  return world;
}

export function createBall(world: World, x: number, y: number, init: BallInit = {}): Ball {
  return {
    id: world.nextId++,
    x,
    y,
    px: x,
    py: y,
    vx: 0,
    vy: 0,
    scale: 0,
    active: false,
    splitTimer: CONFIG.ball.splitInterval,
    bounceAge: 1,
    bounceAngle: 0,
    ...init,
  };
}

export function spawnBall(world: World, x: number, y: number, init: BallInit = {}): Ball {
  const ball = createBall(world, x, y, init);
  world.balls.push(ball);
  return ball;
}

/** A new ball that grows in at a random spot at least minSpawnDist from the player. */
export function spawnSeedBall(world: World): Ball {
  const b = bounds(world, 0.5);
  const p = world.player;
  let x = 0;
  let y = 0;
  for (let i = 0; i < 30; i++) {
    x = world.rng.range(b.minX, b.maxX);
    y = world.rng.range(b.minY, b.maxY);
    if (Math.hypot(x - p.x, y - p.y) >= CONFIG.ball.minSpawnDist) break;
  }
  world.events.push({ type: 'spawnBall', x, y });
  return spawnBall(world, x, y);
}

export function drainEvents(world: World): SimEvent[] {
  const events = world.events;
  world.events = [];
  return events;
}

export function step(world: World, input: Vec, dt: number): void {
  world.time += dt;
  updatePlayer(world, input, dt);
  updateBalls(world, dt * worldTimeScale(world.player));
  collidePlayer(world);
  if (!world.demo && world.player.alive && world.balls.length === 0) {
    world.score += CONFIG.score.clearBonus;
    world.events.push({ type: 'cleared', x: world.player.x, y: world.player.y });
    spawnSeedBall(world);
  }
  if (!world.demo) updatePickups(world, dt);
}

export function resizeWorld(world: World, aspect: number): void {
  const { halfW, halfH } = worldHalfSize(aspect);
  world.halfW = halfW;
  world.halfH = halfH;
  clampPlayer(world);
  const p = world.player;
  p.px = p.x;
  p.py = p.y;
  const b = bounds(world);
  for (const ball of world.balls) {
    const r = ball.scale / 2;
    ball.x = ball.px = clamp(ball.x, b.minX + r, b.maxX - r);
    ball.y = ball.py = clamp(ball.y, b.minY + r, b.maxY - r);
  }
  const pb = bounds(world, CONFIG.pickup.edgeMargin);
  for (const pk of world.pickups) {
    pk.x = clamp(pk.x, pb.minX, pb.maxX);
    pk.y = clamp(pk.y, pb.minY, pb.maxY);
  }
}

function updatePlayer(world: World, input: Vec, dt: number): void {
  const p = world.player;
  p.px = p.x;
  p.py = p.y;
  if (!p.alive) return;
  for (const id of TIMED_IDS) if (p.timers[id] > 0) p.timers[id] = Math.max(0, p.timers[id] - dt);
  if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
  let ix = input.x;
  let iy = input.y;
  const mag = Math.hypot(ix, iy);
  if (mag > 1) {
    ix /= mag;
    iy /= mag;
  }
  const speed = playerSpeed(p);
  p.x += ix * speed * dt;
  p.y += iy * speed * dt;
  clampPlayer(world);
}

function clampPlayer(world: World): void {
  const p = world.player;
  const b = bounds(world, playerSize(p) / 2);
  p.x = clamp(p.x, b.minX, b.maxX);
  p.y = clamp(p.y, b.minY, b.maxY);
}

function updateBalls(world: World, wdt: number): void {
  const cfg = CONFIG.ball;
  const b = bounds(world);
  const balls = world.balls;
  const born: Ball[] = [];
  let count = balls.length;
  let write = 0;

  for (let i = 0; i < balls.length; i++) {
    const ball = balls[i];
    ball.px = ball.x;
    ball.py = ball.y;
    ball.bounceAge += wdt;

    if (!ball.active) {
      ball.scale += (cfg.seedScale / cfg.growInTime) * wdt;
      if (ball.scale >= cfg.seedScale) {
        ball.scale = cfg.seedScale;
        ball.active = true;
        const a = world.rng.angle();
        ball.vx = Math.cos(a) * cfg.speed;
        ball.vy = Math.sin(a) * cfg.speed;
      }
      balls[write++] = ball;
      continue;
    }

    ball.x += ball.vx * wdt;
    ball.y += ball.vy * wdt;
    bounceOffWalls(world, ball, b);

    if (ball.splitTimer > 0) {
      ball.splitTimer -= wdt;
      ball.scale += cfg.growRate * wdt;
    }
    // At the cap the timer stays at zero and the ball stops growing until there is room (as in 2021).
    if (ball.splitTimer <= 0 && count + cfg.splitCount - 1 <= world.maxBalls) {
      count += cfg.splitCount - 1;
      for (let k = 0; k < cfg.splitCount; k++) {
        const a = world.rng.angle();
        born.push(
          createBall(world, ball.x, ball.y, {
            scale: cfg.seedScale,
            active: true,
            vx: Math.cos(a) * cfg.speed,
            vy: Math.sin(a) * cfg.speed,
          }),
        );
      }
      if (world.player.alive) world.score += CONFIG.score.perSplit;
      world.events.push({ type: 'split', x: ball.x, y: ball.y, r: ball.scale / 2 });
      continue;
    }
    balls[write++] = ball;
  }
  balls.length = write;
  for (const nb of born) balls.push(nb);
}

function bounceOffWalls(world: World, ball: Ball, b: Bounds): void {
  const r = ball.scale / 2;
  let nx = 0;
  let ny = 0;
  if (ball.x - r < b.minX) {
    ball.x = b.minX + r;
    if (ball.vx < 0) ball.vx = -ball.vx;
    nx = 1;
  } else if (ball.x + r > b.maxX) {
    ball.x = b.maxX - r;
    if (ball.vx > 0) ball.vx = -ball.vx;
    nx = -1;
  }
  if (ball.y - r < b.minY) {
    ball.y = b.minY + r;
    if (ball.vy < 0) ball.vy = -ball.vy;
    ny = 1;
  } else if (ball.y + r > b.maxY) {
    ball.y = b.maxY - r;
    if (ball.vy > 0) ball.vy = -ball.vy;
    ny = -1;
  }
  if (nx !== 0 || ny !== 0) {
    ball.bounceAge = 0;
    ball.bounceAngle = Math.atan2(ny, nx);
    world.events.push({ type: 'bounce', x: ball.x, y: ball.y });
  }
}

function collidePlayer(world: World): void {
  const p = world.player;
  if (!p.alive) return;
  const half = playerSize(p) / 2;
  const fire = p.timers.fire > 0;
  const shield = p.timers.shield > 0;
  const balls = world.balls;
  let write = 0;

  for (let i = 0; i < balls.length; i++) {
    const ball = balls[i];
    const r = ball.scale / 2;
    const c = ball.active ? circleSquare(ball.x, ball.y, r, p.x, p.y, half) : null;
    if (!c) {
      balls[write++] = ball;
      continue;
    }
    if (fire) {
      world.events.push({ type: 'burn', x: ball.x, y: ball.y, r });
      continue;
    }
    // Push the ball out and reflect it if it is moving into the player.
    ball.x += c.nx * c.depth;
    ball.y += c.ny * c.depth;
    const dot = ball.vx * c.nx + ball.vy * c.ny;
    if (dot < 0) {
      ball.vx -= 2 * dot * c.nx;
      ball.vy -= 2 * dot * c.ny;
    }
    balls[write++] = ball;

    if (shield) {
      world.events.push({ type: 'blocked', x: ball.x, y: ball.y });
      continue;
    }
    if (p.invuln > 0 || !p.alive) continue;
    p.hp -= 1;
    p.invuln = CONFIG.player.invulnTime;
    world.events.push({ type: 'hit', x: ball.x, y: ball.y, hp: p.hp });
    if (p.hp <= 0) killPlayer(world);
  }
  balls.length = write;
}

function killPlayer(world: World): void {
  const p = world.player;
  p.alive = false;
  p.hp = 0;
  p.timers = emptyTimers();
  world.events.push({ type: 'death', x: p.x, y: p.y });
}
```

- [ ] **Step 8: Run all tests and typecheck**

Run: `cd web && npx vitest run && npx tsc --noEmit`
Expected: all PASS, no type errors. If a collision test fails, check the push-out sign in `circleSquare` before changing the test.

- [ ] **Step 9: Commit**

```bash
git add web
git commit -m "web: add fixed-step simulation with balls, player, powerups and pickups"
```

---

### Task 4: Loop planning, storage, input

**Files:**
- Create: `web/src/loop.ts`, `web/src/storage.ts`, `web/src/input/keyboard.ts`, `web/src/input/touch.ts`
- Test: `web/tests/loop.test.ts`, `web/tests/storage.test.ts`, `web/tests/keyboard.test.ts`

**Interfaces:**
- Produces:
  - `planSteps(acc: number, frameDt: number, step: number, maxFrame: number): { steps: number; acc: number; alpha: number }`
  - `readNumber(key, fallback)`, `writeNumber(key, value)`, `readBool(key, fallback)`, `writeBool(key, value)` (keys stored as `gwa.<key>`)
  - `createKeyboard(target: EventTarget): { dir(): Vec; dispose(): void }`
  - `createJoystick(el: HTMLElement, radius?: number): Joystick` with `dir(): Vec`, `view(): JoystickView | null`, `setEnabled(on: boolean)`, `dispose()`; `JoystickView = { ax: number; ay: number; kx: number; ky: number; radius: number }` in CSS pixels relative to `el`.

- [ ] **Step 1: Write the failing tests**

`web/tests/loop.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { planSteps } from '../src/loop';

const STEP = 1 / 60;

describe('planSteps', () => {
  it('runs one step per 1/60 s frame', () => {
    const p = planSteps(0, STEP, STEP, 0.25);
    expect(p.steps).toBe(1);
    expect(p.acc).toBeCloseTo(0, 9);
  });

  it('carries leftover time into the next frame', () => {
    const p = planSteps(0, 0.025, STEP, 0.25);
    expect(p.steps).toBe(1);
    expect(p.acc).toBeCloseTo(0.025 - STEP, 9);
    expect(p.alpha).toBeCloseTo((0.025 - STEP) / STEP, 6);
  });

  it('caps a long stall instead of spiralling', () => {
    expect(planSteps(0, 10, STEP, 0.25).steps).toBe(15);
  });

  it('ignores negative deltas', () => {
    expect(planSteps(0, -1, STEP, 0.25).steps).toBe(0);
  });
});
```

`web/tests/storage.test.ts`:
```ts
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
```

`web/tests/keyboard.test.ts`:
```ts
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
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd web && npx vitest run tests/loop.test.ts tests/storage.test.ts tests/keyboard.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Write `web/src/loop.ts`**

```ts
export interface StepPlan {
  steps: number;
  acc: number;
  /** How far between the last two sim states to draw, for interpolation. */
  alpha: number;
}

/** Splits a frame's delta into fixed steps. A stalled frame is capped so the sim never spirals. */
export function planSteps(acc: number, frameDt: number, step: number, maxFrame: number): StepPlan {
  let a = acc + Math.min(Math.max(frameDt, 0), maxFrame);
  const steps = Math.floor(a / step + 1e-9);
  a = Math.max(0, a - steps * step);
  return { steps, acc: a, alpha: Math.min(1, a / step) };
}
```

- [ ] **Step 4: Write `web/src/storage.ts`**

```ts
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
```

- [ ] **Step 5: Write `web/src/input/keyboard.ts`**

```ts
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
```

- [ ] **Step 6: Write `web/src/input/touch.ts`**

```ts
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
```

- [ ] **Step 7: Run all tests and typecheck**

Run: `cd web && npx vitest run && npx tsc --noEmit`
Expected: all PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add web
git commit -m "web: add fixed-step planner, safe storage, keyboard and floating joystick"
```

---

### Task 5: Rendering and effects (with a temporary harness)

**Files:**
- Create: `web/src/render/tween.ts`, `web/src/render/fx.ts`, `web/src/render/renderer.ts`
- Create (temporary, replaced in Task 8): `web/index.html`, `web/src/main.ts`

**Interfaces:**
- Consumes: sim API, powerups helpers, `JoystickView`, `planSteps`, input.
- Produces:
  - tween: `clamp01`, `lerp`, `easeOutBack`, `approach(current, target, rate, dt)`, `RGB`, `hexToRgb`, `rgbToCss(rgb, alpha?)`, `mixRgb(a, b, t)`
  - `createFx(reducedMotion: boolean): Fx` with `handle(events, world)`, `update(dt, world)`, `draw(ctx)` (world space), `shakeOffset(): Vec`, `flash(): { rgb: RGB; alpha: number }`, `reset()`
  - `createRenderer(canvas): Renderer` with `resize(): number` (returns aspect), `aspect(): number`, `draw(world, fx, alpha, joystick, dt)`

- [ ] **Step 1: Write `web/src/render/tween.ts`**

```ts
export type RGB = [number, number, number];

export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

/** Frame-rate independent exponential approach toward `target`. */
export function approach(current: number, target: number, rate: number, dt: number): number {
  return target + (current - target) * Math.exp(-rate * dt);
}

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToCss([r, g, b]: RGB, alpha = 1): string {
  return alpha >= 1
    ? `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
    : `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha})`;
}

export function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
```

- [ ] **Step 2: Write `web/src/render/fx.ts`**

```ts
import { CONFIG } from '../game/config';
import { playerSize, POWERUPS } from '../game/powerups';
import type { SimEvent, Vec, World } from '../game/types';
import { hexToRgb, type RGB } from './tween';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  round: boolean;
}

interface Ring {
  x: number;
  y: number;
  r0: number;
  r1: number;
  life: number;
  max: number;
  width: number;
  color: string;
}

export interface Fx {
  handle(events: SimEvent[], world: World): void;
  update(dt: number, world: World): void;
  /** Draws in world space: the caller sets the world transform. */
  draw(ctx: CanvasRenderingContext2D): void;
  shakeOffset(): Vec;
  flash(): { rgb: RGB; alpha: number };
  reset(): void;
}

const RED = CONFIG.colors.ball;
const GREEN = CONFIG.colors.player;
const WHITE = '#ffffff';
const EMBERS = ['#ff8b00', '#ffb000', '#ff0c00'];
const MAX_RINGS = 120;

type Range = readonly [number, number];
const pickIn = ([lo, hi]: Range) => lo + Math.random() * (hi - lo);

export function createFx(reducedMotion: boolean): Fx {
  const maxParticles = reducedMotion ? 300 : 700;
  const density = reducedMotion ? 0.5 : 1;
  let particles: Particle[] = [];
  let rings: Ring[] = [];
  let trauma = 0;
  let flashRgb: RGB = hexToRgb(RED);
  let flashAlpha = 0;
  let emberDebt = 0;

  function burst(x: number, y: number, n: number, color: string, speed: Range, life: Range, size: Range, round = false) {
    const count = Math.round(n * density);
    for (let i = 0; i < count && particles.length < maxParticles; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = pickIn(speed);
      const l = pickIn(life);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: l, max: l, size: pickIn(size), color, round });
    }
  }

  function ring(x: number, y: number, r0: number, r1: number, life: number, color: string, width = 0.04) {
    if (rings.length < MAX_RINGS) rings.push({ x, y, r0, r1, life, max: life, width, color });
  }

  function shake(amount: number) {
    if (!reducedMotion) trauma = Math.min(1, trauma + amount);
  }

  function flashWith(hex: string, alpha: number) {
    flashRgb = hexToRgb(hex);
    flashAlpha = Math.max(flashAlpha, reducedMotion ? alpha * 0.4 : alpha);
  }

  return {
    handle(events, world) {
      for (const e of events) {
        switch (e.type) {
          case 'spawnBall':
            ring(e.x, e.y, 0, 0.7, 0.5, RED);
            break;
          case 'split':
            burst(e.x, e.y, 8, RED, [2, 5], [0.25, 0.5], [0.05, 0.1], true);
            ring(e.x, e.y, e.r, e.r * 3 + 0.25, 0.25, RED, 0.03);
            break;
          case 'hit':
            shake(0.55);
            flashWith(RED, 0.4);
            burst(e.x, e.y, 10, WHITE, [2, 6], [0.2, 0.4], [0.05, 0.09]);
            break;
          case 'blocked':
            ring(e.x, e.y, 0.05, 0.35, 0.2, WHITE, 0.03);
            break;
          case 'burn':
            burst(e.x, e.y, 6, '#ff8b00', [2, 5], [0.25, 0.5], [0.05, 0.11]);
            burst(e.x, e.y, 4, RED, [1, 3], [0.2, 0.4], [0.05, 0.09]);
            ring(e.x, e.y, e.r, e.r + 0.5, 0.25, '#ff8b00', 0.05);
            break;
          case 'death':
            shake(1);
            flashWith(RED, 0.55);
            burst(e.x, e.y, 36, GREEN, [2, 9], [0.5, 1.1], [0.07, 0.16]);
            ring(e.x, e.y, 0.2, 3, 0.6, GREEN, 0.08);
            break;
          case 'cleared':
            flashWith(WHITE, 0.35);
            ring(e.x, e.y, 0.3, Math.max(world.halfW, world.halfH) * 1.5, 0.8, WHITE, 0.12);
            break;
          case 'spawnPickup':
            ring(e.x, e.y, 0, 0.6, 0.4, POWERUPS[e.kind].color);
            break;
          case 'pickup': {
            const c = POWERUPS[e.kind].color;
            ring(e.x, e.y, 0.2, 1.4, 0.45, c, 0.07);
            burst(e.x, e.y, 12, c, [2, 6], [0.3, 0.6], [0.06, 0.12]);
            break;
          }
          case 'expire':
            burst(e.x, e.y, 6, POWERUPS[e.kind].color, [0.5, 2], [0.2, 0.4], [0.04, 0.08]);
            break;
          case 'raze':
            shake(0.4);
            flashWith('#000000', 0.25);
            for (const p of e.removed.slice(0, MAX_RINGS)) {
              ring(p.x, p.y, 0.05, 0.45, 0.35, '#000000');
              burst(p.x, p.y, 2, RED, [1, 3], [0.2, 0.4], [0.04, 0.08], true);
            }
            break;
          case 'bounce':
            break;
        }
      }
    },

    update(dt, world) {
      const drag = Math.exp(-4 * dt);
      for (const p of particles) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= drag;
        p.vy *= drag;
      }
      particles = particles.filter((p) => p.life > 0);
      for (const r of rings) r.life -= dt;
      rings = rings.filter((r) => r.life > 0);
      trauma = Math.max(0, trauma - 1.8 * dt);
      flashAlpha *= Math.exp(-5 * dt);

      const pl = world.player;
      if (pl.alive && pl.timers.fire > 0) {
        emberDebt += dt * 70 * density;
        const half = playerSize(pl) / 2;
        while (emberDebt >= 1 && particles.length < maxParticles) {
          emberDebt -= 1;
          const life = 0.25 + Math.random() * 0.3;
          particles.push({
            x: pl.x + (Math.random() * 2 - 1) * half,
            y: pl.y + (Math.random() * 2 - 1) * half,
            vx: (Math.random() - 0.5) * 1.2,
            vy: 0.8 + Math.random() * 1.5,
            life,
            max: life,
            size: 0.04 + Math.random() * 0.07,
            color: EMBERS[Math.floor(Math.random() * EMBERS.length)],
            round: false,
          });
        }
        if (particles.length >= maxParticles) emberDebt = 0;
      }
    },

    draw(ctx) {
      for (const r of rings) {
        const t = 1 - r.life / r.max;
        const eased = 1 - (1 - t) ** 3;
        ctx.globalAlpha = (1 - t) * 0.9;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = r.width * (1 - t * 0.5);
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * eased, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (const p of particles) {
        const t = p.life / p.max;
        const s = p.size * (0.4 + 0.6 * t);
        ctx.globalAlpha = Math.min(1, t * 1.5);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, s / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        }
      }
      ctx.globalAlpha = 1;
    },

    shakeOffset() {
      if (trauma <= 0) return { x: 0, y: 0 };
      const m = trauma * trauma * 0.22;
      return { x: (Math.random() * 2 - 1) * m, y: (Math.random() * 2 - 1) * m };
    },

    flash() {
      return { rgb: flashRgb, alpha: flashAlpha };
    },

    reset() {
      particles = [];
      rings = [];
      trauma = 0;
      flashAlpha = 0;
      emberDebt = 0;
    },
  };
}
```

- [ ] **Step 3: Write `web/src/render/renderer.ts`**

```ts
import { CONFIG } from '../game/config';
import { activePowerups, playerSize, POWERUPS, worldTimeScale } from '../game/powerups';
import type { World } from '../game/types';
import type { JoystickView } from '../input/touch';
import type { Fx } from './fx';
import { approach, clamp01, easeOutBack, hexToRgb, lerp, mixRgb, rgbToCss, type RGB } from './tween';

const TAU = Math.PI * 2;
const SQUASH_TIME = 0.12;
const BG = hexToRgb(CONFIG.colors.background);
const WARM = hexToRgb(POWERUPS.timeFast.color);
const COOL = hexToRgb(POWERUPS.timeSlow.color);
const PLAYER = hexToRgb(CONFIG.colors.player);

export interface Renderer {
  /** Re-reads the canvas CSS size and returns the new aspect ratio. */
  resize(): number;
  aspect(): number;
  draw(world: World, fx: Fx, alpha: number, joystick: JoystickView | null, dt: number): void;
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const ctx = canvas.getContext('2d', { alpha: false })!;
  let cssW = 1;
  let cssH = 1;
  let dpr = 1;
  let tint = 0;
  let playerRgb: RGB = [...PLAYER];
  let shownSize: number = CONFIG.player.size;
  let clock = 0;

  function resize(): number {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = Math.max(1, canvas.clientWidth);
    cssH = Math.max(1, canvas.clientHeight);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    return cssW / cssH;
  }
  resize();

  function drawWalls(world: World) {
    const t = CONFIG.wallThickness / 2;
    const w = world.halfW;
    const h = world.halfH;
    ctx.fillStyle = CONFIG.colors.wall;
    ctx.fillRect(-w, -h, 2 * w, t);
    ctx.fillRect(-w, h - t, 2 * w, t);
    ctx.fillRect(-w, -h, t, 2 * h);
    ctx.fillRect(w - t, -h, t, 2 * h);
  }

  function drawPickups(world: World) {
    const cfg = CONFIG.pickup;
    for (const pk of world.pickups) {
      if (cfg.lifetime - pk.age < cfg.blinkTime && Math.floor(pk.age * 8) % 2 === 0) continue;
      const s = cfg.size * easeOutBack(clamp01(pk.age / 0.35)) * (1 + 0.06 * Math.sin(pk.age * 5));
      const h = s / (2 * Math.SQRT2); // half side of a square whose diagonal is s
      ctx.save();
      ctx.translate(pk.x, pk.y + Math.sin(pk.age * 3) * 0.05);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = POWERUPS[pk.kind].color;
      ctx.beginPath();
      ctx.roundRect(-h, -h, 2 * h, 2 * h, h * 0.35);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawBalls(world: World, alpha: number, timeScale: number) {
    ctx.fillStyle = CONFIG.colors.ball;
    if (timeScale > 1) {
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      for (const b of world.balls) {
        if (!b.active) continue;
        const x = lerp(b.px, b.x, alpha) - b.vx * 0.03;
        const y = lerp(b.py, b.y, alpha) - b.vy * 0.03;
        const r = (b.scale / 2) * 0.8;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, TAU);
      }
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    for (const b of world.balls) {
      const r = b.scale / 2;
      if (r <= 0) continue;
      const x = lerp(b.px, b.x, alpha);
      const y = lerp(b.py, b.y, alpha);
      if (b.bounceAge < SQUASH_TIME) {
        const s = 1 - 0.3 * (1 - b.bounceAge / SQUASH_TIME);
        const rx = r * s;
        const ry = r / s;
        const a = b.bounceAngle;
        ctx.moveTo(x + rx * Math.cos(a), y + rx * Math.sin(a));
        ctx.ellipse(x, y, rx, ry, a, 0, TAU);
      } else {
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, TAU);
      }
    }
    ctx.fill();
  }

  function drawPlayer(world: World, alpha: number, dt: number) {
    const p = world.player;
    if (!p.alive) return;
    const x = lerp(p.px, p.x, alpha);
    const y = lerp(p.py, p.y, alpha);
    shownSize = approach(shownSize, playerSize(p), 14, dt);
    const half = shownSize / 2;
    const active = activePowerups(p);
    const target = active.length > 0 ? hexToRgb(POWERUPS[active[0].id].color) : PLAYER;
    playerRgb = [approach(playerRgb[0], target[0], 12, dt), approach(playerRgb[1], target[1], 12, dt), approach(playerRgb[2], target[2], 12, dt)];

    // Other active powerups as outline rings, the second-longest innermost.
    ctx.lineWidth = 0.05;
    for (let i = Math.min(active.length, 4) - 1; i >= 1; i--) {
      const o = half + 0.06 + (i - 1) * 0.08;
      ctx.strokeStyle = POWERUPS[active[i].id].color;
      ctx.strokeRect(x - o, y - o, o * 2, o * 2);
    }

    const shield = p.timers.shield;
    if (shield > 0 && (shield > 2 || Math.floor(clock * 8) % 2 === 0)) {
      ctx.beginPath();
      ctx.arc(x, y, half * 1.45 + 0.25 + Math.sin(clock * 6) * 0.02, 0, TAU);
      ctx.fillStyle = 'rgba(0, 12, 255, 0.18)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 0.035;
      ctx.stroke();
    }

    ctx.globalAlpha = p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0 ? 0.3 : 1;
    ctx.fillStyle = rgbToCss(playerRgb);
    ctx.fillRect(x - half, y - half, shownSize, shownSize);
    ctx.globalAlpha = 1;
  }

  function drawJoystick(j: JoystickView) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.arc(j.ax, j.ay, j.radius, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(j.kx, j.ky, j.radius * 0.42, 0, TAU);
    ctx.fill();
  }

  function drawFlash(fx: Fx) {
    const f = fx.flash();
    if (f.alpha < 0.01) return;
    const g = ctx.createRadialGradient(cssW / 2, cssH / 2, Math.min(cssW, cssH) * 0.3, cssW / 2, cssH / 2, Math.hypot(cssW, cssH) / 2);
    g.addColorStop(0, rgbToCss(f.rgb, 0));
    g.addColorStop(1, rgbToCss(f.rgb, f.alpha));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssW, cssH);
  }

  return {
    resize,
    aspect: () => cssW / cssH,
    draw(world, fx, alpha, joystick, dt) {
      clock += dt;
      const timeScale = worldTimeScale(world.player);
      tint = approach(tint, timeScale > 1 ? 1 : timeScale < 1 ? -1 : 0, 4, dt);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = rgbToCss(mixRgb(BG, tint > 0 ? WARM : COOL, Math.abs(tint) * 0.16));
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // World space: units, +y up, origin at the centre, plus screen shake.
      const ppu = cssH / (world.halfH * 2);
      const shake = fx.shakeOffset();
      const k = ppu * dpr;
      ctx.setTransform(k, 0, 0, -k, (cssW / 2 + shake.x * ppu) * dpr, (cssH / 2 - shake.y * ppu) * dpr);
      drawWalls(world);
      drawPickups(world);
      drawBalls(world, alpha, timeScale);
      drawPlayer(world, alpha, dt);
      fx.draw(ctx);

      // Screen space (CSS pixels).
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (joystick) drawJoystick(joystick);
      drawFlash(fx);
    },
  };
}
```

- [ ] **Step 4: Write the temporary harness** `web/index.html` and `web/src/main.ts`

`web/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Game Without Art</title>
    <style>
      html, body { margin: 0; height: 100%; overflow: hidden; background: #0063ff; }
      #game { position: fixed; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
    </style>
  </head>
  <body>
    <canvas id="game"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`web/src/main.ts`:
```ts
// Temporary harness for Task 5: a playable world with no UI. Replaced in Task 8.
import { CONFIG } from './game/config';
import { createWorld, drainEvents, resizeWorld, step } from './game/sim';
import { createKeyboard } from './input/keyboard';
import { createJoystick } from './input/touch';
import { planSteps } from './loop';
import { createFx } from './render/fx';
import { createRenderer } from './render/renderer';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = createRenderer(canvas);
const fx = createFx(false);
const keyboard = createKeyboard(window);
const joystick = createJoystick(canvas);
joystick.setEnabled(true);

let world = createWorld({ aspect: renderer.aspect() });
let acc = 0;
let alpha = 0;
let last = performance.now();

window.addEventListener('resize', () => resizeWorld(world, renderer.resize()));
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR') world = createWorld({ aspect: renderer.aspect() });
});

function frame(now: number) {
  const dt = Math.min((now - last) / 1000, CONFIG.maxFrame);
  last = now;
  const kb = keyboard.dir();
  const input = kb.x !== 0 || kb.y !== 0 ? kb : joystick.dir();
  const plan = planSteps(acc, dt, CONFIG.step, CONFIG.maxFrame);
  for (let i = 0; i < plan.steps; i++) step(world, input, CONFIG.step);
  acc = plan.acc;
  alpha = plan.alpha;
  fx.handle(drainEvents(world), world);
  fx.update(dt, world);
  renderer.draw(world, fx, alpha, joystick.view(), dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

- [ ] **Step 5: Typecheck and run the harness**

Run: `cd web && npx tsc --noEmit`, then `npx vite` and open `http://localhost:5173`.
Expected: blue arena with white walls, a green square that moves with WASD/arrows and mouse drag, a red ball that grows in with a ring and then bounces with a squash, splits after 10 s with a pop and shards, powerups (rounded diamonds) from 13 s, a pickup ring and colour change, a screen shake and red edge flash on hit. No console errors.

- [ ] **Step 6: Commit**

```bash
git add web
git commit -m "web: add canvas renderer, particle/shake effects and a playable harness"
```

---

### Task 6: DOM UI (screens, HUD, styles)

**Files:**
- Replace: `web/index.html`
- Create: `web/src/ui/styles.css`, `web/src/ui/screens.ts`

**Interfaces:**
- Consumes: `POWERUPS`, `POWERUP_IDS`, `activePowerups`, `CONFIG`, `World`.
- Produces: `type ScreenName = 'title' | 'howto' | 'playing' | 'paused' | 'gameover'`, `type UIAction = 'play' | 'howto' | 'back' | 'pause' | 'resume' | 'restart' | 'menu' | 'toggleMute'`, `createUI(root: HTMLElement): UI` with `show(name)`, `onAction(handler)`, `hud(world, best)`, `pulseHp()`, `gameOver(score, best, isNewBest)`, `setBest(best)`, `setMuted(muted)`.

- [ ] **Step 1: Replace `web/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0063ff" />
    <meta name="description" content="Dodge the red balls. They keep splitting. A game with no art, just shapes." />
    <title>Game Without Art</title>
    <link
      rel="icon"
      href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%230063ff'/%3E%3Crect x='4' y='4' width='8' height='8' fill='%2300ff05'/%3E%3C/svg%3E"
    />
  </head>
  <body>
    <canvas id="game" aria-label="Game"></canvas>
    <div id="ui">
      <section class="screen" data-screen="title">
        <h1 class="title"><span>Game</span> <span>Without</span> <span class="art">Art</span></h1>
        <p class="tagline">Dodge the red balls. They keep splitting.</p>
        <div class="menu">
          <button class="primary" data-action="play">Play</button>
          <button data-action="howto">How to play</button>
        </div>
        <p class="best" data-bind="titleBest"></p>
      </section>

      <section class="screen howto" data-screen="howto">
        <h2>How to play</h2>
        <div class="scroll">
          <p class="lead">Try not to get hit by the red balls.</p>
          <p class="controls">
            <kbd>WASD</kbd> or <kbd>Arrows</kbd> to move · drag anywhere on touch screens · <kbd>Esc</kbd> pause ·
            <kbd>R</kbd> restart · <kbd>M</kbd> mute
          </p>
          <h3>Powerups <small>Timed ones last 10 seconds, and time adds up.</small></h3>
          <ul class="powerups" data-bind="powerups"></ul>
        </div>
        <button data-action="back">Back</button>
      </section>

      <section class="hud" data-screen="playing paused gameover">
        <div class="hud-left">
          <div class="hp"><span data-bind="hp">20</span><small>HP</small></div>
          <div class="balls" data-bind="balls"></div>
        </div>
        <div class="score"><span data-bind="score">1</span></div>
        <div class="hud-right">
          <div class="hud-best" data-bind="best"></div>
          <button class="icon-btn pause-btn" data-action="pause" aria-label="Pause"></button>
        </div>
        <div class="pills" data-bind="pills"></div>
      </section>

      <section class="screen overlay" data-screen="paused">
        <h2>Paused</h2>
        <div class="menu">
          <button class="primary" data-action="resume">Resume</button>
          <button data-action="restart">Restart</button>
          <button data-action="menu">Menu</button>
        </div>
      </section>

      <section class="screen overlay" data-screen="gameover">
        <h2>Game over</h2>
        <div class="final"><span data-bind="goScore">0</span></div>
        <p class="best"><span data-bind="goBest"></span> <b class="new-best" data-bind="goNew">New best!</b></p>
        <div class="menu">
          <button class="primary" data-action="restart">Retry</button>
          <button data-action="menu">Menu</button>
        </div>
      </section>

      <button class="icon-btn mute-btn" data-action="toggleMute" aria-label="Toggle sound" aria-pressed="false">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path class="speaker" d="M4 9h4l5-4v14l-5-4H4z" />
          <path class="wave" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" />
          <path class="cross" d="M16 9l6 6M22 9l-6 6" />
        </svg>
      </button>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Write `web/src/ui/styles.css`**

```css
:root {
  --blue: #0063ff;
  --white: #ffffff;
  --green: #00ff05;
  --red: #ff0c00;
  --shade: rgba(0, 24, 96, 0.32);
  --font: ui-rounded, 'SF Pro Rounded', 'Nunito', 'Segoe UI', system-ui, -apple-system, sans-serif;
  --pad: 16px;
  --ease-pop: cubic-bezier(0.2, 1.4, 0.4, 1);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body { height: 100%; overflow: hidden; background: var(--blue); overscroll-behavior: none; }

body {
  font-family: var(--font);
  color: var(--white);
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  -webkit-font-smoothing: antialiased;
}

#game { position: fixed; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }

#ui {
  position: fixed;
  inset: 0;
  pointer-events: none;
  --top: max(var(--pad), env(safe-area-inset-top));
  --right: max(var(--pad), env(safe-area-inset-right));
  --bottom: max(var(--pad), env(safe-area-inset-bottom));
  --left: max(var(--pad), env(safe-area-inset-left));
}

/* screen switching */
[data-screen] {
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.22s ease, transform 0.4s var(--ease-pop), visibility 0s linear 0.4s;
}
[data-screen].is-visible { opacity: 1; visibility: visible; transition-delay: 0s; }
[data-screen].is-visible button,
[data-screen].is-visible .scroll { pointer-events: auto; }

.screen {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22px;
  padding: var(--top) var(--right) var(--bottom) var(--left);
  text-align: center;
  transform: translateY(14px) scale(0.98);
}
.screen.is-visible { transform: none; }
.overlay { background: rgba(0, 28, 110, 0.5); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }

h2 { font-size: clamp(34px, 7vw, 60px); font-weight: 900; letter-spacing: -0.02em; }

/* title */
.title {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0 0.25em;
  font-size: clamp(44px, 10vw, 104px);
  font-weight: 900;
  letter-spacing: -0.035em;
  line-height: 0.92;
}
.title span { display: inline-block; position: relative; }
.screen.is-visible .title span { animation: drop 0.7s var(--ease-pop) both; }
.screen.is-visible .title span:nth-child(2) { animation-delay: 0.08s; }
.screen.is-visible .title span:nth-child(3) { animation-delay: 0.16s; }
.title .art::after {
  content: '';
  position: absolute;
  left: -6%;
  right: -6%;
  top: 50%;
  height: 0.11em;
  margin-top: -0.055em;
  background: var(--red);
  transform: scaleX(0);
  transform-origin: left center;
}
.screen.is-visible .title .art::after { animation: strike 0.35s 0.7s cubic-bezier(0.6, 0, 0.2, 1) forwards; }
.tagline { font-size: clamp(16px, 2.4vw, 20px); font-weight: 700; opacity: 0.85; }
.best { font-weight: 800; opacity: 0.9; min-height: 1.2em; }

/* buttons */
.menu { display: flex; flex-direction: column; gap: 12px; width: min(280px, 100%); }
button {
  font: inherit;
  font-weight: 900;
  font-size: 20px;
  letter-spacing: 0.01em;
  color: var(--white);
  background: transparent;
  border: 3px solid var(--white);
  padding: 12px 24px;
  cursor: pointer;
  transition: transform 0.15s var(--ease-pop), background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
button:hover,
button:focus-visible { background: var(--white); color: var(--blue); outline: none; transform: translateY(-2px); }
button:active { transform: scale(0.95); }
button.primary { background: var(--white); color: var(--blue); }
button.primary:hover,
button.primary:focus-visible { background: var(--green); border-color: var(--green); color: #003d0b; }

/* how to play */
.howto { justify-content: flex-start; padding-top: max(32px, var(--top)); }
.howto .scroll {
  flex: 1;
  min-height: 0;
  width: min(640px, 100%);
  overflow-y: auto;
  padding: 4px;
  text-align: left;
  -webkit-overflow-scrolling: touch;
}
.lead { font-size: 20px; font-weight: 800; margin-bottom: 8px; }
.controls { font-weight: 600; line-height: 2; opacity: 0.92; }
kbd { font: inherit; font-size: 0.85em; font-weight: 800; border: 2px solid currentColor; padding: 0 6px; }
.howto h3 { margin: 18px 0 10px; font-size: 20px; font-weight: 900; }
.howto h3 small { display: block; font-size: 14px; font-weight: 600; opacity: 0.8; }
.powerups { list-style: none; display: grid; gap: 8px; }
.powerups li {
  display: grid;
  grid-template-columns: 22px 110px 1fr;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--shade);
  font-weight: 600;
}
.powerups strong { font-weight: 900; }
.diamond,
.pill .dot {
  width: 13px;
  height: 13px;
  justify-self: center;
  background: var(--c);
  border-radius: 3px;
  transform: rotate(45deg);
  box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.55);
}
@media (max-width: 480px) {
  .powerups li { grid-template-columns: 22px 1fr; }
  .powerups li span { grid-column: 2; }
}

/* hud */
.hud { position: absolute; inset: 0; transform: translateY(-10px); }
.hud.is-visible { transform: none; }
.hud-left { position: absolute; top: var(--top); left: var(--left); }
.hp { display: flex; align-items: baseline; gap: 6px; font-size: 30px; font-weight: 900; }
.hp span { display: inline-block; }
.hp small { font-size: 14px; opacity: 0.8; }
.balls { font-size: 13px; font-weight: 700; opacity: 0.75; }
.score {
  position: absolute;
  top: var(--top);
  left: 50%;
  transform: translateX(-50%);
  font-size: clamp(40px, 7vw, 64px);
  font-weight: 900;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.score span { display: inline-block; }
.hud-right {
  position: absolute;
  top: var(--top);
  right: var(--right);
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  font-weight: 800;
}
@media (max-width: 520px) { .hud-best { display: none; } }
.pills { position: absolute; left: var(--left); bottom: var(--bottom); display: flex; flex-direction: column; gap: 6px; }
.pill {
  display: grid;
  grid-template-columns: 13px 1fr auto;
  grid-template-rows: auto 4px;
  column-gap: 9px;
  row-gap: 5px;
  align-items: center;
  min-width: 170px;
  padding: 7px 10px;
  background: var(--shade);
  font-size: 14px;
  font-weight: 800;
  animation: pill-in 0.35s var(--ease-pop) both;
}
.pill .secs { font-variant-numeric: tabular-nums; opacity: 0.85; }
.pill .bar { grid-column: 1 / -1; height: 4px; background: rgba(255, 255, 255, 0.22); overflow: hidden; }
.pill .bar > span { display: block; height: 100%; background: var(--c); transform-origin: left center; }

/* icon buttons */
.icon-btn { display: grid; place-items: center; width: 44px; height: 44px; padding: 0; }
.pause-btn::before,
.pause-btn::after { content: ''; grid-area: 1 / 1; width: 5px; height: 16px; background: currentColor; }
.pause-btn::before { transform: translateX(-5px); }
.pause-btn::after { transform: translateX(5px); }
.mute-btn { position: absolute; right: var(--right); bottom: var(--bottom); pointer-events: auto; }
.mute-btn svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: square; }
.mute-btn .speaker { fill: currentColor; stroke: none; }
.mute-btn .cross { display: none; }
.mute-btn.is-muted .wave { display: none; }
.mute-btn.is-muted .cross { display: inline; }

/* game over */
.final { font-size: clamp(72px, 16vw, 140px); font-weight: 900; line-height: 1; font-variant-numeric: tabular-nums; }
.screen.is-visible .final { animation: drop 0.6s 0.05s var(--ease-pop) both; }
.new-best { display: none; margin-left: 6px; padding: 2px 8px; background: var(--green); color: #003d0b; }
.new-best.is-on { display: inline-block; animation: pulse 0.9s ease-in-out infinite alternate; }

@keyframes drop { from { opacity: 0; transform: translateY(-40px) scale(0.9); } to { opacity: 1; transform: none; } }
@keyframes strike { to { transform: scaleX(1); } }
@keyframes pill-in { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: none; } }
@keyframes pulse { to { transform: scale(1.08); } }

@media (max-height: 520px) {
  .screen { gap: 12px; }
  .title { font-size: clamp(36px, 8vw, 72px); }
  button { padding: 8px 20px; font-size: 18px; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: Write `web/src/ui/screens.ts`**

```ts
import { CONFIG } from '../game/config';
import { activePowerups, POWERUP_IDS, POWERUPS } from '../game/powerups';
import type { TimedPowerupId, World } from '../game/types';

export type ScreenName = 'title' | 'howto' | 'playing' | 'paused' | 'gameover';
export type UIAction = 'play' | 'howto' | 'back' | 'pause' | 'resume' | 'restart' | 'menu' | 'toggleMute';

export interface UI {
  show(name: ScreenName): void;
  onAction(handler: (action: UIAction) => void): void;
  hud(world: World, best: number): void;
  pulseHp(): void;
  gameOver(score: number, best: number, isNewBest: boolean): void;
  setBest(best: number): void;
  setMuted(muted: boolean): void;
}

interface Pill {
  el: HTMLElement;
  bar: HTMLElement;
  secs: HTMLElement;
  peak: number;
}

const POP: Keyframe[] = [{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }];
const POP_TIMING: KeyframeAnimationOptions = { duration: 220, easing: 'cubic-bezier(.2,1.4,.4,1)' };
const HP_PULSE: Keyframe[] = [
  { transform: 'scale(1.5)', color: '#ff0c00' },
  { transform: 'scale(1)', color: '#ffffff' },
];

export function createUI(root: HTMLElement): UI {
  const bind = (name: string) => {
    const el = root.querySelector<HTMLElement>(`[data-bind="${name}"]`);
    if (!el) throw new Error(`missing [data-bind="${name}"]`);
    return el;
  };
  const screens = Array.from(root.querySelectorAll<HTMLElement>('[data-screen]'));
  const hp = bind('hp');
  const score = bind('score');
  const best = bind('best');
  const balls = bind('balls');
  const pills = bind('pills');
  const titleBest = bind('titleBest');
  const goScore = bind('goScore');
  const goBest = bind('goBest');
  const goNew = bind('goNew');
  const muteBtn = root.querySelector<HTMLElement>('[data-action="toggleMute"]')!;
  fillPowerupList(bind('powerups'));

  let handler: (action: UIAction) => void = () => {};
  root.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('button[data-action]');
    if (!btn) return;
    btn.blur();
    handler(btn.dataset.action as UIAction);
  });

  const shown = { hp: -1, score: -1, best: -1, balls: -1, order: '' };
  const pillEls = new Map<TimedPowerupId, Pill>();

  return {
    show(name) {
      for (const el of screens) el.classList.toggle('is-visible', el.dataset.screen!.split(' ').includes(name));
    },

    onAction(h) {
      handler = h;
    },

    hud(world, bestScore) {
      const p = world.player;
      if (p.hp !== shown.hp) {
        hp.textContent = String(p.hp);
        shown.hp = p.hp;
      }
      if (world.score !== shown.score) {
        score.textContent = String(world.score);
        if (shown.score > 0 && world.score > shown.score) score.animate(POP, POP_TIMING);
        shown.score = world.score;
      }
      if (bestScore !== shown.best) {
        best.textContent = `Best ${bestScore}`;
        shown.best = bestScore;
      }
      const n = world.balls.length;
      if (n !== shown.balls) {
        balls.textContent = `${n} ball${n === 1 ? '' : 's'}`;
        shown.balls = n;
      }

      const active = activePowerups(p);
      for (const [id, pill] of pillEls) {
        if (!active.some((a) => a.id === id)) {
          pill.el.remove();
          pillEls.delete(id);
        }
      }
      for (const a of active) {
        let pill = pillEls.get(a.id);
        if (!pill) {
          pill = makePill(a.id);
          pillEls.set(a.id, pill);
        }
        pill.peak = Math.max(pill.peak, a.remaining);
        pill.bar.style.transform = `scaleX(${a.remaining / pill.peak})`;
        const secs = String(Math.ceil(a.remaining));
        if (pill.secs.textContent !== secs) pill.secs.textContent = secs;
      }
      const order = active.map((a) => a.id).join();
      if (order !== shown.order) {
        for (const a of active) pills.appendChild(pillEls.get(a.id)!.el);
        shown.order = order;
      }
    },

    pulseHp() {
      hp.animate(HP_PULSE, { duration: 350, easing: 'cubic-bezier(.2,1.4,.4,1)' });
    },

    gameOver(finalScore, bestScore, isNewBest) {
      goScore.textContent = String(finalScore);
      goBest.textContent = `Best ${bestScore}`;
      goNew.classList.toggle('is-on', isNewBest);
    },

    setBest(bestScore) {
      titleBest.textContent = bestScore > 0 ? `Best ${bestScore}` : '';
    },

    setMuted(muted) {
      muteBtn.classList.toggle('is-muted', muted);
      muteBtn.setAttribute('aria-pressed', String(muted));
    },
  };
}

function makePill(id: TimedPowerupId): Pill {
  const def = POWERUPS[id];
  const el = document.createElement('div');
  el.className = 'pill';
  el.style.setProperty('--c', def.color);
  const dot = document.createElement('i');
  dot.className = 'dot';
  const label = document.createElement('span');
  label.textContent = def.label;
  const secs = document.createElement('b');
  secs.className = 'secs';
  const bar = document.createElement('span');
  bar.className = 'bar';
  const fill = document.createElement('span');
  bar.append(fill);
  el.append(dot, label, secs, bar);
  return { el, bar: fill, secs, peak: 0 };
}

function fillPowerupList(list: HTMLElement) {
  for (const id of POWERUP_IDS) {
    const def = POWERUPS[id];
    const li = document.createElement('li');
    const dot = document.createElement('i');
    dot.className = 'diamond';
    dot.style.setProperty('--c', def.color);
    const name = document.createElement('strong');
    name.textContent = def.label;
    const desc = document.createElement('span');
    desc.textContent = def.timed ? `${def.description} · ${CONFIG.powerup.duration} s` : def.description;
    li.append(dot, name, desc);
    list.append(li);
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: no errors. The UI isn't wired yet; it is verified visually in Task 8.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "web: add DOM screens, HUD with powerup pills, and styles"
```

---

### Task 7: Synthesised sound

**Files:**
- Create: `web/src/audio/sfx.ts`

**Interfaces:**
- Produces: `type SfxName = 'split' | 'bounce' | 'hit' | 'blocked' | 'burn' | 'pickup' | 'expire' | 'death' | 'cleared' | 'spawn' | 'click'`, `createSfx(): Sfx` with `unlock()`, `play(name, variant?)`, `setMuted(muted)`.

- [ ] **Step 1: Write `web/src/audio/sfx.ts`**

```ts
export type SfxName = 'split' | 'bounce' | 'hit' | 'blocked' | 'burn' | 'pickup' | 'expire' | 'death' | 'cleared' | 'spawn' | 'click';

export interface Sfx {
  /** Call from a user gesture: browsers only allow audio after one. */
  unlock(): void;
  play(name: SfxName, variant?: number): void;
  setMuted(muted: boolean): void;
}

const MASTER_VOLUME = 0.6;
/** Minimum seconds between plays, so 700 splitting balls don't become noise. */
const MIN_GAP: Partial<Record<SfxName, number>> = { split: 0.035, bounce: 0.06, blocked: 0.08, burn: 0.03, spawn: 0.1 };

export function createSfx(): Sfx {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let muted = false;
  const lastPlayed = new Map<SfxName, number>();

  function tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0) {
    if (!ctx || !master) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  return {
    unlock() {
      if (!ctx) {
        try {
          const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          ctx = new Ctor();
          master = ctx.createGain();
          master.gain.value = muted ? 0 : MASTER_VOLUME;
          master.connect(ctx.destination);
        } catch {
          ctx = null; // no audio support: play() becomes a no-op
          return;
        }
      }
      if (ctx.state === 'suspended') void ctx.resume();
    },

    play(name, variant = 0) {
      if (!ctx || muted) return;
      const now = ctx.currentTime;
      const gap = MIN_GAP[name];
      if (gap !== undefined && now - (lastPlayed.get(name) ?? -Infinity) < gap) return;
      lastPlayed.set(name, now);
      switch (name) {
        case 'split':
          tone('triangle', 520 + Math.random() * 180, 300, 0.09, 0.05);
          break;
        case 'bounce':
          tone('sine', 900, 700, 0.03, 0.012);
          break;
        case 'hit':
          tone('square', 220, 70, 0.22, 0.1);
          tone('sawtooth', 110, 50, 0.25, 0.05);
          break;
        case 'blocked':
          tone('sine', 1200, 900, 0.06, 0.04);
          break;
        case 'burn':
          tone('sawtooth', 380, 90, 0.12, 0.05);
          break;
        case 'pickup': {
          const base = 440 * 2 ** (variant / 12);
          tone('sine', base, base, 0.09, 0.09);
          tone('sine', base * 1.5, base * 1.5, 0.14, 0.08, 0.07);
          break;
        }
        case 'expire':
          tone('sine', 500, 250, 0.12, 0.03);
          break;
        case 'death':
          tone('sawtooth', 420, 50, 0.7, 0.1);
          tone('square', 210, 40, 0.8, 0.04);
          break;
        case 'cleared':
          [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.15, 0.08, i * 0.08));
          break;
        case 'spawn':
          tone('sine', 200, 400, 0.25, 0.04);
          break;
        case 'click':
          tone('triangle', 700, 600, 0.04, 0.05);
          break;
      }
    },

    setMuted(m) {
      muted = m;
      if (master && ctx) master.gain.setTargetAtTime(m ? 0 : MASTER_VOLUME, ctx.currentTime, 0.02);
    },
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web
git commit -m "web: add synthesised sound effects"
```

---

### Task 8: Wire everything in `main.ts` and play-test

**Files:**
- Replace: `web/src/main.ts`

**Interfaces:**
- Consumes: every module above.

- [ ] **Step 1: Replace `web/src/main.ts`**

```ts
import './ui/styles.css';
import { createSfx } from './audio/sfx';
import { CONFIG } from './game/config';
import { POWERUP_IDS } from './game/powerups';
import { createWorld, drainEvents, resizeWorld, step } from './game/sim';
import type { SimEvent, Vec, World } from './game/types';
import { createKeyboard } from './input/keyboard';
import { createJoystick } from './input/touch';
import { planSteps } from './loop';
import { createFx } from './render/fx';
import { createRenderer } from './render/renderer';
import { readBool, readNumber, writeBool, writeNumber } from './storage';
import { createUI, type ScreenName, type UIAction } from './ui/screens';

const ZERO: Vec = { x: 0, y: 0 };
const GAME_OVER_DELAY = 1.2;

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = createUI(document.getElementById('ui')!);
const renderer = createRenderer(canvas);
const fx = createFx(matchMedia('(prefers-reduced-motion: reduce)').matches);
const keyboard = createKeyboard(window);
const joystick = createJoystick(canvas);
const sfx = createSfx();

let screen: ScreenName = 'title';
let world: World = createWorld({ aspect: renderer.aspect(), demo: true });
let best = readNumber('best', 0);
let muted = readBool('muted', false);
let acc = 0;
let alpha = 0;
let last = performance.now();
let gameOverIn = -1;

if (import.meta.env.DEV) {
  (window as unknown as { gwa: unknown }).gwa = { world: () => world };
}

function setScreen(next: ScreenName) {
  screen = next;
  ui.show(next);
  joystick.setEnabled(next === 'playing');
}

function saveBest() {
  if (!world.demo && world.score > best) {
    best = world.score;
    writeNumber('best', best);
  }
}

function startGame() {
  saveBest();
  world = createWorld({ aspect: renderer.aspect() });
  acc = 0;
  gameOverIn = -1;
  fx.reset();
  setScreen('playing');
}

function toMenu() {
  saveBest();
  world = createWorld({ aspect: renderer.aspect(), demo: true });
  gameOverIn = -1;
  fx.reset();
  ui.setBest(best);
  setScreen('title');
}

function pause() {
  if (screen !== 'playing') return;
  saveBest();
  setScreen('paused');
}

function resume() {
  if (screen !== 'paused') return;
  last = performance.now();
  setScreen('playing');
}

function showGameOver() {
  const isNewBest = world.score > best;
  saveBest();
  ui.gameOver(world.score, best, isNewBest);
  setScreen('gameover');
}

function toggleMute() {
  muted = !muted;
  sfx.setMuted(muted);
  ui.setMuted(muted);
  writeBool('muted', muted);
}

function act(action: UIAction) {
  sfx.unlock();
  sfx.play('click');
  switch (action) {
    case 'play':
    case 'restart':
      startGame();
      break;
    case 'howto':
      setScreen('howto');
      break;
    case 'back':
      setScreen('title');
      break;
    case 'menu':
      toMenu();
      break;
    case 'pause':
      pause();
      break;
    case 'resume':
      resume();
      break;
    case 'toggleMute':
      toggleMute();
      break;
  }
}

function handleEvents(events: SimEvent[]) {
  if (events.length === 0) return;
  fx.handle(events, world);
  if (world.demo) return; // the title screen stays quiet
  for (const e of events) {
    switch (e.type) {
      case 'split':
        sfx.play('split');
        break;
      case 'bounce':
        if (world.balls.length <= 27) sfx.play('bounce');
        break;
      case 'hit':
        sfx.play('hit');
        ui.pulseHp();
        break;
      case 'blocked':
        sfx.play('blocked');
        break;
      case 'burn':
        sfx.play('burn');
        break;
      case 'pickup':
        sfx.play('pickup', POWERUP_IDS.indexOf(e.kind) * 2);
        break;
      case 'expire':
        sfx.play('expire');
        break;
      case 'spawnBall':
        sfx.play('spawn');
        break;
      case 'cleared':
        sfx.play('cleared');
        break;
      case 'death':
        sfx.play('death');
        gameOverIn = GAME_OVER_DELAY;
        break;
      case 'raze':
      case 'spawnPickup':
        break;
    }
  }
}

function currentInput(): Vec {
  if (screen !== 'playing') return ZERO;
  const kb = keyboard.dir();
  return kb.x !== 0 || kb.y !== 0 ? kb : joystick.dir();
}

function frame(now: number) {
  const frameDt = Math.min((now - last) / 1000, CONFIG.maxFrame);
  last = now;
  const running = screen !== 'paused';
  if (running) {
    const input = currentInput();
    const plan = planSteps(acc, frameDt, CONFIG.step, CONFIG.maxFrame);
    for (let i = 0; i < plan.steps; i++) step(world, input, CONFIG.step);
    acc = plan.acc;
    alpha = plan.alpha;
    handleEvents(drainEvents(world));
    fx.update(frameDt, world);
    if (gameOverIn > 0) {
      gameOverIn -= frameDt;
      if (gameOverIn <= 0) showGameOver();
    }
  }
  if (!world.demo) ui.hud(world, Math.max(best, world.score));
  renderer.draw(world, fx, alpha, screen === 'playing' ? joystick.view() : null, running ? frameDt : 0);
  requestAnimationFrame(frame);
}

ui.onAction(act);
window.addEventListener('keydown', (e) => {
  sfx.unlock();
  if (e.repeat) return;
  const onButton = (e.target as Element | null)?.closest?.('button');
  switch (e.code) {
    case 'Escape':
    case 'KeyP':
      if (screen === 'playing') pause();
      else if (screen === 'paused') resume();
      else if (screen === 'howto') setScreen('title');
      break;
    case 'KeyR':
      if (screen === 'playing' || screen === 'paused' || screen === 'gameover') startGame();
      break;
    case 'Enter':
    case 'Space':
      if (onButton) return; // the button's own click handles it
      e.preventDefault();
      if (screen === 'title' || screen === 'gameover') startGame();
      else if (screen === 'paused') resume();
      break;
    case 'KeyM':
      toggleMute();
      break;
  }
});
window.addEventListener('pointerdown', () => sfx.unlock());
window.addEventListener('resize', () => resizeWorld(world, renderer.resize()));
window.addEventListener('blur', pause);
window.addEventListener('pagehide', saveBest);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});

sfx.setMuted(muted);
ui.setMuted(muted);
ui.setBest(best);
setScreen('title');
requestAnimationFrame(frame);
```

- [ ] **Step 2: Typecheck, test, build**

Run: `cd web && npx tsc --noEmit && npx vitest run && npx vite build`
Expected: no type errors, all tests PASS, `dist/` contains `index.html` with relative `./assets/...` paths.

- [ ] **Step 3: Play-test in the browser (desktop 1280×800)**

Run `npx vite` and open it in the browser pane. Check each item:
1. The title animates in, with "Art" struck through in red. Demo balls bounce behind it. The title screen makes no sound.
2. How to play lists 10 powerups with the right colours; Back and Esc both return.
3. Play: HUD shows HP 20, score 1, ball count, best, pause button. The player moves with WASD and arrows, and diagonals aren't faster.
4. After 10 s the ball splits: shard pop, split sound, score pops to 4.
5. After 13 s powerups appear and blink before expiring. Collecting one shows a ring burst, a pill with a draining bar, and the player changes colour. A second powerup adds a ring around the player.
6. Shield shows a bubble; Fire leaves an ember trail and burns balls; Time×2 tints the background warmer and adds trails; Time÷2 tints it cooler.
7. A hit shakes the screen, flashes red at the edges, pulses the HP counter, and makes the player blink.
8. Esc pauses and resumes. Switching tabs auto-pauses. M and the mute button toggle sound, and the setting survives a reload.
9. Dying shows a green burst, then the game-over screen after about 1 s, with a "New best!" badge on the first run. Retry and R both restart. Menu returns to the title, which shows the best score.
10. With `gwa.world()` in the console, set every ball's `splitTimer = 0` repeatedly until there are 729 balls. The game stays smooth and doesn't split further.

- [ ] **Step 4: Play-test on a phone-sized viewport (375×812)**

1. Portrait arena is tall, and the HUD doesn't overlap (best score is hidden on narrow screens).
2. Dragging anywhere shows the floating joystick and moves the player. Dragging past the ring pulls the anchor along.
3. Tapping the pause and mute buttons does not start the joystick or move the player (Review Focus 5).
4. Resizing or rotating mid-game keeps everything inside the walls (Review Focus 2).

- [ ] **Step 5: Fix any issues found, re-run tests, then commit**

```bash
git add web
git commit -m "web: wire game loop, screens, input, audio and effects together"
```

---

### Task 9: itch packaging and README

**Files:**
- Create: `web/scripts/zip-itch.mjs`
- Modify: `README.md`

- [ ] **Step 1: Write `web/scripts/zip-itch.mjs`**

```js
// Zips dist/ into game-without-art.zip for upload to itch.io as an HTML5 game.
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const out = join(root, 'game-without-art.zip');

if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/index.html is missing. Run `npm run build` first.');
  process.exit(1);
}
rmSync(out, { force: true });
execFileSync('zip', ['-r', '-X', '-q', out, '.'], { cwd: dist, stdio: 'inherit' });
console.log(`Wrote ${out}`);
```

- [ ] **Step 2: Build the zip and inspect it**

Run: `cd web && npm run itch && unzip -l game-without-art.zip`
Expected: `index.html` at the zip root plus `assets/*.js` and `assets/*.css`. No image or audio files.

- [ ] **Step 3: Check the built game from a sub-path**

Run: `cd web && npx vite preview --base /sub/`, open `http://localhost:4173/sub/`, and confirm the game loads and plays (relative paths work, as they must on itch).

- [ ] **Step 4: Update `README.md`**

Replace the file with:

~~~markdown
# Game Without Art

Dodge the red balls. They keep splitting.

### [Play it on itch.io](https://aaess.itch.io/game-without-art)

https://github.com/ahamSel/Lockdown/assets/77988808/984e7b93-2480-4ed0-ae68-5b8f87646c1e

## Web version (2026)

The game was rebuilt for the browser in TypeScript and Canvas 2D. It's in [`web/`](web).

```bash
cd web
npm install
npm run dev      # play locally at http://localhost:5173
npm test         # simulation tests
npm run itch     # build + zip for itch.io (web/game-without-art.zip)
```

To publish, upload `web/game-without-art.zip` to the itch page as an HTML5 game ("This file will be played in the browser"). A viewport around 960×600 with fullscreen enabled works well; mobile-friendly can be ticked.

## Original Unity version (2021)

The rest of this repo is the original Unity 2020.3 project, made during lockdown, kept as it was.
~~~

- [ ] **Step 5: Final verification**

Run: `cd web && npx tsc --noEmit && npx vitest run && npm run itch`
Expected: all green and the zip is written. `git status` shows no changes under `Assets/`, `Packages/`, `ProjectSettings/`, or `UserSettings/`.

- [ ] **Step 6: Commit**

```bash
git add web/scripts README.md
git commit -m "web: add itch.io packaging and document the web version"
```
