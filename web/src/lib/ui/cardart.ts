// Art deco playing cards drawn with shapes: the "smooth" card style.
// Port of src/ui/cardart.lua onto the canvas 2D API.
//
// Contract bridge was invented in 1925, so the cards borrow from the era:
// gold geometric borders, sunburst backs, stepped-arch panels and monogram
// crests on the court cards. Every function draws centred on the origin.

import * as cards from '../rules/cards.ts';
import type { Card } from '../rules/cards.ts';
import { LAYOUTS, P, suitColor } from './pixelcards.ts';
import { CARD_H, CARD_W, css, type Color } from './theme.ts';

type G = CanvasRenderingContext2D;

const FONT = '"Avenir Next", "Segoe UI", system-ui, sans-serif';

function set(g: G, c: Color, a = 1) {
	g.fillStyle = css(c, a);
	g.strokeStyle = css(c, a);
}

function poly(g: G, pts: number[], fill = true) {
	g.beginPath();
	g.moveTo(pts[0], pts[1]);
	for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
	g.closePath();
	if (fill) g.fill();
	else g.stroke();
}

function circle(g: G, x: number, y: number, r: number, fill = true) {
	g.beginPath();
	g.arc(x, y, r, 0, Math.PI * 2);
	if (fill) g.fill();
	else g.stroke();
}

function roundRect(g: G, x: number, y: number, w: number, h: number, r: number) {
	g.beginPath();
	g.roundRect(x, y, w, h, r);
}

/** A suit shape centred on (cx, cy). */
export function suit(g: G, s: number, cx: number, cy: number, size: number, color: Color) {
	const h = size / 2;
	set(g, color);
	if (s === cards.DIAMONDS) {
		poly(g, [cx, cy - h, cx + h * 0.72, cy, cx, cy + h, cx - h * 0.72, cy]);
	} else if (s === cards.HEARTS) {
		const r = h * 0.52;
		circle(g, cx - r * 0.95, cy - h * 0.28, r);
		circle(g, cx + r * 0.95, cy - h * 0.28, r);
		poly(g, [cx - h * 0.98, cy - h * 0.12, cx + h * 0.98, cy - h * 0.12, cx, cy + h]);
	} else if (s === cards.SPADES) {
		const r = h * 0.5;
		circle(g, cx - r * 0.95, cy + h * 0.18, r);
		circle(g, cx + r * 0.95, cy + h * 0.18, r);
		poly(g, [cx - h * 0.96, cy + h * 0.05, cx + h * 0.96, cy + h * 0.05, cx, cy - h]);
		poly(g, [cx, cy + h * 0.2, cx - h * 0.35, cy + h, cx + h * 0.35, cy + h]);
	} else {
		const r = h * 0.42;
		circle(g, cx, cy - h * 0.5, r);
		circle(g, cx - h * 0.5, cy + h * 0.08, r);
		circle(g, cx + h * 0.5, cy + h * 0.08, r);
		circle(g, cx, cy, r * 0.6);
		poly(g, [cx, cy, cx - h * 0.32, cy + h, cx + h * 0.32, cy + h]);
	}
}

function pip(g: G, s: number, x: number, y: number, size: number, flipped: boolean, color: Color) {
	if (flipped) {
		g.save();
		g.translate(x, y);
		g.rotate(Math.PI);
		suit(g, s, 0, 0, size, color);
		g.restore();
	} else {
		suit(g, s, x, y, size, color);
	}
}

function drawPips(g: G, card: Card, w: number, h: number, color: Color) {
	const hx = w * 0.2,
		hy = h * 0.3;
	for (const p of LAYOUTS[card.rank]) pip(g, card.suit, p[0] * hx, p[1] * hy, w * 0.19, p[1] > 0.01, color);
}

function drawAce(g: G, card: Card, w: number, color: Color) {
	const r = w * 0.36;
	const n = 16;
	for (let i = 0; i < n; i++) {
		const a0 = (i / n) * Math.PI * 2;
		const a1 = a0 + Math.PI / n;
		set(g, i % 2 === 0 ? P.gold : P.goldLight, 0.55);
		poly(g, [0, 0, Math.cos(a0) * r, Math.sin(a0) * r, Math.cos(a1) * r, Math.sin(a1) * r]);
	}
	set(g, P.cream);
	circle(g, 0, 0, r * 0.62);
	set(g, P.gold);
	g.lineWidth = 1.5;
	circle(g, 0, 0, r * 0.62, false);
	circle(g, 0, 0, r * 1.02, false);
	suit(g, card.suit, 0, 0, w * (card.suit === cards.SPADES ? 0.5 : 0.44), color);
}

