// Plans a real Game Without Art run for the README preview: the actual sim and rules, searched ahead so the square
// dodges, goes for powerups and lasts as long as it can. Open /tools/capture/plan.html?aspect=<game aspect> on the
// tools server; it saves tools/capture/<name>.json, which the game replays with ?replay=<name> (dev only).
import { encodeDir, REPLAY_DIRS, replayInput } from '../../src/dev/replay';
import { CONFIG } from '../../src/game/config';
import { playerSize } from '../../src/game/powerups';
import { createWorld, drainEvents, step } from '../../src/game/sim';
import type { PowerupId, World } from '../../src/game/types';

const params = new URLSearchParams(location.search);
const NAME = params.get('name') ?? 'run';
const SEED = Number(params.get('seed') ?? 2021);
const ASPECT = Number(params.get('aspect') ?? 1.6);
/** Stop planning here even if the square is still alive. */
const MAX_TIME = Number(params.get('max') ?? 150);

const CHUNK = 6; // steps per decision (0.1 s)
const HORIZON = 8; // chunks looked ahead
const ROLLOUTS = 3;
const MAX_BACKTRACKS = 80;

/** What each powerup is worth to grab: the showy, helpful ones most; the ones that hurt, less than nothing. */
const PICKUP_VALUE: Record<PowerupId, number> = {
  fire: 260,
  raze: 240,
  shield: 220,
  timeSlow: 180,
  health: 160,
  shrink: 120,
  speedUp: 90,
  timeFast: 20,
  grow: -60,
  slowDown: -80,
};

const log = (msg: string) => document.getElementById('log')!.insertAdjacentHTML('beforeend', `<div>${msg}</div>`);

function clone(w: World): World {
  const { rng, ...rest } = w;
  const c = structuredClone(rest) as World;
  c.rng = rng.fork();
  return c;
}

interface Tally {
  hits: number;
  pickups: number;
  burns: number;
}

function advance(w: World, dir: number, t: Tally): void {
  step(w, replayInput({ dirs: encodeDir(dir) }, 0), CONFIG.step);
  for (const e of drainEvents(w)) {
    if (e.type === 'hit') t.hits++;
    else if (e.type === 'pickup') t.pickups += PICKUP_VALUE[e.kind];
    else if (e.type === 'burn') t.burns++;
  }
}

/** Distance from the square's edge to the nearest active ball (ignored while shielded or on fire). */
function clearance(w: World): number {
  const p = w.player;
  if (p.timers.shield > 0 || p.timers.fire > 0) return 2;
  const half = playerSize(p) / 2;
  let c = 2;
  for (const b of w.balls) {
    if (!b.active) continue;
    const d = Math.hypot(b.x - p.x, b.y - p.y) - b.scale / 2 - half;
    if (d < c) c = d;
  }
  return c;
}

/** Pull toward the best pickup on the field (worth more when close), or toward balls while on fire. */
function lure(w: World): number {
  const p = w.player;
  let best = 0;
  for (const k of w.pickups) {
    const v = PICKUP_VALUE[k.kind];
    if (v <= 0) continue;
    best = Math.max(best, v / (1 + Math.hypot(k.x - p.x, k.y - p.y)));
  }
  if (p.timers.fire > 0.5) {
    let near = 99;
    for (const b of w.balls) if (b.active) near = Math.min(near, Math.hypot(b.x - p.x, b.y - p.y));
    best = Math.max(best, 120 / (1 + near));
  }
  return best;
}

const angleGap = (a: number, b: number) => {
  if (a < 0 || b < 0) return a === b ? 0 : 2;
  const d = Math.abs(a - b) % REPLAY_DIRS;
  return Math.min(d, REPLAY_DIRS - d);
};

