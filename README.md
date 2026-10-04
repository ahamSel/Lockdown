# Game Without Art

Dodge the red balls. They keep splitting. Made during lockdown in 2021, rebuilt for the browser in 2026.

### [Play it on itch.io](https://ahamsel.itch.io/game-without-art)

![Gameplay: the title, then the red balls splitting until the arena is full while the green square dodges](docs/preview.gif)

## How to play

You're the green square. The red balls bounce around, grow, and split into three every 10 seconds, so the arena fills up fast. Grab powerups to survive: there are 10 of them, and the timed ones last 10 seconds, with time adding up if you collect more.

- **Move:** WASD or arrow keys. On touch screens, drag anywhere.
- **Pause:** Esc or P. **Restart:** R. **Mute:** M.

"No art" is the whole look: plain shapes and flat colours, with the polish coming from motion and feel.

## The browser version (`web/`)

TypeScript and Canvas 2D, built with Vite, with no runtime dependencies. Sound is synthesised in the browser.

```bash
cd web
npm install
npm run dev      # play locally
npm test         # simulation tests
npm run itch     # build + zip for itch.io (web/game-without-art.zip)
```

To publish, upload `web/game-without-art.zip` to the itch page as an HTML5 game ("This file will be played in the browser"). A viewport around 960×600 with fullscreen enabled works well; mobile-friendly can be ticked.

| Folder | What's in it |
| --- | --- |
| `web/src/game` | The simulation: balls, splitting, powerups, collisions (pure, unit tested) |
| `web/src/render` | Canvas renderer and effects |
| `web/src/ui`, `web/src/audio`, `web/src/input` | Screens, synthesised sound, keyboard and touch |
| `web/tests` | Vitest tests |
| `web/tools` | Generates the itch art (cover, banner, backgrounds) with the game's own renderer |
| `web/marketing` | itch.io cover, banner, backgrounds, icons and screenshots |
| `docs/design.md` | The design the rebuild follows |
| `unity/` | The original 2021 Unity project |

## The original (`unity/`)

The 2021 Unity 2020.3 project, made during lockdown and kept as it was. To open it, import the free [Joystick Pack](https://assetstore.unity.com/packages/tools/input-management/joystick-pack-107631) from the Unity Asset Store (it isn't included here, since it's not ours to republish).

https://github.com/ahamSel/Lockdown/assets/77988808/984e7b93-2480-4ed0-ae68-5b8f87646c1e

## Credits

Made by ahamsel.
