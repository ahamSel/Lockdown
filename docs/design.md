# Game Without Art — Web Remake Design

Date: 2026-10-03
Status: Built and shipped (2026-10)

## Goal

Rebuild the 2021 Unity game "Game Without Art" (repo `ahamSel/game-without-art`, formerly `Lockdown`; itch page `ahamsel.itch.io/game-without-art`) as a browser game that feels clearly better while staying recognisably the same game. "No art" is the brand: everything is plain shapes and flat colours; polish comes from motion, feedback, and feel. Ship as an itch.io HTML5 upload.

## Constraints

- Lives in `web/` in this repo. The 2021 Unity project (now in `unity/`) is left as it was.
- TypeScript + Canvas 2D + Vite. No runtime dependencies. Dev dependencies: `vite`, `typescript`, `vitest`.
- Works on desktop (keyboard) and mobile browsers (touch drag joystick).
- Original palette is the brand and is preserved exactly (see Palette).
- Gameplay is faithful to the original with light tuning (listed under Tuning Changes).

## Success Criteria

1. All original mechanics present: bouncing red balls that grow and split into 3 every 10 s (cap 729), 10 powerups with stacking 10 s timers, HP, score, best score, how-to-play screen, pause.
2. Runs at 60 fps on a mid-range phone with the ball cap reached.
3. `npm test` passes; `npm run build` produces a relative-path build; `npm run itch` produces `web/game-without-art.zip` that runs when uploaded to itch.
4. No art assets: no images or audio files ship, apart from an optional favicon drawn from shapes.

## Palette (from the Unity prefabs)

| Element | Colour |
|---|---|
| Background | `#0063ff` |
| Walls | `#ffffff` |
| Player | `#00ff05` |
| Balls | `#ff0c00` |
| Health | `#ff00b5` |
| Shield | `#000cff` |
| Time×2 | `#ffe900` |
| Time/2 | `#7f00ff` |
| Raze | `#000000` |
| Fire | `#ff8b00` |
| Shrink | `#a7ff00` |
| Grow | `#ffffff` |
| SpeedUp | `#7f7f7f` |
| SlowDown | `#7a3300` |

## World Model

- Coordinates mirror the Unity camera: the visible world is 10 units tall (orthographic size 5), width = 10 × aspect. Origin at centre, +y up.
- White walls 0.5 units thick sit on the four edges. Balls bounce off them; the player is clamped inside them.
- Simulation runs at a fixed 60 Hz step with an accumulator. Render frame delta is capped at 250 ms so a hitch never spirals.
- A world `timeScale` (1, 2, or 0.5) multiplies the step for balls, ball growth/split timers, and nothing else. Player movement, powerup timers, powerup spawn timers, and powerup lifetimes run on real time. This matches the original's "player not affected" behaviour.

## Gameplay Rules

### Player
- Square, size 0.5 units (scale 0.5 of a 1-unit square), colour `#00ff05`.
- Speed 7 units/s. Keyboard: WASD / arrows, normalised diagonal. Touch: floating joystick — press anywhere outside UI sets the anchor, drag sets direction, magnitude clamps at 1 joystick radius (analog speed).
- HP starts at 20.
- On ball contact (circle vs square) without Shield/Fire: lose 1 HP, become invulnerable for 0.6 s (blinks), the ball reflects off the player.
- HP 0 → death → game over screen.

### Balls
- First ball spawns at a random position at least 3 units from the player, grows from scale 0 to 0.2 over ~1.6 s, then starts moving at speed 10 in a random direction.
- Ball radius = 0.5 × scale. Scale grows by 1/30 per world-second.
- Every 10 world-seconds a ball splits into 3 new balls of scale 0.2, each with a random direction, if the ball count is below 729. Score += 3 per split while the player is alive.
- Balls reflect off walls with no speed loss. Balls do not collide with each other (as in the original).

### Powerups
- Spawning begins 13 s after the start. One powerup spawns immediately, then every 2/4/6/8/10 s (random) 1–4 powerups spawn at random positions inside the walls.
- Powerups are drawn as small rounded diamonds in their colour, bob and pulse gently, scale in when they spawn, and disappear after 12 s (blinking for the last 2 s).
- Timed effects last 10 s and add up when collected again.
- Mutually exclusive pairs (collecting one cancels the other): Shield/Fire, Time×2/Time/2, Grow/Shrink, SpeedUp/SlowDown.

| Powerup | Effect |
|---|---|
| Health | +5 HP (instant) |
| Shield | Immune to ball damage |
| Fire | Touching a ball destroys it (no damage) |
| Time×2 | World timeScale 2 |
| Time/2 | World timeScale 0.5 |
| Raze | Destroy all balls except 3 random ones (instant) |
| Shrink | Player size ×0.4 (0.2 units) |
| Grow | Player size ×1.6 (0.8 units) |
| SpeedUp | Player speed 12 |
| SlowDown | Player speed 2 |

