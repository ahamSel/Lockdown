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
