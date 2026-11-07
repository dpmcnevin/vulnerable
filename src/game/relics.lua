--- Relics: the items you collect to turn a made contract into a big number.
--
-- Every relic is a real bridge idea -- a holding, a technique, a kind of
-- hand -- so that reading your relics teaches you something about the game.
--
-- Each relic may define:
--   score(ctx) -> { points = n, mult = n, xmult = n }
--       points add to the bridge score, mult adds to the multiplier,
--       xmult multiplies it. Called once when a deal is scored.
--   onBoardWin(ctx, relic) -> { money = n }
--   onDealFail(ctx, relic) -> { money = n }
--   onDealEnd(ctx, relic)
--       called after every deal; scaling relics grow their `relic.state` here.
--   describe(relic) -> string
--       live text for relics whose value changes over the run.
--
-- `score` also receives the owned relic as its second argument, so scaling
-- relics can read the value they have built up.
--
-- ctx fields: contract, result, tricksWon, made, vulnerable, hand, dummyHand
--             (both as dealt), summary (play telemetry), fit, state, run.

local cards = require("src.rules.cards")
local scoring = require("src.rules.scoring")

local M = {}

M.RARITY = { COMMON = 1, UNCOMMON = 2, RARE = 3, LEGENDARY = 4 }
M.RARITY_NAME = { "Common", "Uncommon", "Rare", "Legendary" }

local function countIf(hand, pred)
  local n = 0
  for i = 1, #hand do if pred(hand[i]) then n = n + 1 end end
  return n
end