/** Crown for the king, coronet for the queen, chevron plume for the jack. */
function crest(g: G, rank: number, cx: number, cy: number, s: number, color: Color) {
	set(g, color);
	if (rank === 13) {
		poly(g, [
			cx - s, cy + s * 0.5, cx - s, cy - s * 0.3, cx - s * 0.5, cy + s * 0.1, cx, cy - s * 0.6,
			cx + s * 0.5, cy + s * 0.1, cx + s, cy - s * 0.3, cx + s, cy + s * 0.5
		]);
		circle(g, cx, cy - s * 0.7, s * 0.18);
	} else if (rank === 12) {
		g.beginPath();
		g.arc(cx, cy + s * 0.5, s * 0.85, Math.PI, Math.PI * 2);
		g.closePath();
		g.fill();
		circle(g, cx, cy - s * 0.55, s * 0.2);
	} else {
		poly(g, [
			cx - s * 0.8, cy + s * 0.5, cx, cy - s * 0.55, cx + s * 0.8, cy + s * 0.5,
			cx + s * 0.35, cy + s * 0.5, cx, cy - s * 0.05, cx - s * 0.35, cy + s * 0.5
		]);
	}
}

function mix(a: Color, b: Color, t: number): Color {
	return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 1];
}

function drawCourt(g: G, card: Card, w: number, h: number, color: Color) {
	const tint = mix(P.cream, color, 0.16);
	const x0 = -w * 0.3,
		x1 = w * 0.3;
	const y0 = -h * 0.31,
		y1 = h * 0.31;
	const step = w * 0.06;
	const outline = [
		x0, y1, x0, y0 + step * 2, x0 + step, y0 + step * 2, x0 + step, y0 + step,
		x0 + step * 2, y0 + step, x0 + step * 2, y0, x1 - step * 2, y0, x1 - step * 2, y0 + step,
		x1 - step, y0 + step, x1 - step, y0 + step * 2, x1, y0 + step * 2, x1, y1
	];
	set(g, tint);
	poly(g, outline);
	set(g, P.gold);
	g.lineWidth = 1.5;
	poly(g, outline, false);

	// Fine vertical lines at the panel base, an art deco signature.
	set(g, color, 0.25);
	for (let i = -2; i <= 2; i++) g.fillRect(i * w * 0.08 - 0.5, y1 - h * 0.12, 1, h * 0.1);

	crest(g, card.rank, 0, y0 + h * 0.15, w * 0.13, color);

	const letter = cards.RANK_NAMES[card.rank];
	g.font = `bold 28px ${FONT}`;
	g.textAlign = 'center';
	g.textBaseline = 'middle';
	set(g, P.gold);
	g.fillText(letter, 1, 1);
	set(g, color);
	g.fillText(letter, 0, 0);

	suit(g, card.suit, 0, y1 - h * 0.17, w * 0.17, color);
}

function cardBody(g: G, w: number, h: number, fill: Color, edge: Color) {
	const r = w * 0.1;
	set(g, fill);
	roundRect(g, -w / 2, -h / 2, w, h, r);
	g.fill();
	set(g, edge);
	g.lineWidth = 2.5;
	roundRect(g, -w / 2, -h / 2, w, h, r);
	g.stroke();
}

function cornerIndex(g: G, card: Card, w: number, h: number, color: Color) {
	const rank = cards.RANK_NAMES[card.rank];
	g.font = `bold 20px ${FONT}`;
	g.textAlign = 'center';
	g.textBaseline = 'top';
	const cx = -w / 2 + 13;
	const ry = -h / 2 + 5;
	set(g, color);
	g.fillText(rank, cx, ry);
	suit(g, card.suit, cx, ry + 32, w * 0.16, color);
}

