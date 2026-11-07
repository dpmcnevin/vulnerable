// What the table wants each card sprite to do this frame.

import type { Card } from '../rules/cards.ts';

export interface Spawn {
	x: number;
	y: number;
	r?: number;
	/** Seconds before the card appears and starts moving. */
	delay?: number;
	/** Which side shows while it flies in. */
	faceUp?: boolean;
	/** Play the deal sound when it launches. */
	sound?: boolean;
}

export interface Placement {
	id: number;
	card: Card;
	x: number;
	y: number;
	r: number;
	s: number;
	faceUp: boolean;
	z: number;
	lift?: number;
	dim?: boolean;
	highlight?: string | null;
	trump?: boolean;
	/** Sweeping off the table: fade out as it goes. */
	fade?: boolean;
	/** Phase for the gentle idle sway, or null for none. */
	idle?: number | null;
	/** Seconds to wait before flipping to `faceUp`. */
	flipDelay?: number;
	hovered?: boolean;
	/** Used only when the sprite is first created. */
	spawn?: Spawn;
}
