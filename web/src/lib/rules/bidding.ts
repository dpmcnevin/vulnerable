// Partner's bid, and trick estimation. Port of src/rules/bidding.lua.
//
// You never see your partner's cards before you commit to a contract. What
// you get is what a bid conveys: a point range, any long suit, and whether
// the hand is balanced. Dummy comes down only after you have bid.

import * as cards from './cards.ts';
import * as scoring from './scoring.ts';
import type { Card, Contract, Hand } from './cards.ts';
import type { RNG } from './rng.ts';

export interface Range {
	low: number;
	high: number;
	name: string;
	note: string;
}

export interface PartnerInfo {
	hcp: number;
	range: Range;
	midpoint: number;
	longSuits: { suit: number; length: number }[];
	balanced: boolean;
	text: string;
	lengths?: number[];
	exact?: boolean;
	hand?: Card[];
}

// The ranges a bid narrows a hand to, in ascending order.
export const RANGES: Range[] = [
	{ low: 0, high: 5, name: 'Pass', note: 'very weak' },
	{ low: 6, high: 9, name: 'Minimum', note: 'a few scattered points' },
	{ low: 10, high: 12, name: 'Invitational', note: 'close to an opening hand' },
	{ low: 13, high: 15, name: 'Opening', note: 'a sound opening hand' },
	{ low: 16, high: 18, name: 'Strong', note: 'strong' },
	{ low: 19, high: 40, name: 'Powerhouse', note: 'a powerhouse' }
];

function rangeFor(hcp: number): Range {
	for (const r of RANGES) if (hcp >= r.low && hcp <= r.high) return r;
	return RANGES[RANGES.length - 1];
}

function longSuitsOf(counts: number[]) {
	const longSuits: { suit: number; length: number }[] = [];
	for (let suit = 4; suit >= 1; suit--) {
		if (counts[suit] >= 5) longSuits.push({ suit, length: counts[suit] });
	}
	return longSuits;
}

/** What partner's bid tells you about their hand. */
export function describePartner(hand: Hand): PartnerInfo {
	const hcp = cards.hcp(hand);
	const range = rangeFor(hcp);
	const counts = cards.shape(hand);
	const longSuits = longSuitsOf(counts);
	const balanced = cards.isBalanced(hand);

	const parts = [`${range.low}-${Math.min(range.high, 24)} points`];
	if (longSuits.length > 0) {
		parts.push(longSuits.map((l) => `${l.length} ${cards.SUITS[l.suit].glyph}`).join(', '));
	} else if (balanced) {
		parts.push('balanced');
	}

	return {
		hcp, // the truth; the UI must not show this pre-bid
		range,
		midpoint: (range.low + Math.min(range.high, 22)) / 2,
		longSuits,
		balanced,
		text: parts.join(' · ')
	};
}

/** Partner's hand known exactly (after The Kibitzer ploy). */
export function describeExact(hand: Hand): PartnerInfo {
	const hcp = cards.hcp(hand);
	const counts = cards.shape(hand);
	return {
		hcp,
		range: { low: hcp, high: hcp, name: 'Exact', note: 'exact' },
		midpoint: hcp,
		longSuits: longSuitsOf(counts),
		lengths: counts,
		balanced: cards.isBalanced(hand),
		exact: true,
		hand: cards.copyHand(hand),
		text: cards.describeHand(hand)
	};
}

/**
 * Estimated tricks for a strain, from your hand plus what partner's bid says.
 * Fitted to what the declarer autopilot actually takes against the AI
 * defenders over thousands of deals (tools/simulate).
 */