let seed = SEED >>> 0;
function rand() {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function nextDir(prev: number): number {
  const r = rand();
  if (prev < 0) return r < 0.4 ? -1 : Math.floor(rand() * REPLAY_DIRS);
  if (r < 0.5) return prev;
  if (r < 0.85) return (prev + (rand() < 0.5 ? 1 : -1) + REPLAY_DIRS) % REPLAY_DIRS;
  return (prev + (rand() < 0.5 ? 4 : -4) + REPLAY_DIRS) % REPLAY_DIRS;
}

function score(w: World, t: Tally, steps: number, minC: number): number {
  const dead = !w.player.alive;
  return (
    (dead ? -100000 + steps * 50 : 0) -
    t.hits * 400 +
    t.pickups +
    t.burns * 12 +
    Math.min(minC, 1.2) * 60 +
    lure(w) * 2
  );
}

function evaluate(w: World, first: number, last: number): number {
  const a = clone(w);
  const t: Tally = { hits: 0, pickups: 0, burns: 0 };
  let minC = 9;
  for (let i = 0; i < CHUNK; i++) {
    advance(a, first, t);
    minC = Math.min(minC, clearance(a));
    if (!a.player.alive) return score(a, t, i, minC);
  }
  let best = -Infinity;
  for (let r = 0; r < ROLLOUTS; r++) {
    const b = clone(a);
    const bt = { ...t };
    let prev = first;
    let m = minC;
    let steps = CHUNK;
    outer: for (let k = 0; k < HORIZON; k++) {
      prev = r === 0 ? first : nextDir(prev); // one future keeps going straight
      for (let i = 0; i < CHUNK; i++) {
        advance(b, prev, bt);
        steps++;
        m = Math.min(m, clearance(b));
        if (!b.player.alive) break outer;
      }
    }
    best = Math.max(best, score(b, bt, steps, m));
  }
  return best - angleGap(first, last) * 14;
}

async function main() {
  const t0 = performance.now();
  let w = createWorld({ aspect: ASPECT, seed: SEED });
  let dirs = '';
  let last = -1;
  const history: { w: World; dirs: string; last: number }[] = [];
  const banned = new Map<number, Set<number>>();
  let backtracks = 0;
  const candidates = [-1, ...Array.from({ length: REPLAY_DIRS }, (_, i) => i)];
  const tally: Tally = { hits: 0, pickups: 0, burns: 0 };

  while (w.player.alive && w.time < MAX_TIME) {
    const chunkIndex = history.length;
    history.push({ w: clone(w), dirs, last });
    const ban = banned.get(chunkIndex);
    let bestDir = -1;
    let bestScore = -Infinity;
    for (const d of candidates) {
      if (ban?.has(d)) continue;
      const sc = evaluate(w, d, last);
      if (sc > bestScore) {
        bestScore = sc;
        bestDir = d;
      }
    }
    for (let i = 0; i < CHUNK && w.player.alive; i++) {
      advance(w, bestDir, tally);
      dirs += encodeDir(bestDir);
    }
    last = bestDir;
    if (!w.player.alive && backtracks < MAX_BACKTRACKS) {
      backtracks++;
      const back = Math.max(0, chunkIndex - 5 - Math.floor(rand() * 10));
      const h = history[back];
      const chosen = dirs.charCodeAt(h.dirs.length) - 97;
      history.length = back;
      if (!banned.has(back)) banned.set(back, new Set());
      banned.get(back)!.add(chosen >= 0 && chosen < REPLAY_DIRS ? chosen : -1);
      for (const k of [...banned.keys()]) if (k > back) banned.delete(k);
      w = clone(h.w);
      dirs = h.dirs;
      last = h.last;
      log(`died at ${w.time.toFixed(1)} s, back to chunk ${back} (backtrack ${backtracks})`);
    }
    if (chunkIndex % 40 === 0) {
      log(`t=${w.time.toFixed(1)} s, ${w.balls.length} balls, hp ${w.player.hp}, ${((performance.now() - t0) / 1000).toFixed(0)} s planning`);
      await new Promise((r) => setTimeout(r));
    }
  }
  const replay = { seed: SEED, aspect: ASPECT, dirs };
  const res = await fetch(`/__save?dir=capture&name=${NAME}.json`, { method: 'POST', body: JSON.stringify(replay) });
  log(`${await res.text()}: ${dirs.length} steps (${(dirs.length / 60).toFixed(1)} s), alive ${w.player.alive}, ${backtracks} backtracks`);
  log('done');
}

main().catch((e) => log(`error: ${e.message}`));
