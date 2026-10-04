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

/** A bare canvas at DPR× resolution, for art that isn't a game scene. */
function plainCanvas(cssW: number, cssH: number) {
  const canvas = document.createElement('canvas');
  canvas.width = cssW * DPR;
  canvas.height = cssH * DPR;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.style.background = CONFIG.colors.background;
  document.body.append(canvas);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(DPR, DPR);
  return { canvas, ctx };
}

/** itch page banner: the title on a transparent background, flanked by a few balls and the player. */
async function banner() {
  const W = 960;
  const H = 210;
  const { canvas, ctx } = plainCanvas(W, H);
  const rand = prng(11);
  // Balls along both ends, kept clear of the title.
  ctx.fillStyle = CONFIG.colors.ball;
  for (let i = 0; i < 26; i++) {
    const left = i % 2 === 0;
    const x = left ? 16 + rand() * 120 : W - 20 - rand() * 120;
    const y = 18 + rand() * (H - 36);
    const r = 5 + rand() * 9;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = CONFIG.colors.player;
  ctx.fillRect(96, H * 0.4, 26, 26);
  title(canvas, W, H * 0.47, 78);
  await save(canvas, 'itch-banner.png');
}

/** Seamless page background tile: faint lighter-blue circles ("ghost balls"). */
async function backgroundTile() {
  const S = 480;
  const { canvas, ctx } = plainCanvas(S, S);
  ctx.fillStyle = CONFIG.colors.background;
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  const rand = prng(23);
  for (let i = 0; i < 22; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = 6 + rand() * 26;
    // Draw wrapped copies so the tile repeats without seams.
    for (const dx of [-S, 0, S])
      for (const dy of [-S, 0, S]) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
  }
  await save(canvas, 'itch-background.png');
}

/**
 * Shown behind itch's "Run game" button. itch draws it at its pixel size without scaling, so it is
 * rendered at 2× and then scaled to exactly the embed size (1024×576). No title: the banner has it.
 */
async function embedBackground() {
  const W = 1024;
  const H = 576;
  const s = stage(W, H);
  const rand = prng(5);
  const events: SimEvent[] = [];
  const spots: [number, number][] = [[0, -2.8], [-4.6, -2.9], [4.4, -1.9], [6.6, 0.4], [5.6, 2.6], [-6.6, -0.6], [-5.2, 2.9]];
  // Keep the middle clear for the Run game button, and keep balls off the pickups and splits.
  const keepOut = (x: number, y: number) =>
    (Math.abs(x) < 3.4 && Math.abs(y) < 1.5) || spots.some(([px, py]) => Math.hypot(x - px, y - py) < 1.1);
  scatter(s.world, 46, rand, keepOut);
  split(s.world, events, 5.6, 2.6);
  split(s.world, events, -6.6, -0.6);
  pickup(s.world, 'shield', -4.6, -2.9);
  pickup(s.world, 'fire', 4.4, -1.9);
  pickup(s.world, 'timeSlow', 6.6, 0.4);
  pickup(s.world, 'health', -5.2, 2.9);
  s.world.player.x = s.world.player.px = 0;
  s.world.player.y = s.world.player.py = -2.8;
  render(s, events);
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const octx = out.getContext('2d')!;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(s.canvas, 0, 0, W, H);
  await save(out, 'itch-embed-bg.png');
}

/**
 * Icon-style cover (like DotDodge's): logo A centred on white. itch derives the page's tab icon from a
 * 32×32 centre crop of the cover, so the logo has to sit in the middle square.
 */
async function coverIcon() {
  const W = 1260;
  const H = 1000;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  // Logo A drawn at 1000×1000 in the centre (coordinates designed on a 512 grid).
  const k = H / 512;
  ctx.save();
  ctx.translate((W - H) / 2, 0);
  ctx.scale(k, k);
  ctx.fillStyle = CONFIG.colors.background;
  ctx.fillRect(28, 28, 512 - 56, 512 - 56);
  ctx.fillStyle = CONFIG.colors.player;
  ctx.fillRect(256 - 62, 256 - 62, 124, 124);
  const ball = (x: number, y: number, r: number, rot: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(1.18, 0.85);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = CONFIG.colors.ball;
    ctx.fill();
    ctx.restore();
  };
  ball(118, 132, 44, 0.7);
  ball(396, 150, 30, 2.4);
  ball(360, 392, 52, -2.2);
  ctx.restore();
  await save(c, 'cover-icon.png');
}

async function main() {
  await document.fonts.ready;
  const only = new URLSearchParams(location.search).get('only');
  const jobs: Record<string, () => Promise<void>> = { coverIcon, banner, backgroundTile, embedBackground };
  for (const [name, job] of Object.entries(jobs)) if (!only || only === name) await job();
  log('done');
}
void main();
