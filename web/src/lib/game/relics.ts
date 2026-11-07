// Relics: the items you collect to turn a made contract into a big number.
// Port of src/game/relics.lua.
//
// Every relic is a real bridge idea -- a holding, a technique, a kind of
// hand -- so that reading your relics teaches you something about the game.
//
//   score(ctx, relic) -> { points, mult, xmult }   once when a deal is scored
//   onBoardWin(ctx, relic) -> { money }
//   onDealFail(ctx, relic) -> { money }
//   onDealEnd(ctx, relic)      scaling relics grow their `relic.state` here
//   describe(relic) -> string  live text for relics whose value changes

import * as cards from '../rules/cards.ts';
import * as scoring from '../rules/scoring.ts';
import type { Card, Contract, Hand } from '../rules/cards.ts';
import type { BridgeResult } from '../rules/scoring.ts';
import type { PlaySummary, Trick } from '../rules/play.ts';
import type { RNG } from '../rules/rng.ts';

export const RARITY = { COMMON: 1, UNCOMMON: 2, RARE: 3, LEGENDARY: 4 };
export const RARITY_NAME = ['', 'Common', 'Uncommon', 'Rare', 'Legendary'];

export interface ScoreCtx {
	contract: Contract;
	result: BridgeResult;
	tricksWon: number;
	made: boolean;
	vulnerable: boolean;
	hand: Hand;
	dummyHand: Hand;
	declarer: number;
	summary: PlaySummary;
	fit: number;
	state: { tricks: Trick[] };
	run: { boardsWonThisRubber: number } & Record<string, unknown>;
}

export interface EventCtx {
	made?: boolean;
	contract?: Contract;
	run: unknown;
}

export interface ScoreEffect {
	points?: number;
	mult?: number;
	xmult?: number;
}

export interface RelicState {
	points?: number;
	mult?: number;
	x?: number;
}

export interface Relic {
	key: string;
	def: RelicDef;
	name: string;
	cost: number;
	state: RelicState;
}

export interface RelicDef {
	key: string;
	name: string;
	rarity: number;
	cost: number;
	text: string;
	score?: (ctx: ScoreCtx, relic: Relic) => ScoreEffect | null;
	onBoardWin?: (ctx: EventCtx, relic: Relic) => { money?: number } | void;
	onDealFail?: (ctx: EventCtx, relic: Relic) => { money?: number } | void;
	onDealEnd?: (ctx: EventCtx, relic: Relic) => void;
	describe?: (relic: Relic) => string;
}

function countIf(hand: Hand, pred: (c: Card) => boolean): number {
	let n = 0;
	for (const c of hand) if (pred(c)) n++;
	return n;
}

