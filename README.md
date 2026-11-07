# Vulnerable

A contract bridge roguelike. **Play it in your browser at [corrupt.net/vulnerable](https://corrupt.net/vulnerable/).**

You declare every deal from the South seat and play your dummy, North, as well, against two AI defenders. Each deal you pick a contract from your own hand and your partner's bid, then play out all 13 tricks. Contracts are scored by the real duplicate bridge table. Reach each board's target within three deals, spend your winnings on relics, conventions and ploys, and get through eight rubbers.

It runs on desktop, iPad and phone (a portrait layout kicks in on tall screens), and your run saves automatically.

## How to play

- **Bidding.** You see your own 13 cards and their high card points. Partner's hand is shown only as a bid: a point range, any 5+ card suit, and whether it's balanced. The bid grid gives every contract's chance of making and the minimum it would score with your current relics. A brass edge marks contracts that clear the board on their own; the star is the recommended bid. Hovering a contract previews that suit as trumps in your hand.
- **Doubling.** If your bid needs more strength than your side could plausibly hold, the defenders may double you.
- **Play.** West leads and dummy goes face up. The defenders see dummy too, just as in real bridge. Trump cards get a gold-tinted face and a starred ribbon.
- **Scoring.** Real bridge score first (contract points, overtricks, part-score/game/slam bonuses, vulnerability). Then strain levels and relics add points and multiply: *points × mult = score*. A failed contract scores nothing.
- **Structure.** 8 rubbers × 3 boards, 3 deals per board. The third board of every rubber, and every board from rubber 5 on, is vulnerable.
- **The club (shop).** Four items per visit. Relics are 35 bridge-themed items, some of which grow over the run. Conventions (Precision, Flannery, Jacoby, Michaels, Lebensohl) level up one strain each.
- **Ploys.** 15 one-shot tricks, held two at a time, that bend the deal in front of you: see dummy before you bid, promote a card, create a void, lead out of turn, stop the defenders doubling, count a phantom trick, get a failed deal back. Cards are always exchanged with a defender, never created, so the pack stays a legal 52 cards. Winning a vulnerable board gives you a free ploy.
- **Scorepad.** A WE/THEY rubber-bridge scorepad for each rubber, kept from the bridge scores alone: tricks bid and made below the line (100 wins a game), overtricks and bonuses above it, and undertrick penalties above the line for the defenders.

### Controls

- **Bid:** click or tap a contract, then **Bid**.
- **Play a card:** click it, or drag it onto the middle of the table. On dummy's turn, play from North's hand. On a small touch screen, the first tap lifts a card and the second plays it.
- **Rearrange your hand:** drag any card to put it anywhere. Dummy's hand too, once it's face up. (On the menu, the four aces can be dragged around and tapped to flip.)
- **Ploys:** click a ploy in the sidebar to **Use**, **Sell** or **Cancel** it. Ploys that need a card ask you to pick one from your hand.
- **Keys:** Space or Enter continues; a click skips the pause after a trick and the score count-up; **P** opens the scorepad; **M** toggles the music; Escape goes back to the menu, where you can continue the run.
- **Play it out** hands the rest of the deal to the autopilot, which is quicker but plays worse than a careful declarer.

**Settings** (on the menu, remembered between visits): music, sound effects, a four-color deck (green clubs, orange diamonds) as many bridge players prefer, pixel-art or smooth cards, and **rubber view**, which labels each deal's bridge score above and below the line.

Every card, icon, sound and note of music is generated in code; there are no image or audio files. The music is a lounge-jazz combo that plays a fresh, seeded take each time round.

## Running it locally

The web version lives in [`web/`](web/): SvelteKit 2 and Svelte 5, built as a static site. It needs Node 22.18 or newer.

```bash
cd web
npm install
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

`npm test` runs the rules, engine, ploy, audio and save tests, plus a conformance test that checks the TypeScript engine against the original Lua one deal for deal. See [`web/README.md`](web/README.md) for how it's put together.

### Deploying

Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which tests, builds `web/` and publishes it with GitHub Pages at [corrupt.net/vulnerable](https://corrupt.net/vulnerable/). The home screen shows the version and the commit it was built from.

## The original LÖVE version

Vulnerable started as a [LÖVE](https://love2d.org) 11.x game, and that version is still in the repo root. It's the reference the web port is tested against.

```bash
/Applications/love.app/Contents/MacOS/love .
```

Install LÖVE 11.5 from its [GitHub releases](https://github.com/love2d/love/releases/tag/11.5) (Homebrew's cask is disabled).

Its logic runs under plain `luajit`, with no LÖVE needed:

```bash
luajit tests/test_rules.lua
```

```bash
luajit tests/test_engine.lua
```

```bash
luajit tools/simulate.lua 500
```

```
main.lua, conf.lua      LÖVE entry point; fixed 1280x720 canvas, letterboxed
src/rules/              pure bridge logic: rng, cards, scoring, play, ai, bidding
src/game/               run structure: engine, relics, conventions
src/ui/                 LÖVE front-end
tests/                  luajit test suites + a strict LÖVE API stub
tools/                  balance simulator, bot player, SVG screen snapshots
web/                    the SvelteKit port
```

**Balance**, from the simulator: the trick estimate is fitted to the autopilot's actual results. The bot wins about 15–20% of runs; a human who declares carefully should do better.

## Known limitations

- The defenders are heuristic, not a double-dummy solver. "Play it out" is an autopilot, not a true bridge claim.
- You always declare from South. There's no competitive auction.
