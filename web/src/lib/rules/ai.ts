// Defender AI for East and West, and the declarer autopilot.
// Port of src/rules/ai.lua.
//
// Plays the standard defensive heuristics a club player would recognise:
// fourth-best leads, top of a sequence, second hand low, third hand high,
// cover an honour with an honour, cheapest winner, ruff when it gains a
// trick, and discard from weakness. It sees dummy once dummy is exposed.
// It is deliberately not a double-dummy solver.

import * as cards from './cards.ts';
import * as play from './play.ts';
import { luaSort } from './luasort.ts';
import type { Card, Hand } from './cards.ts';
import type { PlayState } from './play.ts';
import type { RNG } from './rng.ts';

export const DEFAULT_SKILL = 0.88;

export interface AIContext {
	declarer: number;
	dummy: number;
	dummyVisible: boolean;
	rng: RNG;
	skill?: number;
	partnerSuit?: number;
}

type Discarder = (legal: Card[], trump: number) => Card;
interface InnerContext extends AIContext {
	discard: Discarder;
}

/** Does `c` currently beat `w`, given the trump strain? */
function beats(c: Card, w: Card, trump: number): boolean {
	const cT = trump !== cards.NOTRUMP && c.suit === trump;
	const wT = trump !== cards.NOTRUMP && w.suit === trump;
	if (cT && !wT) return true;
	if (wT && !cT) return false;
	if (c.suit === w.suit) return c.rank > w.rank;
	return false;
}

function lowest(list: Card[]): Card {
	let best: Card | undefined;
	for (const c of list) if (!best || c.rank < best.rank) best = c;
	return best!;
}

function highest(list: Card[]): Card | undefined {
	let best: Card | undefined;
	for (const c of list) if (!best || c.rank > best.rank) best = c;
	return best;
}

/** The cheapest card in `list` that beats `target`, or undefined. */
function cheapestWinner(list: Card[], target: Card, trump: number): Card | undefined {
	let best: Card | undefined;
	for (const c of list) {
		if (beats(c, target, trump) && (!best || c.rank < best.rank)) best = c;
	}
	return best;
}

/** Longest run of touching cards starting from the top of a suit holding. */
function sequenceLength(suited: Card[]): number {
	if (suited.length < 2) return suited.length;
	let n = 1;
	for (let i = 1; i < suited.length; i++) {
		if (suited[i].rank === suited[i - 1].rank - 1) n++;
		else break;
	}
	return n;
}

function sortDesc(list: Card[]): Card[] {
	return luaSort(list, (a, b) => a.rank > b.rank);
}

/** Pick a card to lead a fresh trick. */
function chooseLead(state: PlayState, seat: number, ctx: InnerContext): Card {
	const hand = state.hands[seat];
	const trump = state.trump;

	// Cash a known winner: the top outstanding card in a suit we hold.
	const known = ctx.dummyVisible ? state.hands[ctx.dummy] : null;
	let bestCash: Card | undefined;
	for (let suit = 1; suit <= 4; suit++) {
		const suited = sortDesc(cards.cardsOfSuit(hand, suit));
		if (suited.length > 0) {
			const out = play.highestOutstanding(state, suit, hand);
			let dummyTop = 0;
			if (known) {
				for (const dc of cards.cardsOfSuit(known, suit)) dummyTop = Math.max(dummyTop, dc.rank);
			}
			if ((out === null || suited[0].rank > out) && suited[0].rank > dummyTop) {
				if (!bestCash || suited[0].rank > bestCash.rank) bestCash = suited[0];
			}
		}
	}
	if (bestCash && ctx.rng.chance(0.7)) return bestCash;

	// Otherwise lead from our longest side suit, avoiding trumps.
	const candidates: { suit: number; n: number }[] = [];
	for (let suit = 1; suit <= 4; suit++) {
		if (suit !== trump || trump === cards.NOTRUMP) {
			const n = cards.countSuit(hand, suit);
			if (n > 0) candidates.push({ suit, n });
		}
	}
	if (candidates.length === 0) return lowest(hand); // only trumps left

	// Prefer partner's suit if partner has led or discarded into it, then length.
	luaSort(candidates, (a, b) => {
		const aP = ctx.partnerSuit === a.suit ? 1 : 0;
		const bP = ctx.partnerSuit === b.suit ? 1 : 0;
		if (aP !== bP) return aP > bP;
		if (a.n !== b.n) return a.n > b.n;
		return a.suit > b.suit;
	});

	const suit = candidates[0].suit;
	const suited = sortDesc(cards.cardsOfSuit(hand, suit));

	// Top of a three-card sequence (AKQ, KQJ, QJT) is the classic safe lead.
	if (cards.isHonour(suited[0]) && sequenceLength(suited) >= 3) return suited[0];
	// A singleton in a side suit angles for a ruff later.
	if (suited.length === 1) return suited[0];
	// From a doubleton, lead the higher.
	if (suited.length === 2) return suited[0];
	// Fourth best from length, the standard attacking lead.
	if (suited.length >= 4) return suited[3];
	// Three small: lead the lowest.
	return suited[suited.length - 1];
}

