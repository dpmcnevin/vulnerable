// Colors and card sizes. Port of src/ui/theme.lua.
//
// The look is a card-room table at night: deep green baize, cream cards,
// brass accents. Colors are [r, g, b, a] in 0..1, as in LÖVE; `css()`
// turns one into a CSS color. The same palette is mirrored as CSS custom
// properties in app.css for the DOM panels.

export type Color = [number, number, number, number];

export function hex(h: string, a = 1): Color {
	return [
		parseInt(h.slice(1, 3), 16) / 255,
		parseInt(h.slice(3, 5), 16) / 255,
		parseInt(h.slice(5, 7), 16) / 255,
		a
	];
}

export function css(c: Color, alphaMul = 1): string {
	const [r, g, b, a] = c;
	return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a * alphaMul})`;
}

export const C = {
	bg: hex('#0b1f17'),
	felt: hex('#14402c'),
	feltLight: hex('#1c5239'),
	feltEdge: hex('#0e2d20'),
	sidebar: hex('#0f1a16'),
	panel: hex('#15241e'),
	panelEdge: hex('#2c4a3d'),
	ink: hex('#ece6d6'),
	inkDim: hex('#9fb3a8'),
	inkFaint: hex('#5f7a6d'),
	brass: hex('#d9a441'),
	brassDim: hex('#8a6a2c'),
	red: hex('#c0392b'),
	good: hex('#4fbf7a'),
	warn: hex('#e3b341'),
	bad: hex('#e0604f'),
	chips: hex('#4a9fe0'),
	mult: hex('#e0604f'),
	gold: hex('#c9a24a'),
	ploy: hex('#8e6bd1'),
	ployLight: hex('#c2adf0'),
	goldLight: hex('#e8c873'),
	confetti: [hex('#e8c873'), hex('#c9a24a'), hex('#f3ead6'), hex('#4fbf7a'), hex('#c8323c')],
	rarity: [hex('#9fb3a8'), hex('#9fb3a8'), hex('#4fbf7a'), hex('#4a9fe0'), hex('#d9a441')]
};

export const CARD_W = 80;
export const CARD_H = 112;
