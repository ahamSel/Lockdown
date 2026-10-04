import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/game/config';
import { activePowerups, applyPowerup, emptyTimers, playerSize, playerSpeed, POWERUPS, worldTimeScale } from '../src/game/powerups';
import { spawnBall } from '../src/game/sim';
import type { Player, TimedPowerupId } from '../src/game/types';
import { quietWorld } from './helpers';

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
