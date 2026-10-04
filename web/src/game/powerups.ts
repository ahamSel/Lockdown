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
