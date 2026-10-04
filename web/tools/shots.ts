// Stages scenes with the real sim + renderer and saves them as PNGs (see tools/vite.config.ts).
import { CONFIG } from '../src/game/config';
import { createWorld, spawnBall } from '../src/game/sim';
import type { PowerupId, SimEvent, World } from '../src/game/types';
import { createFx } from '../src/render/fx';
import { createRenderer } from '../src/render/renderer';

const DPR = 2;
const FONT = "900 PX ui-rounded, 'SF Pro Rounded', 'Nunito', 'Segoe UI', system-ui, -apple-system, sans-serif";
const log = (msg: string) => document.getElementById('log')!.insertAdjacentHTML('beforeend', `<p>${msg}</p>`);

// The renderer sizes itself from devicePixelRatio; pin it so output is exactly DPR× the CSS size.
Object.defineProperty(window, 'devicePixelRatio', { get: () => DPR });

function stage(cssW: number, cssH: number) {
  const canvas = document.createElement('canvas');
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  document.body.append(canvas);
  const renderer = createRenderer(canvas);
  const world = createWorld({ aspect: renderer.aspect(), seed: 7 });
  world.balls = [];
  world.events = [];
  return { canvas, renderer, world, fx: createFx(false) };
}

/** Deterministic pseudo-random positions so re-runs produce the same art. */
function prng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function ball(world: World, x: number, y: number, scale: number, angle: number) {
  spawnBall(world, x, y, {
    active: true,
    scale,
    age: 5,
    vx: Math.cos(angle) * CONFIG.ball.speed,
    vy: Math.sin(angle) * CONFIG.ball.speed,
    splitTimer: 1e9,
  });
}

function pickup(world: World, kind: PowerupId, x: number, y: number) {
  world.pickups.push({ id: world.nextId++, kind, x, y, age: 2 });
}

/** A fresh split: three small children plus the pop/shard effect. */
function split(world: World, events: SimEvent[], x: number, y: number) {
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.4;
    spawnBall(world, x + Math.cos(a) * 0.16, y + Math.sin(a) * 0.16, {
      active: true,
      scale: 0.2,
      age: 0.12,
      vx: Math.cos(a) * 10,
      vy: Math.sin(a) * 10,
      splitTimer: 1e9,
    });
  }
  events.push({ type: 'split', x, y, r: 0.25 });
}

function scatter(world: World, count: number, rand: () => number, keepOut: (x: number, y: number) => boolean) {
  let placed = 0;
  while (placed < count) {
    const x = (rand() * 2 - 1) * (world.halfW - 0.6);
    const y = (rand() * 2 - 1) * (world.halfH - 0.6);
    if (keepOut(x, y)) continue;
    ball(world, x, y, 0.22 + rand() * 0.3, rand() * Math.PI * 2);
    placed++;
  }
}

function render(s: ReturnType<typeof stage>, events: SimEvent[]) {
  s.fx.handle(events, s.world);
  s.fx.update(0.09, s.world); // let shards fly a little
  for (let i = 0; i < 30; i++) s.renderer.draw(s.world, s.fx, 1, null, 1 / 60);
}

function title(canvas: HTMLCanvasElement, cssW: number, cy: number, size: number) {
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.font = FONT.replace('PX', `${size}px`);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  const words = ['Game', 'Without', 'Art'];
  const gap = size * 0.25;
  const widths = words.map((w) => ctx.measureText(w).width);
  let x = (cssW - (widths.reduce((a, b) => a + b, 0) + gap * 2)) / 2;
  let artX = 0;
  words.forEach((w, i) => {
    if (i === 2) artX = x;
    ctx.fillText(w, x, cy);
    x += widths[i] + gap;
  });
  // The red strike through "Art".
  const pad = widths[2] * 0.06;
  ctx.fillStyle = CONFIG.colors.ball;
  ctx.fillRect(artX - pad, cy - size * 0.06, widths[2] + pad * 2, size * 0.11);
}

async function save(canvas: HTMLCanvasElement, name: string) {
  const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/png'));
  const res = await fetch(`/__save?name=${name}`, { method: 'POST', body: blob });
  log(`${await res.text()} (${canvas.width}×${canvas.height})`);
}

async function cover() {
  const W = 630;
  const H = 500;
  const s = stage(W, H);
  const rand = prng(42);
  const events: SimEvent[] = [];
  // Keep the title band and the player's surroundings clear.
  const keepOut = (x: number, y: number) => (y > 1.2 && y < 3.6) || Math.hypot(x + 0.4, y + 1.6) < 1.3;
  scatter(s.world, 34, rand, keepOut);
  split(s.world, events, 2.6, -0.4);
  split(s.world, events, -3.4, -3.2);
  pickup(s.world, 'fire', -2.2, -0.6);
  pickup(s.world, 'shield', 3.9, -2.8);
  pickup(s.world, 'timeFast', 1.4, -3.5);
  s.world.player.x = s.world.player.px = -0.4;
  s.world.player.y = s.world.player.py = -1.6;
  render(s, events);
  title(s.canvas, W, H * 0.255, 62);
  await save(s.canvas, 'cover.png');
}

async function main() {
  await document.fonts.ready;
  await cover();
  log('done');
}
void main();
