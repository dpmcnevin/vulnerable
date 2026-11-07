--- Cards, suits, strains, seats and deals.
--
-- Bridge ordering is baked into the numbering, because the rules depend on it:
-- suits rank clubs < diamonds < hearts < spades, and notrump outranks them all
-- as a bid. Seats run clockwise so that `nextSeat` is plain arithmetic.

local M = {}

-- Strains, in bidding order. 1..4 are also the suit ids.
M.CLUBS, M.DIAMONDS, M.HEARTS, M.SPADES, M.NOTRUMP = 1, 2, 3, 4, 5

M.SUITS = {
  { key = "C", name = "Clubs",    glyph = "♣", red = false, major = false },
  { key = "D", name = "Diamonds", glyph = "♦", red = true,  major = false },
  { key = "H", name = "Hearts",   glyph = "♥", red = true,  major = true  },
  { key = "S", name = "Spades",   glyph = "♠", red = false, major = true  },
}

M.STRAINS = {
  M.SUITS[1], M.SUITS[2], M.SUITS[3], M.SUITS[4],
  { key = "NT", name = "Notrump", glyph = "NT", red = false, major = false, notrump = true },
}

-- Seats, clockwise. You are South and declare every board; North is your
-- dummy, which you also play. East and West are the AI defenders.
M.NORTH, M.EAST, M.SOUTH, M.WEST = 1, 2, 3, 4

M.SEATS = {
  { key = "N", name = "North", side = "NS", label = "Dummy"    },
  { key = "E", name = "East",  side = "EW", label = "Defender" },
  { key = "S", name = "South", side = "NS", label = "You"      },
  { key = "W", name = "West",  side = "EW", label = "Defender" },
}

M.RANKS = { 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 }

M.RANK_NAMES = {
  [2] = "2", [3] = "3", [4] = "4", [5] = "5", [6] = "6", [7] = "7",
  [8] = "8", [9] = "9", [10] = "10", [11] = "J", [12] = "Q", [13] = "K", [14] = "A",
}

-- Milton Work point count: the standard way bridge players value a hand.
M.HCP_VALUE = { [14] = 4, [13] = 3, [12] = 2, [11] = 1 }

M.HAND_SIZE = 13
M.TRICK_COUNT = 13

--- Next seat clockwise.
function M.nextSeat(seat)
  return seat % 4 + 1
end

--- Partner sits opposite.
function M.partner(seat)
  return (seat + 1) % 4 + 1
end

--- Are two seats on the same side?
function M.sameSide(a, b)
  return M.SEATS[a].side == M.SEATS[b].side
end

function M.card(suit, rank)
  return { suit = suit, rank = rank }
end

--- "AS", stable across locales -- used for tests and save files.
function M.code(c)
  return M.RANK_NAMES[c.rank] .. M.SUITS[c.suit].key
end

--- "A♠", for display.
function M.name(c)
  return M.RANK_NAMES[c.rank] .. M.SUITS[c.suit].glyph
end

function M.strainName(strain)
  return M.STRAINS[strain].name
end

--- "4♠" / "3NT".
function M.contractName(contract)
  local s = contract.level .. M.STRAINS[contract.strain].glyph
  if contract.doubled == 1 then s = s .. " X"
  elseif contract.doubled == 2 then s = s .. " XX" end
  return s
end

function M.isHonour(c)
  return c.rank >= 10
end

--- Ten through ace are the cards that carry point count or near it.
function M.isFace(c)
  return c.rank >= 11
end

