--- Headless balance simulator. Run with: luajit tools/simulate.lua [runs] [seedPrefix]
--
-- Plays complete runs with the bot in tools/bot.lua: it bids to the board's
-- target using the bid screen's odds, declares on autopilot, and shops by a
-- simple rule. A human who plays the cards well should beat its numbers.

package.path = "./?.lua;" .. package.path

local engine = require("src.game.engine")

local runs = tonumber(arg[1]) or 200
local prefix = arg[2] or "SIM"
local verbose = arg[3] == "-v"

local bot = require("tools.bot")
local function playRun(seed) return bot.playRun(seed) end

local reached = {}         -- furthest rubber reached -> count
local boardDeaths = {}     -- "r.b" -> deaths
local wins, made, failed, doubled = 0, 0, 0, 0
local scores = {}

for i = 1, runs do
  local run = playRun(prefix .. i)
  if run.phase == engine.PHASE.VICTORY then wins = wins + 1 end
  local r = math.min(run.rubber, engine.RUBBERS)
  reached[r] = (reached[r] or 0) + 1
  if run.phase == engine.PHASE.GAME_OVER then
    local k = run.rubber .. "." .. run.board
    boardDeaths[k] = (boardDeaths[k] or 0) + 1
  end
  made = made + run.stats.contractsMade
  failed = failed + run.stats.contractsFailed
  doubled = doubled + run.stats.doubledMade
  for _, entry in ipairs(run.log) do scores[#scores + 1] = entry.score end
  if verbose then
    print(("%-8s %s  rubber %d board %d  relics %d  $%d")
      :format(run.seed, run.phase, run.rubber, run.board, #run.relics, run.money))
  end
end

print(("\n%d runs  |  victories %d (%.1f%%)"):format(runs, wins, 100 * wins / runs))
print(("contracts made %d, failed %d  (%.1f%% made)")
  :format(made, failed, 100 * made / math.max(1, made + failed)))

print("\nFurthest rubber reached:")
for r = 1, engine.RUBBERS do
  local n = reached[r] or 0
  print(("  rubber %d  %4d  %s"):format(r, n, string.rep("#", math.floor(60 * n / runs))))
end

print("\nWhere runs ended (rubber.board):")
local keys = {}
for k in pairs(boardDeaths) do keys[#keys + 1] = k end
table.sort(keys, function(a, b)
  local ra, ba = a:match("(%d+)%.(%d+)")
  local rb, bb = b:match("(%d+)%.(%d+)")
  if tonumber(ra) ~= tonumber(rb) then return tonumber(ra) < tonumber(rb) end
  return tonumber(ba) < tonumber(bb)
end)
for _, k in ipairs(keys) do
  local r, b = k:match("(%d+)%.(%d+)")
  print(("  %s  target %6d  deaths %4d"):format(k, engine.targetFor(tonumber(r), tonumber(b)), boardDeaths[k]))
end

table.sort(scores)
local function pct(p) return scores[math.max(1, math.floor(#scores * p))] or 0 end
print(("\nPer-deal score  p25 %d  median %d  p75 %d  p95 %d")
  :format(pct(0.25), pct(0.5), pct(0.75), pct(0.95)))
