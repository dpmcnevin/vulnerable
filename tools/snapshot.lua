--- Render every screen to SVG without LOVE, for checking layout by eye.
-- Run with: luajit tools/snapshot.lua <output-dir>
--
-- Uses the recording LOVE stub. Text metrics are approximate, so treat the
-- output as a layout check, not a pixel-accurate screenshot.

package.path = "./?.lua;" .. package.path

local outDir = arg[1] or "snapshots"
os.execute(('mkdir -p "%s"'):format(outDir))

local stub = require("tests.love_stub")
stub.install()
dofile("main.lua")

local W = require("src.ui.widgets")
local App = require("src.ui.app")
local engine = require("src.game.engine")
local relics = require("src.game.relics")
local PHASE = engine.PHASE

love.load()

local shots = {}

local function frame(dt)
  love.update(dt or 0.05)
  love.draw()
end

local function snap(name, mx, my)
  if mx then love.mousemoved(mx, my) end
  stub.svg = {}
  love.draw()
  local body = table.concat(stub.svg, "\n")
  stub.svg = nil
  local svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" '
    .. 'font-family="DejaVu Sans, Verdana, sans-serif">\n<rect width="1280" height="720" fill="#0b1f17"/>\n%s\n</svg>\n')
    :format(body)
  local path = ("%s/%02d-%s.svg"):format(outDir, #shots + 1, name)
  local f = assert(io.open(path, "w"))
  f:write(svg)
  f:close()
  shots[#shots + 1] = { name = name, file = path:match("[^/]+$") }
  print("wrote " .. path)
end

local function click(pred)
  for i = #W.hits, 1, -1 do
    local h = W.hits[i]
    if h.label and pred(h.label) then
      love.mousemoved(h.x + h.w / 2, h.y + h.h / 2)
      love.mousepressed(h.x + h.w / 2, h.y + h.h / 2, 1)
      return true
    end
  end
  return false
end
local function is(s) return function(l) return l == s end end
local function starts(s) return function(l) return l:sub(1, #s) == s end end

-- Menu and help.
frame()
snap("menu")
click(is("How to play")); frame()
snap("help")
click(is("Got it")); frame()

-- Start a seeded run and give it some relics so panels are populated.
App.seedInput = "SNAPSHOT"
click(is("New run")); frame()
local run = App.run
for _, key in ipairs({ "purist", "club_regular", "nine_card_fit", "the_finesse" }) do
  run.relics[#run.relics + 1] = relics.instantiate(relics.get(key))
end
run.strainLevels[5] = 3
run.money = 23
frame()
-- Hover a cell to show the detail line, select the recommendation.
local rec = App.recommended
click(is(("bid:%d.%d"):format(rec.level, rec.strain))); frame()
snap("bid")

click(is("Bid")); frame()
-- Let the AI lead and wait until it's our turn mid-hand.
for _ = 1, 400 do
  frame(0.5)
  local st = run.deal.state
  if engine.isPlayerTurn(run) and not App.trickHold and #st.tricks >= 3 and #st.trick >= 1 then break end
  if engine.isPlayerTurn(run) and not App.trickHold then click(starts("card:")) end
end
snap("play-your-turn", 760, 640)

-- A completed trick held on the table.
for _ = 1, 200 do
  frame(0.05)
  if App.trickHold then break end
  if engine.isPlayerTurn(run) then click(starts("card:")) end
end
snap("trick-won")

-- Finish the deal and show the score panel.
App.trickHold = nil
click(is("Play it out")); frame()
for _ = 1, 40 do frame(0.5) end
snap("deal-scored")

-- Force a board win to show the payout and shop.
run.score = run.target
run.phase = PHASE.DEAL_SCORED
click(function(l) return l == "Board won!" end); frame()
snap("board-won")
click(is("Enter the club")); frame()
snap("shop", 600, 200)

-- Game over.
run.phase = PHASE.GAME_OVER
frame()
snap("game-over")

-- Index page showing every snapshot.
local html = { "<!doctype html><meta charset='utf-8'><title>Vulnerable snapshots</title>",
  "<style>body{background:#111;color:#ddd;font-family:sans-serif;margin:16px}"
  .. "figure{margin:0 0 28px}img{width:100%;max-width:1280px;border:1px solid #333}</style>" }
for _, s in ipairs(shots) do
  html[#html + 1] = ("<figure><figcaption>%s</figcaption><img src='%s'></figure>"):format(s.name, s.file)
end
local f = assert(io.open(outDir .. "/index.html", "w"))
f:write(table.concat(html, "\n"))
f:close()
print("wrote " .. outDir .. "/index.html")