--- All relic definitions, keyed for save files.
M.DEFS = {
  ---------------------------------------------------------------- common
  {
    key = "honour_roll", name = "Honour Roll", rarity = 1, cost = 4,
    text = "+12 points for each ten, jack, queen, king or ace in your hand",
    score = function(ctx)
      return { points = 12 * countIf(ctx.hand, cards.isHonour) }
    end,
  },
  {
    key = "ace_collector", name = "Ace Collector", rarity = 1, cost = 5,
    text = "+45 points for each ace in your hand",
    score = function(ctx)
      return { points = 45 * cards.countRank(ctx.hand, 14) }
    end,
  },
  {
    key = "milton_work", name = "Milton Work", rarity = 1, cost = 5,
    text = "+5 points for each high card point in your hand",
    score = function(ctx)
      return { points = 5 * cards.hcp(ctx.hand) }
    end,
  },
  {
    key = "the_ruffer", name = "The Ruffer", rarity = 1, cost = 5,
    text = "+50 points for each trick you win with a trump when another suit was led",
    score = function(ctx)
      return { points = 50 * ctx.summary.ruffs }
    end,
  },
  {
    key = "dummy_reversal", name = "Dummy Reversal", rarity = 1, cost = 5,
    text = "+35 points for each trick won in the dummy",
    score = function(ctx)
      return { points = 35 * ctx.summary.tricksFromDummy }
    end,
  },
  {
    key = "shape_shifter", name = "Shape Shifter", rarity = 1, cost = 4,
    text = "+28 points for each card in your longest suit",
    score = function(ctx)
      local _, len = cards.longestSuit(ctx.hand)
      return { points = 28 * len }
    end,
  },
  {
    key = "overtrick_artist", name = "Overtrick Artist", rarity = 1, cost = 5,
    text = "Each overtrick is worth +80 points",
    score = function(ctx)
      return { points = 80 * (ctx.result.overtricks or 0) }
    end,
  },
  {
    key = "safety_play", name = "Safety Play", rarity = 1, cost = 5,
    text = "+180 points if you make your contract exactly",
    score = function(ctx)
      if ctx.made and ctx.result.overtricks == 0 then return { points = 180 } end
      return nil
    end,
  },
  {
    key = "the_squeeze", name = "The Squeeze", rarity = 1, cost = 5,
    text = "+110 points if you win the last trick",
    score = function(ctx)
      if ctx.summary.wonLastTrick then return { points = 110 } end
      return nil
    end,
  },
  {
    key = "endplay", name = "Endplay", rarity = 1, cost = 6,
    text = "+55 points for each of the last three tricks you win",
    score = function(ctx)
      return { points = 55 * ctx.summary.lastThree }
    end,
  },

  -------------------------------------------------------------- uncommon
  {
    key = "nine_card_fit", name = "Nine-Card Fit", rarity = 2, cost = 7,
    text = "x1.5 if you and dummy hold nine or more trumps between you",
    score = function(ctx)
      if ctx.contract.strain ~= cards.NOTRUMP and ctx.fit >= 9 then
        return { xmult = 1.5 }
      end
      return nil
    end,
  },
  {
    key = "the_void", name = "The Void", rarity = 2, cost = 7,
    text = "x2 if you were dealt a void",
    score = function(ctx)
      local counts = cards.shape(ctx.hand)
      for suit = 1, 4 do
        if counts[suit] == 0 then return { xmult = 2 } end
      end
      return nil
    end,
  },
  {
    key = "singleton", name = "Singleton", rarity = 2, cost = 6,
    text = "+90 points for each singleton in your hand",
    score = function(ctx)
      local counts, n = cards.shape(ctx.hand), 0
      for suit = 1, 4 do if counts[suit] == 1 then n = n + 1 end end
      return { points = 90 * n }
    end,
  },
  {
    key = "flat_hand", name = "Flat Hand", rarity = 2, cost = 6,
    text = "x2 if your hand is balanced",
    score = function(ctx)
      if cards.isBalanced(ctx.hand) then return { xmult = 2 } end
      return nil
    end,
  },
  {
    key = "minor_nobility", name = "Minor Nobility", rarity = 2, cost = 6,
    text = "Clubs and diamonds score as though they were major suits",
    score = function(ctx)
      local s = ctx.contract.strain
      if ctx.made and (s == cards.CLUBS or s == cards.DIAMONDS) then
        -- Lift 20-a-trick up to 30-a-trick, doubling included.
        local bump = 10 * ctx.contract.level * (2 ^ (ctx.contract.doubled or 0))
        return { points = bump }
      end
      return nil
    end,
  },
  {
    key = "purist", name = "The Purist", rarity = 2, cost = 6,
    text = "+140 points on notrump contracts",
    score = function(ctx)
      if ctx.contract.strain == cards.NOTRUMP then return { points = 140 } end
      return nil
    end,
  },
  {
    key = "vulnerable", name = "Vulnerable", rarity = 2, cost = 7,
    text = "x2 while you are vulnerable",
    score = function(ctx)
      if ctx.vulnerable then return { xmult = 2 } end
      return nil
    end,
  },
  {
    key = "partners_trust", name = "Partner's Trust", rarity = 2, cost = 6,
    text = "x1.6 if dummy came down with 12 or more points",
    score = function(ctx)
      if cards.hcp(ctx.dummyHand) >= 12 then return { xmult = 1.6 } end
      return nil
    end,
  },
  {
    key = "underdog", name = "Underdog", rarity = 2, cost = 7,
    text = "x2.5 if dummy came down with 5 points or fewer",
    score = function(ctx)
      if cards.hcp(ctx.dummyHand) <= 5 then return { xmult = 2.5 } end
      return nil
    end,
  },
  {
    key = "bold_bidding", name = "Bold Bidding", rarity = 2, cost = 7,
    text = "+150 points for each level you bid above three",
    score = function(ctx)
      local above = math.max(0, ctx.contract.level - 3)
      return { points = 150 * above }
    end,
  },
  {
    key = "crossruff", name = "Crossruff", rarity = 2, cost = 6,
    text = "+45 points for each trick you win with a trump",
    score = function(ctx)
      local n = 0
      local trump = ctx.contract.strain
      if trump == cards.NOTRUMP then return nil end
      for i = 1, #ctx.state.tricks do
        local t = ctx.state.tricks[i]
        if cards.sameSide(t.winner, ctx.declarer) and t.winningCard.suit == trump then
          n = n + 1
        end
      end
      return { points = 45 * n }
    end,
  },
  {
    key = "rubber_baron", name = "Rubber Baron", rarity = 2, cost = 6,
    text = "Earn $4 extra each time you win a board",
    onBoardWin = function() return { money = 4 } end,
  },
  {
    key = "insurance", name = "Insurance", rarity = 2, cost = 5,
    text = "Earn $4 whenever a contract of yours fails",
    onDealFail = function() return { money = 4 } end,
  },

  ------------------------------------------------------------------ rare
  {
    key = "the_finesse", name = "The Finesse", rarity = 3, cost = 8,
    text = "+70 points for each trick you win with a queen or a jack",
    score = function(ctx)
      local n = 0
      for i = 1, #ctx.state.tricks do
        local t = ctx.state.tricks[i]
        if cards.sameSide(t.winner, ctx.declarer)
           and (t.winningCard.rank == 12 or t.winningCard.rank == 11) then
          n = n + 1
        end
      end
      return { points = 70 * n }
    end,
  },
  {
    key = "grand_design", name = "Grand Design", rarity = 3, cost = 9,
    text = "x2 on a small slam, x3 on a grand slam",
    score = function(ctx)
      if ctx.contract.level == 7 then return { xmult = 3 } end
      if ctx.contract.level == 6 then return { xmult = 2 } end
      return nil
    end,
  },
  {
    key = "doubled_down", name = "Doubled Down", rarity = 3, cost = 9,
    text = "x3 if the defenders doubled you",
    score = function(ctx)
      if (ctx.contract.doubled or 0) > 0 then return { xmult = 3 } end
      return nil
    end,
  },
  {
    key = "slam_dunk", name = "Slam Dunk", rarity = 3, cost = 9,
    text = "A small slam pays the grand slam bonus",
    score = function(ctx)
      if ctx.made and ctx.contract.level == 6 then
        local v = ctx.vulnerable
        return { points = scoring.GRAND_SLAM_BONUS[v] - scoring.SMALL_SLAM_BONUS[v] }
      end
      return nil
    end,
  },
  {
    key = "trump_coup", name = "Trump Coup", rarity = 3, cost = 8,
    text = "x1.25 for each trick you win beyond your contract",
    score = function(ctx)
      local over = ctx.result.overtricks or 0
      if over > 0 then return { xmult = 1.25 ^ over } end
      return nil
    end,
  },

  --------------------------------------------------------------- scaling
  {
    key = "club_regular", name = "Club Regular", rarity = 1, cost = 5,
    text = "Gains +25 points every time you make a contract",
    describe = function(relic)
      return ("Gains +25 points every time you make a contract (now +%d)")
        :format(relic.state.points or 0)
    end,
    onDealEnd = function(ctx, relic)
      if ctx.made then relic.state.points = (relic.state.points or 0) + 25 end
    end,
    score = function(ctx, relic)
      local p = relic.state.points or 0
      if p > 0 then return { points = p } end
      return nil
    end,
  },
  {
    key = "master_points", name = "Master Points", rarity = 2, cost = 7,
    text = "Gains +0.2 mult every time you make a game or better",
    describe = function(relic)
      return ("Gains +0.2 mult every time you make a game or better (now +%.1f)")
        :format(relic.state.mult or 0)
    end,
    onDealEnd = function(ctx, relic)
      if ctx.made and scoring.isGame(ctx.contract) then
        relic.state.mult = (relic.state.mult or 0) + 0.2
      end
    end,
    score = function(ctx, relic)
      local m = relic.state.mult or 0
      if m > 0 then return { mult = m } end
      return nil
    end,
  },
  {
    key = "life_master", name = "Life Master", rarity = 3, cost = 10,
    text = "Gains x0.15 every board you win",
    describe = function(relic)
      return ("Gains x0.15 every board you win (now x%.2f)"):format(1 + (relic.state.x or 0))
    end,
    onBoardWin = function(ctx, relic)
      relic.state.x = (relic.state.x or 0) + 0.15
    end,
    score = function(ctx, relic)
      local x = relic.state.x or 0
      if x > 0 then return { xmult = 1 + x } end
      return nil
    end,
  },
  {
    key = "slam_hunter", name = "Slam Hunter", rarity = 3, cost = 9,
    text = "Gains x0.5 every time you make a slam",
    describe = function(relic)
      return ("Gains x0.5 every time you make a slam (now x%.1f)"):format(1 + (relic.state.x or 0))
    end,
    onDealEnd = function(ctx, relic)
      if ctx.made and ctx.contract.level >= 6 then
        relic.state.x = (relic.state.x or 0) + 0.5
      end
    end,
    score = function(ctx, relic)
      local x = relic.state.x or 0
      if x > 0 then return { xmult = 1 + x } end
      return nil
    end,
  },

  ------------------------------------------------------------- legendary
  {
    key = "clean_sweep", name = "Clean Sweep", rarity = 4, cost = 12,
    text = "x5 if you win all thirteen tricks",
    score = function(ctx)
      if ctx.tricksWon >= 13 then return { xmult = 5 } end
      return nil
    end,
  },
  {
    key = "the_rubber", name = "The Rubber", rarity = 4, cost = 12,
    text = "x1.3, and x1.3 again for every board already won this rubber",
    score = function(ctx)
      local n = 1 + (ctx.run and ctx.run.boardsWonThisRubber or 0)
      return { xmult = 1.3 ^ n }
    end,
  },
  {
    key = "vienna_coup", name = "Vienna Coup", rarity = 4, cost = 13,
    text = "x1.1 for each high card point in your hand above ten",
    score = function(ctx)
      local extra = math.max(0, cards.hcp(ctx.hand) - 10)
      if extra > 0 then return { xmult = 1.1 ^ extra } end
      return nil
    end,
  },
}

