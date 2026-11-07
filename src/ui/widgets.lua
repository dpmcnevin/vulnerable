--- Drawing primitives and an immediate-mode hit list.
--
-- Suit symbols are drawn as shapes rather than font glyphs, so they look the
-- same everywhere regardless of which fonts LOVE ships with.
--
-- Interaction model: while drawing a frame, clickable widgets register a
-- rectangle and a callback. A click is tested against the rectangles from
-- the most recent frame, topmost first.

local theme = require("src.ui.theme")
local cards = require("src.rules.cards")

local C = theme.C
local M = {}

M.hits = {}
M.mouseX, M.mouseY = 0, 0
M.tooltip = nil

function M.beginFrame()
  M.hits = {}
  M.tooltip = nil
end

function M.inside(x, y, w, h, px, py)
  px, py = px or M.mouseX, py or M.mouseY
  return px >= x and px <= x + w and py >= y and py <= y + h
end

--- Register a clickable rectangle for this frame. `label` is for tests.
function M.hit(x, y, w, h, onClick, label)
  M.hits[#M.hits + 1] = { x = x, y = y, w = w, h = h, onClick = onClick, label = label }
end

--- Dispatch a click to the topmost rectangle under it. True if handled.
function M.click(px, py)
  for i = #M.hits, 1, -1 do
    local h = M.hits[i]
    if M.inside(h.x, h.y, h.w, h.h, px, py) then
      if h.onClick then h.onClick() end
      return true
    end
  end
  return false
end

function M.setTooltip(text)
  M.tooltip = text
end

local function setColor(c, alphaMul)
  love.graphics.setColor(c[1], c[2], c[3], (c[4] or 1) * (alphaMul or 1))
end
M.setColor = setColor

--------------------------------------------------------------------- text

function M.text(str, x, y, font, color, align, width)
  love.graphics.setFont(font or theme.fonts.body)
  setColor(color or C.ink)
  if align then
    love.graphics.printf(str, x, y, width or 200, align)
  else
    love.graphics.print(str, x, y)
  end
end

--- Centred text within a box.
function M.textCentered(str, x, y, w, font, color)
  M.text(str, x, y, font, color, "center", w)
end

--- Number with thousands separators.
function M.num(n)
  local s = tostring(math.floor(n + 0.5))
  local neg = s:sub(1, 1) == "-"
  if neg then s = s:sub(2) end
  local out = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
  if out:sub(1, 1) == "," then out = out:sub(2) end
  return (neg and "-" or "") .. out
end

--------------------------------------------------------------------- suits

--- Draw a suit symbol centred at (cx, cy), `size` pixels tall.
function M.suit(suit, cx, cy, size, color)
  local g = love.graphics
  local s = size / 2
  setColor(color or (cards.SUITS[suit].red and C.red or C.black))
  if suit == cards.DIAMONDS then
    g.polygon("fill", cx, cy - s, cx + s * 0.72, cy, cx, cy + s, cx - s * 0.72, cy)
  elseif suit == cards.HEARTS then
    local r = s * 0.52
    g.circle("fill", cx - r * 0.95, cy - s * 0.28, r)
    g.circle("fill", cx + r * 0.95, cy - s * 0.28, r)
    g.polygon("fill", cx - s * 0.98, cy - s * 0.12, cx + s * 0.98, cy - s * 0.12, cx, cy + s)
  elseif suit == cards.SPADES then
    local r = s * 0.5
    g.circle("fill", cx - r * 0.95, cy + s * 0.18, r)
    g.circle("fill", cx + r * 0.95, cy + s * 0.18, r)
    g.polygon("fill", cx - s * 0.96, cy + s * 0.05, cx + s * 0.96, cy + s * 0.05, cx, cy - s)
    g.polygon("fill", cx, cy + s * 0.2, cx - s * 0.35, cy + s, cx + s * 0.35, cy + s)
  elseif suit == cards.CLUBS then
    local r = s * 0.42
    g.circle("fill", cx, cy - s * 0.5, r)
    g.circle("fill", cx - s * 0.5, cy + s * 0.08, r)
    g.circle("fill", cx + s * 0.5, cy + s * 0.08, r)
    g.circle("fill", cx, cy, r * 0.6)
    g.polygon("fill", cx, cy, cx - s * 0.32, cy + s, cx + s * 0.32, cy + s)
  end
end

--- A five-pointed star centred at (cx, cy).
function M.star(cx, cy, r, color)
  local pts = {}
  for i = 0, 9 do
    local a = -math.pi / 2 + i * math.pi / 5
    local rr = (i % 2 == 0) and r or r * 0.45
    pts[#pts + 1] = cx + math.cos(a) * rr
    pts[#pts + 1] = cy + math.sin(a) * rr
  end
  setColor(color or C.brass)
  -- Concave polygons need triangulating before LOVE will fill them.
  for _, tri in ipairs(love.math.triangulate(pts)) do
    love.graphics.polygon("fill", tri)
  end
end

--- Strain marker: a suit icon, or the letters NT.
function M.strain(strain, cx, cy, size, color, font)
  if strain == cards.NOTRUMP then
    local f = font or theme.fonts.body
    love.graphics.setFont(f)
    setColor(color or C.ink)
    local w = f:getWidth("NT")
    love.graphics.print("NT", math.floor(cx - w / 2), math.floor(cy - f:getHeight() / 2))
  else
    M.suit(strain, cx, cy, size, color)
  end
end

--- "4" plus a strain icon, laid out from (x, cy). Returns the width used.
function M.contract(contract, x, cy, font, color, suitColor)
  font = font or theme.fonts.label
  love.graphics.setFont(font)
  setColor(color or C.ink)
  local lvl = tostring(contract.level)
  local lw = font:getWidth(lvl)
  love.graphics.print(lvl, math.floor(x), math.floor(cy - font:getHeight() / 2))
  local size = font:getHeight() * 0.72
  local iconW = contract.strain == cards.NOTRUMP and font:getWidth("NT") or size
  M.strain(contract.strain, x + lw + 3 + iconW / 2, cy, size, suitColor or color, font)
  local w = lw + 3 + iconW
  if (contract.doubled or 0) > 0 then
    local tag = contract.doubled == 2 and " XX" or " X"
    setColor(C.bad)
    love.graphics.print(tag, math.floor(x + w), math.floor(cy - font:getHeight() / 2))
    w = w + font:getWidth(tag)
  end
  return w
end

--------------------------------------------------------------------- shapes

function M.rect(x, y, w, h, color, radius)
  setColor(color)
  love.graphics.rectangle("fill", x, y, w, h, radius or 0, radius or 0)
end

function M.outline(x, y, w, h, color, radius, width)
  setColor(color)
  love.graphics.setLineWidth(width or 1)
  love.graphics.rectangle("line", x, y, w, h, radius or 0, radius or 0)
  love.graphics.setLineWidth(1)
end

function M.panel(x, y, w, h, opts)
  opts = opts or {}
  M.rect(x + 4, y + 6, w, h, C.shadow, 10)
  M.rect(x, y, w, h, opts.color or C.panel, 10)
  M.outline(x, y, w, h, opts.edge or C.panelEdge, 10, 2)
end

--- A labelled button. Returns true if hovered.
function M.button(label, x, y, w, h, onClick, opts)
  opts = opts or {}
  local enabled = opts.enabled ~= false
  local hovered = enabled and M.inside(x, y, w, h)
  local base = opts.color or C.brass
  local fill = enabled and (hovered and { base[1] * 1.12, base[2] * 1.12, base[3] * 1.12, 1 } or base)
               or C.panelEdge
  M.rect(x + 2, y + 4, w, h, C.shadow, 8)
  M.rect(x, y + (hovered and -1 or 0), w, h, fill, 8)
  local f = opts.font or theme.fonts.label
  love.graphics.setFont(f)
  setColor(enabled and (opts.textColor or C.bg) or C.inkFaint)
  love.graphics.printf(label, x, y + (hovered and -1 or 0) + (h - f:getHeight()) / 2, w, "center")
  if enabled and onClick then M.hit(x, y, w, h, onClick, label) end
  if opts.tooltip and M.inside(x, y, w, h) then M.setTooltip(opts.tooltip) end
  return hovered
end

--- A horizontal progress bar.
function M.bar(x, y, w, h, frac, color, back)
  M.rect(x, y, w, h, back or C.feltEdge, h / 2)
  local f = math.max(0, math.min(1, frac))
  if f > 0 then M.rect(x, y, math.max(h, w * f), h, color or C.good, h / 2) end
end

--------------------------------------------------------------------- cards

--- Draw a face-up card with its top-left at (x, y).
-- opts: dim, lift, highlight, scale
function M.card(card, x, y, opts)
  opts = opts or {}
  local g = love.graphics
  local sc = opts.scale or 1
  local w, h = theme.CARD_W * sc, theme.CARD_H * sc
  y = y - (opts.lift or 0)

  M.rect(x + 2, y + 3, w, h, C.shadow, 7 * sc)
  M.rect(x, y, w, h, C.card, 7 * sc)
  M.outline(x, y, w, h, opts.highlight or C.cardEdge, 7 * sc, opts.highlight and 3 or 1)

  local red = cards.SUITS[card.suit].red
  local ink = red and C.red or C.black
  local rank = cards.RANK_NAMES[card.rank]
  local f = sc < 0.9 and theme.fonts.rankSmall or theme.fonts.rank
  g.setFont(f)
  setColor(ink)
  g.print(rank, math.floor(x + 6 * sc), math.floor(y + 4 * sc))
  M.suit(card.suit, x + 6 * sc + f:getWidth(rank) / 2, y + 4 * sc + f:getHeight() + 7 * sc, 13 * sc, ink)
  M.suit(card.suit, x + w * 0.58, y + h * 0.6, 34 * sc, ink)

  if opts.dim then M.rect(x, y, w, h, { 0.05, 0.1, 0.08, 0.45 }, 7 * sc) end
end

--- Draw a face-down card.
function M.cardBack(x, y, scale, rotated)
  local sc = scale or 1
  local w, h = theme.CARD_W * sc, theme.CARD_H * sc
  if rotated then w, h = h, w end
  M.rect(x + 2, y + 3, w, h, C.shadow, 6 * sc)
  M.rect(x, y, w, h, C.cardBack, 6 * sc)
  M.outline(x + 4 * sc, y + 4 * sc, w - 8 * sc, h - 8 * sc, C.cardBack2, 4 * sc, 2)
  M.outline(x, y, w, h, C.cardEdge, 6 * sc, 1)
end

--------------------------------------------------------------------- tooltip

function M.drawTooltip()
  if not M.tooltip then return end
  local f = theme.fonts.small
  local maxW = 300
  local _, lines = f:getWrap(M.tooltip, maxW - 20)
  local h = #lines * f:getHeight() + 16
  local x = math.min(M.mouseX + 16, theme.WIDTH - maxW - 8)
  local y = math.min(M.mouseY + 18, theme.HEIGHT - h - 8)
  M.rect(x + 3, y + 4, maxW, h, C.shadow, 6)
  M.rect(x, y, maxW, h, C.sidebar, 6)
  M.outline(x, y, maxW, h, C.brassDim, 6, 1)
  M.text(M.tooltip, x + 10, y + 8, f, C.ink, "left", maxW - 20)
end

return M
