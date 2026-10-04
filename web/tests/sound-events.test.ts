import { describe, expect, it } from 'vitest';
import { soundForEvent } from '../src/audio/events';
import { createWorld } from '../src/game/sim';
import { quietWorld } from './helpers';

describe('soundForEvent', () => {
  it('keeps the title-screen demo silent', () => {
    const demo = createWorld({ aspect: 16 / 9, seed: 1, demo: true });
    expect(soundForEvent({ type: 'split', x: 0, y: 0, r: 0.1 }, demo)).toBeNull();
  });

  it('plays world sounds while the player is alive', () => {
    const world = quietWorld();
    expect(soundForEvent({ type: 'split', x: 0, y: 0, r: 0.1 }, world)).toEqual(['split', 0]);
    expect(soundForEvent({ type: 'pickup', kind: 'fire', x: 0, y: 0 }, world)).toEqual(['pickup', 4]);
  });

  it('goes quiet behind the game-over screen, except for the death sound itself', () => {
    const world = quietWorld();
    world.player.alive = false;
    expect(soundForEvent({ type: 'split', x: 0, y: 0, r: 0.1 }, world)).toBeNull();
    expect(soundForEvent({ type: 'expire', kind: 'health', x: 0, y: 0 }, world)).toBeNull();
    expect(soundForEvent({ type: 'death', x: 0, y: 0 }, world)).toEqual(['death', 0]);
  });

  it('drops bounce ticks once the arena is busy', () => {
    const world = quietWorld();
    expect(soundForEvent({ type: 'bounce', x: 0, y: 0, axis: 0, side: 1 }, world)).toEqual(['bounce', 0]);
    world.balls.length = 0;
    for (let i = 0; i < 28; i++) world.balls.push({ ...world.balls[0] } as never);
    expect(soundForEvent({ type: 'bounce', x: 0, y: 0, axis: 0, side: 1 }, world)).toBeNull();
  });
});