M.BY_KEY = {}
for i = 1, #M.DEFS do
  M.BY_KEY[M.DEFS[i].key] = M.DEFS[i]
end

function M.get(key)
  return M.BY_KEY[key]
end

--- Weighted rarity roll for shop stock.
function M.randomDef(rng, rarityWeights)
  rarityWeights = rarityWeights or { 0.62, 0.28, 0.085, 0.015 }
  local roll, acc, rarity = rng:next(), 0, 1
  for r = 1, 4 do
    acc = acc + rarityWeights[r]
    if roll <= acc then rarity = r; break end
  end
  local pool = {}
  for i = 1, #M.DEFS do
    if M.DEFS[i].rarity == rarity then pool[#pool + 1] = M.DEFS[i] end
  end
  if #pool == 0 then pool = M.DEFS end
  return rng:pick(pool)
end

--- Pick a definition not already owned, so the shop does not offer duplicates.
function M.randomUnowned(rng, owned, rarityWeights)
  local ownedKeys = {}
  for i = 1, #owned do ownedKeys[owned[i].key] = true end
  for _ = 1, 40 do
    local def = M.randomDef(rng, rarityWeights)
    if not ownedKeys[def.key] then return def end
  end
  for i = 1, #M.DEFS do
    if not ownedKeys[M.DEFS[i].key] then return M.DEFS[i] end
  end
  return nil
end

--- Create an owned instance of a relic.
function M.instantiate(def)
  return { key = def.key, def = def, name = def.name, cost = def.cost, state = {} }
end

--- Current text for an owned relic (scaling relics report their value).
function M.textFor(relic)
  if relic.def.describe then return relic.def.describe(relic) end
  return relic.def.text
end

return M
