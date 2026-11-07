--- Duplicate bridge contract scoring.
--
-- These are the real rules, not an approximation, because the whole risk
-- structure of the game rests on them: the jump from a part-score to a game
-- bonus, and from a game to a slam, is what makes bidding high worth it.
--
--   contract = { level = 1..7, strain = 1..5, doubled = 0|1|2 }
--
-- `level` is odd tricks: the contract needs level + 6 of the 13 tricks.

local cards = require("src.rules.cards")

local M = {}

M.PART_SCORE_BONUS = 50
M.GAME_BONUS = { [false] = 300, [true] = 500 }
M.SMALL_SLAM_BONUS = { [false] = 500, [true] = 750 }
M.GRAND_SLAM_BONUS = { [false] = 1000, [true] = 1500 }
M.INSULT_BONUS = { [0] = 0, [1] = 50, [2] = 100 }

--- Tricks needed to make a contract: six plus the level bid.
function M.tricksNeeded(contract)
  return contract.level + 6
end

--- Points per odd trick for a strain, excluding notrump's higher first trick.
function M.trickValue(strain)
  if strain == cards.NOTRUMP then return 30 end
  return cards.SUITS[strain].major and 30 or 20
end

--- Contract points: the part that decides part-score vs. game.
function M.contractPoints(contract)
  local base
  if contract.strain == cards.NOTRUMP then
    base = 40 + 30 * (contract.level - 1)
  else
    base = M.trickValue(contract.strain) * contract.level
  end
  return base * (2 ^ (contract.doubled or 0))
end

--- Is this contract worth game if made?
function M.isGame(contract)
  return M.contractPoints(contract) >= 100
end

--- Value of each overtrick, which doubling inflates enormously.
function M.overtrickValue(contract, vulnerable)
  local d = contract.doubled or 0
  if d == 0 then
    if contract.strain == cards.NOTRUMP then return 30 end
    return M.trickValue(contract.strain)
  end
  local base = vulnerable and 200 or 100
  return base * d
end

--- Total penalty for going down `n` tricks. Escalates, and doubling bites.
function M.undertrickPenalty(contract, n, vulnerable)
  if n <= 0 then return 0 end
  local d = contract.doubled or 0
  local total
  if d == 0 then
    total = (vulnerable and 100 or 50) * n
  elseif vulnerable then
    -- 200 for the first, 300 for each one after.
    total = 200 + 300 * (n - 1)
  else
    -- 100, then 200 for the second and third, then 300 each.
    total = 100
    if n >= 2 then total = total + 200 * math.min(n - 1, 2) end
    if n >= 4 then total = total + 300 * (n - 3) end
  end
  if d == 2 then total = total * 2 end
  return total
end

--- Score a finished deal.
--
-- Returns a table with the final `total` (negative when the contract fails)
-- and an itemised `lines` list for the UI, so the player can see exactly
-- where a number came from.
function M.score(contract, tricksWon, vulnerable)
  vulnerable = vulnerable and true or false
  local needed = M.tricksNeeded(contract)
  local made = tricksWon >= needed
  local result = {
    contract = contract,
    tricksWon = tricksWon,
    tricksNeeded = needed,
    made = made,
    vulnerable = vulnerable,
    overtricks = 0,
    undertricks = 0,
    contractPoints = 0,
    bonusPoints = 0,
    lines = {},
    total = 0,
  }

  local function add(label, amount)
    result.lines[#result.lines + 1] = { label = label, amount = amount }
  end

  if not made then
    result.undertricks = needed - tricksWon
    local penalty = M.undertrickPenalty(contract, result.undertricks, vulnerable)
    add(("Down %d"):format(result.undertricks), -penalty)
    result.total = -penalty
    return result
  end

  local cp = M.contractPoints(contract)
  result.contractPoints = cp
  add(cards.contractName(contract) .. " made", cp)

  result.overtricks = tricksWon - needed
  if result.overtricks > 0 then
    local each = M.overtrickValue(contract, vulnerable)
    add(("Overtricks x%d"):format(result.overtricks), each * result.overtricks)
  end

  local bonus = 0
  if cp >= 100 then
    local g = M.GAME_BONUS[vulnerable]
    add(vulnerable and "Game (vulnerable)" or "Game", g)
    bonus = bonus + g
  else
    add("Part-score", M.PART_SCORE_BONUS)
    bonus = bonus + M.PART_SCORE_BONUS
  end

  if contract.level == 6 then
    local s = M.SMALL_SLAM_BONUS[vulnerable]
    add("Small slam", s)
    bonus = bonus + s
  elseif contract.level == 7 then
    local s = M.GRAND_SLAM_BONUS[vulnerable]
    add("Grand slam", s)
    bonus = bonus + s
  end

  local insult = M.INSULT_BONUS[contract.doubled or 0] or 0
  if insult > 0 then
    add(contract.doubled == 2 and "Redoubled made" or "Doubled made", insult)
    bonus = bonus + insult
  end

  result.bonusPoints = bonus
  local overtrickTotal = result.overtricks * M.overtrickValue(contract, vulnerable)
  result.total = cp + overtrickTotal + bonus
  return result
end

--- Every legal contract, cheapest first. Used by the bid selector.
function M.allContracts()
  local out = {}
  for level = 1, 7 do
    for strain = 1, 5 do
      out[#out + 1] = { level = level, strain = strain, doubled = 0 }
    end
  end
  return out
end

--- What making this contract exactly would be worth. Used for UI hints.
function M.describeReward(contract, vulnerable)
  return M.score(contract, M.tricksNeeded(contract), vulnerable).total
end

return M