export function estimateTricks(hand: Hand, partnerInfo: PartnerInfo, strain: number): number {
	const myHcp = cards.hcp(hand);
	const combined = myHcp + (partnerInfo.midpoint || 0);
	let tricks = 5.5 + (combined - 14) / 3.75;

	if (strain !== cards.NOTRUMP) {
		const mine = cards.countSuit(hand, strain);
		let theirs = partnerInfo.lengths ? partnerInfo.lengths[strain] : 3;
		for (const l of partnerInfo.longSuits) {
			if (l.suit === strain) theirs = l.length;
		}
		const fit = mine + theirs;
		if (fit >= 8) {
			tricks = tricks + 0.5 * (fit - 7);
			tricks = tricks + cards.shortnessPoints(hand) * 0.25;
		} else {
			// Playing a suit without a fit is a liability.
			tricks = tricks - (8 - fit) * 0.6;
		}
	} else {
		if (cards.isBalanced(hand)) tricks = tricks + 0.3;
		// Notrump wants stoppers; a void or singleton is a hole to run.
		const counts = cards.shape(hand);
		for (let suit = 1; suit <= 4; suit++) {
			if (counts[suit] <= 1 && !partnerInfo.balanced) tricks = tricks - 0.4;
		}
	}

	return Math.max(0, Math.min(13, tricks));
}

/** Suggest a contract, the way a partnership would land on one. */
export function suggest(hand: Hand, partnerInfo: PartnerInfo, vulnerable: boolean): Contract {
	let best: Contract | undefined;
	let bestValue: number | undefined;
	for (let strain = 1; strain <= 5; strain++) {
		const est = estimateTricks(hand, partnerInfo, strain);
		const level = Math.max(1, Math.min(7, Math.floor(est) - 6));
		const contract = { level, strain, doubled: 0 };
		let value = scoring.describeReward(contract, vulnerable);
		if (strain === cards.NOTRUMP || cards.SUITS[strain].major) value += 5;
		if (bestValue === undefined || value > bestValue) {
			best = contract;
			bestValue = value;
		}
	}
	return best ?? { level: 1, strain: cards.NOTRUMP, doubled: 0 };
}

// Spread of real results around the estimate, in tricks (measured in sim).
export const ESTIMATE_SIGMA = 1.35;

/** Standard normal CDF (Abramowitz-Stegun approximation; plenty for odds). */
function normalCdf(x: number): number {
	const sign = x < 0 ? -1 : 1;
	x = Math.abs(x) / Math.sqrt(2);
	const t = 1 / (1 + 0.3275911 * x);
	const y =
		1 -
		((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
			t *
			Math.exp(-x * x);
	return 0.5 * (1 + sign * y);
}

/** Chance of taking at least `needed` tricks given an estimate. */
export function chanceToMake(estimate: number, needed: number): number {
	return 1 - normalCdf((needed - 0.5 - estimate) / ESTIMATE_SIGMA);
}

/** The contract with the best expected score. Returns [contract, odds, ev]. */
export function bestByExpectedValue(
	hand: Hand,
	partnerInfo: PartnerInfo,
	vulnerable: boolean
): [Contract, number, number] {
	let best!: Contract;
	let bestEv: number | undefined;
	let bestP = 0;
	for (let strain = 1; strain <= 5; strain++) {
		const est = estimateTricks(hand, partnerInfo, strain);
		for (let level = 1; level <= 7; level++) {
			const contract = { level, strain, doubled: 0 };
			const p = chanceToMake(est, level + 6);
			const ev = p * scoring.describeReward(contract, vulnerable);
			if (bestEv === undefined || ev > bestEv) {
				best = contract;
				bestEv = ev;
				bestP = p;
			}
		}
	}
	return [best, bestP, bestEv!];
}

/** Would the defenders double this? They do it when the bid looks greedy. */
export function defendersDouble(
	contract: Contract,
	declarerHand: Hand,
	dummyHand: Hand,
	rng: RNG
): boolean {
	const combined = cards.hcp(declarerHand) + cards.hcp(dummyHand);
	const needed = 14 + 3 * (scoring.tricksNeeded(contract) - 6);
	const shortfall = needed - combined;
	if (shortfall <= 2) return false;
	const p = Math.min(0.85, 0.12 * shortfall);
	return rng.chance(p);
}
