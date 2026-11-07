// Stage geometry. The game is laid out on a fixed logical stage that is
// scaled to fit the window, like the LÖVE original's 1280x720 canvas. A tall
// window (phone or iPad held upright) gets a portrait stage instead, with
// the sidebar folded into a strip above the table.

import * as cards from '../rules/cards.ts';
import { CARD_H, CARD_W } from '../ui/theme.ts';

export type Orientation = 'landscape' | 'portrait';

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface Layout {
	orientation: Orientation;
	W: number;
	H: number;
	sidebar: Rect;
	table: Rect;
	tableCX: number;
	trickCY: number;
	ovalRX: number;
	ovalRY: number;
	handY: Record<number, number>;
	maxHandWidth: number;
	/** Where each seat's cards come from and go to, off the edge of the table. */
	seatOrigin: Record<number, [number, number]>;
	trickOffset: Record<number, [number, number]>;
	/** Defender stacks: x of the stack, y of its first card, label x/y. */
	defender: Record<number, { x: number; y: number; step: number; labelX: number; labelY: number; align: 'left' | 'right' }>;
	/** Where the "Play it out" button sits. */
	playOut: Rect;
	/** Where ploy effects burst from (the sidebar's ploy row). */
	ployBurst: [number, number];
}

const LANDSCAPE: Layout = (() => {
	const W = 1280,
		H = 720,
		sideW = 270;
	const tableCX = sideW + (W - sideW) / 2;
	return {
		orientation: 'landscape',
		W,
		H,
		sidebar: { x: 0, y: 0, w: sideW, h: H },
		table: { x: sideW, y: 0, w: W - sideW, h: H },
		tableCX,
		trickCY: 330,
		ovalRX: 300,
		ovalRY: 175,
		handY: { [cards.NORTH]: 34, [cards.SOUTH]: 600 },
		maxHandWidth: 780,
		seatOrigin: {
			[cards.NORTH]: [tableCX, -CARD_H],
			[cards.SOUTH]: [tableCX, H + CARD_H],
			[cards.WEST]: [sideW + 60, 270],
			[cards.EAST]: [W - 60, 270]
		},
		trickOffset: {
			[cards.NORTH]: [0, -78],
			[cards.SOUTH]: [0, 78],
			[cards.WEST]: [-118, 0],
			[cards.EAST]: [118, 0]
		},
		defender: {
			[cards.WEST]: { x: sideW + 60, y: 200, step: 10, labelX: sideW + 12, labelY: 150, align: 'left' },
			[cards.EAST]: { x: W - 60, y: 200, step: 10, labelX: W - 152, labelY: 150, align: 'right' }
		},
		playOut: { x: W - 180, y: 540, w: 160, h: 40 },
		ployBurst: [140, 660]
	};
})();

const PORTRAIT: Layout = (() => {
	const W = 800,
		H = 1280,
		sideH = 300;
	const tableCX = W / 2;
	const northY = sideH + 36;
	const southY = H - CARD_H - 56;
	const trickCY = Math.round((northY + CARD_H + southY) / 2);
	return {
		orientation: 'portrait',
		W,
		H,
		sidebar: { x: 0, y: 0, w: W, h: sideH },
		table: { x: 0, y: sideH, w: W, h: H - sideH },
		tableCX,
		trickCY,
		ovalRX: 250,
		ovalRY: 200,
		handY: { [cards.NORTH]: northY, [cards.SOUTH]: southY },
		maxHandWidth: 770,
		seatOrigin: {
			[cards.NORTH]: [tableCX, sideH - CARD_H],
			[cards.SOUTH]: [tableCX, H + CARD_H],
			[cards.WEST]: [-CARD_W, trickCY],
			[cards.EAST]: [W + CARD_W, trickCY]
		},
		trickOffset: {
			[cards.NORTH]: [0, -96],
			[cards.SOUTH]: [0, 96],
			[cards.WEST]: [-112, 0],
			[cards.EAST]: [112, 0]
		},
		defender: {
			[cards.WEST]: { x: 52, y: trickCY - 150, step: 9, labelX: 10, labelY: trickCY - 200, align: 'left' },
			[cards.EAST]: { x: W - 52, y: trickCY - 150, step: 9, labelX: W - 150, labelY: trickCY - 200, align: 'right' }
		},
		playOut: { x: W - 176, y: southY - 70, w: 160, h: 40 },
		ployBurst: [W - 140, 250]
	};
})();

export function getLayout(o: Orientation): Layout {
	return o === 'portrait' ? PORTRAIT : LANDSCAPE;
}

export function trickXY(L: Layout, seat: number): [number, number] {
	const off = L.trickOffset[seat];
	return [L.tableCX + off[0], L.trickCY + off[1]];
}

/** A small fixed tilt per card, so tricks look tossed rather than placed. */
export function tossAngle(card: cards.Card): number {
	return (((card.rank * 7 + card.suit * 13) % 11) - 5) * 0.022;
}

export interface Slot {
	card: cards.Card;
	/** Hit rectangle, stable while the sprite moves. */
	x: number;
	w: number;
	cx: number;
	cy: number;
	r: number;
	idle: number;
}

/** Card positions for a fanned hand, as in app.lua's handSlots. */
export function handSlots(L: Layout, hand: cards.Card[], seat: number): Slot[] {
	const n = hand.length;
	const spacing = n > 1 ? Math.min(56, (L.maxHandWidth - CARD_W) / (n - 1)) : 0;
	const total = CARD_W + spacing * Math.max(0, n - 1);
	const x0 = L.tableCX - total / 2;
	const dir = seat === cards.NORTH ? -1 : 1;
	return hand.map((card, idx) => {
		const k = idx + 1 - (n + 1) / 2;
		return {
			card,
			x: x0 + idx * spacing,
			w: idx === n - 1 ? CARD_W : spacing,
			cx: x0 + idx * spacing + CARD_W / 2,
			cy: L.handY[seat] + CARD_H / 2 + dir * k * k * 0.6,
			r: dir * k * 0.028,
			idle: (idx + 1) * 0.7 + seat
		};
	});
}
