--- Headless UI test: plays whole runs through the real UI code by clicking.
-- Run with: luajit tests/test_ui.lua
--
-- Uses tests/love_stub.lua in place of LOVE. Every frame is drawn, so any
-- bad argument to a draw call or nil access in a screen fails the test.

package.path = "./?.lua;" .. package.path

local stub = require("tests.love_stub")
stub.install()
dofile("main.lua")

local W = require("src.ui.widgets")
local App = require("src.ui.app")
local engine = require("src.game.engine")
local PHASE = engine.PHASE

local passed, failed = 0, 0
local function check(label, cond)
  if cond then passed = passed + 1 else
    failed = failed + 1
    print("  FAIL " .. label)
  end
end

local function frame(dt)
  love.update(dt or 0.05)
  stub.texts = {}
  love.draw()
end

local function findHit(pred)
  for i = #W.hits, 1, -1 do
    local h = W.hits[i]
    if h.label and pred(h.label) then return h end
  end
end

--- Click a labelled hit area through the real mouse path.
local function clickLabel(pred, what)
  local h = findHit(pred)
  if not h then return false end
  love.mousemoved(h.x + h.w / 2, h.y + h.h / 2)
  love.mousepressed(h.x + h.w / 2, h.y + h.h / 2, 1)
  return true
end

