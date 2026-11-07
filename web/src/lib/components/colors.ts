// Suit colors for the dark panels and the cream scorepad.

import * as cards from '../rules/cards.ts';
import { suitColor } from '../ui/pixelcards.ts';
import { C, css } from '../ui/theme.ts';
import { settings } from '../ui/settings.svelte.ts';

/** Suit color that stays readable on dark panels (dark suits lift to ink). */
export function strainColor(s: number): string {
	if (s === cards.NOTRUMP) return css(C.ink);
	const c = suitColor(s, settings.fourColor);
	if (c[0] + c[1] + c[2] < 0.6) return css(C.ink);
	return css(c);
}

/** Suit color on cream paper: the card colors as printed. */
export function paperColor(s: number): string {
	if (s === cards.NOTRUMP) return '#1f2133';
	return css(suitColor(s, settings.fourColor));
}
