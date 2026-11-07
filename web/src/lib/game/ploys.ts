// Ploys: one-shot tricks you buy, hold, and spend to bend a deal your way.
// Port of src/game/ploys.lua.
//
// Every deal is a fresh shuffle of a real 52-card pack, so ploys act on the
// deal in front of you rather than on a deck you keep. Cards are always
// *exchanged* between hands, never created, so the pack stays a legal 52
// cards with 40 high card points.

import * as cards from '../rules/cards.ts';
import * as bidding from '../rules/bidding.ts';
import type { Card, Hand } from '../rules/cards.ts';
import type { RNG } from '../rules/rng.ts';
import type { Deal, Run } from './engine.ts';

export const SLOTS = 2;

export interface PloyCtx {
	run: Run;
	deal: Deal;
	rng: RNG;
	engine: { startDeal: (run: Run) => unknown };
}

export type CheckResult = [boolean, string?];

export interface PloyDef {
	key: string;
	name: string;
	rarity: number;
	cost: number;
	when: { bid?: boolean; play?: boolean; any?: boolean };
	target?: 'card';
	text: string;
	check: (ctx: PloyCtx, target?: Card) => CheckResult;
	apply: (ctx: PloyCtx, target?: Card) => string;
}

export interface Ploy {
	key: string;
	def: PloyDef;
	name: string;
	cost: number;
}

const DEFENDERS = [cards.EAST, cards.WEST];

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

/** Exchange two cards between hands, remembering where each went for the UI. */
function swap(deal: Deal, seatA: number, cardA: Card, seatB: number, cardB: Card) {
	assert(cards.removeCard(deal.hands[seatA], cardA), 'swap: card not in hand A');
	assert(cards.removeCard(deal.hands[seatB], cardB), 'swap: card not in hand B');
	deal.hands[seatA].push(cardB);
	deal.hands[seatB].push(cardA);
	deal.cameFrom.set(cardB, seatB);
	deal.wentTo.set(cardA, seatB);
}

/** Re-sort, refresh the "as dealt" copies, and tell the UI the deal changed. */
function refresh(deal: Deal) {
	for (let seat = 1; seat <= 4; seat++) {
		cards.sortHand(deal.hands[seat]);
		deal.original[seat] = cards.copyHand(deal.hands[seat]);
	}
	deal.partnerInfo = deal.kibitzed
		? bidding.describeExact(deal.hands[deal.dummy])
		: bidding.describePartner(deal.hands[deal.dummy]);
	deal.version = (deal.version || 0) + 1;
}

/** The defender card best satisfying `better`, among cards passing `pred`. */
function bestDefenderCard(
	deal: Deal,
	pred: (c: Card) => boolean,
	better: (a: Card, b: Card) => boolean
): [Card | undefined, number | undefined] {
	let best: Card | undefined;
	let bestSeat: number | undefined;
	for (const seat of DEFENDERS) {
		for (const c of deal.hands[seat]) {
			if (pred(c) && (!best || better(c, best))) {
				best = c;
				bestSeat = seat;
			}
		}
	}
	return [best, bestSeat];
}

const lower = (a: Card, b: Card) => a.rank < b.rank;
const higher = (a: Card, b: Card) => a.rank > b.rank;

function holds(hand: Hand, card: Card): boolean {
	return hand.includes(card);
}

function yourCard(ctx: PloyCtx, target?: Card): CheckResult {
	if (!target) return [false, 'choose one of your cards'];
	if (!holds(ctx.deal.hands[ctx.deal.declarer], target)) {
		return [false, "that card isn't in your hand"];
	}
	return [true];
}

const OK: CheckResult = [true];

