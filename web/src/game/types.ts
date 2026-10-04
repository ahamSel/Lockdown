import type { Rng } from './rng';

export interface Vec {
  x: number;
  y: number;
}

export type PowerupId =
  | 'health'
  | 'shield'
  | 'fire'
  | 'timeFast'
  | 'timeSlow'
  | 'raze'
  | 'shrink'
  | 'grow'
  | 'speedUp'
  | 'slowDown';

export type TimedPowerupId = Exclude<PowerupId, 'health' | 'raze'>;

export interface Ball {
  id: number;
  x: number;
  y: number;
  /** Position at the start of the last step, for render interpolation. */
  px: number;
  py: number;
  vx: number;
  vy: number;
  /** Radius is scale / 2 (a Unity circle sprite is 1 unit across). */
  scale: number;
  /** False while the ball is growing in. */
  active: boolean;
  /** World-seconds until this ball splits. */
  splitTimer: number;
  /** World-seconds since the ball was created (drives the split "pop"). */
  age: number;
  /** Fraction of the last step at which the ball touched a wall, or -1 if it didn't. */
  hitF: number;
  /** Where it touched the wall during the last step (valid when hitF >= 0). */
  hitX: number;
  hitY: number;
  /** World-seconds since it last touched a wall (drives the bounce wobble). */
  bounceT: number;
  /** Which wall it last touched: axis 0 = left/right, 1 = bottom/top; side -1 = min, +1 = max. */
  bounceAxis: 0 | 1;
  bounceSide: -1 | 1;
}

export interface Player {
  x: number;
  y: number;
  px: number;
  py: number;
  hp: number;
  alive: boolean;
  invuln: number;
  timers: Record<TimedPowerupId, number>;
}

export interface Pickup {
  id: number;
  kind: PowerupId;
  x: number;
  y: number;
  age: number;
}

export type SimEvent =
  | { type: 'spawnBall'; x: number; y: number }
  | { type: 'split'; x: number; y: number; r: number }
  | { type: 'bounce'; x: number; y: number; axis: 0 | 1; side: -1 | 1 }
  | { type: 'hit'; x: number; y: number; hp: number }
  | { type: 'blocked'; x: number; y: number }
  | { type: 'burn'; x: number; y: number; r: number }
  | { type: 'death'; x: number; y: number }
  | { type: 'cleared'; x: number; y: number }
  | { type: 'spawnPickup'; kind: PowerupId; x: number; y: number }
  | { type: 'pickup'; kind: PowerupId; x: number; y: number }
  | { type: 'expire'; kind: PowerupId; x: number; y: number }
  | { type: 'raze'; removed: Vec[] };

export interface World {
  rng: Rng;
  /** Title-screen world: no player, no pickups, fewer balls. */
  demo: boolean;
  halfW: number;
  halfH: number;
  /** Real seconds since the world was created. */
  time: number;
  score: number;
  maxBalls: number;
  nextId: number;
  player: Player;
  balls: Ball[];
  pickups: Pickup[];
  /** Real seconds until the next pickup batch, once spawning has started. */
  pickupClock: number;
  pickupsStarted: boolean;
  events: SimEvent[];
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}
