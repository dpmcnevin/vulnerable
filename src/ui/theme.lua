--- Colours, fonts and layout constants.
--
-- The look is a card-room table at night: deep green baize, cream cards,
-- brass accents. Everything is drawn procedurally; there are no image assets.

local M = {}

M.WIDTH, M.HEIGHT = 1280, 720

local function hex(h, a)
  local r = tonumber(h:sub(2, 3), 16) / 255
  local g = tonumber(h:sub(4, 5), 16) / 255
  local b = tonumber(h:sub(6, 7), 16) / 255
  return { r, g, b, a or 1 }
end
M.hex = hex

M.C = {
  bg        = hex("#0b1f17"),
  felt      = hex("#14402c"),
  feltLight = hex("#1c5239"),
  feltEdge  = hex("#0e2d20"),
  sidebar   = hex("#0f1a16"),
  panel     = hex("#15241e"),
  panelEdge = hex("#2c4a3d"),
  ink       = hex("#ece6d6"),
  inkDim    = hex("#9fb3a8"),
  inkFaint  = hex("#5f7a6d"),
  brass     = hex("#d9a441"),
  brassDim  = hex("#8a6a2c"),
  card      = hex("#f6f1e4"),
  cardEdge  = hex("#c9bfa6"),
  cardBack  = hex("#7a2430"),
  cardBack2 = hex("#a8404e"),
  red       = hex("#c0392b"),
  black     = hex("#1d1d1f"),
  good      = hex("#4fbf7a"),
  warn      = hex("#e3b341"),
  bad       = hex("#e0604f"),
  chips     = hex("#4a9fe0"),
  mult      = hex("#e0604f"),
  shadow    = { 0, 0, 0, 0.35 },
  dim       = { 0, 0, 0, 0.55 },
  rarity = {
    hex("#9fb3a8"),  -- common
    hex("#4fbf7a"),  -- uncommon
    hex("#4a9fe0"),  -- rare
    hex("#d9a441"),  -- legendary
  },
}

M.CARD_W, M.CARD_H = 72, 102
M.SIDEBAR_W = 270
M.TABLE_X = M.SIDEBAR_W
M.TABLE_CX = M.SIDEBAR_W + (M.WIDTH - M.SIDEBAR_W) / 2

M.fonts = {}

--- Fonts must be created after LOVE's graphics module is up.
function M.loadFonts()
  local g = love.graphics
  M.fonts.tiny = g.newFont(12)
  M.fonts.small = g.newFont(14)
  M.fonts.body = g.newFont(17)
  M.fonts.label = g.newFont(20)
  M.fonts.big = g.newFont(28)
  M.fonts.huge = g.newFont(44)
  M.fonts.title = g.newFont(72)
  M.fonts.rank = g.newFont(22)
  M.fonts.rankSmall = g.newFont(15)
end

return M
