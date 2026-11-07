--- Deterministic pseudo-random number generator (xorshift32).
--
-- Pure Lua + the `bit` library (built into LuaJIT and LOVE), chosen over
-- math.random so that a seed reproduces a run exactly on every platform.
-- Only xor and shifts are used, so every step is exact in doubles -- no
-- multiplication that could silently lose precision above 2^53.

local bit = require("bit")
local band, bxor, lshift, rshift = bit.band, bit.bxor, bit.lshift, bit.rshift

local M = {}

local RNG = {}
RNG.__index = RNG

--- Mix one 32-bit value. Exact: xor and shift only.
local function mix(h)
  h = bxor(h, lshift(h, 13))
  h = bxor(h, rshift(h, 17))
  h = bxor(h, lshift(h, 5))
  return h
end

--- Hash an arbitrary string to a 32-bit integer, for word seeds.
function M.hashString(s)
  local h = 0x811C9DC5
  for i = 1, #s do
    h = mix(bxor(h, s:byte(i)))
  end
  return h
end

--- Create a generator. `seed` may be a string, a number, or nil (time-based).
function M.new(seed)
  local state
  if type(seed) == "string" then
    state = M.hashString(seed)
  elseif type(seed) == "number" then
    state = band(math.floor(seed), 0xFFFFFFFF)
  else
    state = band(math.floor((os.time() or 1) * 2654435761), 0xFFFFFFFF)
  end
  -- xorshift has a fixed point at zero; nudge off it.
  if state == 0 then state = 0x9E3779B9 end
  return setmetatable({ state = state }, RNG)
end

--- Next raw 32-bit unsigned value.
function RNG:nextUint()
  self.state = mix(self.state)
  return self.state % 4294967296
end

--- Next float in [0, 1).
function RNG:next()
  return self:nextUint() / 4294967296
end

--- Integer in [min, max] inclusive. Rejection-sampled, so it stays uniform.
function RNG:int(min, max)
  if min > max then min, max = max, min end
  local span = max - min + 1
  local limit = 4294967296 - (4294967296 % span)
  local v
  repeat
    v = self:nextUint()
  until v < limit
  return min + (v % span)
end

--- True with probability `p`.
function RNG:chance(p)
  return self:next() < p
end

--- Fisher-Yates, in place. Returns the same table for chaining.
function RNG:shuffle(t)
  for i = #t, 2, -1 do
    local j = self:int(1, i)
    t[i], t[j] = t[j], t[i]
  end
  return t
end

--- Uniformly pick one element of an array.
function RNG:pick(t)
  if #t == 0 then return nil end
  return t[self:int(1, #t)]
end

--- Pick `n` distinct elements. Does not disturb the source table.
function RNG:sample(t, n)
  local pool = {}
  for i = 1, #t do pool[i] = t[i] end
  self:shuffle(pool)
  local out = {}
  for i = 1, math.min(n, #pool) do out[i] = pool[i] end
  return out
end

--- Independent child generator, so one subsystem's draws cannot shift another's.
function RNG:branch(label)
  return M.new(band(bxor(self.state, M.hashString(label or "branch")), 0xFFFFFFFF))
end

--- A pronounceable 8-character seed, for display and re-entry.
function M.randomSeedString(rng)
  rng = rng or M.new()
  local alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  local out = {}
  for i = 1, 8 do
    local k = rng:int(1, #alphabet)
    out[i] = alphabet:sub(k, k)
  end
  return table.concat(out)
end

return M
