--- A strict stand-in for the parts of the LOVE API the game uses.
--
-- It draws nothing, but it validates arguments the way LOVE would complain
-- about them -- a nil passed to print, a NaN coordinate, an odd vertex list --
-- so that the real UI code can be driven headlessly under luajit.

local M = { calls = 0, errors = {} }

local function fail(fmt, ...)
  error(("love stub: " .. fmt):format(...), 3)
end

local function num(v, what)
  if type(v) ~= "number" then fail("%s must be a number, got %s", what, type(v)) end
  if v ~= v then fail("%s is NaN", what) end
  if v == math.huge or v == -math.huge then fail("%s is infinite", what) end
end

local function newFont(size)
  size = size or 12
  num(size, "font size")
  local f = { size = size }
  function f:getWidth(s)
    if type(s) ~= "string" and type(s) ~= "number" then fail("getWidth needs a string, got %s", type(s)) end
    return #tostring(s) * size * 0.55
  end
  function f:getHeight() return size * 1.2 end
  function f:getWrap(s, w)
    if type(s) ~= "string" then fail("getWrap needs a string, got %s", type(s)) end
    num(w, "wrap width")
    local perLine = math.max(1, math.floor(w / (size * 0.55)))
    local lines = {}
    for i = 1, math.max(1, math.ceil(#s / perLine)) do
      lines[i] = s:sub((i - 1) * perLine + 1, i * perLine)
    end
    return w, lines
  end
  return f
end

local currentFont = newFont(12)

-- Optional SVG recording, for visual snapshots (tests/snapshot.lua).
M.svg = nil
local cur = { 1, 1, 1, 1 }
local lineWidth = 1
local function esc(t)
  return (tostring(t):gsub("&", "&amp;"):gsub("<", "&lt;"):gsub(">", "&gt;"))
end
local function rgba()
  return ("rgba(%d,%d,%d,%.3f)"):format(cur[1] * 255, cur[2] * 255, cur[3] * 255, cur[4] or 1)
end
local function paint(mode)
  if mode == "line" then
    return ('fill="none" stroke="%s" stroke-width="%g"'):format(rgba(), lineWidth)
  end
  return ('fill="%s"'):format(rgba())
end
local function rec(el) if M.svg then M.svg[#M.svg + 1] = el end end
local function textEl(str, x, y, anchor)
  rec(('<text x="%.1f" y="%.1f" font-size="%g" text-anchor="%s" fill="%s">%s</text>')
    :format(x, y + currentFont.size * 0.95, currentFont.size, anchor or "start", rgba(), esc(str)))
end

local graphics = {}
function graphics.newFont(size) return newFont(size) end
function graphics.setFont(f)
  if type(f) ~= "table" then fail("setFont needs a font, got %s", type(f)) end
  currentFont = f
end
function graphics.getFont() return currentFont end
function graphics.setColor(r, g, b, a)
  if type(r) == "table" then r, g, b, a = r[1], r[2], r[3], r[4] end
  num(r, "red"); num(g, "green"); num(b, "blue")
  if a ~= nil then num(a, "alpha") end
  cur = { r, g, b, a or 1 }
  M.calls = M.calls + 1
end
function graphics.setBackgroundColor(r) end
function graphics.setLineWidth(w) num(w, "line width"); lineWidth = w end
function graphics.rectangle(mode, x, y, w, h, rx, ry)
  if mode ~= "fill" and mode ~= "line" then fail("bad draw mode %s", tostring(mode)) end
  num(x, "x"); num(y, "y"); num(w, "width"); num(h, "height")
  if rx then num(rx, "rx") end
  rec(('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%g" %s/>')
    :format(x, y, math.max(0, w), math.max(0, h), rx or 0, paint(mode)))
  M.calls = M.calls + 1
end
function graphics.circle(mode, x, y, r)
  num(x, "x"); num(y, "y"); num(r, "radius")
  rec(('<circle cx="%.1f" cy="%.1f" r="%.1f" %s/>'):format(x, y, r, paint(mode)))
  M.calls = M.calls + 1
end
function graphics.ellipse(mode, x, y, rx, ry)
  num(x, "x"); num(y, "y"); num(rx, "rx"); num(ry, "ry")
  rec(('<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" %s/>'):format(x, y, rx, ry, paint(mode)))
end
function graphics.polygon(mode, ...)
  local pts = { ... }
  if type(pts[1]) == "table" then pts = pts[1] end
  if #pts < 6 or #pts % 2 ~= 0 then fail("polygon needs >= 3 points, got %d numbers", #pts) end
  for i = 1, #pts do num(pts[i], "polygon vertex") end
  local ps = {}
  for i = 1, #pts, 2 do ps[#ps + 1] = ("%.1f,%.1f"):format(pts[i], pts[i + 1]) end
  rec(('<polygon points="%s" %s/>'):format(table.concat(ps, " "), paint(mode)))
  M.calls = M.calls + 1
end
local function checkText(s)
  if type(s) ~= "string" and type(s) ~= "number" then
    fail("print needs a string, got %s", type(s))
  end
end
function graphics.print(s, x, y)
  checkText(s); num(x, "x"); num(y, "y")
  M.calls = M.calls + 1
  M.lastText = tostring(s)
  M.texts[#M.texts + 1] = tostring(s)
  local ly = y
  for line in (tostring(s) .. "\n"):gmatch("(.-)\n") do
    textEl(line, x, ly)
    ly = ly + currentFont:getHeight()
  end
end
function graphics.printf(s, x, y, limit, align)
  checkText(s); num(x, "x"); num(y, "y"); num(limit, "printf limit")
  if align and align ~= "left" and align ~= "right" and align ~= "center" and align ~= "justify" then
    fail("bad align %s", tostring(align))
  end
  M.calls = M.calls + 1
  M.texts[#M.texts + 1] = tostring(s)
  -- Greedy word wrap with the same approximate metrics as getWidth.
  local anchor, ax = "start", x
  if align == "center" then anchor, ax = "middle", x + limit / 2
  elseif align == "right" then anchor, ax = "end", x + limit end
  local ly = y
  for para in (tostring(s) .. "\n"):gmatch("(.-)\n") do
    local line = ""
    for word in para:gmatch("%S+") do
      local try = line == "" and word or (line .. " " .. word)
      if currentFont:getWidth(try) > limit and line ~= "" then
        textEl(line, ax, ly, anchor); ly = ly + currentFont:getHeight(); line = word
      else
        line = try
      end
    end
    textEl(line, ax, ly, anchor); ly = ly + currentFont:getHeight()
  end
end
function graphics.push() end
function graphics.pop() end
function graphics.translate(x, y) num(x, "x"); num(y, "y") end
function graphics.scale(s) num(s, "scale") end
function graphics.getDimensions() return 1280, 720 end
function graphics.present() end
function graphics.clear() end

M.texts = {}

local mathlib = {}
--- Ear-clipping triangulation, like love.math.triangulate.
function mathlib.triangulate(pts)
  if #pts < 6 then fail("triangulate needs >= 3 points") end
  local v = {}
  for i = 1, #pts, 2 do v[#v + 1] = { pts[i], pts[i + 1] } end
  local area = 0
  for i = 1, #v do
    local a, b = v[i], v[i % #v + 1]
    area = area + a[1] * b[2] - b[1] * a[2]
  end
  local sign = area > 0 and 1 or -1
  local function cross(o, a, b) return (a[1] - o[1]) * (b[2] - o[2]) - (a[2] - o[2]) * (b[1] - o[1]) end
  local function inTri(p, a, b, c)
    local d1, d2, d3 = cross(p, a, b) * sign, cross(p, b, c) * sign, cross(p, c, a) * sign
    return d1 > 0 and d2 > 0 and d3 > 0
  end
  local tris, guard = {}, 0
  while #v > 3 and guard < 1000 do
    guard = guard + 1
    for i = 1, #v do
      local a, b, c = v[(i - 2) % #v + 1], v[i], v[i % #v + 1]
      if cross(a, b, c) * sign > 0 then
        local ear = true
        for _, p in ipairs(v) do
          if p ~= a and p ~= b and p ~= c and inTri(p, a, b, c) then ear = false; break end
        end
        if ear then
          tris[#tris + 1] = { a[1], a[2], b[1], b[2], c[1], c[2] }
          table.remove(v, i)
          break
        end
      end
    end
  end
  tris[#tris + 1] = { v[1][1], v[1][2], v[2][1], v[2][2], v[3][1], v[3][2] }
  return tris
end

M.quitRequested = false

function M.install()
  _G.love = {
    graphics = graphics,
    math = mathlib,
    keyboard = { setKeyRepeat = function() end },
    event = { quit = function() M.quitRequested = true end },
    timer = { getTime = os.clock },
  }
  return _G.love
end

return M
