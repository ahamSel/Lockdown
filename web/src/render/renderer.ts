import { bounds } from '../game/arena';
import { CONFIG } from '../game/config';
import { activePowerups, playerSize, POWERUPS, worldTimeScale } from '../game/powerups';
import type { SimEvent, Vec, World } from '../game/types';
import type { JoystickView } from '../input/touch';
import { ballPose, ballPosition } from './ballpose';
import type { Fx } from './fx';
import { createPlayerMotion } from './playermotion';
import { roundedSquare } from './shapes';
import { approach, clamp01, easeOutBack, hexToRgb, lerp, mixRgb, rgbToCss, type RGB } from './tween';

const TAU = Math.PI * 2;
const BG = hexToRgb(CONFIG.colors.background);
// Time tints stay in the blue family: mixing in the yellow/purple powerup colours turns the field grey.
const FAST_BG = hexToRgb('#1f8bff');
const SLOW_BG = hexToRgb('#2a2fd6');
const PLAYER = hexToRgb(CONFIG.colors.player);
const WHITE: RGB = [255, 255, 255];
/** Seconds between afterimage samples, and how many to keep. */
const TRAIL_EVERY = 0.03;
const TRAIL_LEN = 4;
const TRAIL_LEN_FAST = 6;

export interface Renderer {
  /** Re-reads the canvas CSS size and returns the new aspect ratio. */
  resize(): number;
  aspect(): number;
  draw(world: World, fx: Fx, alpha: number, joystick: JoystickView | null, dt: number): void;
  /** Sim events that drive renderer-side animation (the player's hit squash). */
  onEvents(events: SimEvent[], world: World): void;
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
  const motion = createPlayerMotion();
  let trail: Vec[] = [];
  let trailClock = 0;
  let lastWorld: World | null = null;

  /** A new run starts from a clean slate (no colour, size or motion left over from the last one). */
  function syncWorld(world: World) {
    if (world === lastWorld) return;
    lastWorld = world;
    motion.reset();
    trail = [];
    trailClock = 0;
    playerRgb = [...PLAYER];
    shownSize = playerSize(world.player);
  }

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
      roundedSquare(ctx, h, h * 0.35);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawBalls(world: World, alpha: number, timeScale: number) {
    if (timeScale > 1) {
      // Motion streaks: a short round-capped stroke behind each ball.
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = CONFIG.colors.ball;
      ctx.lineCap = 'round';
      for (const b of world.balls) {
        if (!b.active) continue;
        const p = ballPosition(b, alpha);
        ctx.lineWidth = b.scale * 0.8;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - b.vx * 0.045, p.y - b.vy * 0.045);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    const inner = bounds(world);
    ctx.fillStyle = CONFIG.colors.ball;
    ctx.beginPath();
    for (const b of world.balls) {
      const pose = ballPose(b, alpha, inner, CONFIG.step * timeScale);
      if (pose.rx <= 0) continue;
      const { x, y, rx, ry, angle } = pose;
      if (rx === ry) {
        ctx.moveTo(x + rx, y);
        ctx.arc(x, y, rx, 0, TAU);
      } else {
        ctx.moveTo(x + rx * Math.cos(angle), y + rx * Math.sin(angle));
        ctx.ellipse(x, y, rx, ry, angle, 0, TAU);
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

    // Squash & stretch from how fast it is moving, plus faint afterimages.
    const vx = (p.x - p.px) / CONFIG.step;
    const vy = (p.y - p.py) / CONFIG.step;
    const speed = Math.hypot(vx, vy);
    motion.update(vx, vy, dt);
    trailClock += dt;
    if (dt > 0 && trailClock >= TRAIL_EVERY) {
      trailClock = 0;
      if (speed > 1) trail.push({ x, y });
      else trail.shift();
      const max = p.timers.speedUp > 0 ? TRAIL_LEN_FAST : TRAIL_LEN;
      while (trail.length > max) trail.shift();
    }
    const fill = rgbToCss(playerRgb);
    ctx.fillStyle = fill;
    for (let i = 0; i < trail.length; i++) {
      const k = (i + 1) / (trail.length + 1);
      const s = shownSize * (0.55 + 0.35 * k);
      ctx.globalAlpha = 0.22 * k;
      ctx.fillRect(trail[i].x - s / 2, trail[i].y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;

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

    const pose = motion.pose();
    // Blink while invulnerable, but let the white hit flash show first.
    ctx.globalAlpha = pose.flash === 0 && p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0 ? 0.3 : 1;
    ctx.fillStyle = pose.flash > 0 ? rgbToCss(mixRgb(playerRgb, WHITE, pose.flash)) : fill;
    // Stretch along the motion axis: rotate in, scale, rotate back so the square stays upright.
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(pose.angle);
    ctx.scale(pose.along, pose.across);
    ctx.rotate(-pose.angle);
    ctx.fillRect(-half, -half, shownSize, shownSize);
    ctx.restore();
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
    onEvents(events, world) {
      syncWorld(world);
      const p = world.player;
      for (const e of events) {
        if (e.type === 'hit') motion.hit(p.x - e.x, p.y - e.y);
        else if (e.type === 'death') trail = [];
      }
    },
    draw(world, fx, alpha, joystick, dt) {
      syncWorld(world);
      clock += dt;
      const timeScale = worldTimeScale(world.player);
      tint = approach(tint, timeScale > 1 ? 1 : timeScale < 1 ? -1 : 0, 4, dt);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = rgbToCss(mixRgb(BG, tint > 0 ? FAST_BG : SLOW_BG, Math.abs(tint)));
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
