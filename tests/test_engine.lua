--- Tests for the run engine, relics and shop. Run with: luajit tests/test_engine.lua

package.path = "./?.lua;" .. package.path

local engine = require("src.game.engine")
local relics = require("src.game.relics")
local cards = require("src.rules.cards")
local play = require("src.rules.play")
local scoring = require("src.rules.scoring")
local bot = require("tools.bot")

local passed, failed = 0, 0
local function check(label, actual, expected)
  if actual == expected then
    passed = passed + 1
  else
    failed = failed + 1
    print(("  FAIL %s\n        got %s, expected %s"):format(label, tostring(actual), tostring(expected)))
  end
end
local function section(name) print("\n" .. name) end

--------------------------------------------------------------------------
section("Deals")
--------------------------------------------------------------------------
do
  local weakSide, weakDeclarer = 0, 0
  for i = 1, 300 do
    local run = engine.newRun("DEALS" .. i)
    local d = run.deal
    local ns = cards.hcp(d.hands[cards.NORTH]) + cards.hcp(d.hands[cards.SOUTH])
    if ns < 20 then weakSide = weakSide + 1 end
    if cards.hcp(d.hands[cards.SOUTH]) < cards.hcp(d.hands[cards.NORTH]) then
      weakDeclarer = weakDeclarer + 1
    end
  end
  check("you always hold the stronger partnership", weakSide, 0)
  check("you always hold the stronger of your two hands", weakDeclarer, 0)
end

