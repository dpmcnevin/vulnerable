--- Defender AI for East and West.
--
-- Plays the standard defensive heuristics a club player would recognise:
-- fourth-best leads, top of a sequence, second hand low, third hand high,
-- cover an honour with an honour, cheapest winner, ruff when it gains a
-- trick, and discard from weakness. It sees dummy once dummy is exposed,
-- exactly as a real defender does.
--
-- It is deliberately not a double-dummy solver. It should punish greedy
-- overbidding without being unbeatable.

local cards = require("src.rules.cards")
local play = require("src.rules.play")

local M = {}

M.DEFAULT_SKILL = 0.88

--- Does `c` currently beat `w`, given the trump strain?
local function beats(c, w, trump)
  local cT = (trump ~= cards.NOTRUMP and c.suit == trump)
  local wT = (trump ~= cards.NOTRUMP and w.suit == trump)
  if cT and not wT then return true end
  if wT and not cT then return false end
  if c.suit == w.suit then return c.rank > w.rank end
  return false
end

local function lowest(list)
  local best
  for i = 1, #list do
    if not best or list[i].rank < best.rank then best = list[i] end
  end
  return best
end

local function highest(list)
  local best
  for i = 1, #list do
    if not best or list[i].rank > best.rank then best = list[i] end
  end
  return best
end

--- The cheapest card in `list` that beats `target`, or nil.
local function cheapestWinner(list, target, trump)
  local best
  for i = 1, #list do
    if beats(list[i], target, trump) then
      if not best or list[i].rank < best.rank then best = list[i] end
    end
  end
  return best
end

--- Longest run of touching cards starting from the top of a suit holding.
local function sequenceLength(suited)
  if #suited < 2 then return #suited end
  local n = 1
  for i = 2, #suited do
    if suited[i].rank == suited[i - 1].rank - 1 then n = n + 1 else break end
  end
  return n
end

local function sortDesc(list)
  table.sort(list, function(a, b) return a.rank > b.rank end)
  return list
end

