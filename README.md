# Game Without Art

Dodge the red balls. They keep splitting.

### [Play it on itch.io](https://aaess.itch.io/game-without-art)

https://github.com/ahamSel/Lockdown/assets/77988808/984e7b93-2480-4ed0-ae68-5b8f87646c1e

## Web version (2026)

The game was rebuilt for the browser in TypeScript and Canvas 2D. It's in [`web/`](web).

```bash
cd web
npm install
npm run dev      # play locally at http://localhost:5173
npm test         # simulation tests
npm run itch     # build + zip for itch.io (web/game-without-art.zip)
```

To publish, upload `web/game-without-art.zip` to the itch page as an HTML5 game ("This file will be played in the browser"). A viewport around 960×600 with fullscreen enabled works well; mobile-friendly can be ticked.

## Original Unity version (2021)

The rest of this repo is the original Unity 2020.3 project, made during lockdown, kept as it was.
