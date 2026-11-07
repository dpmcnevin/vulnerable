--- Vulnerable: a contract bridge roguelike. Entry point for LOVE 11.x.
--
-- The game renders to a fixed 1280x720 virtual canvas, scaled and
-- letterboxed to fit the window.

local theme = require("src.ui.theme")
local App = require("src.ui.app")

local view = { scale = 1, ox = 0, oy = 0 }

local function recompute()
  local w, h = love.graphics.getDimensions()
  view.scale = math.min(w / theme.WIDTH, h / theme.HEIGHT)
  view.ox = math.floor((w - theme.WIDTH * view.scale) / 2)
  view.oy = math.floor((h - theme.HEIGHT * view.scale) / 2)
end

local function toVirtual(x, y)
  return (x - view.ox) / view.scale, (y - view.oy) / view.scale
end

function love.load()
  love.graphics.setBackgroundColor(theme.C.bg)
  love.keyboard.setKeyRepeat(true)
  theme.loadFonts()
  recompute()
end

function love.resize()
  recompute()
end

function love.update(dt)
  App.update(math.min(dt, 0.1))
end

function love.draw()
  love.graphics.push()
  love.graphics.translate(view.ox, view.oy)
  love.graphics.scale(view.scale)
  App.draw()
  love.graphics.pop()
end

function love.mousemoved(x, y)
  App.mousemoved(toVirtual(x, y))
end

function love.mousepressed(x, y, button)
  local vx, vy = toVirtual(x, y)
  App.mousepressed(vx, vy, button)
end

function love.textinput(t)
  App.textinput(t)
end

function love.keypressed(key)
  App.keypressed(key)
end
