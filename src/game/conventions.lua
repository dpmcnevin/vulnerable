--- Conventions: permanent upgrades to how a strain scores.
--
-- Each is a real bidding convention, tied to the strain it is used to find.
-- Buying one raises that strain's level for the rest of the run, so your
-- relics and your bidding start pulling in the same direction.

local cards = require("src.rules.cards")

local M = {}

M.POINTS_PER_LEVEL = 30
M.MULT_PER_LEVEL = 0.6

M.DEFS = {
  {
    key = "precision", name = "Precision Club", strain = cards.CLUBS,
    text = "Level up clubs",
    flavour = "A strong, artificial one-club opening.",
  },
  {
    key = "flannery", name = "Flannery", strain = cards.DIAMONDS,
    text = "Level up diamonds",
    flavour = "Two diamonds, showing hearts and spades.",
  },
  {
    key = "jacoby", name = "Jacoby Transfer", strain = cards.HEARTS,
    text = "Level up hearts",
    flavour = "Bid the suit below the one you hold.",
  },
  {
    key = "michaels", name = "Michaels Cuebid", strain = cards.SPADES,
    text = "Level up spades",
    flavour = "A cuebid that promises two suits at once.",
  },
  {
    key = "lebensohl", name = "Lebensohl", strain = cards.NOTRUMP,
    text = "Level up notrump",
    flavour = "Two notrump, demanding three clubs.",
  },
}

M.BY_KEY = {}
for i = 1, #M.DEFS do M.BY_KEY[M.DEFS[i].key] = M.DEFS[i] end

function M.get(key) return M.BY_KEY[key] end

function M.forStrain(strain)
  for i = 1, #M.DEFS do
    if M.DEFS[i].strain == strain then return M.DEFS[i] end
  end
  return nil
end

function M.randomDef(rng)
  return rng:pick(M.DEFS)
end

--- Bonus points and multiplier a strain's current level is worth.
function M.bonusFor(level)
  local extra = math.max(0, (level or 1) - 1)
  return extra * M.POINTS_PER_LEVEL, extra * M.MULT_PER_LEVEL
end

--- Human-readable summary of a strain's level, for the UI.
function M.describe(strain, level)
  local points, mult = M.bonusFor(level)
  return ("%s  Lv.%d   +%d points  +%.2f mult")
    :format(cards.STRAINS[strain].glyph, level or 1, points, mult)
end

return M
