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

/** A short red tick painted on the wall where a ball bounced. */
interface WallMark {
  axis: 0 | 1;
  /** Inner edge of the wall that was hit (world units on the bounce axis). */
  edge: number;
  side: -1 | 1;
  /** Position along the wall. */
  pos: number;
  life: number;
}

export interface Fx {
  handle(events: SimEvent[], world: World): void;
  update(dt: number, world: World): void;
  /** Draws in world space: the caller sets the world transform. */
  draw(ctx: CanvasRenderingContext2D): void;
  shakeOffset(): Vec;
  flash(): { rgb: RGB; alpha: number };
  reset(): void;
  stats(): { particles: number; rings: number; marks: number };
}

const RED = CONFIG.colors.ball;
const GREEN = CONFIG.colors.player;
const WHITE = '#ffffff';
const EMBERS = ['#ff8b00', '#ffb000', '#ff0c00'];
const MAX_RINGS = 120;
const MAX_MARKS = 40;
/** Above this many balls, bounce rings and wall ticks would just be noise. */
const MARK_MAX_BALLS = 40;
const MARK_LIFE = 0.35;
const MARK_DEPTH = CONFIG.wallThickness / 2; // the whole visible wall
const MARK_LENGTH = 0.8;
/** Peak shake in world units at full trauma; offset = trauma² × this. */
const SHAKE_UNITS = 0.3;

type Range = readonly [number, number];
const pickIn = ([lo, hi]: Range) => lo + Math.random() * (hi - lo);

export function createFx(reducedMotion: boolean): Fx {
  const maxParticles = reducedMotion ? 300 : 700;
  const density = reducedMotion ? 0.5 : 1;
  let particles: Particle[] = [];
  let rings: Ring[] = [];
  let marks: WallMark[] = [];
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
            shake(0.7); // 0.7² × 0.3 ≈ 0.15 units peak
            flashWith(RED, 0.4);
            burst(e.x, e.y, 10, WHITE, [2, 6], [0.2, 0.4], [0.05, 0.09]);
            ring(e.x, e.y, 0.05, 0.75, 0.3, WHITE, 0.05);
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
            if (world.balls.length <= MARK_MAX_BALLS && marks.length < MAX_MARKS) {
              // A small ring from the contact point, sized to the ball, so even tiny balls read as bouncing.
              ring(e.x, e.y, e.r * 0.6, e.r * 2.6 + 0.15, 0.22, RED, 0.035);
              const half = e.axis === 0 ? world.halfW : world.halfH;
              const edge = e.side * (half - CONFIG.wallThickness / 2);
              marks.push({ axis: e.axis, edge, side: e.side, pos: e.axis === 0 ? e.y : e.x, life: MARK_LIFE });
            }
            break;
        }
      }
    },

    update(rawDt, world) {
      const dt = Math.max(0, rawDt); // effects only ever move forward
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
      for (const m of marks) m.life -= dt;
      marks = marks.filter((m) => m.life > 0);
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
      ctx.fillStyle = RED;
      for (const m of marks) {
        const t = m.life / MARK_LIFE;
        const len = MARK_LENGTH * (0.6 + 0.4 * t);
        const depth = MARK_DEPTH * t;
        // Painted on the wall itself, just outside the playfield.
        const a = m.side > 0 ? m.edge : m.edge - depth;
        ctx.globalAlpha = t;
        if (m.axis === 0) ctx.fillRect(a, m.pos - len / 2, depth, len);
        else ctx.fillRect(m.pos - len / 2, a, len, depth);
      }
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
      const m = trauma * trauma * SHAKE_UNITS;
      return { x: (Math.random() * 2 - 1) * m, y: (Math.random() * 2 - 1) * m };
    },

    flash() {
      return { rgb: flashRgb, alpha: flashAlpha };
    },

    stats() {
      return { particles: particles.length, rings: rings.length, marks: marks.length };
    },

    reset() {
      particles = [];
      rings = [];
      marks = [];
      trauma = 0;
      flashAlpha = 0;
      emberDebt = 0;
    },
  };
}
