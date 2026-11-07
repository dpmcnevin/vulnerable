// Number formatting shared by the panels.

/** Rounded, with thousands separators: 12,345. */
export function num(n: number): string {
	const v = Math.floor(n + 0.5);
	const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	return (v < 0 ? '-' : '') + s;
}

export function fixed(n: number, digits: number): string {
	return n.toFixed(digits);
}

export function pct(p: number): string {
	return `${Math.floor(p * 100 + 0.5)}%`;
}
