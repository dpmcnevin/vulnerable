// Cards, suits, strains, seats and deals. Port of src/rules/cards.lua.
//
// Bridge ordering is baked into the numbering, because the rules depend on it:
// suits rank clubs < diamonds < hearts < spades, and notrump outranks them all
// as a bid. Seats run clockwise so that `nextSeat` is plain arithmetic.
//
// Suit, strain and seat ids stay 1-based exactly as in Lua, so tables indexed
// by them (SUITS, SEATS, a deal's hands, a shape's counts) keep an unused
// slot 0. Plain lists (a hand, a trick) are ordinary 0-based arrays.

import type { RNG } from './rng.ts';
import { luaSort } from './luasort.ts';

export type Suit = 1 | 2 | 3 | 4;
export type Strain = 1 | 2 | 3 | 4 | 5;
export type Seat = 1 | 2 | 3 | 4;

export interface Card {
	suit: number;
	rank: number;
}
export type Hand = Card[];
/** Four hands indexed by seat; slot 0 is unused. */
export type Hands = Hand[];

export interface Contract {
	level: number;
	strain: number;
	doubled: number;
}

export interface SuitInfo {
	key: string;
	name: string;
	glyph: string;
	red: boolean;
	major: boolean;
	notrump?: boolean;
}

export interface SeatInfo {
	key: string;
	name: string;
	side: 'NS' | 'EW';
	label: string;
}

export const CLUBS = 1,
	DIAMONDS = 2,
	HEARTS = 3,
	SPADES = 4,
	NOTRUMP = 5;

const UNUSED = undefined as unknown as SuitInfo;

export const SUITS: SuitInfo[] = [
	UNUSED,
	{ key: 'C', name: 'Clubs', glyph: '♣', red: false, major: false },
	{ key: 'D', name: 'Diamonds', glyph: '♦', red: true, major: false },
	{ key: 'H', name: 'Hearts', glyph: '♥', red: true, major: true },
	{ key: 'S', name: 'Spades', glyph: '♠', red: false, major: true }
];

export const STRAINS: SuitInfo[] = [
	UNUSED,
	SUITS[1],
	SUITS[2],
	SUITS[3],
	SUITS[4],
	{ key: 'NT', name: 'Notrump', glyph: 'NT', red: false, major: false, notrump: true }
];

// Seats, clockwise. You are South and declare every board; North is your
// dummy, which you also play. East and West are the AI defenders.
export const NORTH = 1,
	EAST = 2,
	SOUTH = 3,
	WEST = 4;

export const SEATS: SeatInfo[] = [
	undefined as unknown as SeatInfo,
	{ key: 'N', name: 'North', side: 'NS', label: 'Dummy' },
	{ key: 'E', name: 'East', side: 'EW', label: 'Defender' },
	{ key: 'S', name: 'South', side: 'NS', label: 'You' },
	{ key: 'W', name: 'West', side: 'EW', label: 'Defender' }
];

export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export const RANK_NAMES: Record<number, string> = {
	2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8',
	9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A'
};

// Milton Work point count: the standard way bridge players value a hand.
export const HCP_VALUE: Record<number, number> = { 14: 4, 13: 3, 12: 2, 11: 1 };

export const HAND_SIZE = 13;
export const TRICK_COUNT = 13;

/** Next seat clockwise. */
export function nextSeat(seat: number): number {
	return (seat % 4) + 1;
}

/** Partner sits opposite. */
export function partner(seat: number): number {
	return ((seat + 1) % 4) + 1;
}

/** Are two seats on the same side? */
export function sameSide(a: number, b: number): boolean {
	return SEATS[a].side === SEATS[b].side;
}

export function card(suit: number, rank: number): Card {
	return { suit, rank };
}

/** "AS", stable across locales -- used for tests and save files. */
export function code(c: Card): string {
	return RANK_NAMES[c.rank] + SUITS[c.suit].key;
}

/** "A♠", for display. */
export function name(c: Card): string {
	return RANK_NAMES[c.rank] + SUITS[c.suit].glyph;
}

export function strainName(strain: number): string {
	return STRAINS[strain].name;
}

/** "4♠" / "3NT". */
export function contractName(contract: Contract): string {
	let s = contract.level + STRAINS[contract.strain].glyph;
	if (contract.doubled === 1) s += ' X';
	else if (contract.doubled === 2) s += ' XX';
	return s;
}

export function isHonour(c: Card): boolean {
	return c.rank >= 10;
}

/** Ten through ace are the cards that carry point count or near it. */
export function isFace(c: Card): boolean {
	return c.rank >= 11;
}

