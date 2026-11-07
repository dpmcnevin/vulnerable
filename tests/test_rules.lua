--- Tests for the bridge rules core. Run with: luajit tests/test_rules.lua
--
-- The scoring cases are hand-checked against the duplicate bridge scoring
-- table, not against this implementation, so they catch drift.

package.path = "./?.lua;" .. package.path

local cards = require("src.rules.cards")
local scoring = require("src.rules.scoring")
local play = require("src.rules.play")
local rng = require("src.rules.rng")

local passed, failed = 0, 0
local function check(label, actual, expected)
  if actual == expected then
    passed = passed + 1
  else
    failed = failed + 1
    print(("  FAIL %s\n        got %s, expected %s")
      :format(label, tostring(actual), tostring(expected)))
  end
end

local function section(name)
  print("\n" .. name)
end

local C, D, H, S, NT = cards.CLUBS, cards.DIAMONDS, cards.HEARTS, cards.SPADES, cards.NOTRUMP
local function ct(level, strain, doubled)
  return { level = level, strain = strain, doubled = doubled or 0 }
end
local function total(level, strain, tricks, vul, doubled)
  return scoring.score(ct(level, strain, doubled), tricks, vul).total
end

--------------------------------------------------------------------------
section("Contract points")
--------------------------------------------------------------------------
check("2C contract points", scoring.contractPoints(ct(2, C)), 40)
check("4S contract points", scoring.contractPoints(ct(4, S)), 120)
check("3NT contract points", scoring.contractPoints(ct(3, NT)), 100)
check("1NT contract points", scoring.contractPoints(ct(1, NT)), 40)
check("7NT contract points", scoring.contractPoints(ct(7, NT)), 220)
check("5D contract points", scoring.contractPoints(ct(5, D)), 100)
check("4S doubled contract points", scoring.contractPoints(ct(4, S, 1)), 240)
check("1S redoubled contract points", scoring.contractPoints(ct(1, S, 2)), 120)
check("tricks needed for 4S", scoring.tricksNeeded(ct(4, S)), 10)
check("tricks needed for 7NT", scoring.tricksNeeded(ct(7, NT)), 13)

--------------------------------------------------------------------------
section("Making contracts")
--------------------------------------------------------------------------
check("4S made NV",            total(4, S, 10, false), 420)
check("4S made vul",           total(4, S, 10, true),  620)
check("3NT made NV",           total(3, NT, 9, false), 400)
check("3NT made vul",          total(3, NT, 9, true),  600)
check("2H made NV (partscore)", total(2, H, 8, false), 110)
check("1NT made NV",           total(1, NT, 7, false), 90)
check("5D made NV",            total(5, D, 11, false), 400)
check("6S made NV (slam)",     total(6, S, 12, false), 980)
check("6S made vul",           total(6, S, 12, true),  1430)
check("7NT made vul (grand)",  total(7, NT, 13, true), 2220)
check("7NT made NV",           total(7, NT, 13, false), 1520)
-- A redoubled one-spade is worth game: 120 contract points clears 100.
check("1S redoubled made NV",  total(1, S, 7, false, 2), 520)

--------------------------------------------------------------------------
section("Overtricks")
--------------------------------------------------------------------------
check("2C +2 NV", total(2, C, 10, false), 130)
check("4S +1 NV", total(4, S, 11, false), 450)
check("3NT +2 vul", total(3, NT, 11, true), 660)
check("4S doubled +1 NV", total(4, S, 11, false, 1), 690)
-- 240 contract + 500 game + 50 insult + 200 doubled overtrick.
check("4S doubled +1 vul", total(4, S, 11, true, 1), 990)

