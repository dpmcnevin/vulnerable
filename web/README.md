# Vulnerable for the web

A SvelteKit port of Vulnerable, the contract bridge roguelike. The Lua/LÖVE
game in the parent folder is the reference; this folder adds a browser
version alongside it without changing it.

## Running it

Needs Node 22.18 or newer (the tests run the TypeScript engine directly).

```bash
cd web
npm install
npm run dev          # http://localhost:5173
```

```bash
npm test             # engine, ploys, audio and Lua-conformance tests
npm run build        # static site in web/build
npm run preview      # serve the build locally
npm run simulate     # headless balance run: node tools/simulate.ts [runs] [prefix]
```

### Deploying to GitHub Pages

It deploys like isle-wars: `.github/workflows/deploy.yml` (at the repo root)
builds `web/` and publishes it with GitHub Pages on every push to `main`. In
a repo named `vulnerable` on the dpmcnevin account, whose custom domain is
corrupt.net, that serves the game at https://corrupt.net/vulnerable/. Turn
on Pages once under Settings → Pages → Source: GitHub Actions.

The build is a static site (`@sveltejs/adapter-static`, SPA fallback in
`404.html`). Asset URLs are prefixed with the Pages base path, `/vulnerable`
by default; set `BASE_PATH` to match your repository name, or to an empty
string for a custom domain:

```bash
BASE_PATH=/my-repo npm run build
```

Publish `web/build` (add an empty `.nojekyll` file to it).

## How it's put together

- `src/lib/rules`, `src/lib/game`: the engine, a line-for-line port of
  `src/rules` and `src/game`. Pure TypeScript, no browser APIs.
- `src/lib/audio`: the synthesizer and sound recipes, rendered into typed
  arrays and played through Web Audio. Music is generative: each pass is a
  new seeded take rendered in a Web Worker and scheduled seamlessly after the
  last.
- `src/lib/ui`: pixel-art cards, sprites and icons as bitmaps, the smooth
  card style on canvas, the palette and settings.
- `src/lib/app`: the game controller (the logic half of `src/ui/app.lua`),
  stage layout, particles and screen shake.
- `src/lib/components`: the Svelte 5 UI. Cards are keyed sprites that chase
  their layout position with `svelte/motion` springs (deal-in, flips, plays,
  sweeps). The stage scales to fit; tall screens get a portrait layout.
- `tools/bot.ts`, `tools/simulate.ts`: the balance bot and simulator.

Beyond the original: drag cards to rearrange your hand (or drag a playable
card onto the table to play it), drag the menu's aces around, and touch
input throughout.

## Conformance with the Lua game

The engine is seeded and deterministic, and the port reproduces the Lua
version bit for bit: same deals, same AI plays, same scores. The RNG is an
exact xorshift32 port, and Lua's `table.sort` algorithm is reproduced so ties
sort identically.

`tests/conformance.test.mjs` checks this against
`tests/fixtures/lua-conformance.json`, which `tools/dump_fixture.lua` writes
from the Lua engine: RNG streams, deals, the scoring table, 75 bot runs, 25
card-by-card human-style runs with ploys and shopping, a hash of every
pixel-art card and icon, and statistics for every sound (the original music
loop is kept as `renderMusicClassic` for this). When the Lua engine changes,
regenerate the fixture with luajit and port the difference until the test
passes:

```bash
npm run fixture      # luajit tools/dump_fixture.lua .. > tests/fixtures/lua-conformance.json
```
