--- Partner's bid, and trick estimation.
--
-- You never see your partner's cards before you commit to a contract. What
-- you get is what a bid conveys: a point range, any long suit, and whether
-- the hand is balanced. Dummy comes down only after you have bid.

local cards = require("src.rules.cards")
local scoring = require("src.rules.scoring")

local M = {}

-- The ranges a bid narrows a hand to, in ascending order.
M.RANGES = {
  { low = 0,  high = 5,  name = "Pass",      note = "very weak" },
  { low = 6,  high = 9,  name = "Minimum",   note = "a few scattered points" },
  { low = 10, high = 12, name = "Invitational", note = "close to an opening hand" },
  { low = 13, high = 15, name = "Opening",   note = "a sound opening hand" },
  { low = 16, high = 18, name = "Strong",    note = "strong" },
  { low = 19, high = 40, name = "Powerhouse", note = "a powerhouse" },
}

local function rangeFor(hcp)
  for i = 1, #M.RANGES do
    local r = M.RANGES[i]
    if hcp >= r.low and hcp <= r.high then return r end
  end
  return M.RANGES[#M.RANGES]
end

--- What partner's bid tells you about their hand.
function M.describePartner(hand)
  local hcp = cards.hcp(hand)
  local range = rangeFor(hcp)
  local counts = cards.shape(hand)
  local longSuits = {}
  for suit = 4, 1, -1 do
    if counts[suit] >= 5 then
      longSuits[#longSuits + 1] = { suit = suit, length = counts[suit] }
    end
  end
  local balanced = cards.isBalanced(hand)

  local parts = { ("%d-%d points"):format(range.low, math.min(range.high, 24)) }
  if #longSuits > 0 then
    local names = {}
    for i = 1, #longSuits do
      names[i] = ("%d %s"):format(longSuits[i].length, cards.SUITS[longSuits[i].suit].glyph)
    end
    parts[#parts + 1] = table.concat(names, ", ")
  elseif balanced then
    parts[#parts + 1] = "balanced"
  end

  return {
    hcp = hcp,                 -- the truth; the UI must not show this pre-bid
    range = range,
    midpoint = (range.low + math.min(range.high, 22)) / 2,
    longSuits = longSuits,
    balanced = balanced,
    text = table.concat(parts, " · "),
  }
end

--- Estimated tricks for a strain, from your hand plus what partner's bid says.
--
-- Fitted to what the declarer autopilot actually takes against the AI
-- defenders over thousands of deals (tools/simulate.lua): roughly one trick
-- per 3.75 combined points, then adjusted for trump length and shortness.
-- A careful human declarer should beat it by a fraction of a trick.
function M.estimateTricks(hand, partnerInfo, strain)
  local myHcp = cards.hcp(hand)
  local combined = myHcp + (partnerInfo.midpoint or 0)
  local tricks = 5.5 + (combined - 14) / 3.75

  if strain ~= cards.NOTRUMP then
    -- Trump length: your own holding, plus what partner's bid implies.
    local mine = cards.countSuit(hand, strain)
    local theirs = 3
    for i = 1, #partnerInfo.longSuits do
      if partnerInfo.longSuits[i].suit == strain then
        theirs = partnerInfo.longSuits[i].length
      end
    end
    local fit = mine + theirs
    if fit >= 8 then
      tricks = tricks + 0.5 * (fit - 7)
      tricks = tricks + cards.shortnessPoints(hand) * 0.25
    else
      -- Playing a suit without a fit is a liability.
      tricks = tricks - (8 - fit) * 0.6
    end
  else
    if cards.isBalanced(hand) then tricks = tricks + 0.3 end
    -- Notrump wants stoppers; a void or singleton is a hole to run.
    local counts = cards.shape(hand)
    for suit = 1, 4 do
      if counts[suit] <= 1 and not partnerInfo.balanced then tricks = tricks - 0.4 end
    end
  end

  return math.max(0, math.min(13, tricks))
end

--- Suggest a contract, the way a partnership would land on one.
function M.suggest(hand, partnerInfo, vulnerable)
  local best, bestValue
  for strain = 1, 5 do
    local est = M.estimateTricks(hand, partnerInfo, strain)
    -- Bid the level we expect to make, not a level beyond it.
    local level = math.max(1, math.min(7, math.floor(est) - 6))
    if level >= 1 then
      local contract = { level = level, strain = strain, doubled = 0 }
      local value = scoring.describeReward(contract, vulnerable)
      -- Prefer majors and notrump on ties; they score faster.
      if strain == cards.NOTRUMP or cards.SUITS[strain].major then value = value + 5 end
      if not bestValue or value > bestValue then best, bestValue = contract, value end
    end
  end
  return best or { level = 1, strain = cards.NOTRUMP, doubled = 0 }
end

-- Spread of real results around the estimate, in tricks (measured in sim).
M.ESTIMATE_SIGMA = 1.35

--- Standard normal CDF (Abramowitz-Stegun approximation; plenty for odds).
local function normalCdf(x)
  local sign = x < 0 and -1 or 1
  x = math.abs(x) / math.sqrt(2)
  local t = 1 / (1 + 0.3275911 * x)
  local y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
            - 0.284496736) * t + 0.254829592) * t * math.exp(-x * x)
  return 0.5 * (1 + sign * y)
end

--- Chance of taking at least `needed` tricks given an estimate.
function M.chanceToMake(estimate, needed)
  -- Continuity correction: tricks are whole numbers.
  return 1 - normalCdf((needed - 0.5 - estimate) / M.ESTIMATE_SIGMA)
end

--- The contract with the best expected score: chance to make x value.
-- Failing scores nothing toward the target, so this is the right yardstick.
-- Returns the contract, its odds, and its expected value.
function M.bestByExpectedValue(hand, partnerInfo, vulnerable)
  local best, bestEv, bestP
  for strain = 1, 5 do
    local est = M.estimateTricks(hand, partnerInfo, strain)
    for level = 1, 7 do
      local contract = { level = level, strain = strain, doubled = 0 }
      local p = M.chanceToMake(est, level + 6)
      local ev = p * scoring.describeReward(contract, vulnerable)
      if not bestEv or ev > bestEv then
        best, bestEv, bestP = contract, ev, p
      end
    end
  end
  return best, bestP, bestEv
end

--- Would the defenders double this? They do it when the bid looks greedy.
--
-- The defenders can count their own points, so a contract that needs more
-- strength than the declaring side can hold invites a penalty double.
function M.defendersDouble(contract, declarerHand, dummyHand, rng)
  local combined = cards.hcp(declarerHand) + cards.hcp(dummyHand)
  local needed = 14 + 3 * (scoring.tricksNeeded(contract) - 6)
  local shortfall = needed - combined
  if shortfall <= 2 then return false end
  -- The greedier the bid, the likelier the double.
  local p = math.min(0.85, 0.12 * shortfall)
  return rng:chance(p)
end

return M
