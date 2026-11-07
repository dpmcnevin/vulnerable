--- Run engine: rubbers, boards, deals, scoring and the shop.
--
-- Pure logic with no LOVE dependency, so the same code drives both the
-- playable game and the headless balance simulator.
--
-- Structure of a run:
--   8 rubbers, 3 boards each. A board sets a target; you have a small number
--   of deals to reach it. Each deal you bid a contract and play it out.
--   Making the contract scores; going down scores nothing.

local cards = require("src.rules.cards")
local scoring = require("src.rules.scoring")
local play = require("src.rules.play")
local ai = require("src.rules.ai")
local bidding = require("src.rules.bidding")
local rngLib = require("src.rules.rng")
local relics = require("src.game.relics")
local conventions = require("src.game.conventions")

local M = {}

M.RUBBERS = 8
M.BOARDS_PER_RUBBER = 3
M.DEALS_PER_BOARD = 3
M.RELIC_SLOTS = 5
M.SHOP_SIZE = 3
M.BASE_REROLL_COST = 5
M.STARTING_MONEY = 6
M.INTEREST_PER = 5
M.MAX_INTEREST = 5
M.MONEY_PER_BOARD = 4
M.MONEY_PER_UNUSED_DEAL = 1

-- Target for the first board of each rubber. Fitted to how fast a sensible
-- relic build actually grows (see tools/simulate.lua), so the difficulty
-- comes from bidding and declarer play rather than from a wall of numbers.
M.RUBBER_BASE = { 200, 420, 650, 920, 1260, 1680, 2200, 2700 }
-- Multipliers for board 1, 2 and the vulnerable board 3 within a rubber.
M.BOARD_SCALE = { 1.0, 1.3, 1.65 }

M.PHASE = {
  BID = "bid",
  PLAY = "play",
  DEAL_SCORED = "deal_scored",
  BOARD_WON = "board_won",
  SHOP = "shop",
  GAME_OVER = "game_over",
  VICTORY = "victory",
}

--------------------------------------------------------------------- helpers

local function round10(n)
  if n < 100 then return math.floor(n / 5 + 0.5) * 5 end
  local mag = 10 ^ math.max(1, math.floor(math.log10(n)) - 1)
  return math.floor(n / mag + 0.5) * mag
end

