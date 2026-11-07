// Conventions: permanent upgrades to how a strain scores.
// Port of src/game/conventions.lua.

import * as cards from '../rules/cards.ts';
import type { RNG } from '../rules/rng.ts';

export const POINTS_PER_LEVEL = 30;
export const MULT_PER_LEVEL = 0.6;

export interface ConventionDef {
	key: string;
	name: string;
	strain: number;
	text: string;
	flavour: string;
}

export const DEFS: ConventionDef[] = [
	{
		key: 'precision', name: 'Precision Club', strain: cards.CLUBS,
		text: 'Level up clubs', flavour: 'A strong, artificial one-club opening.'
	},
	{
		key: 'flannery', name: 'Flannery', strain: cards.DIAMONDS,
		text: 'Level up diamonds', flavour: 'Two diamonds, showing hearts and spades.'
	},
	{
		key: 'jacoby', name: 'Jacoby Transfer', strain: cards.HEARTS,
		text: 'Level up hearts', flavour: 'Bid the suit below the one you hold.'
	},
	{
		key: 'michaels', name: 'Michaels Cuebid', strain: cards.SPADES,
		text: 'Level up spades', flavour: 'A cuebid that promises two suits at once.'
	},
	{
		key: 'lebensohl', name: 'Lebensohl', strain: cards.NOTRUMP,
		text: 'Level up notrump', flavour: 'Two notrump, demanding three clubs.'
	}
];

export const BY_KEY: Record<string, ConventionDef> = {};
for (const d of DEFS) BY_KEY[d.key] = d;

export function get(key: string): ConventionDef | undefined {
	return BY_KEY[key];
}

export function forStrain(strain: number): ConventionDef | undefined {
	return DEFS.find((d) => d.strain === strain);
}

export function randomDef(rng: RNG): ConventionDef {
	return rng.pick(DEFS)!;
}

/** Bonus points and multiplier a strain's current level is worth. */
export function bonusFor(level?: number): [number, number] {
	const extra = Math.max(0, (level || 1) - 1);
	return [extra * POINTS_PER_LEVEL, extra * MULT_PER_LEVEL];
}

/** Human-readable summary of a strain's level, for the UI. */
export function describe(strain: number, level?: number): string {
	const [points, mult] = bonusFor(level);
	return `${cards.STRAINS[strain].glyph}  Lv.${level || 1}   +${points} points  +${mult.toFixed(2)} mult`;
}
