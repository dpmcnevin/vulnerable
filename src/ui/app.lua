--- The game's screens and input handling.
--
-- One module owns the UI state; rendering is immediate-mode (see widgets).
-- All rules live in src/game and src/rules -- this file only shows them and
-- forwards clicks.

local theme = require("src.ui.theme")
local W = require("src.ui.widgets")
local cards = require("src.rules.cards")
local play = require("src.rules.play")
local scoring = require("src.rules.scoring")
local engine = require("src.game.engine")
local relics = require("src.game.relics")
local conventions = require("src.game.conventions")

local C = theme.C
local F = theme.fonts
local PHASE = engine.PHASE

local App = {
  screen = "menu",       -- "menu" | "run"
  run = nil,
  seedInput = "",
  seedFocused = false,
  showHelp = false,
  selectedBid = nil,
  bidOptions = nil,      -- cached per deal
  bidOptionsFor = nil,
  aiTimer = 0,
  trickHold = nil,       -- completed trick kept on the table briefly
  toast = nil,
  hoveredCard = nil,
  time = 0,
}

App.AI_DELAY = 0.42
App.TRICK_HOLD = 1.0

--------------------------------------------------------------------- helpers

local function toast(text, color)
  App.toast = { text = text, color = color or C.brass, timer = 2.4 }
end

local function newRun()
  local seed = App.seedInput ~= "" and App.seedInput:upper() or nil
  App.run = engine.newRun(seed)
  App.screen = "run"
  App.selectedBid = nil
  App.bidOptions = nil
  App.trickHold = nil
  App.seedFocused = false
end

local function currentOptions()
  local run = App.run
  if App.bidOptionsFor ~= run.deal then
    App.bidOptions = engine.bidOptions(run)
    App.bidOptionsFor = run.deal
    App.recommended = engine.recommendBid(run, App.bidOptions)
    App.selectedBid = nil
  end
  return App.bidOptions
end

local function optionFor(level, strain)
  for _, o in ipairs(currentOptions()) do
    if o.contract.level == level and o.contract.strain == strain then return o end
  end
end

local function holdTrick(trick)
  if trick then App.trickHold = { trick = trick, timer = App.TRICK_HOLD } end
end

local function commitSelectedBid()
  local run = App.run
  if not App.selectedBid then return end
  local c = engine.commitBid(run, App.selectedBid, { stepwise = true })
  App.aiTimer = App.AI_DELAY
  if (c.doubled or 0) > 0 then
    toast("The defenders double!  Make it and score big; fail and it hurts.", C.bad)
  end
end

local function continueAfterDeal()
  local run = App.run
  if run.phase ~= PHASE.DEAL_SCORED or App.trickHold then return end
  engine.continueAfterDeal(run)
  App.selectedBid = nil
end

local function enterShop()
  engine.enterShop(App.run)
end

local function leaveShop()
  engine.leaveShop(App.run)
  App.selectedBid = nil
end

--------------------------------------------------------------------- update

function App.update(dt)
  App.time = App.time + dt
  if App.toast then
    App.toast.timer = App.toast.timer - dt
    if App.toast.timer <= 0 then App.toast = nil end
  end
  if App.screen ~= "run" then return end

  if App.trickHold then
    App.trickHold.timer = App.trickHold.timer - dt
    if App.trickHold.timer <= 0 then App.trickHold = nil end
    return
  end

  local run = App.run
  if run.phase == PHASE.PLAY and not engine.isPlayerTurn(run) then
    App.aiTimer = App.aiTimer - dt
    if App.aiTimer <= 0 then
      local trick = engine.stepAI(run)
      holdTrick(trick)
      App.aiTimer = App.AI_DELAY
    end
  end
end

--------------------------------------------------------------------- layout

--- Card positions for a hand laid out horizontally around the table centre.
local function handLayout(hand, y, maxWidth)
  local n = #hand
  maxWidth = maxWidth or 760
  local spacing = n > 1 and math.min(54, (maxWidth - theme.CARD_W) / (n - 1)) or 0
  local total = theme.CARD_W + spacing * math.max(0, n - 1)
  local x0 = theme.TABLE_CX - total / 2
  local out = {}
  for i = 1, n do
    out[i] = { card = hand[i], x = x0 + (i - 1) * spacing, y = y,
               w = (i == n) and theme.CARD_W or spacing }
  end
  return out
end

local HAND_Y = { [cards.NORTH] = 34, [cards.SOUTH] = 600 }

local TRICK_POS = {
  [cards.NORTH] = { 0, -112 },
  [cards.SOUTH] = { 0, 40 },
  [cards.WEST]  = { -128, -36 },
  [cards.EAST]  = { 128, -36 },
}
local TRICK_CY = 330

--------------------------------------------------------------------- drawing: table