/** Pick a card when following to a trick already in progress. */
function chooseFollow(state: PlayState, seat: number, ctx: InnerContext): Card {
	const trump = state.trump;
	const legal = play.legalPlays(state, seat);
	if (legal.length === 1) return legal[0];

	const partner = cards.partner(seat);
	const winning = play.trickWinner(state.trick, trump);
	const partnerWinning = winning.seat === partner;
	const lastToPlay = state.trick.length === 3;
	const secondToPlay = state.trick.length === 1;
	const followingSuit = legal[0].suit === state.ledSuit;

	// Partner already has it: never waste a high card on our own trick.
	if (partnerWinning) {
		if (followingSuit) return lowest(legal);
		return ctx.discard(legal, trump);
	}

	const winner = cheapestWinner(legal, winning.card, trump);

	if (followingSuit) {
		if (winner) {
			// Second hand low, unless covering an honour.
			const honourOnTable = cards.isHonour(winning.card);
			if (secondToPlay && cards.isHonour(winner) && !honourOnTable && ctx.rng.chance(0.75)) {
				return lowest(legal);
			}
			return winner;
		}
		// Can't win. Third hand high still helps push declarer's card up.
		if (state.trick.length === 2 && ctx.rng.chance(0.5)) {
			const h = highest(legal);
			if (h && !cards.isHonour(h)) return h;
		}
		return lowest(legal);
	}

	// Void in the led suit. Ruffing is worth it when the trick is ours to take.
	if (winner && trump !== cards.NOTRUMP) {
		const trumps = cards.cardsOfSuit(legal, trump);
		if (trumps.length > 0) {
			const cheap = cheapestWinner(trumps, winning.card, trump);
			if (cheap && (lastToPlay || cards.isHonour(winning.card) || ctx.rng.chance(0.6))) {
				return cheap;
			}
		}
	}
	return ctx.discard(legal, trump);
}

/** Throw the least useful card: lowest card of our weakest non-trump suit. */
function makeDiscarder(state: PlayState, seat: number): Discarder {
	return (legal, trump) => {
		const hand = state.hands[seat];
		let best!: Card;
		let bestScore: number | undefined;
		for (const c of legal) {
			const suitLen = cards.countSuit(hand, c.suit);
			const honours = cards.honoursInSuit(hand, c.suit);
			let score = c.rank;
			if (trump !== cards.NOTRUMP && c.suit === trump) score += 40;
			if (cards.isHonour(c)) score += 12;
			score = score + honours * 3 - suitLen;
			if (bestScore === undefined || score < bestScore) {
				best = c;
				bestScore = score;
			}
		}
		return best;
	};
}

/** Choose a card for a defender. */
export function chooseCard(state: PlayState, seat: number, ctx: AIContext): Card {
	const legal = play.legalPlays(state, seat);
	if (legal.length === 1) return legal[0];

	const skill = ctx.skill ?? DEFAULT_SKILL;
	if (ctx.rng.chance(1 - skill)) {
		return legal[ctx.rng.int(1, legal.length) - 1];
	}

	const inner: InnerContext = {
		declarer: ctx.declarer,
		dummy: ctx.dummy,
		dummyVisible: ctx.dummyVisible,
		rng: ctx.rng,
		partnerSuit: ctx.partnerSuit,
		discard: makeDiscarder(state, seat)
	};

	if (state.trick.length === 0) return chooseLead(state, seat, inner);
	return chooseFollow(state, seat, inner);
}

/** Highest rank the defenders could still hold in a suit, seen from the declaring side. */
function defendersTop(state: PlayState, suit: number, seat: number): number | null {
	const p = cards.partner(seat);
	const both: Hand = cards.copyHand(state.hands[seat]).concat(state.hands[p]);
	return play.highestOutstanding(state, suit, both);
}

/** Do the defenders still hold any trumps? Counted from the cards seen. */
function defendersHaveTrumps(state: PlayState, seat: number): boolean {
	if (state.trump === cards.NOTRUMP) return false;
	let seen =
		cards.countSuit(state.hands[seat], state.trump) +
		cards.countSuit(state.hands[cards.partner(seat)], state.trump);
	for (const p of state.played) if (p.card.suit === state.trump) seen++;
	return seen < 13;
}

