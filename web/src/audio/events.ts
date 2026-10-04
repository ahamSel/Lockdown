import { POWERUP_IDS } from '../game/powerups';
import type { SimEvent, World } from '../game/types';
import type { SfxName } from './sfx';

/** Above this many balls, wall-bounce ticks would just be noise. */
const QUIET_BOUNCE_BALLS = 27;

/** Which sound (and variant) an event makes, or null for silence. */
export function soundForEvent(e: SimEvent, world: World): [SfxName, number] | null {
  if (world.demo) return null; // the title screen stays quiet
  if (e.type === 'death') return ['death', 0];
  if (!world.player.alive) return null; // the world keeps moving behind the game-over screen, silently
  switch (e.type) {
    case 'split':
      return ['split', 0];
    case 'bounce':
      return world.balls.length <= QUIET_BOUNCE_BALLS ? ['bounce', 0] : null;
    case 'hit':
      return ['hit', 0];
    case 'blocked':
      return ['blocked', 0];
    case 'burn':
      return ['burn', 0];
    case 'pickup':
      return ['pickup', POWERUP_IDS.indexOf(e.kind) * 2];
    case 'expire':
      return ['expire', 0];
    case 'spawnBall':
      return ['spawn', 0];
    case 'cleared':
      return ['cleared', 0];
    case 'raze':
    case 'spawnPickup':
      return null;
  }
}