local function drawTable()
  local x, y = theme.TABLE_X, 0
  local w, h = theme.WIDTH - theme.TABLE_X, theme.HEIGHT
  W.rect(x, y, w, h, C.felt)
  -- A soft lighter oval where the cards land.
  W.setColor(C.feltLight, 0.55)
  love.graphics.ellipse("fill", theme.TABLE_CX, TRICK_CY, 330, 190)
  W.setColor(C.feltEdge)
  love.graphics.setLineWidth(3)
  love.graphics.ellipse("line", theme.TABLE_CX, TRICK_CY, 330, 190)
  love.graphics.setLineWidth(1)
end

local function seatLabel(seat, x, y, active, align, width)
  local s = cards.SEATS[seat]
  local color = active and C.brass or C.inkDim
  W.text(s.name:upper() .. "  ·  " .. s.label, x, y, F.small, color, align, width)
end

local function drawDefender(seat, count, active)
  local isWest = seat == cards.WEST
  local x = isWest and (theme.TABLE_X + 26) or (theme.WIDTH - 26 - theme.CARD_H * 0.62)
  local y = 210
  for i = 1, count do
    W.cardBack(x, y + (i - 1) * 11, 0.62, true)
  end
  local lx = isWest and (theme.TABLE_X + 18) or (theme.WIDTH - 150)
  W.text(cards.SEATS[seat].name:upper(), lx, y - 26, F.small, active and C.brass or C.inkDim,
    isWest and "left" or "right", 132)
  if count > 0 then
    W.text(count .. " cards", lx, y + 12 * count + 50, F.tiny, C.inkFaint,
      isWest and "left" or "right", 132)
  end
end

local function drawHand(seat, faceUp, interactive)
  local run = App.run
  local deal = run.deal
  local hand = deal.state and deal.state.hands[seat] or deal.hands[seat]
  if #hand == 0 then return end
  local layout = handLayout(hand, HAND_Y[seat])
  local isTurn = interactive and engine.isPlayerTurn(run) and deal.state.turn == seat
                 and not App.trickHold

  local legalSet = {}
  if isTurn then
    for _, c in ipairs(play.legalPlays(deal.state, seat)) do legalSet[c] = true end
  end

  for i, slot in ipairs(layout) do
    if faceUp then
      local legal = legalSet[slot.card]
      local hovered = isTurn and legal and W.inside(slot.x, slot.y - 14, slot.w, theme.CARD_H + 14)
      W.card(slot.card, slot.x, slot.y, {
        lift = hovered and 16 or (legal and 6 or 0),
        dim = isTurn and not legal,
        highlight = hovered and C.brass or nil,
      })
      if isTurn and legal then
        local card = slot.card
        W.hit(slot.x, slot.y - 16, slot.w, theme.CARD_H + 16, function()
          local tricks = engine.playerPlay(run, card, { stepwise = true })
          holdTrick(tricks[1])
          App.aiTimer = App.AI_DELAY
        end, "card:" .. cards.code(card))
      end
    else
      W.cardBack(slot.x, slot.y, 1)
    end
  end

  -- Seat label beside the hand.
  local labelY = seat == cards.NORTH and (HAND_Y[seat] + theme.CARD_H + 8) or (HAND_Y[seat] - 26)
  local active = deal.state and deal.state.turn == seat and not deal.state.complete
  seatLabel(seat, theme.TABLE_CX - 200, labelY, active, "center", 400)
  if isTurn then
    local msg = seat == cards.NORTH and "Your play from dummy" or "Your play"
    W.text(msg, theme.TABLE_CX - 200, labelY + (seat == cards.NORTH and 18 or -20),
      F.small, C.brass, "center", 400)
  end
end

local function drawTrick()
  local deal = App.run.deal
  local plays
  local winner
  if App.trickHold then
    plays, winner = App.trickHold.trick.plays, App.trickHold.trick.winner
  elseif deal.state then
    plays = deal.state.trick
  end
  if not plays then return end
  for _, p in ipairs(plays) do
    local off = TRICK_POS[p.seat]
    local x = theme.TABLE_CX + off[1] - theme.CARD_W / 2
    local y = TRICK_CY + off[2]
    W.card(p.card, x, y, { highlight = (winner == p.seat) and C.brass or nil })
  end
  if winner then
    local side = cards.sameSide(winner, deal.declarer) and "Your trick" or "Defenders' trick"
    local col = cards.sameSide(winner, deal.declarer) and C.good or C.bad
    W.text(side, theme.TABLE_CX - 150, TRICK_CY + 150, F.label, col, "center", 300)
  end
end

--------------------------------------------------------------------- drawing: sidebar

