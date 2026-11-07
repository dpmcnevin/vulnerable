--- Trick-play state machine.
--
-- Enforces follow-suit, resolves tricks, and records telemetry that the
-- relics read later (which seat won a trick, whether it was a ruff, whether
-- the winning card was an honour). Pure Lua: no LOVE, no globals.

local cards = require("src.rules.cards")

local M = {}

--- Start a play phase.
-- @param hands  table of four hands indexed by seat (consumed, not copied)
-- @param trump  strain 1..5; 5 (notrump) means no trump suit
-- @param leader seat on opening lead
function M.new(hands, trump, leader)
  local state = {
    hands = {},
    trump = trump,
    leader = leader,
    turn = leader,
    trick = {},          -- cards played so far this trick
    ledSuit = nil,
    tricks = {},         -- completed tricks, with telemetry
    nsTricks = 0,
    ewTricks = 0,
    voids = { {}, {}, {} , {} },  -- revealed voids, per seat, for AI inference
    played = {},         -- every card played, for AI card counting
    complete = false,
  }
  for seat = 1, 4 do
    state.hands[seat] = cards.copyHand(hands[seat] or {})
  end
  return state
end

function M.isTrumpSuit(state, suit)
  return state.trump ~= cards.NOTRUMP and suit == state.trump
end

--- Cards a seat may legally play right now: follow suit if you can.
function M.legalPlays(state, seat)
  local hand = state.hands[seat]
  if state.ledSuit and cards.hasSuit(hand, state.ledSuit) then
    return cards.cardsOfSuit(hand, state.ledSuit)
  end
  return cards.copyHand(hand)
end

function M.isLegal(state, seat, card)
  local legal = M.legalPlays(state, seat)
  for i = 1, #legal do
    if legal[i] == card then return true end
  end
  return false
end

--- Which play in a trick wins it.
-- Highest trump if any trump was played, otherwise highest card of the led suit.
function M.trickWinner(trick, trump)
  local ledSuit = trick[1].card.suit
  local best = trick[1]
  for i = 2, #trick do
    local c, b = trick[i].card, best.card
    local cTrump = (trump ~= cards.NOTRUMP and c.suit == trump)
    local bTrump = (trump ~= cards.NOTRUMP and b.suit == trump)
    if cTrump and not bTrump then
      best = trick[i]
    elseif cTrump == bTrump and c.suit == b.suit and c.rank > b.rank then
      best = trick[i]
    end
  end
  return best
end

--- Play one card. Returns the completed trick table when the trick ends.
function M.play(state, seat, card)
  assert(not state.complete, "play: deal is already finished")
  assert(seat == state.turn, "play: not this seat's turn")
  assert(M.isLegal(state, seat, card), "play: illegal card")

  -- Record a revealed void: discarding off-suit proves the seat is out of it.
  if state.ledSuit and card.suit ~= state.ledSuit then
    state.voids[seat][state.ledSuit] = true
  end

  cards.removeCard(state.hands[seat], card)
  state.trick[#state.trick + 1] = { seat = seat, card = card }
  state.played[#state.played + 1] = { seat = seat, card = card }
  if #state.trick == 1 then state.ledSuit = card.suit end

  if #state.trick < 4 then
    state.turn = cards.nextSeat(seat)
    return nil
  end

  -- Trick is full: resolve it.
  local winning = M.trickWinner(state.trick, state.trump)
  local ledSuit = state.trick[1].card.suit
  local completed = {
    index = #state.tricks + 1,
    leader = state.leader,
    ledSuit = ledSuit,
    plays = state.trick,
    winner = winning.seat,
    winningCard = winning.card,
    -- A ruff: won with a trump when something else was led.
    ruff = M.isTrumpSuit(state, winning.card.suit) and ledSuit ~= state.trump,
    wonWithHonour = cards.isHonour(winning.card),
  }
  state.tricks[#state.tricks + 1] = completed

  if cards.SEATS[winning.seat].side == "NS" then
    state.nsTricks = state.nsTricks + 1
  else
    state.ewTricks = state.ewTricks + 1
  end

  state.trick = {}
  state.ledSuit = nil
  state.leader = winning.seat
  state.turn = winning.seat

  if #state.tricks >= cards.TRICK_COUNT or #state.hands[winning.seat] == 0 then
    state.complete = true
  end
  return completed
end

--- Tricks taken by the declaring side.
function M.declarerTricks(state, declarer)
  return cards.SEATS[declarer].side == "NS" and state.nsTricks or state.ewTricks
end

function M.tricksRemaining(state)
  return cards.TRICK_COUNT - #state.tricks
end

--- Highest card of a suit still unseen by a given seat (for AI reasoning).
function M.highestOutstanding(state, suit, knownHand)
  local seen = {}
  for i = 1, #state.played do
    if state.played[i].card.suit == suit then seen[state.played[i].card.rank] = true end
  end
  for i = 1, #state.trick do
    if state.trick[i].card.suit == suit then seen[state.trick[i].card.rank] = true end
  end
  if knownHand then
    for i = 1, #knownHand do
      if knownHand[i].suit == suit then seen[knownHand[i].rank] = true end
    end
  end
  for rank = 14, 2, -1 do
    if not seen[rank] then return rank end
  end
  return nil
end

--- Telemetry the relics consume, derived once a deal is finished.
function M.summarise(state, declarer)
  local dummy = cards.partner(declarer)
  local s = {
    declarerTricks = M.declarerTricks(state, declarer),
    ruffs = 0,
    tricksFromDummy = 0,
    tricksFromDeclarer = 0,
    honourWins = 0,
    wonLastTrick = false,
    wonFirstTrick = false,
    lastThree = 0,
  }
  for i = 1, #state.tricks do
    local t = state.tricks[i]
    local ours = cards.sameSide(t.winner, declarer)
    if ours then
      if t.ruff then s.ruffs = s.ruffs + 1 end
      if t.winner == dummy then s.tricksFromDummy = s.tricksFromDummy + 1 end
      if t.winner == declarer then s.tricksFromDeclarer = s.tricksFromDeclarer + 1 end
      if t.wonWithHonour then s.honourWins = s.honourWins + 1 end
      if i == 1 then s.wonFirstTrick = true end
      if i == #state.tricks then s.wonLastTrick = true end
      if i > #state.tricks - 3 then s.lastThree = s.lastThree + 1 end
    end
  end
  return s
end

return M
