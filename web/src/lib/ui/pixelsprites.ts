// Hand-drawn pixel sprites: suit symbols, pixel fonts and court crests.
// Port of src/ui/pixelsprites.lua. '#' marks an opaque pixel; colors are
// supplied when stamping. Tables are indexed by suit or rank id.

import type { Color } from './theme.ts';

// Suits at 5x5 (corner index) and 7x7 (pips).
export const SUIT5: Record<number, string[]> = {
	1: ['.###.', '.###.', '#####', '##.##', '..#..'],
	2: ['..#..', '.###.', '#####', '.###.', '..#..'],
	3: ['##.##', '#####', '#####', '.###.', '..#..'],
	4: ['..#..', '.###.', '#####', '##.##', '..#..']
};

export const SUIT7: Record<number, string[]> = {
	1: ['..###..', '..###..', '##.#.##', '#######', '##.#.##', '...#...', '..###..'],
	2: ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'],
	3: ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'],
	4: ['...#...', '..###..', '.#####.', '#######', '#######', '...#...', '..###..']
};

// Corner-index font, 4x6 ("10" is 6 wide).
export const RANK: Record<number, string[]> = {
	2: ['.##.', '#..#', '..#.', '.#..', '#...', '####'],
	3: ['###.', '...#', '.##.', '...#', '...#', '###.'],
	4: ['#..#', '#..#', '####', '...#', '...#', '...#'],
	5: ['####', '#...', '###.', '...#', '...#', '###.'],
	6: ['.##.', '#...', '###.', '#..#', '#..#', '.##.'],
	7: ['####', '...#', '..#.', '.#..', '.#..', '.#..'],
	8: ['.##.', '#..#', '.##.', '#..#', '#..#', '.##.'],
	9: ['.##.', '#..#', '#..#', '.###', '...#', '.##.'],
	10: ['#..##.', '#.#..#', '#.#..#', '#.#..#', '#.#..#', '#..##.'],
	11: ['...#', '...#', '...#', '...#', '#..#', '.##.'],
	12: ['.##.', '#..#', '#..#', '#..#', '#.#.', '.#.#'],
	13: ['#..#', '#.#.', '##..', '##..', '#.#.', '#..#'],
	14: ['.##.', '#..#', '#..#', '####', '#..#', '#..#']
};

// Bold monogram font for the court cards, 6x7.
export const MONOGRAM: Record<number, string[]> = {
	11: ['..####', '....##', '....##', '....##', '##..##', '##..##', '.####.'],
	12: ['.####.', '##..##', '##..##', '##..##', '##.##.', '.####.', '....##'],
	13: ['##..##', '##.##.', '####..', '###...', '####..', '##.##.', '##..##']
};

export const V = ['#...#', '#...#', '.#.#.', '.#.#.', '..#..'];

// Crests above the monogram: crown (K), coronet (Q), plume chevron (J).
// g = gold, G = light gold, r = jewel (the suit color).
export const CREST: Record<number, string[]> = {
	13: ['g...g...g', 'gg.ggg.gg', 'ggggggggg', 'gGgGrGgGg', 'ggggggggg'],
	12: ['...ggg...', '..gGrGg..', '.ggggggg.', '.gGgGgGg.', '.ggggggg.'],
	11: ['....g....', '...gGg...', '..gg.gg..', '.gg...gg.', 'gg.....gg']
};

/** A palette that paints every '#' in one color. */
export function solid(color: Color): Record<string, Color> {
	return { '#': color };
}
