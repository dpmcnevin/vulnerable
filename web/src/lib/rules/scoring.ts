// Duplicate bridge contract scoring. Port of src/rules/scoring.lua.
//
// These are the real rules, not an approximation, because the whole risk
// structure of the game rests on them: the jump from a part-score to a game
// bonus, and from a game to a slam, is what makes bidding high worth it.
//
// `level` is odd tricks: the contract needs level + 6 of the 13 tricks.

import { NOTRUMP, SUITS, type Contract } from './cards.ts';

export const PART_SCORE_BONUS = 50;
const vulTable = (nv: number, v: number) => (vul: boolean) => (vul ? v : nv);
export const GAME_BONUS = vulTable(300, 500);
export const SMALL_SLAM_BONUS = vulTable(500, 750);
export const GRAND_SLAM_BONUS = vulTable(1000, 1500);
export const INSULT_BONUS = [0, 50, 100];

export interface ScoreLine {
	label: string;
	amount: number;
}

export interface BridgeResult {
	contract: Contract;
	tricksWon: number;
	tricksNeeded: number;
	made: boolean;
	vulnerable: boolean;
	overtricks: number;
	undertricks: number;
	contractPoints: number;
	bonusPoints: number;
	lines: ScoreLine[];
	total: number;
}

/** Tricks needed to make a contract: six plus the level bid. */
export function tricksNeeded(contract: Contract): number {
	return contract.level + 6;
}

/** Points per odd trick for a strain, excluding notrump's higher first trick. */
export function trickValue(strain: number): number {
	if (strain === NOTRUMP) return 30;
	return SUITS[strain].major ? 30 : 20;
}

/** Contract points: the part that decides part-score vs. game. */
export function contractPoints(contract: Contract): number {
	let base: number;
	if (contract.strain === NOTRUMP) {
		base = 40 + 30 * (contract.level - 1);
	} else {
		base = trickValue(contract.strain) * contract.level;
	}
	return base * 2 ** (contract.doubled || 0);
}

/** Is this contract worth game if made? */
export function isGame(contract: Contract): boolean {
	return contractPoints(contract) >= 100;
}

/** Value of each overtrick, which doubling inflates enormously. */
export function overtrickValue(contract: Contract, vulnerable: boolean): number {
	const d = contract.doubled || 0;
	if (d === 0) {
		if (contract.strain === NOTRUMP) return 30;
		return trickValue(contract.strain);
	}
	const base = vulnerable ? 200 : 100;
	return base * d;
}

/** Total penalty for going down `n` tricks. Escalates, and doubling bites. */
export function undertrickPenalty(contract: Contract, n: number, vulnerable: boolean): number {
	if (n <= 0) return 0;
	const d = contract.doubled || 0;
	let total: number;
	if (d === 0) {
		total = (vulnerable ? 100 : 50) * n;
	} else if (vulnerable) {
		// 200 for the first, 300 for each one after.
		total = 200 + 300 * (n - 1);
	} else {
		// 100, then 200 for the second and third, then 300 each.
		total = 100;
		if (n >= 2) total += 200 * Math.min(n - 1, 2);
		if (n >= 4) total += 300 * (n - 3);
	}
	if (d === 2) total *= 2;
	return total;
}

/**
 * Score a finished deal. Returns the final `total` (negative when the
 * contract fails) and an itemised `lines` list for the UI.
 */
export function score(contract: Contract, tricksWon: number, vulnerable: boolean): BridgeResult {
	vulnerable = !!vulnerable;
	const needed = tricksNeeded(contract);
	const made = tricksWon >= needed;
	const result: BridgeResult = {
		contract,
		tricksWon,
		tricksNeeded: needed,
		made,
		vulnerable,
		overtricks: 0,
		undertricks: 0,
		contractPoints: 0,
		bonusPoints: 0,
		lines: [],
		total: 0
	};
	const add = (label: string, amount: number) => result.lines.push({ label, amount });

	if (!made) {
		result.undertricks = needed - tricksWon;
		const penalty = undertrickPenalty(contract, result.undertricks, vulnerable);
		add(`Down ${result.undertricks}`, -penalty);
		result.total = -penalty;
		return result;
	}

	const cp = contractPoints(contract);
	result.contractPoints = cp;
	add('Contract made', cp);

	result.overtricks = tricksWon - needed;
	if (result.overtricks > 0) {
		const each = overtrickValue(contract, vulnerable);
		add(`Overtricks x${result.overtricks}`, each * result.overtricks);
	}

	let bonus = 0;
	if (cp >= 100) {
		const g = GAME_BONUS(vulnerable);
		add(vulnerable ? 'Game (vulnerable)' : 'Game', g);
		bonus += g;
	} else {
		add('Part-score', PART_SCORE_BONUS);
		bonus += PART_SCORE_BONUS;
	}

	if (contract.level === 6) {
		const s = SMALL_SLAM_BONUS(vulnerable);
		add('Small slam', s);
		bonus += s;
	} else if (contract.level === 7) {
		const s = GRAND_SLAM_BONUS(vulnerable);
		add('Grand slam', s);
		bonus += s;
	}

	const insult = INSULT_BONUS[contract.doubled || 0] ?? 0;
	if (insult > 0) {
		add(contract.doubled === 2 ? 'Redoubled made' : 'Doubled made', insult);
		bonus += insult;
	}

	result.bonusPoints = bonus;
	const overtrickTotal = result.overtricks * overtrickValue(contract, vulnerable);
	result.total = cp + overtrickTotal + bonus;
	return result;
}

/** Every legal contract, cheapest first. Used by the bid selector. */
export function allContracts(): Contract[] {
	const out: Contract[] = [];
	for (let level = 1; level <= 7; level++) {
		for (let strain = 1; strain <= 5; strain++) out.push({ level, strain, doubled: 0 });
	}
	return out;
}

/** What making this contract exactly would be worth. Used for UI hints. */
export function describeReward(contract: Contract, vulnerable: boolean): number {
	return score(contract, tricksNeeded(contract), vulnerable).total;
}
