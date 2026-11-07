// Pixel-art versions of the art deco cards. Port of src/ui/pixelcards.lua.
//
// Each card is a 40x56 bitmap built from hand-drawn sprites and drawn at an
// integer scale with nearest-neighbour filtering. The palette and suit
// colors live here too (they were in cardart.lua), so both card styles
// share them.

import * as cards from '../rules/cards.ts';
import type { Card } from '../rules/cards.ts';
import { newBitmap, type Bitmap } from './pixel.ts';
import * as S from './pixelsprites.ts';
import { hex, type Color } from './theme.ts';

export const W = 40;
export const H = 56;

export const P = {
	cream: hex('#f3ead6'),
	trumpCream: hex('#f6e3a8'),
	creamDeep: hex('#e6d9bc'),
	ink: hex('#1b1d26'),
	gold: hex('#c9a24a'),
	goldLight: hex('#e8c873'),
	goldDeep: hex('#8f6d27'),
	wine: hex('#5e1a26'),
	wineLight: hex('#7c2634'),
	wineDeep: hex('#3f1019')
};
export type Palette = typeof P;

const TWO: Record<number, Color> = {
	1: hex('#1b1d26'),
	2: hex('#c8323c'),
	3: hex('#c8323c'),
	4: hex('#1b1d26')
};
// The four-color deck many bridge players prefer: suits never get confused.
const FOUR: Record<number, Color> = {
	1: hex('#23804e'),
	2: hex('#d9771f'),
	3: hex('#c8323c'),
	4: hex('#1b1d26')
};

export function suitColor(suit: number, fourColor: boolean): Color {
	return (fourColor ? FOUR : TWO)[suit];
}

// --------------------------------------------------------------------- helpers

/** Big suit shapes rasterised from geometry (for aces). */
function bigSuit(b: Bitmap, suit: number, cx: number, cy: number, size: number, color: Color) {
	const s = size / 2;
	if (suit === cards.DIAMONDS) {
		b.fillPoly([cx, cy - s, cx + s * 0.75, cy, cx, cy + s, cx - s * 0.75, cy], color);
	} else if (suit === cards.HEARTS) {
		const r = s * 0.52;
		b.fillCircle(cx - r * 0.95, cy - s * 0.3, r, color);
		b.fillCircle(cx + r * 0.95, cy - s * 0.3, r, color);
		b.fillPoly([cx - s, cy - s * 0.15, cx + s, cy - s * 0.15, cx, cy + s], color);
	} else if (suit === cards.SPADES) {
		const r = s * 0.5;
		b.fillCircle(cx - r * 0.95, cy + s * 0.18, r, color);
		b.fillCircle(cx + r * 0.95, cy + s * 0.18, r, color);
		b.fillPoly([cx - s * 0.98, cy + s * 0.08, cx + s * 0.98, cy + s * 0.08, cx, cy - s], color);
		b.fillPoly([cx, cy + s * 0.2, cx - s * 0.4, cy + s, cx + s * 0.4, cy + s], color);
	} else {
		const r = s * 0.44;
		b.fillCircle(cx, cy - s * 0.48, r, color);
		b.fillCircle(cx - s * 0.5, cy + s * 0.1, r, color);
		b.fillCircle(cx + s * 0.5, cy + s * 0.1, r, color);
		b.fillPoly([cx, cy - s * 0.1, cx - s * 0.35, cy + s, cx + s * 0.35, cy + s], color);
	}
}

function body(b: Bitmap, fill: Color) {
	b.fillRect(1, 1, W - 2, H - 2, fill);
	// Outline with clipped corners.
	b.fillRect(2, 0, W - 4, 1, P.ink);
	b.fillRect(2, H - 1, W - 4, 1, P.ink);
	b.fillRect(0, 2, 1, H - 4, P.ink);
	b.fillRect(W - 1, 2, 1, H - 4, P.ink);
	b.set(1, 1, P.ink);
	b.set(W - 2, 1, P.ink);
	b.set(1, H - 2, P.ink);
	b.set(W - 2, H - 2, P.ink);
}

function cornerIndex(b: Bitmap, card: Card, color: Color) {
	const glyph = S.RANK[card.rank];
	const gw = glyph[0].length;
	const pal = S.solid(color);
	const off = gw > 5 ? 1 : 0;
	b.sprite(glyph, pal, 3, 4);
	b.sprite(S.SUIT5[card.suit], pal, 3 + off, 11);
	b.sprite(glyph, pal, W - 3 - gw, H - 4 - 6, { flip: true });
	b.sprite(S.SUIT5[card.suit], pal, W - 3 - 5 - off, H - 11 - 5, { flip: true });
}

// Pip layouts: column -1..1 and row -1..1.
export const LAYOUTS: Record<number, [number, number][]> = {
	2: [[0, -1], [0, 1]],
	3: [[0, -1], [0, 0], [0, 1]],
	4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
	5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
	6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
	7: [[-1, -1], [1, -1], [0, -0.5], [-1, 0], [1, 0], [-1, 1], [1, 1]],
	8: [[-1, -1], [1, -1], [0, -0.5], [-1, 0], [1, 0], [0, 0.5], [-1, 1], [1, 1]],
	9: [[-1, -1], [1, -1], [-1, -1 / 3], [1, -1 / 3], [0, 0], [-1, 1 / 3], [1, 1 / 3], [-1, 1], [1, 1]],
	10: [[-1, -1], [1, -1], [0, -2 / 3], [-1, -1 / 3], [1, -1 / 3], [-1, 1 / 3], [1, 1 / 3], [0, 2 / 3], [-1, 1], [1, 1]]
};