--------------------------------------------------------------------------
section("Failing contracts")
--------------------------------------------------------------------------
check("4S down 1 NV",  total(4, S, 9, false), -50)
check("4S down 1 vul", total(4, S, 9, true),  -100)
check("3NT down 2 vul", total(3, NT, 7, true), -200)
check("4S doubled down 1 NV", total(4, S, 9, false, 1), -100)
check("4S doubled down 2 NV", total(4, S, 8, false, 1), -300)
check("4S doubled down 3 NV", total(4, S, 7, false, 1), -500)
check("4S doubled down 4 NV", total(4, S, 6, false, 1), -800)
check("4S doubled down 3 vul", total(4, S, 7, true, 1), -800)
check("4S redoubled down 2 NV", total(4, S, 8, false, 2), -600)

--------------------------------------------------------------------------
section("Cards and dealing")
--------------------------------------------------------------------------
check("deck size", #cards.newDeck(), 52)
check("next seat from West wraps to North", cards.nextSeat(cards.WEST), cards.NORTH)
check("next seat from North is East", cards.nextSeat(cards.NORTH), cards.EAST)
check("South's partner is North", cards.partner(cards.SOUTH), cards.NORTH)
check("East's partner is West", cards.partner(cards.EAST), cards.WEST)
check("North and South are partners", cards.sameSide(cards.NORTH, cards.SOUTH), true)
check("North and East are not", cards.sameSide(cards.NORTH, cards.EAST), false)

do
  -- Over many deals: 13 cards each, 40 HCP total, no card dealt twice.
  local badSize, badHcp, dupes = 0, 0, 0
  for trial = 1, 200 do
    local r = rng.new("DEAL" .. trial)
    local hands = cards.deal(r)
    local seen, hcpTotal = {}, 0
    for seat = 1, 4 do
      if #hands[seat] ~= 13 then badSize = badSize + 1 end
      hcpTotal = hcpTotal + cards.hcp(hands[seat])
      for _, c in ipairs(hands[seat]) do
        local code = cards.code(c)
        if seen[code] then dupes = dupes + 1 end
        seen[code] = true
      end
    end
    if hcpTotal ~= 40 then badHcp = badHcp + 1 end
  end
  check("every hand is 13 cards (200 deals)", badSize, 0)
  check("HCP always totals 40 (200 deals)", badHcp, 0)
  check("no duplicate cards (200 deals)", dupes, 0)
end

do
  local hand = {
    cards.card(S, 14), cards.card(S, 13), cards.card(S, 12),
    cards.card(H, 11), cards.card(H, 2),
    cards.card(D, 14), cards.card(D, 7), cards.card(D, 5), cards.card(D, 3),
    cards.card(C, 9), cards.card(C, 8), cards.card(C, 4), cards.card(C, 2),
  }
  check("hcp A+K+Q+J+A", cards.hcp(hand), 4 + 3 + 2 + 1 + 4)
  check("spade count", cards.countSuit(hand, S), 3)
  check("longest suit is diamonds or clubs (4)", select(2, cards.longestSuit(hand)), 4)
  check("sorted shape", table.concat(cards.sortedShape(hand), "-"), "4-4-3-2")
  check("is balanced (4432)", cards.isBalanced(hand), true)
  check("honours in spades", cards.honoursInSuit(hand, S), 3)
  check("shortness points (one doubleton)", cards.shortnessPoints(hand), 1)
end

--------------------------------------------------------------------------
section("Reproducibility")
--------------------------------------------------------------------------
do
  local a = cards.deal(rng.new("SAMESEED"))
  local b = cards.deal(rng.new("SAMESEED"))
  local same = true
  for seat = 1, 4 do
    for i = 1, 13 do
      if cards.code(a[seat][i]) ~= cards.code(b[seat][i]) then same = false end
    end
  end
  check("same seed deals the same cards", same, true)

  local c = cards.deal(rng.new("OTHERSEED"))
  local identical = true
  for i = 1, 13 do
    if cards.code(a[1][i]) ~= cards.code(c[1][i]) then identical = false end
  end
  check("different seed deals differently", identical, false)
end

--------------------------------------------------------------------------
section("Trick play")
--------------------------------------------------------------------------
do
  local trump = H
  -- Highest trump beats everything.
  local trick = {
    { seat = cards.WEST,  card = cards.card(S, 14) },
    { seat = cards.NORTH, card = cards.card(S, 3) },
    { seat = cards.EAST,  card = cards.card(H, 2) },
    { seat = cards.SOUTH, card = cards.card(S, 13) },
  }
  check("low trump beats the ace of the led suit", play.trickWinner(trick, trump).seat, cards.EAST)

  -- Without trumps, highest of the led suit wins and off-suit cards never do.
  local trick2 = {
    { seat = cards.WEST,  card = cards.card(S, 10) },
    { seat = cards.NORTH, card = cards.card(S, 12) },
    { seat = cards.EAST,  card = cards.card(D, 14) },
    { seat = cards.SOUTH, card = cards.card(S, 4) },
  }
  check("highest of led suit wins at notrump", play.trickWinner(trick2, NT).seat, cards.NORTH)
  check("discard cannot win", play.trickWinner(trick2, NT).card.suit, S)

  -- Two trumps: the higher wins.
  local trick3 = {
    { seat = cards.WEST,  card = cards.card(D, 5) },
    { seat = cards.NORTH, card = cards.card(H, 7) },
    { seat = cards.EAST,  card = cards.card(H, 11) },
    { seat = cards.SOUTH, card = cards.card(D, 14) },
  }
  check("higher trump wins", play.trickWinner(trick3, trump).seat, cards.EAST)
end

do
  -- Follow-suit enforcement.
  local hands = {
    [cards.NORTH] = { cards.card(S, 5), cards.card(H, 9) },
    [cards.EAST]  = { cards.card(S, 2), cards.card(D, 9) },
    [cards.SOUTH] = { cards.card(H, 3), cards.card(D, 4) },
    [cards.WEST]  = { cards.card(S, 14), cards.card(C, 6) },
  }
  local st = play.new(hands, NT, cards.WEST)
  check("west leads", st.turn, cards.WEST)
  check("leader may play anything", #play.legalPlays(st, cards.WEST), 2)

  play.play(st, cards.WEST, st.hands[cards.WEST][1])  -- spade ace
  check("led suit recorded", st.ledSuit, S)
  local northLegal = play.legalPlays(st, cards.NORTH)
  check("north must follow suit", #northLegal, 1)
  check("north's only legal card is the spade", northLegal[1].suit, S)

  play.play(st, cards.NORTH, northLegal[1])
  play.play(st, cards.EAST, play.legalPlays(st, cards.EAST)[1])
  -- South is void in spades, so may play either card.
  check("void seat may discard freely", #play.legalPlays(st, cards.SOUTH), 2)
  play.play(st, cards.SOUTH, play.legalPlays(st, cards.SOUTH)[1])

  check("trick resolved", #st.tricks, 1)
  check("west won with the ace", st.tricks[1].winner, cards.WEST)
  check("south's void in spades is now known", st.voids[cards.SOUTH][S], true)
  check("winner leads next", st.turn, cards.WEST)
end

do
  -- A full random deal always plays out to exactly 13 tricks.
  local badTricks, badSplit = 0, 0
  for trial = 1, 50 do
    local r = rng.new("PLAYOUT" .. trial)
    local hands = cards.deal(r)
    local st = play.new(hands, r:int(1, 5), cards.WEST)
    while not st.complete do
      local legal = play.legalPlays(st, st.turn)
      play.play(st, st.turn, legal[r:int(1, #legal)])
    end
    if #st.tricks ~= 13 then badTricks = badTricks + 1 end
    if st.nsTricks + st.ewTricks ~= 13 then badSplit = badSplit + 1 end
  end
  check("random play always makes 13 tricks (50 deals)", badTricks, 0)
  check("trick counts always sum to 13", badSplit, 0)
end

--------------------------------------------------------------------------
print(("\n%d passed, %d failed"):format(passed, failed))
os.exit(failed == 0 and 0 or 1)
