import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/game/config';
import { activePowerups, emptyTimers, playerSize, playerSpeed, POWERUPS, worldTimeScale } from '../src/game/powerups';
import type { Player, TimedPowerupId } from '../src/game/types';

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