### Score and end states
- Score starts at 1. Best score is saved to `localStorage` (wrapped in try/catch) and is only written when the game ends or the best score changes, never every frame.
- If every ball is destroyed (e.g. by Fire), award +25 and spawn a new seed ball with the normal grow-in. The game does not end.
- Game over screen: score, best (with a "new best" badge), Retry (R / Enter / tap) and Menu.

## Tuning Changes vs 2021

1. Time/2 is 0.5× (the original used 0.1×).
2. 0.6 s invulnerability after a hit.
3. Powerups expire after 12 s.
4. Clearing all balls gives a bonus and a new ball instead of restarting.
5. Explicit game over screen instead of a silent 3 s restart.
6. Auto-pause when the tab is hidden or the window loses focus.
7. Raze picks 3 random survivors and keeps the ball count correct.
8. Player colour picks the longest-running powerup deterministically (no float-equality ties).

## Feel and Polish (shapes and motion only)

- Ball spawn: grow-in with a soft ring. Split: pop (quick scale overshoot), 6–10 small red shard particles.
- Wall bounce: brief squash along the contact normal.
- Player hit: screen shake (amplitude ~0.15 units, 200 ms), red vignette flash, HP counter pulse, player blink.
- Pickup: expanding ring in the powerup's colour, a small burst, a HUD pill that slides in with a draining timer bar.
- Player colour: main fill eases toward the colour of the longest-running active powerup. Up to 3 other active powerups render as concentric outline rings around the player.
- Shield: translucent bubble around the player. Fire: ember particle trail.
- Time×2 / Time/2: background eases slightly warmer or cooler. Balls get faint motion trails at 2×.
- Score pops when it goes up. Ball counter in the HUD.
- Menus: title bounces in, buttons ease on hover and press, screens crossfade. The title screen has idle balls bouncing behind it.
- Sound: WebAudio-synthesised blips for split, hit, pickup (pitch per powerup), bounce (very quiet, rate-limited), game over. Mute toggle (M key / button), saved to storage. Audio unlocks on the first input.
- `prefers-reduced-motion`: no shake, flashes reduced, particles halved.

## Architecture

```
web/
  index.html            canvas + UI overlay root
  vite.config.ts        base: './'
  package.json          scripts: dev, build, test, itch
  scripts/zip-itch.mjs  zips dist/ into game-without-art.zip (no extra deps; uses system `zip`)
  src/
    main.ts             boot, fixed-step loop, screen state machine (title | howto | playing | paused | gameover)
    game/
      config.ts         every tuning number and colour
      rng.ts            seedable RNG (deterministic tests)
      types.ts          World, Ball, Player, Powerup, Events
      powerups.ts       powerup definitions table (id, colour, label, description, kind, apply, cancels)
      sim.ts            createWorld(), step(world, input, dt) → emits events; pure, no DOM
      spawner.ts        powerup spawn scheduling
      collide.ts        circle/AABB and circle/wall helpers
    render/
      renderer.ts       draws the world from state + interpolation alpha
      fx.ts             particles, rings, shake, flashes driven by sim events
      tween.ts          easing functions
    input/
      keyboard.ts
      touch.ts          floating joystick (also drawn by renderer)
    ui/
      screens.ts        DOM screens and HUD; CSS transitions
      styles.css
    audio/
      sfx.ts
    storage.ts          safe localStorage get/set
  tests/
    sim.test.ts
    powerups.test.ts
```

Data flow: input → `sim.step` mutates the `World` and pushes typed events (`split`, `hit`, `pickup`, `bounce`, `ballDestroyed`, `cleared`, `death`) → `fx` and `sfx` consume events → `renderer` draws world plus fx → `ui` reads world for the HUD. The simulation never touches the DOM, canvas, or audio.

## Error Handling

- `localStorage` access always wrapped in try/catch; the game works without it.
- `AudioContext` is created lazily on the first user gesture. If it's unavailable, sound is silently disabled.
- Canvas is sized by devicePixelRatio (capped at 2) and resized on `resize` / orientation change. Wall positions and the player clamp recompute on resize.
- The loop pauses on `visibilitychange`.

## Testing

- Vitest unit tests on the pure simulation with a seeded RNG:
  - ball grows, splits into 3 at 10 world-seconds; cap at 729 prevents a split
  - score +3 per split; no score after death
  - timeScale affects balls but not player displacement or powerup timers
  - timer stacking (collect twice → 20 s) and pair cancellation
  - Raze leaves exactly 3 balls (or fewer if fewer existed)
  - hit reduces HP once during invulnerability; Shield blocks; Fire destroys the ball
  - clearing all balls awards the bonus and spawns a seed
- Manual play-test in the browser at desktop and mobile viewports.

## Out of Scope

Online leaderboards, new powerups, accounts, PWA/offline install, native mobile builds, changes to the Unity project.