--- Pick a card to lead a fresh trick.
local function chooseLead(state, seat, ctx)
  local hand = state.hands[seat]
  local trump = state.trump
  local partner = cards.partner(seat)

  -- Cash a known winner: the top outstanding card in a suit we hold.
  -- We may look at our own hand and dummy's exposed hand when judging this.
  local known = ctx.dummyVisible and state.hands[ctx.dummy] or nil
  local bestCash
  for suit = 1, 4 do
    local suited = sortDesc(cards.cardsOfSuit(hand, suit))
    if #suited > 0 then
      local out = play.highestOutstanding(state, suit, hand)
      local dummyTop = 0
      if known then
        local dc = cards.cardsOfSuit(known, suit)
        for i = 1, #dc do dummyTop = math.max(dummyTop, dc[i].rank) end
      end
      -- Our top card is a winner if nothing outstanding beats it.
      if (not out or suited[1].rank > out) and suited[1].rank > dummyTop then
        if not bestCash or suited[1].rank > bestCash.rank then bestCash = suited[1] end
      end
    end
  end
  if bestCash and ctx.rng:chance(0.7) then return bestCash end

  -- Otherwise lead from our longest side suit, avoiding trumps.
  local candidates = {}
  for suit = 1, 4 do
    if suit ~= trump or trump == cards.NOTRUMP then
      local n = cards.countSuit(hand, suit)
      if n > 0 then candidates[#candidates + 1] = { suit = suit, n = n } end
    end
  end
  if #candidates == 0 then
    -- Only trumps left.
    return lowest(hand)
  end

  -- Prefer partner's suit if partner has led or discarded into it, then length.
  table.sort(candidates, function(a, b)
    local aP = ctx.partnerSuit == a.suit and 1 or 0
    local bP = ctx.partnerSuit == b.suit and 1 or 0
    if aP ~= bP then return aP > bP end
    if a.n ~= b.n then return a.n > b.n end
    return a.suit > b.suit
  end)

  local suit = candidates[1].suit
  local suited = sortDesc(cards.cardsOfSuit(hand, suit))

  -- Top of a three-card sequence (AKQ, KQJ, QJT) is the classic safe lead.
  if cards.isHonour(suited[1]) and sequenceLength(suited) >= 3 then
    return suited[1]
  end
  -- A singleton in a side suit angles for a ruff later.
  if #suited == 1 then return suited[1] end
  -- From a doubleton, lead the higher.
  if #suited == 2 then return suited[1] end
  -- Fourth best from length, the standard attacking lead.
  if #suited >= 4 then return suited[4] end
  -- Three small: lead the lowest.
  return suited[#suited]
end

--- Pick a card when following to a trick already in progress.
local function chooseFollow(state, seat, ctx)
  local trump = state.trump
  local legal = play.legalPlays(state, seat)
  if #legal == 1 then return legal[1] end

  local partner = cards.partner(seat)
  local winning = play.trickWinner(state.trick, trump)
  local partnerWinning = (winning.seat == partner)
  local lastToPlay = (#state.trick == 3)
  local secondToPlay = (#state.trick == 1)
  local followingSuit = (legal[1].suit == state.ledSuit)

  -- Partner already has it: never waste a high card on our own trick.
  if partnerWinning then
    if followingSuit then return lowest(legal) end
    -- Discarding: throw the least useful card.
    return ctx.discard(legal, trump)
  end

  local winner = cheapestWinner(legal, winning.card, trump)

  if followingSuit then
    if winner then
      -- Second hand low: with two opponents still to play, an honour is
      -- often wasted -- unless it is covering an honour, or it is cheap.
      local honourOnTable = cards.isHonour(winning.card)
      if secondToPlay and cards.isHonour(winner) and not honourOnTable
         and ctx.rng:chance(0.75) then
        return lowest(legal)
      end
      return winner
    end
    -- Can't win. Third hand high still helps push declarer's card up.
    if #state.trick == 2 and ctx.rng:chance(0.5) then
      local h = highest(legal)
      if h and not cards.isHonour(h) then return h end
    end
    return lowest(legal)
  end

  -- Void in the led suit. Ruffing is worth it when the trick is ours to take.
  if winner and trump ~= cards.NOTRUMP then
    local trumps = cards.cardsOfSuit(legal, trump)
    if #trumps > 0 then
      local cheap = cheapestWinner(trumps, winning.card, trump)
      -- Ruff when last to play (certain), or when the trick holds value.
      if cheap and (lastToPlay or cards.isHonour(winning.card) or ctx.rng:chance(0.6)) then
        return cheap
      end
    end
  end
  return ctx.discard(legal, trump)
end

--- Throw the least useful card: lowest card of our weakest non-trump suit.
local function makeDiscarder(state, seat)
  return function(legal, trump)
    local hand = state.hands[seat]
    local best, bestScore
    for i = 1, #legal do
      local c = legal[i]
      local suitLen = cards.countSuit(hand, c.suit)
      local honours = cards.honoursInSuit(hand, c.suit)
      -- Lower score = happier to throw it.
      local score = c.rank
      if trump ~= cards.NOTRUMP and c.suit == trump then score = score + 40 end
      if cards.isHonour(c) then score = score + 12 end
      -- Keep guards in short suits; shed from long weak suits.
      score = score + honours * 3 - suitLen
      if not bestScore or score < bestScore then best, bestScore = c, score end
    end
    return best
  end
end

--- Choose a card for a defender.
-- @param ctx { declarer, dummy, dummyVisible, rng, skill, partnerSuit }
function M.chooseCard(state, seat, ctx)
  local legal = play.legalPlays(state, seat)
  if #legal == 1 then return legal[1] end

  local skill = ctx.skill or M.DEFAULT_SKILL
  if ctx.rng:chance(1 - skill) then
    return legal[ctx.rng:int(1, #legal)]
  end

  local inner = {
    declarer = ctx.declarer,
    dummy = ctx.dummy,
    dummyVisible = ctx.dummyVisible,
    rng = ctx.rng,
    partnerSuit = ctx.partnerSuit,
    discard = makeDiscarder(state, seat),
  }

  if #state.trick == 0 then
    return chooseLead(state, seat, inner)
  end
  return chooseFollow(state, seat, inner)
end

--- A simple declarer-side policy, used when the player asks to play out the
-- remaining tricks rather than clicking every card.
--- Highest rank the defenders could still hold in a suit, from the declaring
-- side's point of view (it can see its own two hands, nothing else).
local function defendersTop(state, suit, seat)
  local partner = cards.partner(seat)
  local both = cards.copyHand(state.hands[seat])
  for _, c in ipairs(state.hands[partner]) do both[#both + 1] = c end
  return play.highestOutstanding(state, suit, both)
end

--- Do the defenders still hold any trumps? Counted from the cards seen.
local function defendersHaveTrumps(state, seat)
  if state.trump == cards.NOTRUMP then return false end
  local seen = cards.countSuit(state.hands[seat], state.trump)
             + cards.countSuit(state.hands[cards.partner(seat)], state.trump)
  for _, p in ipairs(state.played) do
    if p.card.suit == state.trump then seen = seen + 1 end
  end
  return seen < 13
end

function M.chooseDeclarerCard(state, seat, ctx)
  local trump = state.trump
  local legal = play.legalPlays(state, seat)
  if #legal == 1 then return legal[1] end

  local partner = cards.partner(seat)
  local hand, pHand = state.hands[seat], state.hands[partner]

  if #state.trick == 0 then
    local drawing = trump ~= cards.NOTRUMP and defendersHaveTrumps(state, seat)
    -- Draw trumps first while we hold the master trump.
    if drawing then
      local t = sortDesc(cards.cardsOfSuit(hand, trump))
      local top = defendersTop(state, trump, seat)
      if #t > 0 and (not top or t[1].rank > top) then return t[1] end
    end
    -- Cash a sure winner, preferring suits where we are not leaving partner
    -- stranded: lead low towards partner's master card when they hold it.
    local bestLead, bestScore
    for suit = 1, 4 do
      if not drawing or suit ~= trump then
        local mine = sortDesc(cards.cardsOfSuit(hand, suit))
        local theirs = sortDesc(cards.cardsOfSuit(pHand, suit))
        if #mine > 0 then
          local top = defendersTop(state, suit, seat)
          local myMaster = (not top) or mine[1].rank > top
          local theirMaster = #theirs > 0 and ((not top) or theirs[1].rank > top)
          local pick, score
          if myMaster then
            pick, score = mine[1], 100 + #mine
          elseif theirMaster then
            pick, score = mine[#mine], 90 + #theirs
          end
          -- Don't cash side winners into a defender's void while they hold trumps.
          if pick and drawing then score = score - 50 end
          if pick and (not bestScore or score > bestScore) then
            bestLead, bestScore = pick, score
          end
        end
      end
    end
    if bestLead then return bestLead end
    -- Nothing certain: lead low from our longest side suit to set it up.
    local best, bestLen
    for suit = 1, 4 do
      if suit ~= trump or trump == cards.NOTRUMP then
        local n = cards.countSuit(hand, suit) + cards.countSuit(pHand, suit)
        if cards.countSuit(hand, suit) > 0 and (not bestLen or n > bestLen) then
          best, bestLen = suit, n
        end
      end
    end
    if best then return lowest(cards.cardsOfSuit(hand, best)) end
    return lowest(legal)
  end

  local winning = play.trickWinner(state.trick, trump)
  -- Partner plays after us only if partner has not played yet.
  local partnerToPlay = true
  for i = 1, #state.trick do
    if state.trick[i].seat == partner then partnerToPlay = false end
  end

  if winning.seat == partner then
    -- Partner is winning. Overtake only if partner's card is not a sure winner
    -- and we are last; otherwise play low.
    return lowest(legal)
  end

  local winner = cheapestWinner(legal, winning.card, trump)
  if partnerToPlay and state.ledSuit then
    -- Partner still to play: if partner holds a master in the led suit, duck.
    local theirs = sortDesc(cards.cardsOfSuit(pHand, state.ledSuit))
    local top = defendersTop(state, state.ledSuit, seat)
    if #theirs > 0 and (not top or theirs[1].rank > top) and theirs[1].rank > winning.card.rank then
      if legal[1].suit == state.ledSuit then return lowest(legal) end
    end
  end
  if winner then
    -- Second hand: a defender still plays after us; win only with a master card.
    if #state.trick == 1 and winner.suit == state.ledSuit then
      local top = defendersTop(state, winner.suit, seat)
      if top and winner.rank < top and not partnerToPlay then
        return lowest(legal)
      end
    end
    return winner
  end
  return makeDiscarder(state, seat)(legal, trump)
end

--- Run the rest of a deal with both sides on autopilot.
function M.playOut(state, ctx)
  local guard = 0
  while not state.complete do
    guard = guard + 1
    assert(guard < 200, "playOut: did not terminate")
    local seat = state.turn
    local card
    if cards.sameSide(seat, ctx.declarer) then
      card = M.chooseDeclarerCard(state, seat, ctx)
    else
      card = M.chooseCard(state, seat, ctx)
    end
    play.play(state, seat, card)
  end
  return state
end

return M