--- A fresh 52-card deck in a fixed order. Shuffle it before dealing.
function M.newDeck()
  local deck = {}
  for suit = 1, 4 do
    for _, rank in ipairs(M.RANKS) do
      deck[#deck + 1] = M.card(suit, rank)
    end
  end
  return deck
end

--- Deal four 13-card hands, indexed by seat.
function M.deal(rng)
  local deck = rng:shuffle(M.newDeck())
  local hands = { {}, {}, {}, {} }
  local i = 1
  for seat = 1, 4 do
    for _ = 1, M.HAND_SIZE do
      hands[seat][#hands[seat] + 1] = deck[i]
      i = i + 1
    end
    M.sortHand(hands[seat])
  end
  return hands
end

--- Sort into the layout bridge players use: spades first, high cards left.
function M.sortHand(hand)
  table.sort(hand, function(a, b)
    if a.suit ~= b.suit then return a.suit > b.suit end
    return a.rank > b.rank
  end)
  return hand
end

--- High card points in a hand.
function M.hcp(hand)
  local total = 0
  for i = 1, #hand do
    total = total + (M.HCP_VALUE[hand[i].rank] or 0)
  end
  return total
end

--- Cards per suit, as an array indexed by suit id.
function M.shape(hand)
  local counts = { 0, 0, 0, 0 }
  for i = 1, #hand do
    counts[hand[i].suit] = counts[hand[i].suit] + 1
  end
  return counts
end

--- Shape sorted long-to-short, e.g. {5,4,3,1}. Distribution regardless of suit.
function M.sortedShape(hand)
  local counts = M.shape(hand)
  local sorted = { counts[1], counts[2], counts[3], counts[4] }
  table.sort(sorted, function(a, b) return a > b end)
  return sorted
end

--- Balanced hands are 4333, 4432 and 5332 -- the shapes that want notrump.
function M.isBalanced(hand)
  local s = M.sortedShape(hand)
  return s[1] <= 5 and s[4] >= 2 and not (s[1] == 5 and s[2] == 5)
end

--- Longest suit, ties broken by the higher-ranking suit.
function M.longestSuit(hand)
  local counts = M.shape(hand)
  local best, bestCount = M.CLUBS, -1
  for suit = 1, 4 do
    if counts[suit] > bestCount then best, bestCount = suit, counts[suit] end
  end
  return best, bestCount
end

--- Distribution points: the extra value of short suits when you have a trump.
function M.shortnessPoints(hand)
  local counts, pts = M.shape(hand), 0
  for suit = 1, 4 do
    if counts[suit] == 0 then pts = pts + 3
    elseif counts[suit] == 1 then pts = pts + 2
    elseif counts[suit] == 2 then pts = pts + 1 end
  end
  return pts
end

function M.cardsOfSuit(hand, suit)
  local out = {}
  for i = 1, #hand do
    if hand[i].suit == suit then out[#out + 1] = hand[i] end
  end
  return out
end

function M.countSuit(hand, suit)
  local n = 0
  for i = 1, #hand do
    if hand[i].suit == suit then n = n + 1 end
  end
  return n
end

function M.hasSuit(hand, suit)
  return M.countSuit(hand, suit) > 0
end

--- Aces, kings, queens... in a suit. Used by honour-counting relics.
function M.honoursInSuit(hand, suit)
  local n = 0
  for i = 1, #hand do
    if hand[i].suit == suit and M.isHonour(hand[i]) then n = n + 1 end
  end
  return n
end

function M.countRank(hand, rank)
  local n = 0
  for i = 1, #hand do
    if hand[i].rank == rank then n = n + 1 end
  end
  return n
end

--- Index of a card within a hand, by identity then by value.
function M.indexOf(hand, card)
  for i = 1, #hand do
    if hand[i] == card then return i end
  end
  for i = 1, #hand do
    if hand[i].suit == card.suit and hand[i].rank == card.rank then return i end
  end
  return nil
end

function M.removeCard(hand, card)
  local i = M.indexOf(hand, card)
  if i then return table.remove(hand, i) end
  return nil
end

--- Shallow copy of a hand (cards themselves are shared and never mutated).
function M.copyHand(hand)
  local out = {}
  for i = 1, #hand do out[i] = hand[i] end
  return out
end

--- Compact rendering of a whole hand, e.g. "S:AKQ74 H:K3 D:A82 C:95".
function M.describeHand(hand)
  local parts = {}
  for suit = 4, 1, -1 do
    local cs = M.cardsOfSuit(hand, suit)
    table.sort(cs, function(a, b) return a.rank > b.rank end)
    local ranks = {}
    for i = 1, #cs do ranks[i] = M.RANK_NAMES[cs[i].rank] end
    parts[#parts + 1] = M.SUITS[suit].key .. ":" .. (#ranks > 0 and table.concat(ranks) or "-")
  end
  return table.concat(parts, " ")
end

return M