export const DEFS: PloyDef[] = [
	{
		key: 'kibitzer', name: 'The Kibitzer', rarity: 1, cost: 3,
		when: { bid: true },
		text: "See dummy's exact cards before you bid.",
		check: (ctx) => (ctx.deal.kibitzed ? [false, 'you can already see dummy'] : OK),
		apply: (ctx) => {
			ctx.deal.kibitzed = true;
			refresh(ctx.deal);
			return "You peek at partner's hand.";
		}
	},
	{
		key: 'double_dummy', name: 'Double Dummy', rarity: 2, cost: 5,
		when: { bid: true, play: true },
		text: "See both defenders' hands for the rest of this deal.",
		check: (ctx) =>
			ctx.deal.seeDefenders ? [false, "the defenders' cards are already showing"] : OK,
		apply: (ctx) => {
			ctx.deal.seeDefenders = true;
			return 'Every card is on the table.';
		}
	},
	{
		key: 'redeal', name: 'Redeal', rarity: 1, cost: 3,
		when: { bid: true },
		text: "Throw in this deal and deal again. It doesn't use up a deal.",
		check: () => OK,
		apply: (ctx) => {
			ctx.engine.startDeal(ctx.run);
			return 'The cards are shuffled and dealt again.';
		}
	},
	{
		key: 'promotion', name: 'Promotion', rarity: 1, cost: 3,
		when: { bid: true }, target: 'card',
		text: 'Trade one of your cards for the next card up in its suit, taken from a defender.',
		check: (ctx, target) => {
			const r = yourCard(ctx, target);
			if (!r[0]) return r;
			const [c] = bestDefenderCard(
				ctx.deal, (c) => c.suit === target!.suit && c.rank > target!.rank, lower);
			if (!c) return [false, 'the defenders hold nothing higher in that suit'];
			return OK;
		},
		apply: (ctx, target) => {
			const deal = ctx.deal;
			const t = target!;
			const [c, seat] = bestDefenderCard(deal, (c) => c.suit === t.suit && c.rank > t.rank, lower);
			swap(deal, deal.declarer, t, seat!, c!);
			refresh(deal);
			return `${cards.code(t)} becomes ${cards.code(c!)}.`;
		}
	},
	{
		key: 'coup', name: 'The Coup', rarity: 2, cost: 5,
		when: { bid: true }, target: 'card',
		text: 'Trade one of your cards for the highest card of its suit that a defender holds.',
		check: (ctx, target) => {
			const r = yourCard(ctx, target);
			if (!r[0]) return r;
			const [c] = bestDefenderCard(
				ctx.deal, (c) => c.suit === target!.suit && c.rank > target!.rank, higher);
			if (!c) return [false, 'the defenders hold nothing higher in that suit'];
			return OK;
		},
		apply: (ctx, target) => {
			const deal = ctx.deal;
			const t = target!;
			const [c, seat] = bestDefenderCard(deal, (c) => c.suit === t.suit && c.rank > t.rank, higher);
			swap(deal, deal.declarer, t, seat!, c!);
			refresh(deal);
			return `${cards.code(t)} becomes ${cards.code(c!)}.`;
		}
	},
	{
		key: 'transfer', name: 'Transfer', rarity: 1, cost: 3,
		when: { bid: true }, target: 'card',
		text: 'Trade one of your cards for a card of your longest suit, taken from a defender.',
		check: (ctx, target) => {
			const r = yourCard(ctx, target);
			if (!r[0]) return r;
			const [long] = cards.longestSuit(ctx.deal.hands[ctx.deal.declarer]);
			if (target!.suit === long) return [false, 'pick a card outside your longest suit'];
			const [c] = bestDefenderCard(ctx.deal, (c) => c.suit === long, higher);
			if (!c) return [false, 'the defenders hold none of your longest suit'];
			return OK;
		},
		apply: (ctx, target) => {
			const deal = ctx.deal;
			const [long] = cards.longestSuit(deal.hands[deal.declarer]);
			const pool: { card: Card; seat: number }[] = [];
			for (const seat of DEFENDERS) {
				for (const c of deal.hands[seat]) if (c.suit === long) pool.push({ card: c, seat });
			}
			const pick = ctx.rng.pick(pool)!;
			swap(deal, deal.declarer, target!, pick.seat, pick.card);
			refresh(deal);
			return `${cards.code(target!)} becomes ${cards.code(pick.card)}.`;
		}
	},
	{
		key: 'ruffing_void', name: 'Ruffing Void', rarity: 2, cost: 4,
		when: { bid: true }, target: 'card',
		text: "Give away every card in the chosen card's suit, and take cards in your longest suit in return.",
		check: (ctx, target) => {
			const r = yourCard(ctx, target);
			if (!r[0]) return r;
			const [long] = cards.longestSuit(ctx.deal.hands[ctx.deal.declarer]);
			if (target!.suit === long) return [false, 'pick a suit other than your longest'];
			return OK;
		},
		apply: (ctx, target) => {
			const deal = ctx.deal;
			const hand = deal.hands[deal.declarer];
			const [long] = cards.longestSuit(hand);
			const voidSuit = target!.suit;
			for (const c of cards.cardsOfSuit(hand, voidSuit)) {
				// Prefer the defenders' cards in our long suit; failing that, any
				// card that doesn't put the void suit straight back.
				let [take, seat] = bestDefenderCard(deal, (d) => d.suit === long, lower);
				if (!take) [take, seat] = bestDefenderCard(deal, (d) => d.suit !== voidSuit, lower);
				if (take) swap(deal, deal.declarer, c, seat!, take);
			}
			refresh(deal);
			return `You're now void in ${cards.SUITS[voidSuit].name.toLowerCase()}.`;
		}
	},
	{
		key: 'strong_partner', name: 'Strong Partner', rarity: 2, cost: 5,
		when: { bid: true },
		text: 'Dummy swaps its two lowest cards for the two highest cards the defenders hold.',
		check: () => OK,
		apply: (ctx) => {
			const deal = ctx.deal;
			for (let k = 0; k < 2; k++) {
				const dummyHand = deal.hands[deal.dummy];
				let low = dummyHand[0];
				for (const c of dummyHand) if (c.rank < low.rank) low = c;
				const [high, seat] = bestDefenderCard(deal, () => true, higher);
				if (high && high.rank > low.rank) swap(deal, deal.dummy, low, seat!, high);
			}
			refresh(deal);
			return "Partner's hand gets stronger.";
		}
	},
	{
		key: 'lead_out_of_turn', name: 'Lead Out of Turn', rarity: 1, cost: 3,
		when: { bid: true },
		text: 'You make the opening lead instead of West.',
		check: (ctx) => (ctx.deal.declarerLeads ? [false, "you're already leading"] : OK),
		apply: (ctx) => {
			ctx.deal.declarerLeads = true;
			return "You'll lead the first trick.";
		}
	},
	{
		key: 'psych', name: 'Psych', rarity: 1, cost: 3,
		when: { bid: true },
		text: "A misleading bid: the defenders won't double you this deal.",
		check: (ctx) => (ctx.deal.noDouble ? [false, 'already played'] : OK),
		apply: (ctx) => {
			ctx.deal.noDouble = true;
			return "The defenders won't double this deal.";
		}
	},
	{
		key: 'table_talk', name: 'Table Talk', rarity: 1, cost: 3,
		when: { bid: true, play: true },
		text: 'Chatter at the table: the defenders play carelessly this deal.',
		check: (ctx) => (ctx.deal.carelessDefense ? [false, "they're already distracted"] : OK),
		apply: (ctx) => {
			ctx.deal.carelessDefense = true;
			return 'The defenders lose focus.';
		}
	},
	{
		key: 'phantom_trick', name: 'Phantom Trick', rarity: 3, cost: 6,
		when: { bid: true, play: true },
		text: 'One extra trick counts for you this deal.',
		check: () => OK,
		apply: (ctx) => {
			ctx.deal.phantom = (ctx.deal.phantom || 0) + 1;
			return 'One more trick in your column.';
		}
	},
	{
		key: 'safety_net', name: 'Safety Net', rarity: 2, cost: 4,
		when: { bid: true, play: true },
		text: 'If this contract fails, you get the deal back.',
		check: (ctx) => (ctx.deal.safetyNet ? [false, 'already in place'] : OK),
		apply: (ctx) => {
			ctx.deal.safetyNet = true;
			return "A failed contract won't cost you this deal.";
		}
	},
	{
		key: 'high_stakes', name: 'High Stakes', rarity: 2, cost: 4,
		when: { any: true },
		text: 'Double your money (up to +$15).',
		check: () => OK,
		apply: (ctx) => {
			const gain = Math.min(ctx.run.money, 15);
			ctx.run.money += gain;
			return `+$${gain}`;
		}
	},
	{
		key: 'vanderbilt', name: 'Vanderbilt', rarity: 3, cost: 5,
		when: { any: true },
		text: 'Gain a copy of the last ploy you used. Named for the man who invented contract bridge.',
		check: (ctx) => (!ctx.run.lastPloy ? [false, "you haven't used a ploy yet"] : OK),
		apply: (ctx) => {
			const def = get(ctx.run.lastPloy!)!;
			ctx.run.ploys.push(instantiate(def));
			return `You gain another ${def.name}.`;
		}
	}
];

export const BY_KEY: Record<string, PloyDef> = {};
for (const d of DEFS) BY_KEY[d.key] = d;

export function get(key: string): PloyDef | undefined {
	return BY_KEY[key];
}

export function instantiate(def: PloyDef): Ploy {
	return { key: def.key, def, name: def.name, cost: def.cost };
}

/** Describe when a ploy can be played, for the UI. */
export function whenText(def: PloyDef): string {
	if (def.when.any) return 'Any time';
	if (def.when.bid && def.when.play) return 'Before bidding or during play';
	if (def.when.bid) return 'Before you bid';
	return 'During play';
}

/** A random ploy definition, weighted toward common ones. */
export function randomDef(rng: RNG): PloyDef {
	const weights = [0, 3, 2, 1];
	let total = 0;
	for (const d of DEFS) total += weights[d.rarity];
	let roll = rng.next() * total;
	for (const d of DEFS) {
		roll -= weights[d.rarity];
		if (roll <= 0) return d;
	}
	return DEFS[DEFS.length - 1];
}