do
  local run = engine.newRun("BIDFLOW")
  check("a new run starts in the bid phase", run.phase, engine.PHASE.BID)
  check("three deals per board", run.dealsLeft, engine.DEALS_PER_BOARD)
  engine.commitBid(run, { level = 2, strain = cards.SPADES })
  check("bidding moves to play", run.phase, engine.PHASE.PLAY)
  check("West made the opening lead", run.deal.state.played[1].seat, cards.WEST)
  check("dummy is face up after the lead", run.deal.dummyVisible, true)
  check("it is now the player's turn", engine.isPlayerTurn(run), true)

  -- Play the whole deal by clicking the first legal card every time.
  local guard = 0
  while run.phase == engine.PHASE.PLAY do
    guard = guard + 1
    local legal = play.legalPlays(run.deal.state, run.deal.state.turn)
    engine.playerPlay(run, legal[1])
    assert(guard < 40)
  end
  check("deal ends scored", run.phase, engine.PHASE.DEAL_SCORED)
  check("13 tricks played", #run.deal.state.tricks, 13)
  check("one deal used", run.dealsLeft, engine.DEALS_PER_BOARD - 1)
end

--------------------------------------------------------------------------
section("Scoring pipeline")
--------------------------------------------------------------------------
do
  -- With no relics, the projection is exactly the bridge score.
  local run = engine.newRun("PROJ")
  local c = { level = 4, strain = cards.SPADES, doubled = 0 }
  check("projection with no relics = bridge score",
    engine.projectScore(run, c), scoring.score(c, 10, run.vulnerable).total)

  -- A flat relic adds to the projection; a multiplier scales it.
  run.relics[1] = relics.instantiate(relics.get("purist"))
  local nt = { level = 3, strain = cards.NOTRUMP, doubled = 0 }
  check("Purist adds 140 on notrump",
    engine.projectScore(run, nt), scoring.score(nt, 9, run.vulnerable).total + 140)
  check("Purist does nothing in a suit",
    engine.projectScore(run, c), scoring.score(c, 10, run.vulnerable).total)

  run.relics[2] = relics.instantiate(relics.get("bold_bidding"))
  local five = { level = 5, strain = cards.CLUBS, doubled = 0 }
  check("Bold Bidding: +150 per level above three",
    engine.projectScore(run, five), scoring.score(five, 11, run.vulnerable).total + 300)

  -- Convention levels: +points then +mult.
  local run2 = engine.newRun("CONV")
  run2.strainLevels[cards.HEARTS] = 3
  local h = { level = 4, strain = cards.HEARTS, doubled = 0 }
  local base = scoring.score(h, 10, run2.vulnerable).total
  check("hearts level 3: (base + 60) x 2.2",
    engine.projectScore(run2, h), math.floor((base + 60) * 2.2))
end

do
  -- A failed contract scores nothing toward the target, relics or not.
  local run = engine.newRun("FAIL")
  run.relics[1] = relics.instantiate(relics.get("purist"))
  engine.commitBid(run, { level = 7, strain = cards.NOTRUMP })
  engine.playOut(run)
  local made = run.deal.result.made
  if not made then
    check("failed grand slam scores zero", run.deal.result.total, 0)
    check("board score unchanged", run.score, 0)
  else
    check("(seed made 7NT; skipped)", true, true)
  end
end

--------------------------------------------------------------------------
section("Scaling relics")
--------------------------------------------------------------------------
do
  local run = engine.newRun("SCALE")
  local regular = relics.instantiate(relics.get("club_regular"))
  run.relics[1] = regular
  local def = regular.def
  def.onDealEnd({ made = true, contract = { level = 2, strain = 1 } }, regular)
  def.onDealEnd({ made = false, contract = { level = 2, strain = 1 } }, regular)
  def.onDealEnd({ made = true, contract = { level = 2, strain = 1 } }, regular)
  check("Club Regular grows only on made contracts", regular.state.points, 50)
  check("its text reports the current value", relics.textFor(regular):find("now %+50") ~= nil, true)

  local master = relics.instantiate(relics.get("master_points"))
  master.def.onDealEnd({ made = true, contract = { level = 2, strain = 4 } }, master)
  check("Master Points ignores part-scores", master.state.mult, nil)
  master.def.onDealEnd({ made = true, contract = { level = 4, strain = 4 } }, master)
  check("Master Points grows on a game", master.state.mult, 0.2)

  -- Separate copies keep separate state.
  local a = relics.instantiate(relics.get("club_regular"))
  local b = relics.instantiate(relics.get("club_regular"))
  a.def.onDealEnd({ made = true }, a)
  check("instances do not share state", b.state.points, nil)
end

--------------------------------------------------------------------------
section("Economy and shop")
--------------------------------------------------------------------------
do
  local run = engine.newRun("SHOP")
  run.money = 100
  engine.enterShop(run)
  check("shop stocks three items", #run.shop.items, engine.SHOP_SIZE)
  local before = run.money
  local item = run.shop.items[1]
  check("can buy with plenty of money", engine.buy(run, 1), true)
  check("money charged", run.money, before - item.cost)
  check("cannot buy the same slot twice", (engine.buy(run, 1)), false)

  -- Relic slots cap purchases.
  run.relics = {}
  for i = 1, engine.RELIC_SLOTS do run.relics[i] = relics.instantiate(relics.DEFS[i]) end
  run.shop.items[2] = { kind = "relic", def = relics.DEFS[20], name = "x", cost = 1 }
  local ok, why = engine.canBuy(run, 2)
  check("full relic slots block a relic purchase", ok, false)
  check("with the right reason", why, "no relic slots")

  local cost = run.rerollCost
  local m = run.money
  check("reroll succeeds", engine.reroll(run), true)
  check("reroll charges its cost", run.money, m - cost)
  check("reroll cost rises", run.rerollCost, cost + 1)

  local count = #run.relics
  local cash = run.money
  engine.sellRelic(run, 1)
  check("selling removes the relic", #run.relics, count - 1)
  check("selling refunds money", run.money > cash, true)
end

do
  local run = engine.newRun("INTEREST")
  run.money = 23
  check("interest is $1 per $5", engine.interest(run), 4)
  run.money = 200
  check("interest is capped", engine.interest(run), engine.MAX_INTEREST)
end

do
  check("vulnerable on the third board", engine.isVulnerable(1, 3), true)
  check("not vulnerable on board one early", engine.isVulnerable(1, 1), false)
  check("always vulnerable from rubber five", engine.isVulnerable(5, 1), true)
  -- Targets climb within a rubber and from rubber to rubber. The first board
  -- of a rubber may dip below the previous vulnerable board: a deliberate
  -- breather, and vulnerable boards pay bigger game bonuses anyway.
  local withinRising, acrossRising = true, true
  for r = 1, engine.RUBBERS do
    for b = 2, engine.BOARDS_PER_RUBBER do
      if engine.targetFor(r, b) <= engine.targetFor(r, b - 1) then withinRising = false end
    end
    if r > 1 and engine.targetFor(r, 1) <= engine.targetFor(r - 1, 1) then acrossRising = false end
  end
  check("targets rise within every rubber", withinRising, true)
  check("each rubber starts higher than the last", acrossRising, true)
end

--------------------------------------------------------------------------
section("Whole runs")
--------------------------------------------------------------------------
do
  local finished, victories, bad = 0, 0, 0
  for i = 1, 60 do
    local run = bot.playRun("WHOLE" .. i)
    if run.phase == engine.PHASE.VICTORY or run.phase == engine.PHASE.GAME_OVER then
      finished = finished + 1
    end
    if run.phase == engine.PHASE.VICTORY then victories = victories + 1 end
    if run.money < 0 or #run.relics > engine.RELIC_SLOTS then bad = bad + 1 end
  end
  check("every bot run reaches an ending (60 runs)", finished, 60)
  check("money and relic slots stay valid", bad, 0)

  -- Same seed, same run.
  local a, b = bot.playRun("REPLAY"), bot.playRun("REPLAY")
  check("a seed replays identically (rubber)", a.rubber, b.rubber)
  check("a seed replays identically (score)", a.stats.totalScore, b.stats.totalScore)
end

print(("\n%d passed, %d failed"):format(passed, failed))
os.exit(failed == 0 and 0 or 1)
