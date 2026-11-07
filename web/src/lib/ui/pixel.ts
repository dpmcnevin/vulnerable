// A tiny pixel-art bitmap library. Port of src/ui/pixel.lua.
//
// Bitmaps are plain arrays of colors, so every card and icon is built and
// tested without a browser. `toCanvas` turns one into a canvas, scaled up by
// an integer factor with nearest-neighbour sampling so pixels stay hard.

import type { Color } from './theme.ts';

export class Bitmap {
	w: number;
	h: number;
	px: (Color | undefined)[];

	constructor(w: number, h: number) {
		this.w = w;
		this.h = h;
		this.px = new Array(w * h);
	}

	set(x: number, y: number, c: Color | undefined) {
		x = Math.floor(x);
		y = Math.floor(y);
		if (c && x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c;
	}

	clear(x: number, y: number) {
		this.px[y * this.w + x] = undefined;
	}

	get(x: number, y: number): Color | undefined {
		if (x < 0 || y < 0 || x >= this.w || y >= this.h) return undefined;
		return this.px[y * this.w + x];
	}

	fillRect(x: number, y: number, w: number, h: number, c: Color) {
		for (let j = y; j <= y + h - 1; j++) for (let i = x; i <= x + w - 1; i++) this.set(i, j, c);
	}

	/** One-pixel outline. */
	rect(x: number, y: number, w: number, h: number, c: Color) {
		for (let i = x; i <= x + w - 1; i++) {
			this.set(i, y, c);
			this.set(i, y + h - 1, c);
		}
		for (let j = y; j <= y + h - 1; j++) {
			this.set(x, j, c);
			this.set(x + w - 1, j, c);
		}
	}

	/** Filled circle, sampled at pixel centres so edges stay crisp. */
	fillCircle(cx: number, cy: number, r: number, c: Color) {
		for (let j = Math.floor(cy - r - 1); j <= Math.ceil(cy + r + 1); j++) {
			for (let i = Math.floor(cx - r - 1); i <= Math.ceil(cx + r + 1); i++) {
				const dx = i + 0.5 - cx,
					dy = j + 0.5 - cy;
				if (dx * dx + dy * dy <= r * r) this.set(i, j, c);
			}
		}
	}

	/** One-pixel ring. */
	circle(cx: number, cy: number, r: number, c: Color) {
		for (let j = Math.floor(cy - r - 1); j <= Math.ceil(cy + r + 1); j++) {
			for (let i = Math.floor(cx - r - 1); i <= Math.ceil(cx + r + 1); i++) {
				const dx = i + 0.5 - cx,
					dy = j + 0.5 - cy;
				const d = Math.sqrt(dx * dx + dy * dy);
				if (d <= r && d > r - 1) this.set(i, j, c);
			}
		}
	}

	/** Filled polygon [x1, y1, x2, y2, ...], sampled at pixel centres (even-odd). */
	fillPoly(pts: number[], c: Color) {
		let minX = Infinity,
			minY = Infinity,
			maxX = -Infinity,
			maxY = -Infinity;
		for (let i = 0; i < pts.length; i += 2) {
			minX = Math.min(minX, pts[i]);
			maxX = Math.max(maxX, pts[i]);
			minY = Math.min(minY, pts[i + 1]);
			maxY = Math.max(maxY, pts[i + 1]);
		}
		const n = pts.length / 2;
		for (let j = Math.floor(minY); j <= Math.ceil(maxY); j++) {
			for (let i = Math.floor(minX); i <= Math.ceil(maxX); i++) {
				const px = i + 0.5,
					py = j + 0.5;
				let inside = false;
				let k = n - 1;
				for (let m = 0; m < n; m++) {
					const xi = pts[2 * m],
						yi = pts[2 * m + 1];
					const xk = pts[2 * k],
						yk = pts[2 * k + 1];
					if (yi > py !== yk > py && px < ((xk - xi) * (py - yi)) / (yk - yi) + xi) inside = !inside;
					k = m;
				}
				if (inside) this.set(i, j, c);
			}
		}
	}

	/**
	 * Stamp a sprite given as rows of characters. `palette` maps characters to
	 * colors; unmapped characters ('.' and space) are transparent.
	 * `flip` rotates the sprite 180 degrees (for the lower half of a card).
	 */
	sprite(rows: string[], palette: Record<string, Color>, x: number, y: number, opts?: { flip?: boolean }) {
		const flip = opts?.flip;
		const h = rows.length;
		for (let j = 0; j < h; j++) {
			const row = rows[j];
			const w = row.length;
			for (let i = 0; i < w; i++) {
				const c = palette[row[i]];
				if (!c) continue;
				if (flip) this.set(x + w - 1 - i, y + h - 1 - j, c);
				else this.set(x + i, y + j, c);
			}
		}
	}

	/** Count opaque pixels (tests use it to catch empty sprites). */
	opaqueCount(): number {
		let n = 0;
		for (const c of this.px) if (c) n++;
		return n;
	}
}

export function newBitmap(w: number, h: number): Bitmap {
	return new Bitmap(w, h);
}

/** Width and height of a sprite's rows. */
export function size(rows: string[]): [number, number] {
	return [(rows[0] ?? '').length, rows.length];
}

/** RGBA bytes for a bitmap, scaled up by an integer factor (nearest neighbour). */
export function toRGBA(bmp: Bitmap, scale = 1): Uint8ClampedArray {
	const W = bmp.w * scale,
		H = bmp.h * scale;
	const out = new Uint8ClampedArray(W * H * 4);
	for (let y = 0; y < bmp.h; y++) {
		for (let x = 0; x < bmp.w; x++) {
			const c = bmp.px[y * bmp.w + x];
			if (!c) continue;
			const r = Math.round(c[0] * 255),
				g = Math.round(c[1] * 255),
				b = Math.round(c[2] * 255),
				a = Math.round((c[3] ?? 1) * 255);
			for (let dy = 0; dy < scale; dy++) {
				let o = ((y * scale + dy) * W + x * scale) * 4;
				for (let dx = 0; dx < scale; dx++) {
					out[o] = r;
					out[o + 1] = g;
					out[o + 2] = b;
					out[o + 3] = a;
					o += 4;
				}
			}
		}
	}
	return out;
}

/** Draw a bitmap into a new canvas at an integer scale. Browser only. */
export function toCanvas(bmp: Bitmap, scale = 1): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = bmp.w * scale;
	canvas.height = bmp.h * scale;
	const g = canvas.getContext('2d')!;
	const img = g.createImageData(canvas.width, canvas.height);
	img.data.set(toRGBA(bmp, scale));
	g.putImageData(img, 0, 0);
	return canvas;
}