local function drawSidebar()
  local run = App.run
  local x, w = 0, theme.SIDEBAR_W
  W.rect(x, 0, w, theme.HEIGHT, C.sidebar)
  W.rect(w - 2, 0, 2, theme.HEIGHT, C.panelEdge)

  local pad = 18
  local y = 16
  W.text("VULNERABLE", pad, y, F.label, C.brass)
  y = y + 34

  W.text(("Rubber %d of %d"):format(math.min(run.rubber, engine.RUBBERS), engine.RUBBERS),
    pad, y, F.body, C.ink)
  y = y + 24
  W.text(engine.boardName(run), pad, y, F.small, C.inkDim)
  if run.vulnerable then
    W.rect(w - pad - 58, y - 2, 58, 20, C.bad, 4)
    W.text("VUL", w - pad - 58, y, F.small, C.ink, "center", 58)
  end
  y = y + 32

  -- Target and progress.
  W.panel(pad - 6, y, w - 2 * pad + 12, 112, { color = C.panel })
  W.text("Target", pad + 6, y + 10, F.small, C.inkDim)
  W.text(W.num(run.target), pad + 6, y + 26, F.big, C.ink)
  W.text("Scored", w - pad - 120, y + 10, F.small, C.inkDim, "right", 114)
  local reached = run.score >= run.target
  W.text(W.num(run.score), w - pad - 140, y + 26, F.big, reached and C.good or C.ink, "right", 134)
  W.bar(pad + 6, y + 70, w - 2 * pad - 12, 10, run.score / math.max(1, run.target),
    reached and C.good or C.brass)
  -- Deals remaining.
  W.text("Deals", pad + 6, y + 86, F.tiny, C.inkDim)
  for i = 1, engine.DEALS_PER_BOARD do
    local used = i > run.dealsLeft
    W.setColor(used and C.panelEdge or C.brass)
    love.graphics.circle("fill", pad + 60 + (i - 1) * 18, y + 93, 6)
  end
  y = y + 128

  -- Contract and tricks.
  local deal = run.deal
  if deal and deal.contract then
    W.text("Contract", pad, y, F.small, C.inkDim)
    W.contract(deal.contract, pad, y + 30, F.big, C.ink)
    local made = deal.state and play.declarerTricks(deal.state, deal.declarer) or 0
    local need = scoring.tricksNeeded(deal.contract)
    W.text("Tricks", w - pad - 110, y, F.small, C.inkDim, "right", 110)
    W.text(("%d / %d"):format(made, need), w - pad - 110, y + 16, F.big,
      made >= need and C.good or C.ink, "right", 110)
    local lost = deal.state and deal.state.ewTricks or 0
    W.text(("can lose %d more"):format(math.max(0, (13 - need) - lost)), pad, y + 52, F.tiny,
      C.inkFaint)
  else
    W.text("Contract", pad, y, F.small, C.inkDim)
    W.text("bidding...", pad, y + 18, F.body, C.inkFaint)
  end
  y = y + 78

  W.text("Money", pad, y, F.small, C.inkDim)
  W.text("$" .. run.money, pad, y + 16, F.big, C.brass)
  W.text("Interest", w - pad - 110, y, F.small, C.inkDim, "right", 110)
  W.text("+$" .. engine.interest(run), w - pad - 110, y + 20, F.body, C.inkDim, "right", 110)
  y = y + 60

  -- Strain levels.
  W.text("Strain levels", pad, y, F.small, C.inkDim)
  y = y + 22
  local colW = (w - 2 * pad) / 5
  for s = 1, 5 do
    local cx = pad + (s - 0.5) * colW
    W.strain(s, cx, y + 10, 18, s <= 4 and (cards.SUITS[s].red and C.red or C.ink) or C.ink, F.small)
    local lvl = run.strainLevels[s]
    W.text(tostring(lvl), cx - 20, y + 24, F.small, lvl > 1 and C.brass or C.inkFaint, "center", 40)
    if W.inside(cx - colW / 2, y, colW, 44) then
      local pts, m = conventions.bonusFor(lvl)
      W.setTooltip(("%s level %d: +%d points, +%.2f mult on contracts in this strain.")
        :format(cards.STRAINS[s].name, lvl, pts, m))
    end
  end
  y = y + 54

  -- Relics.
  W.text(("Relics  %d/%d"):format(#run.relics, engine.RELIC_SLOTS), pad, y, F.small, C.inkDim)
  y = y + 22
  for i = 1, engine.RELIC_SLOTS do
    local relic = run.relics[i]
    local ry = y + (i - 1) * 30
    W.rect(pad - 4, ry, w - 2 * pad + 8, 26, relic and C.panel or C.bg, 5)
    if relic then
      W.rect(pad - 4, ry, 4, 26, C.rarity[relic.def.rarity], 2)
      W.text(relic.name, pad + 8, ry + 4, F.small, C.ink)
      if W.inside(pad - 4, ry, w - 2 * pad + 8, 26) then
        W.setTooltip(relic.name .. " (" .. relics.RARITY_NAME[relic.def.rarity] .. ")\n" ..
          relics.textFor(relic))
      end
    end
  end

  W.text("Seed " .. run.seed, pad, theme.HEIGHT - 26, F.tiny, C.inkFaint)
end

--------------------------------------------------------------------- drawing: bid

local function chanceColor(p)
  if p >= 0.7 then return C.good end
  if p >= 0.45 then return C.warn end
  return C.bad
end

local function drawPartnerInfo(x, y)
  local info = App.run.deal.partnerInfo
  W.text("Partner's bid:", x, y, F.body, C.inkDim)
  local cx = x + 128
  local rangeText = ("%d-%d points"):format(info.range.low, math.min(info.range.high, 24))
  W.text(rangeText, cx, y, F.body, C.ink)
  cx = cx + F.body:getWidth(rangeText) + 16
  if #info.longSuits > 0 then
    for _, ls in ipairs(info.longSuits) do
      W.text(tostring(ls.length), cx, y, F.body, C.ink)
      cx = cx + F.body:getWidth(tostring(ls.length)) + 12
      W.suit(ls.suit, cx, y + 11, 16, cards.SUITS[ls.suit].red and C.red or C.ink)
      cx = cx + 22
    end
  elseif info.balanced then
    W.text("balanced", cx, y, F.body, C.ink)
  else
    W.text("no long suit", cx, y, F.body, C.inkDim)
  end
end

local function drawBid()
  local run = App.run
  local px, py = theme.TABLE_X + 18, 16
  local pw, ph = theme.WIDTH - theme.TABLE_X - 36, 560
  W.panel(px, py, pw, ph)

  local need = math.max(0, run.target - run.score)
  W.text("Choose your contract", px + 24, py + 16, F.big, C.ink)
  W.text(("Need %s more  ·  %d deal%s left"):format(W.num(need), run.dealsLeft,
    run.dealsLeft == 1 and "" or "s"), px + pw - 424, py + 24, F.body, C.inkDim, "right", 400)
  local myHcp = cards.hcp(run.deal.hands[run.deal.declarer])
  W.text(("Your hand: %d points"):format(myHcp), px + 24, py + 58, F.body, C.ink)
  drawPartnerInfo(px + 260, py + 58)

  -- Grid of every contract: strains across, levels down.
  local gx, gy = px + 70, py + 104
  local cw, chh = (pw - 100) / 5, 50
  for s = 1, 5 do
    W.strain(s, gx + (s - 0.5) * cw, gy - 14, 18,
      s <= 4 and (cards.SUITS[s].red and C.red or C.ink) or C.ink, F.body)
  end
  local hovered
  for level = 1, 7 do
    local ry = gy + (level - 1) * chh
    W.text(tostring(level), px + 24, ry + 14, F.label, C.inkDim)
    for s = 1, 5 do
      local o = optionFor(level, s)
      local cx = gx + (s - 1) * cw
      local x, y, w, h = cx + 3, ry + 3, cw - 6, chh - 6
      local isSel = App.selectedBid and App.selectedBid.level == level and App.selectedBid.strain == s
      local isRec = App.recommended and App.recommended.level == level and App.recommended.strain == s
      local hov = W.inside(x, y, w, h)
      local col = chanceColor(o.chance)
      W.rect(x, y, w, h, { col[1], col[2], col[3], hov and 0.32 or 0.16 }, 6)
      if o.projected >= need and need > 0 then
        W.rect(x, y, 4, h, C.brass, 2)
      end
      W.contract(o.contract, x + 12, y + h / 2, F.label, C.ink,
        s <= 4 and (cards.SUITS[s].red and C.red or C.ink) or C.ink)
      W.text(("%d%%"):format(math.floor(o.chance * 100 + 0.5)), x + w - 96, y + 4, F.small, col, "right", 88)
      W.text(W.num(o.projected), x + w - 96, y + 22, F.small, C.inkDim, "right", 88)
      if isRec then
        W.star(x + w * 0.42, y + h / 2, 7, C.brass)
        W.outline(x, y, w, h, C.brassDim, 6, 1)
      end
      if isSel then W.outline(x, y, w, h, C.ink, 6, 3) end
      if hov then hovered = o end
      W.hit(x, y, w, h, function() App.selectedBid = o.contract end,
        ("bid:%d.%d"):format(level, s))
    end
  end

  -- Detail line for the hovered or selected contract.
  local detail = hovered or (App.selectedBid and optionFor(App.selectedBid.level, App.selectedBid.strain))
  local dy = gy + 7 * chh + 10
  if detail then
    local c = detail.contract
    local wdt = W.contract(c, px + 24, dy + 12, F.label, C.ink)
    W.text(("needs %d of 13 tricks   ·   %d%% to make   ·   scores at least %s"):format(
      scoring.tricksNeeded(c), math.floor(detail.chance * 100 + 0.5), W.num(detail.projected)),
      px + 34 + wdt, dy + 2, F.body, C.inkDim)
  else
    W.text("Green is safe, red is a stretch. A brass edge clears the board on its own. "
      .. "The starred cell is the recommended bid.", px + 24, dy + 2, F.small, C.inkDim)
  end

  W.button(App.selectedBid and "Bid" or "Pick a contract", px + pw - 210, py + ph - 56, 186, 42,
    commitSelectedBid, { enabled = App.selectedBid ~= nil })
end

--------------------------------------------------------------------- drawing: results

local function scoreLine(label, x, y, w, entry)
  W.text(label, x, y, F.body, C.ink)
  local parts = {}
  if entry.points and entry.points ~= 0 then
    parts[#parts + 1] = { (entry.points > 0 and "+" or "") .. W.num(entry.points), C.chips }
  end
  if entry.mult and entry.mult ~= 0 then
    parts[#parts + 1] = { ("+%.2f mult"):format(entry.mult), C.mult }
  end
  if entry.xmult and entry.xmult ~= 1 then
    parts[#parts + 1] = { ("x%.2f"):format(entry.xmult), C.mult }
  end
  local rx = x + w
  for i = #parts, 1, -1 do
    local str, col = parts[i][1], parts[i][2]
    local tw = F.body:getWidth(str)
    rx = rx - tw
    W.text(str, rx, y, F.body, col)
    rx = rx - 14
  end
end

local function drawDealScored()
  local run = App.run
  local deal = run.deal
  local r = deal.result
  local b = r.bridge
  local pw, ph = 580, 500
  local px, py = theme.TABLE_CX - pw / 2, 110
  W.panel(px, py, pw, ph)

  local x, w = px + 30, pw - 60
  if r.made then
    local title = "Contract made"
    if b.overtricks > 0 then title = ("Made with %d overtrick%s"):format(b.overtricks, b.overtricks > 1 and "s" or "") end
    W.text(title, x, py + 20, F.big, C.good)
  else
    W.text(("Down %d"):format(b.undertricks), x, py + 20, F.big, C.bad)
  end
  W.contract(deal.contract, px + pw - 120, py + 38, F.big, C.ink)
  W.text(("%d of 13 tricks  ·  needed %d"):format(b.tricksWon, b.tricksNeeded),
    x, py + 60, F.body, C.inkDim)

  local y = py + 100
  for _, line in ipairs(b.lines) do
    scoreLine(line.label, x, y, w, { points = line.amount })
    y = y + 26
  end
  if not r.made then
    W.text("A failed contract scores nothing toward the target.", x, y + 6, F.body, C.inkDim)
    y = y + 40
  else
    W.rect(x, y + 2, w, 1, C.panelEdge)
    y = y + 10
    for i = 2, #r.lines do
      scoreLine(r.lines[i].label, x, y, w, r.lines[i])
      y = y + 26
      if y > py + ph - 170 then break end
    end
    W.rect(x, y + 2, w, 1, C.panelEdge)
    y = y + 12
    W.text(W.num(r.points), x, y, F.big, C.chips)
    local pw1 = F.big:getWidth(W.num(r.points))
    W.text("x", x + pw1 + 12, y, F.big, C.inkDim)
    W.text(("%.2f"):format(r.mult), x + pw1 + 40, y, F.big, C.mult)
    W.text("= " .. W.num(r.total), x, y, F.big, C.ink, "right", w)
    y = y + 50
  end

  -- Board progress after this deal.
  local by = py + ph - 108
  W.text(("Board  %s / %s"):format(W.num(run.score), W.num(run.target)), x, by, F.body, C.ink)
  W.bar(x, by + 26, w, 12, run.score / math.max(1, run.target), run.score >= run.target and C.good or C.brass)

  local label
  if run.score >= run.target then label = "Board won!"
  elseif run.dealsLeft <= 0 then label = "Out of deals"
  else label = ("Next deal  (%d left)"):format(run.dealsLeft) end
  W.button(label, px + pw - 250, py + ph - 56, 220, 42, continueAfterDeal)
end

local function drawBoardWon()
  local run = App.run
  local p = run.lastPayout
  local pw, ph = 460, 380
  local px, py = theme.TABLE_CX - pw / 2, 150
  W.panel(px, py, pw, ph)
  local x, w = px + 30, pw - 60
  W.text("Board won", x, py + 20, F.big, C.good)
  W.text(("%s scored against a target of %s"):format(W.num(run.score), W.num(run.target)),
    x, py + 60, F.body, C.inkDim)
  local y = py + 104
  local function row(label, amount)
    W.text(label, x, y, F.body, C.ink)
    W.text("$" .. amount, x, y, F.body, amount > 0 and C.brass or C.inkFaint, "right", w)
    y = y + 28
  end
  row("Board", p.board)
  row("Unused deals", p.unused)
  row("Interest", p.interest)
  if p.relics > 0 then row("Relics", p.relics) end
  W.rect(x, y + 2, w, 1, C.panelEdge)
  y = y + 12
  W.text("Total", x, y, F.label, C.ink)
  W.text("$" .. p.total, x, y, F.label, C.brass, "right", w)
  W.button("Enter the club", px + pw - 230, py + ph - 56, 200, 42, enterShop)
end

--------------------------------------------------------------------- drawing: shop

local function drawShop()
  local run = App.run
  local x0 = theme.TABLE_X + 30
  W.text("The Club", x0, 22, F.huge, C.brass)
  W.text("Spend your winnings before the next board.", x0, 76, F.body, C.inkDim)
  W.text("$" .. run.money, theme.WIDTH - 230, 30, F.huge, C.brass, "right", 200)

  local cw, ch = 280, 290
  local gap = 26
  local total = engine.SHOP_SIZE * cw + (engine.SHOP_SIZE - 1) * gap
  local sx = theme.TABLE_CX - total / 2
  for i, item in ipairs(run.shop.items) do
    local x, y = sx + (i - 1) * (cw + gap), 118
    local edge = item.kind == "relic" and C.rarity[item.def.rarity] or C.brass
    W.panel(x, y, cw, ch, { edge = edge })
    if item.kind == "relic" then
      W.text(relics.RARITY_NAME[item.def.rarity] .. " relic", x + 18, y + 16, F.small, edge)
      W.text(item.name, x + 18, y + 38, F.label, C.ink, "left", cw - 36)
      W.text(item.def.text, x + 18, y + 96, F.body, C.inkDim, "left", cw - 36)
    else
      W.text("Convention", x + 18, y + 16, F.small, C.brass)
      W.text(item.name, x + 18, y + 38, F.label, C.ink, "left", cw - 36)
      local s = item.def.strain
      W.text("Level up", x + 18, y + 96, F.body, C.inkDim)
      W.strain(s, x + 18 + F.body:getWidth("Level up ") + 12, y + 107, 18,
        s <= 4 and (cards.SUITS[s].red and C.red or C.ink) or C.ink, F.body)
      local lvl = run.strainLevels[s]
      local p0, m0 = conventions.bonusFor(lvl)
      local p1, m1 = conventions.bonusFor(lvl + 1)
      W.text(("Lv.%d -> Lv.%d\n+%d points, +%.2f mult\n(from +%d, +%.2f)"):format(
        lvl, lvl + 1, p1, m1, p0, m0), x + 18, y + 124, F.body, C.inkDim, "left", cw - 36)
      W.text(item.def.flavour, x + 18, y + 190, F.small, C.inkFaint, "left", cw - 36)
    end
    if item.sold then
      W.rect(x, y, cw, ch, C.dim, 10)
      W.text("SOLD", x, y + ch / 2 - 20, F.big, C.inkDim, "center", cw)
    else
      local ok, why = engine.canBuy(run, i)
      W.button(("Buy  $%d"):format(item.cost), x + 18, y + ch - 58, cw - 36, 40,
        function() engine.buy(run, i) end,
        { enabled = ok, tooltip = (not ok) and ("Can't buy: " .. why) or nil })
    end
  end

  -- Owned relics, sellable.
  local oy = 440
  W.text(("Your relics  %d/%d"):format(#run.relics, engine.RELIC_SLOTS), x0, oy, F.label, C.ink)
  local rw = (theme.WIDTH - theme.TABLE_X - 60 - 4 * 12) / engine.RELIC_SLOTS
  for i = 1, engine.RELIC_SLOTS do
    local x, y = x0 + (i - 1) * (rw + 12), oy + 34
    local relic = run.relics[i]
    if relic then
      W.panel(x, y, rw, 120, { edge = C.rarity[relic.def.rarity] })
      W.text(relic.name, x + 12, y + 10, F.body, C.ink, "left", rw - 24)
      local refund = math.max(1, math.floor(relic.cost / 2))
      W.button(("Sell  $%d"):format(refund), x + 12, y + 78, rw - 24, 30,
        function() engine.sellRelic(run, i) end, { font = F.small, color = C.panelEdge, textColor = C.ink })
      if W.inside(x, y, rw, 70) then W.setTooltip(relics.textFor(relic)) end
    else
      W.rect(x, y, rw, 120, C.bg, 10)
      W.text("empty", x, y + 50, F.small, C.inkFaint, "center", rw)
    end
  end

  W.button(("Reroll  $%d"):format(run.rerollCost), x0, theme.HEIGHT - 70, 190, 44,
    function() engine.reroll(run) end, { enabled = run.money >= run.rerollCost,
    color = C.panelEdge, textColor = C.ink })
  local nextLabel = (run.board == engine.BOARDS_PER_RUBBER) and "Next rubber" or "Next board"
  if run.board == engine.BOARDS_PER_RUBBER and run.rubber == engine.RUBBERS then nextLabel = "Claim victory" end
  W.button(nextLabel, theme.WIDTH - 240, theme.HEIGHT - 70, 210, 44, leaveShop)
end

--------------------------------------------------------------------- drawing: endings

local function drawEnding(victory)
  local run = App.run
  local pw, ph = 520, 440
  local px, py = theme.TABLE_CX - pw / 2, 130
  W.panel(px, py, pw, ph, { edge = victory and C.brass or C.bad })
  local x, w = px + 30, pw - 60
  W.text(victory and "Rubber won!" or "Out of deals", x, py + 22, F.huge, victory and C.brass or C.bad)
  local sub = victory and "You beat all eight rubbers." or
    ("Fell on %s of rubber %d, %s short."):format(engine.boardName(run), run.rubber,
      W.num(run.target - run.score))
  W.text(sub, x, py + 82, F.body, C.inkDim, "left", w)
  local s = run.stats
  local y = py + 130
  local function row(label, value)
    W.text(label, x, y, F.body, C.ink)
    W.text(value, x, y, F.body, C.brass, "right", w)
    y = y + 28
  end
  row("Deals played", tostring(s.dealsPlayed))
  row("Contracts made", ("%d of %d"):format(s.contractsMade, s.dealsPlayed))
  row("Slams made", tostring(s.slamsMade))
  row("Doubled contracts made", tostring(s.doubledMade))
  row("Best deal", W.num(s.bestDeal))
  row("Seed", run.seed)
  W.button("New run", px + pw - 200, py + ph - 60, 170, 42, function()
    App.seedInput = ""
    newRun()
  end)
  W.button("Main menu", x, py + ph - 60, 170, 42, function() App.screen = "menu" end,
    { color = C.panelEdge, textColor = C.ink })
end

--------------------------------------------------------------------- drawing: menu

local HELP = {
  "You are always declarer, sitting South. North is your dummy, and you play both hands.",
  "Each deal: look at your hand and your partner's bid, then choose a contract -- a level (1 to 7) and a strain. Level 4 means you must win 4 + 6 = 10 of the 13 tricks.",
  "West leads, dummy goes face up, and you play out the hand against the AI defenders. Follow suit if you can; trumps beat everything else.",
  "Contracts are scored by real duplicate bridge rules. Bidding game (100+ contract points) or a slam (level 6 or 7) earns big bonuses -- but a failed contract scores nothing.",
  "Reach each board's target within three deals. Win boards to earn money, then spend it at the club on relics, which multiply your scores, and conventions, which level up a strain.",
  "Beat all three boards in each of eight rubbers to win. The third board of every rubber, and every board from rubber five, is vulnerable: bigger bonuses, bigger targets.",
}

local function drawMenu()
  W.rect(0, 0, theme.WIDTH, theme.HEIGHT, C.felt)
  W.setColor(C.feltLight, 0.5)
  love.graphics.ellipse("fill", theme.WIDTH / 2, theme.HEIGHT / 2 + 20, 520, 300)

  -- A fan of four aces behind the title.
  for i, suit in ipairs({ cards.CLUBS, cards.DIAMONDS, cards.HEARTS, cards.SPADES }) do
    local bob = math.sin(App.time * 1.4 + i) * 4
    W.card(cards.card(suit, 14), theme.WIDTH / 2 - 170 + (i - 1) * 86, 70 + bob, { scale = 1.05 })
  end

  W.textCentered("VULNERABLE", 0, 200, theme.WIDTH, F.title, C.brass)
  W.textCentered("a contract bridge roguelike", 0, 284, theme.WIDTH, F.label, C.inkDim)

  local bx = theme.WIDTH / 2 - 130
  local by = 350
  if App.run and App.run.phase ~= PHASE.GAME_OVER and App.run.phase ~= PHASE.VICTORY then
    W.button("Continue run", bx, by, 260, 48, function() App.screen = "run" end)
    by = by + 62
  end
  W.button("New run", bx, by, 260, 48, newRun)
  by = by + 62

  -- Optional seed entry.
  local focused = App.seedFocused
  W.rect(bx, by, 260, 40, focused and C.panel or C.feltEdge, 6)
  W.outline(bx, by, 260, 40, focused and C.brass or C.panelEdge, 6, 2)
  local shown = App.seedInput ~= "" and App.seedInput or (focused and "" or "Seed (optional)")
  local caret = focused and (math.floor(App.time * 2) % 2 == 0) and "_" or ""
  W.text(shown .. caret, bx + 14, by + 10, F.body, App.seedInput ~= "" and C.ink or C.inkFaint)
  W.hit(bx, by, 260, 40, function() App.seedFocused = true end, "seed")
  by = by + 56

  W.button("How to play", bx, by, 260, 44, function() App.showHelp = true end,
    { color = C.panelEdge, textColor = C.ink })
  by = by + 56
  W.button("Quit", bx, by, 260, 44, function() love.event.quit() end,
    { color = C.panelEdge, textColor = C.ink })

  if App.showHelp then
    W.rect(0, 0, theme.WIDTH, theme.HEIGHT, C.dim)
    local pw, ph = 760, 560
    local px, py = (theme.WIDTH - pw) / 2, (theme.HEIGHT - ph) / 2
    W.panel(px, py, pw, ph)
    W.text("How to play", px + 30, py + 22, F.big, C.brass)
    local y = py + 74
    for _, para in ipairs(HELP) do
      local _, lines = F.body:getWrap(para, pw - 60)
      W.text(para, px + 30, y, F.body, C.ink, "left", pw - 60)
      y = y + #lines * F.body:getHeight() + 12
    end
    W.button("Got it", px + pw - 180, py + ph - 60, 150, 42, function() App.showHelp = false end)
  end
end

--------------------------------------------------------------------- main draw

function App.draw()
  W.beginFrame()
  if App.screen == "menu" then
    drawMenu()
  else
    local run = App.run
    drawTable()
    drawSidebar()
    local phase = run.phase
    if phase == PHASE.SHOP then
      W.rect(theme.TABLE_X, 0, theme.WIDTH - theme.TABLE_X, theme.HEIGHT, C.felt)
      drawShop()
    else
      local deal = run.deal
      local defendersActive = deal.state and not deal.state.complete
      drawDefender(cards.WEST, deal.state and #deal.state.hands[cards.WEST] or 13,
        defendersActive and deal.state.turn == cards.WEST)
      drawDefender(cards.EAST, deal.state and #deal.state.hands[cards.EAST] or 13,
        defendersActive and deal.state.turn == cards.EAST)
      drawHand(cards.NORTH, deal.dummyVisible, true)
      drawHand(cards.SOUTH, true, true)
      drawTrick()

      if phase == PHASE.BID then
        drawBid()
      elseif phase == PHASE.PLAY then
        W.button("Play it out", theme.WIDTH - 180, 540, 160, 40, function()
          App.trickHold = nil
          engine.playOut(run)
        end, { font = F.body, color = C.panelEdge, textColor = C.ink,
               tooltip = "Let the autopilot finish this deal for you. Quicker, but it plays worse than a careful declarer." })
      elseif phase == PHASE.DEAL_SCORED and not App.trickHold then
        drawDealScored()
      elseif phase == PHASE.BOARD_WON then
        drawBoardWon()
      elseif phase == PHASE.GAME_OVER then
        drawEnding(false)
      elseif phase == PHASE.VICTORY then
        drawEnding(true)
      end
    end
  end

  if App.toast then
    local f = F.label
    local tw = f:getWidth(App.toast.text) + 40
    local tx = (theme.WIDTH - tw) / 2 + theme.SIDEBAR_W / 2
    W.rect(tx, 470, tw, 44, C.sidebar, 8)
    W.outline(tx, 470, tw, 44, App.toast.color, 8, 2)
    W.text(App.toast.text, tx, 480, f, App.toast.color, "center", tw)
  end
  W.drawTooltip()
end

--------------------------------------------------------------------- input

function App.mousemoved(x, y)
  W.mouseX, W.mouseY = x, y
end

function App.mousepressed(x, y, button)
  if button ~= 1 then return end
  W.mouseX, W.mouseY = x, y
  -- Clicking during a held trick skips the pause.
  if App.trickHold then
    App.trickHold = nil
    return
  end
  local handled = W.click(x, y)
  if App.screen == "menu" and not handled then App.seedFocused = false end
end

function App.textinput(t)
  if App.screen == "menu" and App.seedFocused and #App.seedInput < 12 then
    local clean = t:upper():gsub("[^%w]", "")
    App.seedInput = App.seedInput .. clean
  end
end

function App.keypressed(key)
  if App.screen == "menu" then
    if App.seedFocused then
      if key == "backspace" then App.seedInput = App.seedInput:sub(1, -2)
      elseif key == "return" or key == "kpenter" then newRun()
      elseif key == "escape" then App.seedFocused = false end
      return
    end
    if key == "escape" then
      if App.showHelp then App.showHelp = false else love.event.quit() end
    elseif key == "return" or key == "space" then
      newRun()
    end
    return
  end

  local run = App.run
  if key == "escape" then
    App.screen = "menu"
    return
  end
  if key == "space" or key == "return" or key == "kpenter" then
    if App.trickHold then App.trickHold = nil
    elseif run.phase == PHASE.BID then commitSelectedBid()
    elseif run.phase == PHASE.DEAL_SCORED then continueAfterDeal()
    elseif run.phase == PHASE.BOARD_WON then enterShop()
    end
  end
end

return App