function pips(b: Bitmap, card: Card, color: Color) {
	const pal = S.solid(color);
	for (const p of LAYOUTS[card.rank]) {
		// Columns sit 6px apart so the outer pips clear the corner indices.
		const cx = 20 + p[0] * 6;
		const cy = 28 + p[1] * 15;
		b.sprite(S.SUIT7[card.suit], pal, Math.floor(cx + 0.5) - 3, Math.floor(cy + 0.5) - 3, {
			flip: p[1] > 0.01
		});
	}
}

function ace(b: Bitmap, card: Card, color: Color) {
	const cx = 20,
		cy = 28;
	const n = 12;
	for (let i = 0; i < n; i++) {
		const a0 = (i / n) * Math.PI * 2;
		const a1 = ((i + 1) / n) * Math.PI * 2;
		b.fillPoly(
			[cx, cy, cx + Math.cos(a0) * 14, cy + Math.sin(a0) * 14, cx + Math.cos(a1) * 14, cy + Math.sin(a1) * 14],
			i % 2 === 0 ? P.gold : P.goldLight
		);
	}
	b.fillCircle(cx, cy, 10, P.gold);
	b.fillCircle(cx, cy, 9, P.cream);
	bigSuit(b, card.suit, cx, cy, card.suit === cards.SPADES ? 13 : 12, color);
}

function court(b: Bitmap, card: Card, color: Color) {
	// Stepped-arch panel, tinted with the suit color.
	const tint: Color = [
		P.cream[0] + (color[0] - P.cream[0]) * 0.18,
		P.cream[1] + (color[1] - P.cream[1]) * 0.18,
		P.cream[2] + (color[2] - P.cream[2]) * 0.18,
		1
	];
	const mask = new Set<number>();
	const mark = (x: number, y: number, w: number, h: number) => {
		for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) mask.add(j * 100 + i);
	};
	mark(10, 16, 20, 29);
	mark(12, 14, 16, 2);
	mark(14, 12, 12, 2);
	for (const key of mask) b.set(key % 100, Math.floor(key / 100), tint);
	// Gold edge wherever the panel meets the outside.
	for (const key of mask) {
		const x = key % 100,
			y = Math.floor(key / 100);
		if (
			!(mask.has((y - 1) * 100 + x) && mask.has((y + 1) * 100 + x) && mask.has(y * 100 + x - 1) && mask.has(y * 100 + x + 1))
		) {
			b.set(x, y, P.gold);
		}
	}
	b.sprite(S.CREST[card.rank], { g: P.gold, G: P.goldLight, r: color }, 16, 15);
	b.sprite(S.MONOGRAM[card.rank], S.solid(color), 17, 22);
	b.sprite(S.SUIT7[card.suit], S.solid(color), 17, 33);
	// Deco fluting at the panel base.
	for (const x of [13, 16, 23, 26]) b.fillRect(x, 41, 1, 3, P.goldLight);
}

function trumpMark(b: Bitmap) {
	b.rect(1, 1, W - 2, H - 2, P.gold);
	b.rect(2, 2, W - 4, H - 4, P.goldLight);
	// Ribbon in the bottom-left corner, with a star.
	b.fillPoly([1, H - 14, 1, H - 1, 14, H - 1], P.goldDeep);
	b.fillPoly([1, H - 12, 1, H - 1, 12, H - 1], P.goldLight);
	const sx = 3,
		sy = H - 7;
	b.set(sx + 1, sy, P.ink);
	b.fillRect(sx, sy + 1, 3, 1, P.ink);
	b.set(sx + 1, sy + 2, P.ink);
}

// --------------------------------------------------------------------- builders

/** Build the bitmap for a face-up card. */
export function faceBitmap(card: Card, trump: boolean, fourColor: boolean): Bitmap {
	const b = newBitmap(W, H);
	const color = suitColor(card.suit, fourColor);
	body(b, trump ? P.trumpCream : P.cream);
	b.rect(2, 2, W - 4, H - 4, P.gold);
	if (card.rank === 14) ace(b, card, color);
	else if (card.rank >= 11) court(b, card, color);
	else pips(b, card, color);
	if (trump) trumpMark(b);
	cornerIndex(b, card, color);
	return b;
}

/** Build the bitmap for a card back. */
export function backBitmap(): Bitmap {
	const b = newBitmap(W, H);
	body(b, P.wine);
	b.fillRect(4, 4, W - 8, H - 8, P.wineDeep);
	const cx = 20,
		cy = 28;
	const x0 = 4,
		y0 = 4,
		x1 = W - 5,
		y1 = H - 5;
	const edge = (a: number): [number, number] => {
		const c = Math.cos(a),
			s = Math.sin(a);
		const tx = c !== 0 ? ((c > 0 ? x1 + 1 : x0) - cx) / c : Infinity;
		const ty = s !== 0 ? ((s > 0 ? y1 + 1 : y0) - cy) / s : Infinity;
		const t = Math.min(Math.abs(tx), Math.abs(ty));
		return [cx + c * t, cy + s * t];
	};
	const n = 20;
	for (let i = 0; i < n; i += 2) {
		const [ax, ay] = edge((i / n) * Math.PI * 2);
		const [bx, by] = edge(((i + 1) / n) * Math.PI * 2);
		b.fillPoly([cx, cy, ax, ay, bx, by], P.wineLight);
	}
	b.rect(2, 2, W - 4, H - 4, P.gold);
	b.rect(4, 4, W - 8, H - 8, P.goldDeep);
	b.fillPoly([cx, cy - 12, cx + 9, cy, cx, cy + 12, cx - 9, cy], P.gold);
	b.fillPoly([cx, cy - 10, cx + 7, cy, cx, cy + 10, cx - 7, cy], P.wineDeep);
	b.sprite(S.V, S.solid(P.goldLight), cx - 3, cy - 2);
	return b;
}
