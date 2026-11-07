// Trick-play state machine. Port of src/rules/play.lua.
//
// Enforces follow-suit, resolves tricks, and records telemetry that the
// relics read later (which seat won a trick, whether it was a ruff, whether
// the winning card was an honour).

import * as cards from './cards.ts';
import type { Card, Hand, Hands } from './cards.ts';

export interface PlayedCard {
	seat: number;
	card: Card;
}

export interface Trick {
	index: number; // 1-based, as in Lua
	leader: number;
	ledSuit: number;
	plays: PlayedCard[];
	winner: number;
	winningCard: Card;
	ruff: boolean;
	wonWithHonour: boolean;
}

export interface PlayState {
	hands: Hands;
	trump: number;
	leader: number;
	turn: number;
	trick: PlayedCard[];
	ledSuit: number | null;
	tricks: Trick[];
	nsTricks: number;
	ewTricks: number;
	/** Revealed voids, per seat then suit, for AI inference. */
	voids: Record<number, boolean>[];
	played: PlayedCard[];
	complete: boolean;
}

export interface PlaySummary {
	declarerTricks: number;
	ruffs: number;
	tricksFromDummy: number;
	tricksFromDeclarer: number;
	honourWins: number;
	wonLastTrick: boolean;
	wonFirstTrick: boolean;
	lastThree: number;
}

/** Start a play phase. Hands are copied; trump 5 means notrump. */
export function newPlay(hands: Hands, trump: number, leader: number): PlayState {
	const state: PlayState = {
		hands: [[]],
		trump,
		leader,
		turn: leader,
		trick: [],
		ledSuit: null,
		tricks: [],
		nsTricks: 0,
		ewTricks: 0,
		voids: [{}, {}, {}, {}, {}],
		played: [],
		complete: false
	};
	for (let seat = 1; seat <= 4; seat++) state.hands[seat] = cards.copyHand(hands[seat] ?? []);
	return state;
}

export { newPlay as new };

export function isTrumpSuit(state: PlayState, suit: number): boolean {
	return state.trump !== cards.NOTRUMP && suit === state.trump;
}

/** Cards a seat may legally play right now: follow suit if you can. */
export function legalPlays(state: PlayState, seat: number): Card[] {
	const hand = state.hands[seat];
	if (state.ledSuit && cards.hasSuit(hand, state.ledSuit)) {
		return cards.cardsOfSuit(hand, state.ledSuit);
	}
	return cards.copyHand(hand);
}

export function isLegal(state: PlayState, seat: number, card: Card): boolean {
	return legalPlays(state, seat).includes(card);
}

/** Highest trump if any trump was played, otherwise highest card of the led suit. */
export function trickWinner(trick: PlayedCard[], trump: number): PlayedCard {
	let best = trick[0];
	for (let i = 1; i < trick.length; i++) {
		const c = trick[i].card,
			b = best.card;
		const cTrump = trump !== cards.NOTRUMP && c.suit === trump;
		const bTrump = trump !== cards.NOTRUMP && b.suit === trump;
		if (cTrump && !bTrump) {
			best = trick[i];
		} else if (cTrump === bTrump && c.suit === b.suit && c.rank > b.rank) {
			best = trick[i];
		}
	}
	return best;
}

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

/** Play one card. Returns the completed trick when the trick ends. */
export function play(state: PlayState, seat: number, card: Card): Trick | null {
	assert(!state.complete, 'play: deal is already finished');
	assert(seat === state.turn, 'play: not this seat\'s turn');
	assert(isLegal(state, seat, card), 'play: illegal card');

	// Record a revealed void: discarding off-suit proves the seat is out of it.
	if (state.ledSuit && card.suit !== state.ledSuit) {
		state.voids[seat][state.ledSuit] = true;
	}

	cards.removeCard(state.hands[seat], card);
	state.trick.push({ seat, card });
	state.played.push({ seat, card });
	if (state.trick.length === 1) state.ledSuit = card.suit;

	if (state.trick.length < 4) {
		state.turn = cards.nextSeat(seat);
		return null;
	}

	// Trick is full: resolve it.
	const winning = trickWinner(state.trick, state.trump);
	const ledSuit = state.trick[0].card.suit;
	const completed: Trick = {
		index: state.tricks.length + 1,
		leader: state.leader,
		ledSuit,
		plays: state.trick,
		winner: winning.seat,
		winningCard: winning.card,
		ruff: isTrumpSuit(state, winning.card.suit) && ledSuit !== state.trump,
		wonWithHonour: cards.isHonour(winning.card)
	};
	state.tricks.push(completed);

	if (cards.SEATS[winning.seat].side === 'NS') state.nsTricks++;
	else state.ewTricks++;

	state.trick = [];
	state.ledSuit = null;
	state.leader = winning.seat;
	state.turn = winning.seat;

	if (state.tricks.length >= cards.TRICK_COUNT || state.hands[winning.seat].length === 0) {
		state.complete = true;
	}
	return completed;
}

/** Tricks taken by the declaring side. */
export function declarerTricks(state: PlayState, declarer: number): number {
	return cards.SEATS[declarer].side === 'NS' ? state.nsTricks : state.ewTricks;
}

export function tricksRemaining(state: PlayState): number {
	return cards.TRICK_COUNT - state.tricks.length;
}

/** Highest card of a suit still unseen by a given seat (for AI reasoning). */
export function highestOutstanding(
	state: PlayState,
	suit: number,
	knownHand?: Hand | null
): number | null {
	const seen: boolean[] = [];
	for (const p of state.played) if (p.card.suit === suit) seen[p.card.rank] = true;
	for (const p of state.trick) if (p.card.suit === suit) seen[p.card.rank] = true;
	if (knownHand) for (const c of knownHand) if (c.suit === suit) seen[c.rank] = true;
	for (let rank = 14; rank >= 2; rank--) if (!seen[rank]) return rank;
	return null;
}

/** Telemetry the relics consume, derived once a deal is finished. */
export function summarise(state: Pick<PlayState, 'tricks' | 'nsTricks' | 'ewTricks'>, declarer: number): PlaySummary {
	const dummy = cards.partner(declarer);
	const s: PlaySummary = {
		declarerTricks: declarerTricks(state as PlayState, declarer),
		ruffs: 0,
		tricksFromDummy: 0,
		tricksFromDeclarer: 0,
		honourWins: 0,
		wonLastTrick: false,
		wonFirstTrick: false,
		lastThree: 0
	};
	const n = state.tricks.length;
	state.tricks.forEach((t, k) => {
		const i = k + 1;
		if (cards.sameSide(t.winner, declarer)) {
			if (t.ruff) s.ruffs++;
			if (t.winner === dummy) s.tricksFromDummy++;
			if (t.winner === declarer) s.tricksFromDeclarer++;
			if (t.wonWithHonour) s.honourWins++;
			if (i === 1) s.wonFirstTrick = true;
			if (i === n) s.wonLastTrick = true;
			if (i > n - 3) s.lastThree++;
		}
	});
	return s;
}