/** All relic definitions, keyed for save files. */
export const DEFS: RelicDef[] = [
	// ---------------------------------------------------------------- common
	{
		key: 'honour_roll', name: 'Honour Roll', rarity: 1, cost: 4,
		text: '+12 points for each ten, jack, queen, king or ace in your hand',
		score: (ctx) => ({ points: 12 * countIf(ctx.hand, cards.isHonour) })
	},
	{
		key: 'ace_collector', name: 'Ace Collector', rarity: 1, cost: 5,
		text: '+45 points for each ace in your hand',
		score: (ctx) => ({ points: 45 * cards.countRank(ctx.hand, 14) })
	},
	{
		key: 'milton_work', name: 'Milton Work', rarity: 1, cost: 5,
		text: '+5 points for each high card point in your hand',
		score: (ctx) => ({ points: 5 * cards.hcp(ctx.hand) })
	},
	{
		key: 'the_ruffer', name: 'The Ruffer', rarity: 1, cost: 5,
		text: '+50 points for each trick you win with a trump when another suit was led',
		score: (ctx) => ({ points: 50 * ctx.summary.ruffs })
	},
	{
		key: 'dummy_reversal', name: 'Dummy Reversal', rarity: 1, cost: 5,
		text: '+35 points for each trick won in the dummy',
		score: (ctx) => ({ points: 35 * ctx.summary.tricksFromDummy })
	},
	{
		key: 'shape_shifter', name: 'Shape Shifter', rarity: 1, cost: 4,
		text: '+28 points for each card in your longest suit',
		score: (ctx) => ({ points: 28 * cards.longestSuit(ctx.hand)[1] })
	},
	{
		key: 'overtrick_artist', name: 'Overtrick Artist', rarity: 1, cost: 5,
		text: 'Each overtrick is worth +80 points',
		score: (ctx) => ({ points: 80 * (ctx.result.overtricks || 0) })
	},
	{
		key: 'safety_play', name: 'Safety Play', rarity: 1, cost: 5,
		text: '+180 points if you make your contract exactly',
		score: (ctx) => (ctx.made && ctx.result.overtricks === 0 ? { points: 180 } : null)
	},
	{
		key: 'the_squeeze', name: 'The Squeeze', rarity: 1, cost: 5,
		text: '+110 points if you win the last trick',
		score: (ctx) => (ctx.summary.wonLastTrick ? { points: 110 } : null)
	},
	{
		key: 'endplay', name: 'Endplay', rarity: 1, cost: 6,
		text: '+55 points for each of the last three tricks you win',
		score: (ctx) => ({ points: 55 * ctx.summary.lastThree })
	},

	// -------------------------------------------------------------- uncommon
	{
		key: 'nine_card_fit', name: 'Nine-Card Fit', rarity: 2, cost: 7,
		text: 'x1.5 if you and dummy hold nine or more trumps between you',
		score: (ctx) =>
			ctx.contract.strain !== cards.NOTRUMP && ctx.fit >= 9 ? { xmult: 1.5 } : null
	},
	{
		key: 'the_void', name: 'The Void', rarity: 2, cost: 7,
		text: 'x2 if you were dealt a void',
		score: (ctx) => {
			const counts = cards.shape(ctx.hand);
			for (let suit = 1; suit <= 4; suit++) if (counts[suit] === 0) return { xmult: 2 };
			return null;
		}
	},
	{
		key: 'singleton', name: 'Singleton', rarity: 2, cost: 6,
		text: '+90 points for each singleton in your hand',
		score: (ctx) => {
			const counts = cards.shape(ctx.hand);
			let n = 0;
			for (let suit = 1; suit <= 4; suit++) if (counts[suit] === 1) n++;
			return { points: 90 * n };
		}
	},
	{
		key: 'flat_hand', name: 'Flat Hand', rarity: 2, cost: 6,
		text: 'x2 if your hand is balanced',
		score: (ctx) => (cards.isBalanced(ctx.hand) ? { xmult: 2 } : null)
	},
	{
		key: 'minor_nobility', name: 'Minor Nobility', rarity: 2, cost: 6,
		text: 'Clubs and diamonds score as though they were major suits',
		score: (ctx) => {
			const s = ctx.contract.strain;
			if (ctx.made && (s === cards.CLUBS || s === cards.DIAMONDS)) {
				// Lift 20-a-trick up to 30-a-trick, doubling included.
				return { points: 10 * ctx.contract.level * 2 ** (ctx.contract.doubled || 0) };
			}
			return null;
		}
	},
	{
		key: 'purist', name: 'The Purist', rarity: 2, cost: 6,
		text: '+140 points on notrump contracts',
		score: (ctx) => (ctx.contract.strain === cards.NOTRUMP ? { points: 140 } : null)
	},
	{
		key: 'vulnerable', name: 'Vulnerable', rarity: 2, cost: 7,
		text: 'x2 while you are vulnerable',
		score: (ctx) => (ctx.vulnerable ? { xmult: 2 } : null)
	},
	{
		key: 'partners_trust', name: "Partner's Trust", rarity: 2, cost: 6,
		text: 'x1.6 if dummy came down with 12 or more points',
		score: (ctx) => (cards.hcp(ctx.dummyHand) >= 12 ? { xmult: 1.6 } : null)
	},
	{
		key: 'underdog', name: 'Underdog', rarity: 2, cost: 7,
		text: 'x2.5 if dummy came down with 5 points or fewer',
		score: (ctx) => (cards.hcp(ctx.dummyHand) <= 5 ? { xmult: 2.5 } : null)
	},
	{
		key: 'bold_bidding', name: 'Bold Bidding', rarity: 2, cost: 7,
		text: '+150 points for each level you bid above three',
		score: (ctx) => ({ points: 150 * Math.max(0, ctx.contract.level - 3) })
	},
	{
		key: 'crossruff', name: 'Crossruff', rarity: 2, cost: 6,
		text: '+45 points for each trick you win with a trump',
		score: (ctx) => {
			const trump = ctx.contract.strain;
			if (trump === cards.NOTRUMP) return null;
			let n = 0;
			for (const t of ctx.state.tricks) {
				if (cards.sameSide(t.winner, ctx.declarer) && t.winningCard.suit === trump) n++;
			}
			return { points: 45 * n };
		}
	},
	{
		key: 'rubber_baron', name: 'Rubber Baron', rarity: 2, cost: 6,
		text: 'Earn $4 extra each time you win a board',
		onBoardWin: () => ({ money: 4 })
	},
	{
		key: 'insurance', name: 'Insurance', rarity: 2, cost: 5,
		text: 'Earn $4 whenever a contract of yours fails',
		onDealFail: () => ({ money: 4 })
	},

	// ------------------------------------------------------------------ rare
	{
		key: 'the_finesse', name: 'The Finesse', rarity: 3, cost: 8,
		text: '+70 points for each trick you win with a queen or a jack',
		score: (ctx) => {
			let n = 0;
			for (const t of ctx.state.tricks) {
				if (
					cards.sameSide(t.winner, ctx.declarer) &&
					(t.winningCard.rank === 12 || t.winningCard.rank === 11)
				)
					n++;
			}
			return { points: 70 * n };
		}
	},
	{
		key: 'grand_design', name: 'Grand Design', rarity: 3, cost: 9,
		text: 'x2 on a small slam, x3 on a grand slam',
		score: (ctx) => {
			if (ctx.contract.level === 7) return { xmult: 3 };
			if (ctx.contract.level === 6) return { xmult: 2 };
			return null;
		}
	},
	{
		key: 'doubled_down', name: 'Doubled Down', rarity: 3, cost: 9,
		text: 'x3 if the defenders doubled you',
		score: (ctx) => ((ctx.contract.doubled || 0) > 0 ? { xmult: 3 } : null)
	},
	{
		key: 'slam_dunk', name: 'Slam Dunk', rarity: 3, cost: 9,
		text: 'A small slam pays the grand slam bonus',
		score: (ctx) => {
			if (ctx.made && ctx.contract.level === 6) {
				const v = ctx.vulnerable;
				return { points: scoring.GRAND_SLAM_BONUS(v) - scoring.SMALL_SLAM_BONUS(v) };
			}
			return null;
		}
	},
	{
		key: 'trump_coup', name: 'Trump Coup', rarity: 3, cost: 8,
		text: 'x1.25 for each trick you win beyond your contract',
		score: (ctx) => {
			const over = ctx.result.overtricks || 0;
			return over > 0 ? { xmult: 1.25 ** over } : null;
		}
	},

	// --------------------------------------------------------------- scaling
	{
		key: 'club_regular', name: 'Club Regular', rarity: 1, cost: 5,
		text: 'Gains +25 points every time you make a contract',
		describe: (relic) =>
			`Gains +25 points every time you make a contract (now +${relic.state.points || 0})`,
		onDealEnd: (ctx, relic) => {
			if (ctx.made) relic.state.points = (relic.state.points || 0) + 25;
		},
		score: (_ctx, relic) => {
			const p = relic.state.points || 0;
			return p > 0 ? { points: p } : null;
		}
	},
	{
		key: 'master_points', name: 'Master Points', rarity: 2, cost: 7,
		text: 'Gains +0.2 mult every time you make a game or better',
		describe: (relic) =>
			`Gains +0.2 mult every time you make a game or better (now +${(relic.state.mult || 0).toFixed(1)})`,
		onDealEnd: (ctx, relic) => {
			if (ctx.made && scoring.isGame(ctx.contract!)) {
				relic.state.mult = (relic.state.mult || 0) + 0.2;
			}
		},
		score: (_ctx, relic) => {
			const m = relic.state.mult || 0;
			return m > 0 ? { mult: m } : null;
		}
	},
	{
		key: 'life_master', name: 'Life Master', rarity: 3, cost: 10,
		text: 'Gains x0.15 every board you win',
		describe: (relic) =>
			`Gains x0.15 every board you win (now x${(1 + (relic.state.x || 0)).toFixed(2)})`,
		onBoardWin: (_ctx, relic) => {
			relic.state.x = (relic.state.x || 0) + 0.15;
		},
		score: (_ctx, relic) => {
			const x = relic.state.x || 0;
			return x > 0 ? { xmult: 1 + x } : null;
		}
	},
	{
		key: 'slam_hunter', name: 'Slam Hunter', rarity: 3, cost: 9,
		text: 'Gains x0.5 every time you make a slam',
		describe: (relic) =>
			`Gains x0.5 every time you make a slam (now x${(1 + (relic.state.x || 0)).toFixed(1)})`,
		onDealEnd: (ctx, relic) => {
			if (ctx.made && ctx.contract!.level >= 6) relic.state.x = (relic.state.x || 0) + 0.5;
		},
		score: (_ctx, relic) => {
			const x = relic.state.x || 0;
			return x > 0 ? { xmult: 1 + x } : null;
		}
	},

	// ------------------------------------------------------------- legendary
	{
		key: 'clean_sweep', name: 'Clean Sweep', rarity: 4, cost: 12,
		text: 'x5 if you win all thirteen tricks',
		score: (ctx) => (ctx.tricksWon >= 13 ? { xmult: 5 } : null)
	},
	{
		key: 'the_rubber', name: 'The Rubber', rarity: 4, cost: 12,
		text: 'x1.3, and x1.3 again for every board already won this rubber',
		score: (ctx) => {
			const n = 1 + (ctx.run ? ctx.run.boardsWonThisRubber || 0 : 0);
			return { xmult: 1.3 ** n };
		}
	},
	{
		key: 'vienna_coup', name: 'Vienna Coup', rarity: 4, cost: 13,
		text: 'x1.1 for each high card point in your hand above ten',
		score: (ctx) => {
			const extra = Math.max(0, cards.hcp(ctx.hand) - 10);
			return extra > 0 ? { xmult: 1.1 ** extra } : null;
		}
	}
];