--- Target score for a given rubber and board.
function M.targetFor(rubber, board)
  local base = M.RUBBER_BASE[math.min(rubber, #M.RUBBER_BASE)]
  if rubber > #M.RUBBER_BASE then
    -- Endless: keep climbing past the designed run.
    base = base * (1.75 ^ (rubber - #M.RUBBER_BASE))
  end
  return round10(base * M.BOARD_SCALE[board])
end

--- Vulnerability: the last board of every rubber, and everything from five on.
function M.isVulnerable(rubber, board)
  return board == M.BOARDS_PER_RUBBER or rubber >= 5
end

--------------------------------------------------------------------- new run

function M.newRun(seed, opts)
  opts = opts or {}
  seed = seed or rngLib.randomSeedString(rngLib.new())
  local run = {
    seed = seed,
    rng = rngLib.new(seed),
    rubber = 1,
    board = 1,
    boardsWonThisRubber = 0,
    money = opts.money or M.STARTING_MONEY,
    relics = {},
    strainLevels = { 1, 1, 1, 1, 1 },
    score = 0,
    target = 0,
    dealsLeft = 0,
    vulnerable = false,
    phase = nil,
    deal = nil,
    shop = nil,
    rerollCost = M.BASE_REROLL_COST,
    aiSkill = opts.aiSkill or ai.DEFAULT_SKILL,
    log = {},
    stats = {
      dealsPlayed = 0, contractsMade = 0, contractsFailed = 0,
      slamsMade = 0, bestDeal = 0, totalScore = 0, doubledMade = 0,
    },
  }
  M.startBoard(run)
  return run
end

--------------------------------------------------------------------- board

function M.startBoard(run)
  run.target = M.targetFor(run.rubber, run.board)
  run.vulnerable = M.isVulnerable(run.rubber, run.board)
  run.score = 0
  run.dealsLeft = M.DEALS_PER_BOARD
  run.deal = nil
  M.startDeal(run)
end

function M.boardName(run)
  if run.board == M.BOARDS_PER_RUBBER then return "Vulnerable Board" end
  return ("Board %d"):format(run.board)
end

--------------------------------------------------------------------- deal

--- Deal the cards and ask for a bid.
function M.startDeal(run)
  local hands = cards.deal(run.rng)
  local declarer, dummy = cards.SOUTH, cards.NORTH
  -- In real bridge the stronger partnership wins the auction. You always
  -- declare, so make sure you are that partnership: swap sides if needed.
  local ns = cards.hcp(hands[cards.NORTH]) + cards.hcp(hands[cards.SOUTH])
  if ns < 20 then
    hands[cards.NORTH], hands[cards.EAST] = hands[cards.EAST], hands[cards.NORTH]
    hands[cards.SOUTH], hands[cards.WEST] = hands[cards.WEST], hands[cards.SOUTH]
  end
  -- And you, not dummy, hold the stronger of the two hands.
  if cards.hcp(hands[dummy]) > cards.hcp(hands[declarer]) then
    hands[dummy], hands[declarer] = hands[declarer], hands[dummy]
  end
  run.deal = {
    hands = hands,
    original = {
      cards.copyHand(hands[1]), cards.copyHand(hands[2]),
      cards.copyHand(hands[3]), cards.copyHand(hands[4]),
    },
    declarer = declarer,
    dummy = dummy,
    partnerInfo = bidding.describePartner(hands[dummy]),
    dummyVisible = false,
    contract = nil,
    state = nil,
    result = nil,
  }
  run.phase = M.PHASE.BID
  return run.deal
end

--- Contracts the player may choose. Everything is legal; the risk is yours.
function M.availableContracts()
  return scoring.allContracts()
end

--- Lock in a contract. The defenders may double it, then play begins.
function M.commitBid(run, contract, opts)
  assert(run.phase == M.PHASE.BID, "commitBid: not bidding")
  local deal = run.deal
  local c = { level = contract.level, strain = contract.strain, doubled = 0 }

  if bidding.defendersDouble(c, deal.hands[deal.declarer], deal.hands[deal.dummy], run.rng) then
    c.doubled = 1
  end

  deal.contract = c
  -- The opening lead comes from the defender on declarer's left.
  local leader = cards.nextSeat(deal.declarer)
  deal.state = play.new(deal.hands, c.strain, leader)
  deal.dummyVisible = false
  run.phase = M.PHASE.PLAY
  -- The UI passes { stepwise = true } and calls stepAI itself, so each
  -- defender's card can be shown landing; tests and the bot advance at once.
  if not (opts and opts.stepwise) then M.advanceAI(run) end
  return c
end

--- Is it the player's turn? The player holds both declarer and dummy.
function M.isPlayerTurn(run)
  local deal = run.deal
  if not deal or not deal.state or deal.state.complete then return false end
  return cards.sameSide(deal.state.turn, deal.declarer)
end

local function aiContext(run)
  local deal = run.deal
  return {
    declarer = deal.declarer,
    dummy = deal.dummy,
    dummyVisible = deal.dummyVisible,
    rng = run.rng,
    skill = run.aiSkill,
  }
end

--- Let the AI defenders play until it is the player's turn or the deal ends.
-- Returns the tricks that completed, so the UI can animate them.
function M.advanceAI(run)
  local deal = run.deal
  local completed = {}
  local guard = 0
  while deal.state and not deal.state.complete and not M.isPlayerTurn(run) do
    guard = guard + 1
    assert(guard < 100, "advanceAI: stuck")
    local seat = deal.state.turn
    local card = ai.chooseCard(deal.state, seat, aiContext(run))
    local trick = play.play(deal.state, seat, card)
    -- Dummy goes face up once the opening lead is made.
    deal.dummyVisible = true
    if trick then completed[#completed + 1] = trick end
  end
  if deal.state and deal.state.complete then M.finishDeal(run) end
  return completed
end

--- Play one card from the declarer's or dummy's hand.
function M.playerPlay(run, card, opts)
  assert(run.phase == M.PHASE.PLAY, "playerPlay: not in play")
  local deal = run.deal
  local seat = deal.state.turn
  assert(cards.sameSide(seat, deal.declarer), "playerPlay: not your seat")
  assert(play.isLegal(deal.state, seat, card), "playerPlay: illegal card")
  local trick = play.play(deal.state, seat, card)
  deal.dummyVisible = true
  if opts and opts.stepwise then
    if deal.state.complete then M.finishDeal(run) end
    return trick and { trick } or {}
  end
  local more = M.advanceAI(run)
  if trick then table.insert(more, 1, trick) end
  return more
end

--- Play exactly one defender card. Returns the completed trick, if any.
function M.stepAI(run)
  local deal = run.deal
  if run.phase ~= M.PHASE.PLAY or not deal.state or deal.state.complete then return nil end
  if M.isPlayerTurn(run) then return nil end
  local seat = deal.state.turn
  local card = ai.chooseCard(deal.state, seat, aiContext(run))
  local trick = play.play(deal.state, seat, card)
  deal.dummyVisible = true
  if deal.state.complete then M.finishDeal(run) end
  return trick, seat, card
end

--- Hand the rest of the deal to the autopilot.
function M.playOut(run)
  local deal = run.deal
  ai.playOut(deal.state, aiContext(run))
  deal.dummyVisible = true
  M.finishDeal(run)
end

--------------------------------------------------------------------- scoring

--- The relic pipeline, shared by real scoring and the bid-screen preview.
--
-- Base bridge score, plus convention level, plus every relic's points, all
-- multiplied by the accumulated multiplier. A failed contract scores nothing.
local function scorePipeline(run, deal, contract, tricksWon, summary, state)
  local result = scoring.score(contract, tricksWon, run.vulnerable)
  local breakdown = {
    base = result.total,
    made = result.made,
    lines = {},
    points = 0,
    mult = 1,
    total = 0,
    bridge = result,
  }
  if not result.made then return breakdown end

  local fit = cards.countSuit(deal.original[deal.declarer], contract.strain)
             + cards.countSuit(deal.original[deal.dummy], contract.strain)
  local ctx = {
    contract = contract,
    result = result,
    tricksWon = tricksWon,
    made = result.made,
    vulnerable = run.vulnerable,
    hand = deal.original[deal.declarer],
    dummyHand = deal.original[deal.dummy],
    declarer = deal.declarer,
    summary = summary,
    fit = fit,
    state = state,
    run = run,
  }

  local points, mult = result.total, 1
  breakdown.lines[#breakdown.lines + 1] =
    { label = cards.contractName(contract) .. " scored", points = result.total }

  local cp, cm = conventions.bonusFor(run.strainLevels[contract.strain])
  if cp > 0 or cm > 0 then
    points = points + cp
    mult = mult + cm
    breakdown.lines[#breakdown.lines + 1] = {
      label = ("%s level %d"):format(cards.STRAINS[contract.strain].name,
                                     run.strainLevels[contract.strain]),
      points = cp, mult = cm,
    }
  end

  for i = 1, #run.relics do
    local relic = run.relics[i]
    if relic.def.score then
      local r = relic.def.score(ctx, relic)
      if r and (r.points or r.mult or r.xmult) then
        if r.points then points = points + r.points end
        if r.mult then mult = mult + r.mult end
        if r.xmult then mult = mult * r.xmult end
        breakdown.lines[#breakdown.lines + 1] = {
          label = relic.name, points = r.points, mult = r.mult, xmult = r.xmult,
        }
      end
    end
  end

  breakdown.points = points
  breakdown.mult = mult
  breakdown.total = math.floor(points * mult)
  return breakdown
end

--- Score a finished deal.
function M.computeScore(run, deal)
  local state = deal.state
  local tricksWon = play.declarerTricks(state, deal.declarer)
  local summary = play.summarise(state, deal.declarer)
  return scorePipeline(run, deal, deal.contract, tricksWon, summary, state)
end

local EMPTY_SUMMARY = {
  declarerTricks = 0, ruffs = 0, tricksFromDummy = 0, tricksFromDeclarer = 0,
  honourWins = 0, wonLastTrick = false, wonFirstTrick = false, lastThree = 0,
}
local EMPTY_STATE = { tricks = {} }

--- What a contract would score if made exactly, undoubled, with nothing
-- earned during play. Relics that depend on how the play goes count as zero,
-- so this is a floor the player can rely on when choosing a bid.
function M.projectScore(run, contract)
  local c = { level = contract.level, strain = contract.strain, doubled = 0 }
  local b = scorePipeline(run, run.deal, c, scoring.tricksNeeded(c), EMPTY_SUMMARY, EMPTY_STATE)
  return b.total, b
end

--- Odds and projected score for every contract, for the bid screen.
function M.bidOptions(run)
  local deal = run.deal
  local hand = deal.hands[deal.declarer]
  local out = {}
  for _, c in ipairs(scoring.allContracts()) do
    local est = bidding.estimateTricks(hand, deal.partnerInfo, c.strain)
    out[#out + 1] = {
      contract = c,
      chance = bidding.chanceToMake(est, scoring.tricksNeeded(c)),
      projected = M.projectScore(run, c),
    }
  end
  return out
end

--- The contract a careful player would choose: on the last deal, the safest
-- one that clears the board alone; earlier, the best balance of odds against
-- how much of the remaining target it covers. Shown as the bid screen's
-- recommendation and used by the balance-simulation bot.
function M.recommendBid(run, options)
  local need = math.max(1, run.target - run.score)
  options = options or M.bidOptions(run)
  local best, bestValue
  if run.dealsLeft <= 1 then
    for _, o in ipairs(options) do
      if o.projected >= need and (not bestValue or o.chance > bestValue) then
        best, bestValue = o, o.chance
      end
    end
    if best then return best.contract end
  end
  for _, o in ipairs(options) do
    local value = o.chance * math.min(o.projected, need) + 0.05 * o.chance * o.projected
    if not bestValue or value > bestValue then best, bestValue = o, value end
  end
  return best.contract
end

--- Resolve a completed deal: score it, bank it, and decide what happens next.
function M.finishDeal(run)
  local deal = run.deal
  if deal.result then return deal.result end

  local breakdown = M.computeScore(run, deal)
  deal.result = breakdown
  run.dealsLeft = run.dealsLeft - 1
  run.score = run.score + breakdown.total

  run.stats.dealsPlayed = run.stats.dealsPlayed + 1
  run.stats.totalScore = run.stats.totalScore + breakdown.total
  if breakdown.total > run.stats.bestDeal then run.stats.bestDeal = breakdown.total end

  if breakdown.made then
    run.stats.contractsMade = run.stats.contractsMade + 1
    if deal.contract.level >= 6 then run.stats.slamsMade = run.stats.slamsMade + 1 end
    if (deal.contract.doubled or 0) > 0 then run.stats.doubledMade = run.stats.doubledMade + 1 end
  else
    run.stats.contractsFailed = run.stats.contractsFailed + 1
    for i = 1, #run.relics do
      local r = run.relics[i]
      if r.def.onDealFail then
        local out = r.def.onDealFail({ run = run }, r)
        if out and out.money then run.money = run.money + out.money end
      end
    end
  end

  -- Scaling relics grow after the deal is banked, so growth applies next time.
  local endCtx = { made = breakdown.made, contract = deal.contract, run = run }
  for i = 1, #run.relics do
    local r = run.relics[i]
    if r.def.onDealEnd then r.def.onDealEnd(endCtx, r) end
  end

  run.log[#run.log + 1] = {
    rubber = run.rubber, board = run.board,
    contract = cards.contractName(deal.contract),
    tricks = breakdown.bridge.tricksWon,
    needed = breakdown.bridge.tricksNeeded,
    made = breakdown.made,
    score = breakdown.total,
  }

  run.phase = M.PHASE.DEAL_SCORED
  return breakdown
end

--- Move on after a deal has been scored and shown.
function M.continueAfterDeal(run)
  assert(run.phase == M.PHASE.DEAL_SCORED, "continueAfterDeal: nothing to continue")
  if run.score >= run.target then
    M.winBoard(run)
  elseif run.dealsLeft <= 0 then
    run.phase = M.PHASE.GAME_OVER
  else
    M.startDeal(run)
  end
  return run.phase
end

--------------------------------------------------------------------- economy

function M.interest(run)
  return math.min(M.MAX_INTEREST, math.floor(run.money / M.INTEREST_PER))
end

function M.winBoard(run)
  local earned = M.MONEY_PER_BOARD
  local unused = math.max(0, run.dealsLeft) * M.MONEY_PER_UNUSED_DEAL
  local interest = M.interest(run)
  local bonus = 0
  for i = 1, #run.relics do
    local r = run.relics[i]
    if r.def.onBoardWin then
      local out = r.def.onBoardWin({ run = run }, r)
      if out and out.money then bonus = bonus + out.money end
    end
  end
  run.lastPayout = {
    board = earned, unused = unused, interest = interest, relics = bonus,
    total = earned + unused + interest + bonus,
  }
  run.money = run.money + run.lastPayout.total
  run.boardsWonThisRubber = run.boardsWonThisRubber + 1
  run.phase = M.PHASE.BOARD_WON
  return run.lastPayout
end

--------------------------------------------------------------------- shop

function M.enterShop(run)
  run.phase = M.PHASE.SHOP
  run.rerollCost = M.BASE_REROLL_COST
  run.shop = { items = {} }
  for i = 1, M.SHOP_SIZE do
    run.shop.items[i] = M.rollShopItem(run)
  end
  return run.shop
end

function M.rollShopItem(run)
  -- Roughly one slot in four offers a convention rather than a relic.
  if run.rng:chance(0.25) then
    local def = conventions.randomDef(run.rng)
    return { kind = "convention", def = def, name = def.name,
             cost = 4 + run.strainLevels[def.strain] }
  end
  local def = relics.randomUnowned(run.rng, run.relics)
  if not def then
    local cdef = conventions.randomDef(run.rng)
    return { kind = "convention", def = cdef, name = cdef.name,
             cost = 4 + run.strainLevels[cdef.strain] }
  end
  return { kind = "relic", def = def, name = def.name, cost = def.cost }
end

function M.canBuy(run, index)
  local item = run.shop and run.shop.items[index]
  if not item or item.sold then return false, "gone" end
  if run.money < item.cost then return false, "too expensive" end
  if item.kind == "relic" and #run.relics >= M.RELIC_SLOTS then
    return false, "no relic slots"
  end
  return true
end

function M.buy(run, index)
  local ok, why = M.canBuy(run, index)
  if not ok then return false, why end
  local item = run.shop.items[index]
  run.money = run.money - item.cost
  if item.kind == "relic" then
    run.relics[#run.relics + 1] = relics.instantiate(item.def)
  else
    local s = item.def.strain
    run.strainLevels[s] = run.strainLevels[s] + 1
  end
  item.sold = true
  return true
end

function M.sellRelic(run, index)
  local relic = run.relics[index]
  if not relic then return false end
  run.money = run.money + math.max(1, math.floor(relic.cost / 2))
  table.remove(run.relics, index)
  return true
end

function M.reroll(run)
  if run.money < run.rerollCost then return false end
  run.money = run.money - run.rerollCost
  run.rerollCost = run.rerollCost + 1
  for i = 1, M.SHOP_SIZE do
    run.shop.items[i] = M.rollShopItem(run)
  end
  return true
end

--- Leave the shop and start the next board, rubber or the victory screen.
function M.leaveShop(run)
  run.board = run.board + 1
  if run.board > M.BOARDS_PER_RUBBER then
    run.board = 1
    run.rubber = run.rubber + 1
    run.boardsWonThisRubber = 0
  end
  if run.rubber > M.RUBBERS then
    run.phase = M.PHASE.VICTORY
    return run.phase
  end
  M.startBoard(run)
  return run.phase
end

return M
