--- A reasonable but unspectacular player, for balance simulation.
--
-- Bids to the board's target using the same odds and projected scores the
-- bid screen shows a human, plays every deal on autopilot, and shops by a
-- simple rule. A thoughtful human should do noticeably better.

local engine = require("src.game.engine")

local M = {}

--- Choose a contract: the same recommendation the bid screen shows a human.
function M.bid(run)
  return engine.recommendBid(run)
end

local function relicValue(def)
  return def.rarity * 10 + def.cost
end

--- The strain this run is building around: whichever has the most levels,
-- preferring notrump and the majors, which score fastest.
local function focusStrain(run)
  local best, bestLevel = 5, -1
  for _, s in ipairs({ 5, 4, 3, 2, 1 }) do
    if run.strainLevels[s] > bestLevel then best, bestLevel = s, run.strainLevels[s] end
  end
  return best
end

--- Spend money. Upgrade relics when slots are full, and stack one strain.
function M.shop(run)
  engine.enterShop(run)
  local engineRelicSlots = engine.RELIC_SLOTS
  for _ = 1, 10 do
    local best, bestScore
    for i, item in ipairs(run.shop.items) do
      if not item.sold and run.money >= item.cost then
        local score
        if item.kind == "relic" then
          score = relicValue(item.def)
          if #run.relics >= engineRelicSlots then
            -- Worth it only as an upgrade over our weakest relic.
            local weakest = math.huge
            for _, r in ipairs(run.relics) do weakest = math.min(weakest, relicValue(r.def)) end
            score = (score > weakest + 5) and score or nil
          end
        else
          score = (item.def.strain == focusStrain(run)) and 30 or 4
        end
        if score and (not bestScore or score > bestScore) then best, bestScore = i, score end
      end
    end
    if not best then break end
    local item = run.shop.items[best]
    if item.kind == "relic" and #run.relics >= engineRelicSlots then
      local wi, wv
      for i, r in ipairs(run.relics) do
        if not wv or relicValue(r.def) < wv then wi, wv = i, relicValue(r.def) end
      end
      engine.sellRelic(run, wi)
    end
    if not engine.buy(run, best) then break end
  end
  -- Reroll once if rich, hunting for upgrades.
  if run.money >= 20 and engine.reroll(run) then
    for i, item in ipairs(run.shop.items) do
      if item.kind == "relic" and engine.canBuy(run, i) then engine.buy(run, i) end
    end
  end
  engine.leaveShop(run)
end

--- Play a full run and return the finished run table.
function M.playRun(seed, opts)
  local run = engine.newRun(seed, opts)
  for _ = 1, 5000 do
    local phase = run.phase
    if phase == engine.PHASE.BID then
      engine.commitBid(run, M.bid(run))
    elseif phase == engine.PHASE.PLAY then
      engine.playOut(run)
    elseif phase == engine.PHASE.DEAL_SCORED then
      engine.continueAfterDeal(run)
    elseif phase == engine.PHASE.BOARD_WON then
      M.shop(run)
    else
      return run
    end
  end
  error("run did not terminate: " .. tostring(seed))
end

return M