/** A simple declarer-side policy, used for "play it out" and by the bot. */
export function chooseDeclarerCard(state: PlayState, seat: number, ctx: AIContext): Card {
	void ctx;
	const trump = state.trump;
	const legal = play.legalPlays(state, seat);
	if (legal.length === 1) return legal[0];

	const partner = cards.partner(seat);
	const hand = state.hands[seat],
		pHand = state.hands[partner];

	if (state.trick.length === 0) {
		const drawing = trump !== cards.NOTRUMP && defendersHaveTrumps(state, seat);
		// Draw trumps first while we hold the master trump.
		if (drawing) {
			const t = sortDesc(cards.cardsOfSuit(hand, trump));
			const top = defendersTop(state, trump, seat);
			if (t.length > 0 && (top === null || t[0].rank > top)) return t[0];
		}
		// Cash a sure winner; lead low towards partner's master card when they hold it.
		let bestLead: Card | undefined;
		let bestScore: number | undefined;
		for (let suit = 1; suit <= 4; suit++) {
			if (!drawing || suit !== trump) {
				const mine = sortDesc(cards.cardsOfSuit(hand, suit));
				const theirs = sortDesc(cards.cardsOfSuit(pHand, suit));
				if (mine.length > 0) {
					const top = defendersTop(state, suit, seat);
					const myMaster = top === null || mine[0].rank > top;
					const theirMaster = theirs.length > 0 && (top === null || theirs[0].rank > top);
					let pick: Card | undefined;
					let score = 0;
					if (myMaster) {
						pick = mine[0];
						score = 100 + mine.length;
					} else if (theirMaster) {
						pick = mine[mine.length - 1];
						score = 90 + theirs.length;
					}
					// Don't cash side winners into a defender's void while they hold trumps.
					if (pick && drawing) score -= 50;
					if (pick && (bestScore === undefined || score > bestScore)) {
						bestLead = pick;
						bestScore = score;
					}
				}
			}
		}
		if (bestLead) return bestLead;
		// Nothing certain: lead low from our longest side suit to set it up.
		let best: number | undefined;
		let bestLen: number | undefined;
		for (let suit = 1; suit <= 4; suit++) {
			if (suit !== trump || trump === cards.NOTRUMP) {
				const n = cards.countSuit(hand, suit) + cards.countSuit(pHand, suit);
				if (cards.countSuit(hand, suit) > 0 && (bestLen === undefined || n > bestLen)) {
					best = suit;
					bestLen = n;
				}
			}
		}
		if (best !== undefined) return lowest(cards.cardsOfSuit(hand, best));
		return lowest(legal);
	}

	const winning = play.trickWinner(state.trick, trump);
	// Partner plays after us only if partner has not played yet.
	let partnerToPlay = true;
	for (const p of state.trick) if (p.seat === partner) partnerToPlay = false;

	if (winning.seat === partner) return lowest(legal);

	const winner = cheapestWinner(legal, winning.card, trump);
	if (partnerToPlay && state.ledSuit) {
		// Partner still to play: if partner holds a master in the led suit, duck.
		const theirs = sortDesc(cards.cardsOfSuit(pHand, state.ledSuit));
		const top = defendersTop(state, state.ledSuit, seat);
		if (
			theirs.length > 0 &&
			(top === null || theirs[0].rank > top) &&
			theirs[0].rank > winning.card.rank
		) {
			if (legal[0].suit === state.ledSuit) return lowest(legal);
		}
	}
	if (winner) {
		// Second hand: a defender still plays after us; win only with a master card.
		if (state.trick.length === 1 && winner.suit === state.ledSuit) {
			const top = defendersTop(state, winner.suit, seat);
			if (top !== null && winner.rank < top && !partnerToPlay) return lowest(legal);
		}
		return winner;
	}
	return makeDiscarder(state, seat)(legal, trump);
}

/** Run the rest of a deal with both sides on autopilot. */
export function playOut(state: PlayState, ctx: AIContext): PlayState {
	let guard = 0;
	while (!state.complete) {
		guard++;
		if (guard >= 200) throw new Error('playOut: did not terminate');
		const seat = state.turn;
		const card = cards.sameSide(seat, ctx.declarer)
			? chooseDeclarerCard(state, seat, ctx)
			: chooseCard(state, seat, ctx);
		play.play(state, seat, card);
	}
	return state;
}