export const BY_KEY: Record<string, RelicDef> = {};
for (const d of DEFS) BY_KEY[d.key] = d;

export function get(key: string): RelicDef | undefined {
	return BY_KEY[key];
}

/** Weighted rarity roll for shop stock. */
export function randomDef(rng: RNG, rarityWeights?: number[]): RelicDef {
	rarityWeights = rarityWeights ?? [0.62, 0.28, 0.085, 0.015];
	const roll = rng.next();
	let acc = 0,
		rarity = 1;
	for (let r = 1; r <= 4; r++) {
		acc = acc + rarityWeights[r - 1];
		if (roll <= acc) {
			rarity = r;
			break;
		}
	}
	let pool = DEFS.filter((d) => d.rarity === rarity);
	if (pool.length === 0) pool = DEFS;
	return rng.pick(pool)!;
}

/** Pick a definition not already owned, so the shop does not offer duplicates. */
export function randomUnowned(
	rng: RNG,
	owned: { key: string }[],
	rarityWeights?: number[]
): RelicDef | undefined {
	const ownedKeys = new Set(owned.map((o) => o.key));
	for (let i = 0; i < 40; i++) {
		const def = randomDef(rng, rarityWeights);
		if (!ownedKeys.has(def.key)) return def;
	}
	return DEFS.find((d) => !ownedKeys.has(d.key));
}

/** Create an owned instance of a relic. */
export function instantiate(def: RelicDef): Relic {
	return { key: def.key, def, name: def.name, cost: def.cost, state: {} };
}

/** Current text for an owned relic (scaling relics report their value). */
export function textFor(relic: Relic): string {
	if (relic.def.describe) return relic.def.describe(relic);
	return relic.def.text;
}