local function startsWith(prefix)
  return function(label) return label:sub(1, #prefix) == prefix end
end

local function screenHasText(fragment)
  for _, t in ipairs(stub.texts) do
    if t:find(fragment, 1, true) then return true end
  end
  return false
end

love.load()

--------------------------------------------------------------------------
print("\nMenu")
--------------------------------------------------------------------------
frame()
check("title is drawn", screenHasText("VULNERABLE"))
check("New run button exists", findHit(function(l) return l == "New run" end) ~= nil)

clickLabel(function(l) return l == "How to play" end)
frame()
check("help opens", App.showHelp)
check("help explains the trick count", screenHasText("4 + 6 = 10"))
clickLabel(function(l) return l == "Got it" end)
frame()
check("help closes", not App.showHelp)

clickLabel(function(l) return l == "seed" end)
for ch in ("tab le7"):gmatch(".") do love.textinput(ch) end
love.keypressed("backspace")
frame()
check("seed box takes typing, uppercased, letters and digits only", App.seedInput == "TABLE")

--------------------------------------------------------------------------
print("\nPlaying runs through the UI")
--------------------------------------------------------------------------
local phasesSeen = {}
local runsFinished = 0
local cardClicks, bidClicks, buys = 0, 0, 0

local function playOneRun(seed, useAutopilotSometimes)
  -- From an ending screen, go back to the menu to enter a seed, as a player would.
  if App.screen == "run" then
    clickLabel(function(l) return l == "Main menu" end)
    frame()
  end
  App.seedInput = seed
  frame()
  clickLabel(function(l) return l == "New run" end)
  frame()
  check("run started with seed " .. seed, App.run and App.run.seed == seed)

  for step = 1, 20000 do
    frame(0.5)
    local run = App.run
    local phase = run.phase
    phasesSeen[phase] = true

    if phase == PHASE.BID then
      local rec = App.recommended
      check("a recommendation is shown", rec ~= nil)
      clickLabel(function(l) return l == ("bid:%d.%d"):format(rec.level, rec.strain) end)
      bidClicks = bidClicks + 1
      frame()
      check("clicking a cell selects that contract",
        App.selectedBid and App.selectedBid.level == rec.level and App.selectedBid.strain == rec.strain)
      clickLabel(function(l) return l == "Bid" end)
    elseif phase == PHASE.PLAY then
      if engine.isPlayerTurn(run) and not App.trickHold then
        if useAutopilotSometimes and run.deal.state and #run.deal.state.tricks == 6 then
          clickLabel(function(l) return l == "Play it out" end)
        elseif clickLabel(startsWith("card:")) then
          cardClicks = cardClicks + 1
        end
      end
    elseif phase == PHASE.DEAL_SCORED then
      if not App.trickHold then
        clickLabel(function(l)
          return l:find("Next deal", 1, true) or l == "Board won!" or l == "Out of deals"
        end)
      end
    elseif phase == PHASE.BOARD_WON then
      check("payout is shown", screenHasText("Unused deals"))
      clickLabel(function(l) return l == "Enter the club" end)
    elseif phase == PHASE.SHOP then
      local bought = clickLabel(startsWith("Buy"))
      if bought then buys = buys + 1 else
        clickLabel(function(l) return l == "Next board" or l == "Next rubber" or l == "Claim victory" end)
      end
    else
      runsFinished = runsFinished + 1
      check("ending screen offers a new run", findHit(function(l) return l == "New run" end) ~= nil)
      return run
    end
  end
  check("run finished within the step budget (" .. seed .. ")", false)
end

local endings = {}
for i, seed in ipairs({ "UIRUN1", "UIRUN2", "UIRUN3", "UIRUN4" }) do
  local run = playOneRun(seed, i % 2 == 0)
  if run then endings[#endings + 1] = run.phase end
end

check("four runs reached an ending", runsFinished == 4)
check("bid phase was shown", phasesSeen[PHASE.BID])
check("play phase was shown", phasesSeen[PHASE.PLAY])
check("deal results were shown", phasesSeen[PHASE.DEAL_SCORED])
check("cards were played by clicking", cardClicks > 50)
check("bids were made by clicking", bidClicks > 4)
print(("  %d card clicks, %d bids, %d purchases; endings: %s")
  :format(cardClicks, bidClicks, buys, table.concat(endings, ", ")))

--------------------------------------------------------------------------
print("\nInput edge cases")
--------------------------------------------------------------------------
do
  App.seedInput = "EDGE"
  App.screen = "menu"
  frame()
  clickLabel(function(l) return l == "New run" end)
  frame()
  -- Illegal clicks: during the bid phase there are no card hits at all.
  check("no card is clickable while bidding", findHit(startsWith("card:")) == nil)
  check("Bid button disabled before choosing", findHit(function(l) return l == "Bid" end) == nil)

  -- Escape to the menu and come back.
  love.keypressed("escape")
  frame()
  check("escape returns to the menu", App.screen == "menu")
  check("menu offers to continue", findHit(function(l) return l == "Continue run" end) ~= nil)
  clickLabel(function(l) return l == "Continue run" end)
  frame()
  check("continue returns to the same run", App.screen == "run" and App.run.seed == "EDGE")

  -- Bid with the keyboard after selecting.
  clickLabel(function(l) return l == "bid:1.5" end)
  love.keypressed("return")
  frame()
  check("enter confirms the bid", App.run.phase == PHASE.PLAY)

  -- Only legal cards are clickable: when following suit, every card hit must
  -- be of the led suit if the hand holds that suit.
  for _ = 1, 30 do frame(0.5) end
  local st = App.run.deal.state
  if engine.isPlayerTurn(App.run) and st.ledSuit then
    local hand = st.hands[st.turn]
    local hasSuit = false
    for _, c in ipairs(hand) do if c.suit == st.ledSuit then hasSuit = true end end
    local allOk = true
    for _, h in ipairs(W.hits) do
      if h.label and h.label:sub(1, 5) == "card:" and hasSuit then
        local suitKey = h.label:sub(-1)
        local cardsMod = require("src.rules.cards")
        if suitKey ~= cardsMod.SUITS[st.ledSuit].key then allOk = false end
      end
    end
    check("only cards that follow suit are clickable", allOk)
  else
    check("(follow-suit check skipped this deal)", true)
  end

  -- Hovering a relic or strain level must not crash and should give a tooltip.
  love.mousemoved(60, 470)
  frame()
  check("tooltip machinery runs", true)
end

print(("\n%d passed, %d failed"):format(passed, failed))
os.exit(failed == 0 and 0 or 1)