function trumpMark(g: G, w: number, h: number) {
	const r = w * 0.1;
	set(g, P.gold);
	g.lineWidth = 3;
	roundRect(g, -w / 2 + 2.5, -h / 2 + 2.5, w - 5, h - 5, r * 0.8);
	g.stroke();
	const s = w * 0.36;
	const x0 = -w / 2 + 1.5,
		y1 = h / 2 - 1.5;
	set(g, P.goldDeep);
	poly(g, [x0, y1 - s, x0, y1, x0 + s, y1]);
	set(g, P.goldLight);
	poly(g, [x0, y1 - s + 3, x0, y1, x0 + s - 3, y1]);
	const cx = x0 + s * 0.3,
		cy = y1 - s * 0.3,
		rr = s * 0.2;
	const pts: number[] = [];
	for (let i = 0; i < 10; i++) {
		const a = -Math.PI / 2 + (i * Math.PI) / 5;
		const rad = i % 2 === 0 ? rr : rr * 0.45;
		pts.push(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
	}
	set(g, P.ink);
	poly(g, pts);
}

/** Draw a face-up card centred on the origin. */
export function face(g: G, card: Card, trump: boolean, fourColor: boolean) {
	const w = CARD_W,
		h = CARD_H;
	const color = suitColor(card.suit, fourColor);
	cardBody(g, w, h, trump ? P.trumpCream : P.cream, P.ink);

	// Inner gold border with deco corner diamonds.
	const ix = w / 2 - 5,
		iy = h / 2 - 5;
	set(g, P.gold, 0.85);
	g.lineWidth = 1;
	roundRect(g, -ix, -iy, ix * 2, iy * 2, 4);
	g.stroke();
	for (const [x, y] of [[-ix, -iy], [ix, -iy], [-ix, iy], [ix, iy]]) {
		poly(g, [x, y - 3, x + 3, y, x, y + 3, x - 3, y]);
	}

	if (card.rank === 14) drawAce(g, card, w, color);
	else if (card.rank >= 11) drawCourt(g, card, w, h, color);
	else drawPips(g, card, w, h, color);

	cornerIndex(g, card, w, h, color);
	g.save();
	g.rotate(Math.PI);
	cornerIndex(g, card, w, h, color);
	g.restore();

	if (trump) trumpMark(g, w, h);
}

function rectEdge(a: number, w: number, h: number): [number, number] {
	const c = Math.cos(a),
		s = Math.sin(a);
	const tx = c !== 0 ? w / 2 / Math.abs(c) : Infinity;
	const ty = s !== 0 ? h / 2 / Math.abs(s) : Infinity;
	const t = Math.min(tx, ty);
	return [c * t, s * t];
}

/** Draw a face-down card centred on the origin. */
export function back(g: G) {
	const w = CARD_W,
		h = CARD_H;
	cardBody(g, w, h, P.wine, P.ink);
	const iw = w - 16,
		ih = h - 16;
	set(g, P.wineDeep);
	roundRect(g, -iw / 2, -ih / 2, iw, ih, 3);
	g.fill();
	g.save();
	roundRect(g, -iw / 2, -ih / 2, iw, ih, 3);
	g.clip();
	const n = 28;
	for (let i = 0; i < n; i += 2) {
		const [x0, y0] = rectEdge((i / n) * Math.PI * 2, iw, ih);
		const [x1, y1] = rectEdge(((i + 1) / n) * Math.PI * 2, iw, ih);
		set(g, P.wineLight);
		poly(g, [0, 0, x0, y0, x1, y1]);
	}
	g.restore();
	set(g, P.gold);
	g.lineWidth = 1.5;
	roundRect(g, -w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 4);
	g.stroke();
	roundRect(g, -iw / 2, -ih / 2, iw, ih, 3);
	g.stroke();
	const d = w * 0.22;
	set(g, P.wineDeep);
	poly(g, [0, -d * 1.3, d, 0, 0, d * 1.3, -d, 0]);
	set(g, P.gold);
	g.lineWidth = 2;
	poly(g, [0, -d * 1.3, d, 0, 0, d * 1.3, -d, 0], false);
	set(g, P.goldLight);
	g.font = `bold 20px ${FONT}`;
	g.textAlign = 'center';
	g.textBaseline = 'middle';
	g.fillText('V', 0, 1);
}
