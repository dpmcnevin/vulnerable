--- Dump reference results from the Lua engine as JSON, for the web port's
-- conformance test (web/tests/conformance.test.mjs).
--
-- Usage, from web/:  luajit tools/dump_fixture.lua [luaRoot] > tests/fixtures/lua-conformance.json
-- `luaRoot` is the folder holding the Lua game's src/ and tools/ (default "..").

local root = arg[1] or ".."
package.path = root .. "/?.lua;" .. package.path

local cards = require("src.rules.cards")
local rngLib = require("src.rules.rng")
local scoring = require("src.rules.scoring")
local engine = require("src.game.engine")
local bot = require("tools.bot")

------------------------------------------------------------------ tiny JSON

local function isArray(t)
  if next(t) == nil then return true end
  local n = 0
  for k in pairs(t) do
    if type(k) ~= "number" then return false end
    n = n + 1
  end
  return n == #t
end

local encode
local function encodeString(s)
  return '"' .. s:gsub('[%c"\\]', function(c)
    return string.format("\\u%04x", c:byte())
  end) .. '"'
end

encode = function(v)
  local t = type(v)
  if t == "nil" then return "null"
  elseif t == "boolean" then return tostring(v)
  elseif t == "number" then
    if v == math.floor(v) and math.abs(v) < 2^53 then return string.format("%d", v) end
    return string.format("%.17g", v)
  elseif t == "string" then return encodeString(v)
  elseif t == "table" then
    local parts = {}
    if isArray(v) then
      for i = 1, #v do parts[i] = encode(v[i]) end
      return "[" .. table.concat(parts, ",") .. "]"
    end
    local keys, byName = {}, {}
    for k, val in pairs(v) do
      keys[#keys + 1] = tostring(k)
      byName[tostring(k)] = val
    end
    table.sort(keys)
    for _, k in ipairs(keys) do
      parts[#parts + 1] = encodeString(k) .. ":" .. encode(byName[k])
    end
    return "{" .. table.concat(parts, ",") .. "}"
  end
  error("cannot encode " .. t)
end

------------------------------------------------------------------ helpers

local function handCodes(hand)
  local out = {}
  for i = 1, #hand do out[i] = cards.code(hand[i]) end
  return out
end

local function dealCodes(hands)
  return { handCodes(hands[1]), handCodes(hands[2]), handCodes(hands[3]), handCodes(hands[4]) }
end

local function summariseRun(run)
  local relicKeys = {}
  for i = 1, #run.relics do relicKeys[i] = run.relics[i].key end
  local ployKeys = {}
  for i = 1, #run.ploys do ployKeys[i] = run.ploys[i].key end
  local log = {}
  for i = 1, #run.log do
    local e = run.log[i]
    log[i] = { e.rubber, e.board, e.contract, e.tricks, e.score }
  end
  return {
    phase = run.phase, rubber = run.rubber, board = run.board, money = run.money,
    score = run.score, target = run.target,
    relics = relicKeys, ploys = ployKeys,
    strainLevels = run.strainLevels, stats = run.stats, log = log,
    rngState = run.rng.state % 4294967296,
  }
end

--- A deterministic "human": picks bids and cards with its own generator and
-- drives the engine stepwise, the way the UI does, using every ploy it holds.
local function randomPlayer(seed)
  local run = engine.newRun(seed)
  local me = rngLib.new("player:" .. seed)
  local trace = {}
  for _ = 1, 400 do
    local phase = run.phase
    if phase == engine.PHASE.BID then
      local deal = run.deal
      trace[#trace + 1] = table.concat(handCodes(deal.hands[deal.declarer]), "")
      if #run.ploys > 0 and me:chance(0.5) then
        local hand = deal.hands[deal.declarer]
        local ok, msg = engine.usePloy(run, 1, me:pick(hand))
        trace[#trace + 1] = "ploy " .. tostring(ok) .. " " .. tostring(msg)
      end
      if run.phase == engine.PHASE.BID then
        local opts = engine.bidOptions(run)
        local pick = me:chance(0.5) and engine.recommendBid(run, opts) or me:pick(opts).contract
        local c = engine.commitBid(run, pick, { stepwise = true })
        trace[#trace + 1] = "bid " .. cards.contractName(c)
      end
    elseif phase == engine.PHASE.PLAY then
      if engine.isPlayerTurn(run) then
        local state = run.deal.state
        local legal = require("src.rules.play").legalPlays(state, state.turn)
        local c = me:pick(legal)
        engine.playerPlay(run, c, { stepwise = true })
        trace[#trace + 1] = cards.code(c)
      else
        local _, seat, c = engine.stepAI(run)
        trace[#trace + 1] = seat .. cards.code(c)
      end
    elseif phase == engine.PHASE.DEAL_SCORED then
      local r = run.deal.result
      trace[#trace + 1] = ("scored %d %s"):format(r.total, tostring(r.made))
      engine.continueAfterDeal(run)
    elseif phase == engine.PHASE.BOARD_WON then
      engine.enterShop(run)
      for i = 1, engine.SHOP_SIZE do
        if engine.canBuy(run, i) and me:chance(0.6) then engine.buy(run, i) end
      end
      if me:chance(0.3) and engine.reroll(run) then
        trace[#trace + 1] = "reroll"
      end
      local names = {}
      for i, item in ipairs(run.shop.items) do names[i] = item.kind .. ":" .. item.def.key end
      trace[#trace + 1] = "shop " .. table.concat(names, ",")
      engine.leaveShop(run)
    else
      break
    end
  end
  return { trace = trace, final = summariseRun(run) }
end

------------------------------------------------------------------ fixture

local out = {}

-- RNG primitives.
out.hash = {}
for _, s in ipairs({ "", "a", "VULNERABLE", "SIM1", "player:7", "héllo ♠" }) do
  out.hash[#out.hash + 1] = { s, rngLib.hashString(s) % 4294967296 }
end
out.streams = {}
for _, seed in ipairs({ "ABC", "SIM42", 1, 12345, -7, 4294967297, 0 }) do
  local r = rngLib.new(seed)
  local seq = {}
  for i = 1, 8 do seq[i] = r:nextUint() end
  for i = 1, 8 do seq[#seq + 1] = r:int(1, 13 + i) end
  seq[#seq + 1] = rngLib.randomSeedString(r)
  local deck = r:shuffle(cards.newDeck())
  seq[#seq + 1] = table.concat(handCodes(deck), "")
  local b = r:branch("shop")
  seq[#seq + 1] = b:nextUint()
  out.streams[#out.streams + 1] = { seed = seed, values = seq }
end

-- Deals.
out.deals = {}
for i = 1, 20 do
  local run = engine.newRun("DEAL" .. i)
  out.deals[i] = { seed = "DEAL" .. i, hands = dealCodes(run.deal.hands),
                   partner = run.deal.partnerInfo.text, target = run.target }
end

-- Scoring table.
out.scores = {}
for level = 1, 7 do
  for strain = 1, 5 do
    for doubled = 0, 2 do
      for _, vul in ipairs({ false, true }) do
        for tricks = 0, 13, 3 do
          local r = scoring.score({ level = level, strain = strain, doubled = doubled }, tricks, vul)
          out.scores[#out.scores + 1] = r.total
        end
      end
    end
  end
end
out.targets = {}
for rubber = 1, 11 do
  for board = 1, 3 do out.targets[#out.targets + 1] = engine.targetFor(rubber, board) end
end

-- Bot runs, with and without ploys.
out.botRuns = {}
for i = 1, 60 do
  out.botRuns[#out.botRuns + 1] = { seed = "CONF" .. i, ploys = true, result = summariseRun(bot.playRun("CONF" .. i)) }
end
for i = 1, 15 do
  out.botRuns[#out.botRuns + 1] = { seed = "NOPLOY" .. i, ploys = false,
    result = summariseRun(bot.playRun("NOPLOY" .. i, { noPloys = true })) }
end

-- Random human-style runs through the stepwise API.
out.playerRuns = {}
for i = 1, 25 do
  local seed = "HUMAN" .. i
  out.playerRuns[i] = { seed = seed, run = randomPlayer(seed) }
end

-- Pixel art: a hash of every card face (both palettes, trump or not), the
-- back, and every icon tile.
do
  local pixelcards = require("src.ui.pixelcards")
  local cardart = require("src.ui.cardart")
  local settings = require("src.ui.settings")
  local icons = require("src.ui.icons")
  local function serialise(b)
    local parts = {}
    for i = 1, b.w * b.h do
      local c = b.px[i]
      if c then
        parts[i] = string.format("%02x%02x%02x%02x", math.floor(c[1] * 255 + 0.5),
          math.floor(c[2] * 255 + 0.5), math.floor(c[3] * 255 + 0.5), math.floor((c[4] or 1) * 255 + 0.5))
      else
        parts[i] = "."
      end
    end
    return rngLib.hashString(table.concat(parts, ",")) % 4294967296
  end
  out.pixel = {}
  for _, four in ipairs({ true, false }) do
    settings.values.fourColour = four
    for _, card in ipairs(cards.newDeck()) do
      for _, trump in ipairs({ false, true }) do
        local b = pixelcards.faceBitmap(card, trump, cardart.palette, cardart.suitColor)
        out.pixel[#out.pixel + 1] = { cards.code(card), four, trump, serialise(b) }
      end
    end
  end
  out.pixelBack = serialise(pixelcards.backBitmap(cardart.palette))
  local keys = {}
  for k in pairs(icons.ICONS) do keys[#keys + 1] = k end
  keys[#keys + 1] = "no_such_icon"
  table.sort(keys)
  out.icons = {}
  for _, k in ipairs(keys) do out.icons[#out.icons + 1] = { k, serialise(icons.bitmap(k)) } end
end

-- Audio: sample count and a few summary statistics for every sound and the
-- music loop (compared with a tolerance; sin/exp differ by an ulp or so).
do
  local sounds = require("src.audio.sounds")
  local function stats(buf)
    local sumAbs, sumSq = 0, 0
    for i = 1, #buf do sumAbs = sumAbs + math.abs(buf[i]); sumSq = sumSq + buf[i] * buf[i] end
    return { n = #buf, rate = buf.rate, sumAbs = sumAbs, sumSq = sumSq,
             probe = { buf[1] or 0, buf[math.floor(#buf / 3)] or 0, buf[math.floor(#buf / 2)] or 0 } }
  end
  local names = {}
  for k in pairs(sounds.defs) do names[#names + 1] = k end
  table.sort(names)
  out.sounds = {}
  for _, k in ipairs(names) do out.sounds[#out.sounds + 1] = { k, stats(sounds.defs[k]()) } end
  out.music = stats(sounds.renderMusic())
end

io.write(encode(out), "\n")