/** A fresh 52-card deck in a fixed order. Shuffle it before dealing. */
export function newDeck(): Card[] {
	const deck: Card[] = [];
	for (let suit = 1; suit <= 4; suit++) {
		for (const rank of RANKS) deck.push(card(suit, rank));
	}
	return deck;
}

/** Deal four 13-card hands, indexed by seat. */
export function deal(rng: RNG): Hands {
	const deck = rng.shuffle(newDeck());
	const hands: Hands = [[], [], [], [], []];
	let i = 0;
	for (let seat = 1; seat <= 4; seat++) {
		for (let n = 0; n < HAND_SIZE; n++) {
			hands[seat].push(deck[i]);
			i++;
		}
		sortHand(hands[seat]);
	}
	return hands;
}

/** Sort into the layout bridge players use: spades first, high cards left. */
export function sortHand(hand: Hand): Hand {
	return luaSort(hand, (a, b) => {
		if (a.suit !== b.suit) return a.suit > b.suit;
		return a.rank > b.rank;
	});
}

/** High card points in a hand. */
export function hcp(hand: Hand): number {
	let total = 0;
	for (const c of hand) total += HCP_VALUE[c.rank] ?? 0;
	return total;
}

/** Cards per suit, indexed by suit id (slot 0 unused). */
export function shape(hand: Hand): number[] {
	const counts = [0, 0, 0, 0, 0];
	for (const c of hand) counts[c.suit]++;
	return counts;
}

/** Shape sorted long-to-short, e.g. [5,4,3,1]. Distribution regardless of suit. */
export function sortedShape(hand: Hand): number[] {
	const counts = shape(hand);
	const sorted = [counts[1], counts[2], counts[3], counts[4]];
	return luaSort(sorted, (a, b) => a > b);
}

/** Balanced hands are 4333, 4432 and 5332 -- the shapes that want notrump. */
export function isBalanced(hand: Hand): boolean {
	const s = sortedShape(hand);
	return s[0] <= 5 && s[3] >= 2 && !(s[0] === 5 && s[1] === 5);
}

/** Longest suit, ties broken by the higher-ranking suit. Returns [suit, count]. */
export function longestSuit(hand: Hand): [number, number] {
	const counts = shape(hand);
	let best = CLUBS,
		bestCount = -1;
	for (let suit = 1; suit <= 4; suit++) {
		if (counts[suit] > bestCount) {
			best = suit;
			bestCount = counts[suit];
		}
	}
	return [best, bestCount];
}

/** Distribution points: the extra value of short suits when you have a trump. */
export function shortnessPoints(hand: Hand): number {
	const counts = shape(hand);
	let pts = 0;
	for (let suit = 1; suit <= 4; suit++) {
		if (counts[suit] === 0) pts += 3;
		else if (counts[suit] === 1) pts += 2;
		else if (counts[suit] === 2) pts += 1;
	}
	return pts;
}

export function cardsOfSuit(hand: Hand, suit: number): Card[] {
	return hand.filter((c) => c.suit === suit);
}

export function countSuit(hand: Hand, suit: number): number {
	let n = 0;
	for (const c of hand) if (c.suit === suit) n++;
	return n;
}

export function hasSuit(hand: Hand, suit: number): boolean {
	return countSuit(hand, suit) > 0;
}

/** Aces, kings, queens... in a suit. Used by honour-counting relics. */
export function honoursInSuit(hand: Hand, suit: number): number {
	let n = 0;
	for (const c of hand) if (c.suit === suit && isHonour(c)) n++;
	return n;
}

export function countRank(hand: Hand, rank: number): number {
	let n = 0;
	for (const c of hand) if (c.rank === rank) n++;
	return n;
}

/** Index of a card within a hand, by identity then by value; -1 if absent. */
export function indexOf(hand: Hand, c: Card): number {
	const i = hand.indexOf(c);
	if (i >= 0) return i;
	return hand.findIndex((h) => h.suit === c.suit && h.rank === c.rank);
}

export function removeCard(hand: Hand, c: Card): Card | undefined {
	const i = indexOf(hand, c);
	if (i >= 0) return hand.splice(i, 1)[0];
	return undefined;
}

/** Shallow copy of a hand (cards themselves are shared and never mutated). */
export function copyHand(hand: Hand): Hand {
	return hand.slice();
}

/** Compact rendering of a whole hand, e.g. "S:AKQ74 H:K3 D:A82 C:95". */
export function describeHand(hand: Hand): string {
	const parts: string[] = [];
	for (let suit = 4; suit >= 1; suit--) {
		const cs = luaSort(cardsOfSuit(hand, suit), (a, b) => a.rank > b.rank);
		const ranks = cs.map((c) => RANK_NAMES[c.rank]).join('');
		parts.push(SUITS[suit].key + ':' + (ranks.length > 0 ? ranks : '-'));
	}
	return parts.join(' ');
}
