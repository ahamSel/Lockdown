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
    age: 0,
    hitF: -1,
    hitX: x,
    hitY: y,
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
    ball.hitF = -1;
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
    ball.hitF = -1;
    ball.age += wdt;

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

/** Fraction of a step's travel at which an edge `gap` away from a wall reaches it. */
function contactFraction(gap: number, travel: number): number {
  if (travel <= 0 || gap <= 0) return 0;
  return Math.min(1, gap / travel);
}

/**
 * Reflects the ball off the walls. The overshoot is mirrored back (rather than parking the ball on the
 * wall) and the contact point is recorded so the renderer can draw the ball actually touching the wall.
 */
function bounceOffWalls(world: World, ball: Ball, b: Bounds): void {
  const r = ball.scale / 2;
  const mx = ball.x;
  const my = ball.y;
  let f = Infinity;
  if (mx - r < b.minX) {
    f = Math.min(f, contactFraction(ball.px - r - b.minX, ball.px - mx));
    ball.x = 2 * (b.minX + r) - mx;
    ball.vx = Math.abs(ball.vx);
  } else if (mx + r > b.maxX) {
    f = Math.min(f, contactFraction(b.maxX - (ball.px + r), mx - ball.px));
    ball.x = 2 * (b.maxX - r) - mx;
    ball.vx = -Math.abs(ball.vx);
  }
  if (my - r < b.minY) {
    f = Math.min(f, contactFraction(ball.py - r - b.minY, ball.py - my));
    ball.y = 2 * (b.minY + r) - my;
    ball.vy = Math.abs(ball.vy);
  } else if (my + r > b.maxY) {
    f = Math.min(f, contactFraction(b.maxY - (ball.py + r), my - ball.py));
    ball.y = 2 * (b.maxY - r) - my;
    ball.vy = -Math.abs(ball.vy);
  }
  if (f !== Infinity) {
    ball.hitF = f;
    ball.hitX = ball.px + (mx - ball.px) * f;
    ball.hitY = ball.py + (my - ball.py) * f;
    world.events.push({ type: 'bounce', x: ball.hitX, y: ball.hitY });
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
