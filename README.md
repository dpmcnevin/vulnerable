# Vulnerable

A contract bridge roguelike for [LÖVE](https://love2d.org) 11.x.

You declare every deal from the South seat and play your dummy, North, as well, against two AI defenders. Each deal you pick a contract from your own hand and your partner's bid, then play out all 13 tricks. Contracts are scored by the real duplicate bridge table. Reach each board's target within three deals, spend your winnings on relics and conventions, and get through eight rubbers.

## Running it

```bash
brew install --cask love
```

```bash
love .
```

If `love` isn't on your PATH after installing, run `/Applications/love.app/Contents/MacOS/love .` instead.

**Controls:** click a contract cell, then **Bid**. Click a lifted card to play it; on dummy's turn, click a card in North's hand. Space or Enter continues past result screens, and clicking skips the pause after a trick. Escape returns to the menu, where you can continue the run. **Play it out** hands the rest of the deal to the autopilot, which is quicker but plays worse than a careful declarer.

## How it plays

- **Bidding.** You see your own 13 cards. Partner's hand is shown only as a bid: a point range, any 5+ card suit, and whether it's balanced. The bid grid gives every contract's chance of making and the minimum it would score with your current relics. A brass edge marks contracts that clear the board on their own; the star is the recommended bid.
- **Doubling.** If your bid needs more strength than your side could plausibly hold, the defenders may double you.
- **Play.** West leads and dummy goes face up. The defenders see dummy too, just as in real bridge.
- **Scoring.** Real bridge score first (contract points, overtricks, part-score/game/slam bonuses, vulnerability). Then strain levels and relics add points and multiply: *points × mult = score*. A failed contract scores nothing.
- **Structure.** 8 rubbers × 3 boards, 3 deals per board. The third board of every rubber, and every board from rubber 5 on, is vulnerable.
- **The club (shop).** Relics are 35 bridge-themed items, some of which grow over the run. Conventions (Precision, Flannery, Jacoby, Michaels, Lebensohl) level up one strain each.

## Layout

```
main.lua, conf.lua      LÖVE entry point; fixed 1280x720 canvas, letterboxed
src/rules/              pure bridge logic, no LÖVE dependency
  rng.lua               seeded xorshift32 (runs replay exactly from a seed)
  cards.lua             cards, seats, dealing, HCP, shape
  scoring.lua           duplicate bridge scoring
  play.lua              trick play, follow-suit, trick telemetry
  ai.lua                defender heuristics + declarer autopilot
  bidding.lua           partner's bid, trick estimate, odds
src/game/               run structure, also pure Lua
  engine.lua            rubbers/boards/deals, scoring pipeline, economy, shop
  relics.lua, conventions.lua
src/ui/                 LÖVE front-end (theme, widgets, app)
tests/                  luajit test suites + a strict LÖVE API stub
tools/                  balance simulator, bot player, SVG screen snapshots
```

## Testing and tuning

Everything except the final rendering runs under plain `luajit`:

```bash
luajit tests/test_rules.lua
```

```bash
luajit tests/test_engine.lua
```

```bash
luajit tests/test_ui.lua
```

```bash
luajit tools/simulate.lua 500
```

```bash
luajit tools/snapshot.lua snapshots
```

- `test_rules` checks scoring against the bridge scoring table, plus dealing and trick rules.
- `test_ui` drives the real UI through whole runs using a LÖVE stub that rejects bad draw-call arguments.
- `simulate` plays complete runs with a bot that bids by the bid screen's recommendation, declares on autopilot and shops by a simple rule.
- `snapshot` renders every screen to SVG so you can check the layout by eye.

**Balance**, from the simulator: the trick estimate is fitted to the autopilot's actual results (mean error ≈ 0). Targets are fitted to how fast a sensible relic build grows. The bot wins about 15–20% of runs and clears rubber 1 about 85% of the time. A human who declares carefully should do better.

## Known limitations

- Not yet run in real LÖVE. Logic, input and layout are verified headlessly; font metrics and feel are not.
- No save/load mid-run.
- The defenders are heuristic, not a double-dummy solver. "Play it out" is an autopilot, not a true bridge claim.
- You always declare from South. There's no competitive auction.
