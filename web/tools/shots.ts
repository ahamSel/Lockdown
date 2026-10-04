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

/** Logo drafts: 512×512 icons plus tiny previews side by side. */
async function logos() {
  const S = 512;
  const BLUE = CONFIG.colors.background;
  const RED = CONFIG.colors.ball;
  const GREEN = CONFIG.colors.player;
  const ball = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, sx = 1, sy = 1, rot = 0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(sx, sy);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = RED;
    ctx.fill();
    ctx.restore();
  };
  const variants: Record<string, (ctx: CanvasRenderingContext2D) => void> = {
    // A: the arena. White walls, the square in the middle, balls closing in.
    arena: (ctx) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = BLUE;
      ctx.fillRect(28, 28, S - 56, S - 56);
      ctx.fillStyle = GREEN;
      ctx.fillRect(S / 2 - 62, S / 2 - 62, 124, 124);
      ball(ctx, 118, 132, 44, 1.18, 0.85, 0.7);
      ball(ctx, 396, 150, 30, 1.18, 0.85, 2.4);
      ball(ctx, 360, 392, 52, 1.18, 0.85, -2.2);
    },
    // B: one ball about to hit. The square, a single big ball, and a white motion streak.
    nearMiss: (ctx) => {
      ctx.fillStyle = BLUE;
      ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = GREEN;
      ctx.fillRect(S / 2 - 96, S / 2 - 40, 150, 150);
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = RED;
      ctx.lineCap = 'round';
      ctx.lineWidth = 70;
      ctx.beginPath();
      ctx.moveTo(470, 40);
      ctx.lineTo(380, 130);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ball(ctx, 360, 150, 62, 1.2, 0.84, -0.78);
    },
    // C: minimal. Just the square, framed, with one small ball for scale.
    minimal: (ctx) => {
      ctx.fillStyle = BLUE;
      ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = GREEN;
      ctx.fillRect(S / 2 - 110, S / 2 - 110, 220, 220);
      ball(ctx, 408, 104, 40);
    },
  };
  for (const [name, draw] of Object.entries(variants)) {
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    draw(c.getContext('2d')!);
    await save(c, `logo-${name}.png`);
    if (name === 'arena') {
      // Home-screen icon (iOS wants a 180×180 PNG).
      const touch = document.createElement('canvas');
      touch.width = 180;
      touch.height = 180;
      const tctx = touch.getContext('2d')!;
      tctx.imageSmoothingQuality = 'high';
      tctx.drawImage(c, 0, 0, 180, 180);
      await save(touch, 'apple-touch-icon.png');
    }
  }
  // Preview sheet: each variant at 128, 48, 32 and 16 px, as it would appear in tabs and home screens.
  const sheet = document.createElement('canvas');
  const sizes = [128, 48, 32, 16];
  sheet.width = 3 * 260;
  sheet.height = 170;
  const sctx = sheet.getContext('2d')!;
  sctx.fillStyle = '#2b2b2b';
  sctx.fillRect(0, 0, sheet.width, sheet.height);
  let col = 0;
  for (const [, draw] of Object.entries(variants)) {
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    draw(c.getContext('2d')!);
    let x = col * 260 + 12;
    for (const size of sizes) {
      sctx.drawImage(c, x, 20 + (128 - size) / 2, size, size);
      x += size + 10;
    }
    col++;
  }
  await save(sheet, 'logo-previews.png');
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
  const jobs: Record<string, () => Promise<void>> = { cover, coverIcon, banner, backgroundTile, embedBackground, logos };
  for (const [name, job] of Object.entries(jobs)) if (!only || only === name) await job();
  log('done');
}
void main();
