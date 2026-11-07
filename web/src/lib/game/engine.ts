// Run engine: rubbers, boards, deals, scoring and the shop.
// Port of src/game/engine.lua.
//
// Pure logic with no UI dependency, so the same code drives both the
// playable game and the headless balance simulator.
//
//   8 rubbers, 3 boards each. A board sets a target; you have a small number
//   of deals to reach it. Each deal you bid a contract and play it out.
//   Making the contract scores; going down scores nothing.
//
// Lua's 1-based slot indices (shop items, relics, ploys) are 0-based here.

import * as cards from '../rules/cards.ts';
import * as scoring from '../rules/scoring.ts';
import * as play from '../rules/play.ts';
import * as ai from '../rules/ai.ts';
import * as bidding from '../rules/bidding.ts';
import * as rngLib from '../rules/rng.ts';
import * as relics from './relics.ts';
import * as conventions from './conventions.ts';
import * as ploys from './ploys.ts';
import type { Card, Contract, Hands } from '../rules/cards.ts';
import type { BridgeResult } from '../rules/scoring.ts';
import type { PlayState, PlaySummary, Trick } from '../rules/play.ts';
import type { PartnerInfo } from '../rules/bidding.ts';
import type { RNG } from '../rules/rng.ts';
import type { Relic, RelicDef, ScoreCtx } from './relics.ts';
import type { ConventionDef } from './conventions.ts';
import type { Ploy, PloyDef } from './ploys.ts';

export const RUBBERS = 8;
export const BOARDS_PER_RUBBER = 3;
export const DEALS_PER_BOARD = 3;
export const RELIC_SLOTS = 5;
export const PLOY_SLOTS = ploys.SLOTS;
export const SHOP_SIZE = 4;
export const BASE_REROLL_COST = 5;
export const STARTING_MONEY = 6;
export const INTEREST_PER = 5;
export const MAX_INTEREST = 5;
export const MONEY_PER_BOARD = 4;
export const MONEY_PER_UNUSED_DEAL = 1;

// Target for the first board of each rubber, fitted by tools/simulate.
export const RUBBER_BASE = [200, 420, 650, 920, 1260, 1680, 2200, 2700];
// Multipliers for board 1, 2 and the vulnerable board 3 within a rubber.
export const BOARD_SCALE = [1.0, 1.3, 1.65];

export const PHASE = {
	BID: 'bid',
	PLAY: 'play',
	DEAL_SCORED: 'deal_scored',
	BOARD_WON: 'board_won',
	SHOP: 'shop',
	GAME_OVER: 'game_over',
	VICTORY: 'victory'
} as const;
export type Phase = (typeof PHASE)[keyof typeof PHASE];

export interface BreakdownLine {
	label: string;
	points?: number;
	mult?: number;
	xmult?: number;
}

export interface Breakdown {
	base: number;
	made: boolean;
	lines: BreakdownLine[];
	points: number;
	mult: number;
	total: number;
	bridge: BridgeResult;
	refunded?: boolean;
}

export interface Deal {
	hands: Hands;
	original: Hands;
	declarer: number;
	dummy: number;
	partnerInfo: PartnerInfo;
	version: number;
	cameFrom: Map<Card, number>;
	wentTo: Map<Card, number>;
	dummyVisible: boolean;
	contract: Contract | null;
	state: PlayState | null;
	result: Breakdown | null;
	// Ploy flags.
	kibitzed?: boolean;
	seeDefenders?: boolean;
	declarerLeads?: boolean;
	noDouble?: boolean;
	carelessDefense?: boolean;
	phantom?: number;
	safetyNet?: boolean;
}

export type ShopItem =
	| { kind: 'relic'; def: RelicDef; name: string; cost: number; sold?: boolean }
	| { kind: 'ploy'; def: PloyDef; name: string; cost: number; sold?: boolean }
	| { kind: 'convention'; def: ConventionDef; name: string; cost: number; sold?: boolean };

export interface PadEntry {
	points: number;
	contract?: Contract;
	label?: string;
}
export interface PadGame {
	we: PadEntry[];
	they: PadEntry[];
	won?: 'we' | 'they';
}
export interface Scorepad {
	rubber: number;
	above: { we: PadEntry[]; they: PadEntry[] };
	games: PadGame[];
	gamesWon: number;
}

export interface Payout {
	board: number;
	unused: number;
	interest: number;
	relics: number;
	total: number;
	gift?: PloyDef | null;
}

export interface LogEntry {
	rubber: number;
	board: number;
	contract: string;
	tricks: number;
	needed: number;
	made: boolean;
	score: number;
}

export interface Stats {
	dealsPlayed: number;
	contractsMade: number;
	contractsFailed: number;
	slamsMade: number;
	bestDeal: number;
	totalScore: number;
	doubledMade: number;
	ploysUsed: number;
}

export interface Run {
	seed: string | number;
	rng: RNG;
	rubber: number;
	board: number;
	boardsWonThisRubber: number;
	money: number;
	relics: Relic[];
	ploys: Ploy[];
	lastPloy: string | null;
	/** Indexed by strain id; slot 0 unused. */
	strainLevels: number[];
	score: number;
	target: number;
	dealsLeft: number;
	vulnerable: boolean;
	phase: Phase;
	deal: Deal;
	shop: { items: ShopItem[] } | null;
	rerollCost: number;
	aiSkill: number;
	log: LogEntry[];
	stats: Stats;
	pad?: Scorepad;
	lastPayout?: Payout;
}

export interface RunOptions {
	money?: number;
	aiSkill?: number;
}

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

// --------------------------------------------------------------------- helpers

function round10(n: number): number {
	if (n < 100) return Math.floor(n / 5 + 0.5) * 5;
	const mag = 10 ** Math.max(1, Math.floor(Math.log10(n)) - 1);
	return Math.floor(n / mag + 0.5) * mag;
}

/** Target score for a given rubber and board. */
export function targetFor(rubber: number, board: number): number {
	let base = RUBBER_BASE[Math.min(rubber, RUBBER_BASE.length) - 1];
	if (rubber > RUBBER_BASE.length) {
		// Endless: keep climbing past the designed run.
		base = base * 1.75 ** (rubber - RUBBER_BASE.length);
	}
	return round10(base * BOARD_SCALE[board - 1]);
}

/** Vulnerability: the last board of every rubber, and everything from five on. */
export function isVulnerable(rubber: number, board: number): boolean {
	return board === BOARDS_PER_RUBBER || rubber >= 5;
}

// --------------------------------------------------------------------- new run

export function newRun(seed?: string | number, opts: RunOptions = {}): Run {
	seed = seed ?? rngLib.randomSeedString(rngLib.newRng());
	const run = {
		seed,
		rng: rngLib.newRng(seed),
		rubber: 1,
		board: 1,
		boardsWonThisRubber: 0,
		money: opts.money ?? STARTING_MONEY,
		relics: [],
		ploys: [],
		lastPloy: null,
		strainLevels: [0, 1, 1, 1, 1, 1],
		score: 0,
		target: 0,
		dealsLeft: 0,
		vulnerable: false,
		phase: PHASE.BID,
		deal: null as unknown as Deal,
		shop: null,
		rerollCost: BASE_REROLL_COST,
		aiSkill: opts.aiSkill ?? ai.DEFAULT_SKILL,
		log: [],
		stats: {
			dealsPlayed: 0, contractsMade: 0, contractsFailed: 0,
			slamsMade: 0, bestDeal: 0, totalScore: 0, doubledMade: 0, ploysUsed: 0
		}
	} as Run;
	startBoard(run);
	return run;
}

// --------------------------------------------------------------------- board

export function startBoard(run: Run) {
	run.target = targetFor(run.rubber, run.board);
	run.vulnerable = isVulnerable(run.rubber, run.board);
	run.score = 0;
	run.dealsLeft = DEALS_PER_BOARD;
	startDeal(run);
}

export function boardName(run: Run): string {
	if (run.board === BOARDS_PER_RUBBER) return 'Vulnerable Board';
	return `Board ${run.board}`;
}

// --------------------------------------------------------------------- deal

/** Deal the cards and ask for a bid. */
export function startDeal(run: Run): Deal {
	const hands = cards.deal(run.rng);
	const declarer = cards.SOUTH,
		dummy = cards.NORTH;
	// You always declare, so make sure you are the stronger partnership.
	const ns = cards.hcp(hands[cards.NORTH]) + cards.hcp(hands[cards.SOUTH]);
	if (ns < 20) {
		[hands[cards.NORTH], hands[cards.EAST]] = [hands[cards.EAST], hands[cards.NORTH]];
		[hands[cards.SOUTH], hands[cards.WEST]] = [hands[cards.WEST], hands[cards.SOUTH]];
	}
	// And you, not dummy, hold the stronger of the two hands.
	if (cards.hcp(hands[dummy]) > cards.hcp(hands[declarer])) {
		[hands[dummy], hands[declarer]] = [hands[declarer], hands[dummy]];
	}
	run.deal = {
		hands,
		original: [[], ...[1, 2, 3, 4].map((s) => cards.copyHand(hands[s]))],
		declarer,
		dummy,
		partnerInfo: bidding.describePartner(hands[dummy]),
		version: 0,
		cameFrom: new Map(),
		wentTo: new Map(),
		dummyVisible: false,
		contract: null,
		state: null,
		result: null
	};
	run.phase = PHASE.BID;
	return run.deal;
}

/** Contracts the player may choose. Everything is legal; the risk is yours. */
export function availableContracts(): Contract[] {
	return scoring.allContracts();
}

/** Lock in a contract. The defenders may double it, then play begins. */
export function commitBid(run: Run, contract: Contract, opts?: { stepwise?: boolean }): Contract {
	assert(run.phase === PHASE.BID, 'commitBid: not bidding');
	const deal = run.deal;
	const c: Contract = { level: contract.level, strain: contract.strain, doubled: 0 };

	if (
		!deal.noDouble &&
		bidding.defendersDouble(c, deal.hands[deal.declarer], deal.hands[deal.dummy], run.rng)
	) {
		c.doubled = 1;
	}

	deal.contract = c;
	// The opening lead comes from the defender on declarer's left.
	const leader = deal.declarerLeads ? deal.declarer : cards.nextSeat(deal.declarer);
	deal.state = play.newPlay(deal.hands, c.strain, leader);
	deal.dummyVisible = false;
	run.phase = PHASE.PLAY;
	// The UI passes { stepwise: true } and calls stepAI itself.
	if (!opts?.stepwise) advanceAI(run);
	return c;
}

/** Is it the player's turn? The player holds both declarer and dummy. */
export function isPlayerTurn(run: Run): boolean {
	const deal = run.deal;
	if (!deal || !deal.state || deal.state.complete) return false;
	return cards.sameSide(deal.state.turn, deal.declarer);
}

function aiContext(run: Run): ai.AIContext {
	const deal = run.deal;
	return {
		declarer: deal.declarer,
		dummy: deal.dummy,
		dummyVisible: deal.dummyVisible,
		rng: run.rng,
		// Table Talk leaves the defenders playing carelessly.
		skill: deal.carelessDefense ? 0.45 : run.aiSkill
	};
}

/** Let the AI defenders play until it is the player's turn or the deal ends. */
export function advanceAI(run: Run): Trick[] {
	const deal = run.deal;
	const completed: Trick[] = [];
	let guard = 0;
	while (deal.state && !deal.state.complete && !isPlayerTurn(run)) {
		guard++;
		assert(guard < 100, 'advanceAI: stuck');
		const seat = deal.state.turn;
		const card = ai.chooseCard(deal.state, seat, aiContext(run));
		const trick = play.play(deal.state, seat, card);
		// Dummy goes face up once the opening lead is made.
		deal.dummyVisible = true;
		if (trick) completed.push(trick);
	}
	if (deal.state && deal.state.complete) finishDeal(run);
	return completed;
}

/** Play one card from the declarer's or dummy's hand. */
export function playerPlay(run: Run, card: Card, opts?: { stepwise?: boolean }): Trick[] {
	assert(run.phase === PHASE.PLAY, 'playerPlay: not in play');
	const deal = run.deal;
	const state = deal.state!;
	const seat = state.turn;
	assert(cards.sameSide(seat, deal.declarer), 'playerPlay: not your seat');
	assert(play.isLegal(state, seat, card), 'playerPlay: illegal card');
	const trick = play.play(state, seat, card);
	deal.dummyVisible = true;
	if (opts?.stepwise) {
		if (state.complete) finishDeal(run);
		return trick ? [trick] : [];
	}
	const more = advanceAI(run);
	if (trick) more.unshift(trick);
	return more;
}

/** Play exactly one defender card. Returns the completed trick (if any), seat and card. */
export function stepAI(run: Run): { trick: Trick | null; seat: number; card: Card } | null {
	const deal = run.deal;
	if (run.phase !== PHASE.PLAY || !deal.state || deal.state.complete) return null;
	if (isPlayerTurn(run)) return null;
	const seat = deal.state.turn;
	const card = ai.chooseCard(deal.state, seat, aiContext(run));
	const trick = play.play(deal.state, seat, card);
	deal.dummyVisible = true;
	if (deal.state.complete) finishDeal(run);
	return { trick, seat, card };
}

/** Hand the rest of the deal to the autopilot. */
export function playOut(run: Run) {
	const deal = run.deal;
	ai.playOut(deal.state!, aiContext(run));
	deal.dummyVisible = true;
	finishDeal(run);
}

// --------------------------------------------------------------------- scoring

/** The relic pipeline, shared by real scoring and the bid-screen preview. */
function scorePipeline(
	run: Run,
	deal: Deal,
	contract: Contract,
	tricksWon: number,
	summary: PlaySummary,
	state: { tricks: Trick[] }
): Breakdown {
	const result = scoring.score(contract, tricksWon, run.vulnerable);
	const breakdown: Breakdown = {
		base: result.total,
		made: result.made,
		lines: [],
		points: 0,
		mult: 1,
		total: 0,
		bridge: result
	};
	if (!result.made) return breakdown;

	const fit =
		cards.countSuit(deal.original[deal.declarer], contract.strain) +
		cards.countSuit(deal.original[deal.dummy], contract.strain);
	const ctx: ScoreCtx = {
		contract,
		result,
		tricksWon,
		made: result.made,
		vulnerable: run.vulnerable,
		hand: deal.original[deal.declarer],
		dummyHand: deal.original[deal.dummy],
		declarer: deal.declarer,
		summary,
		fit,
		state,
		run: run as unknown as ScoreCtx['run']
	};

	let points = result.total,
		mult = 1;
	breakdown.lines.push({ label: cards.contractName(contract) + ' scored', points: result.total });

	const level = run.strainLevels[contract.strain];
	const [cp, cm] = conventions.bonusFor(level);
	if (cp > 0 || cm > 0) {
		points += cp;
		mult += cm;
		breakdown.lines.push({
			label: `${cards.STRAINS[contract.strain].name} level ${level}`,
			points: cp,
			mult: cm
		});
	}

	for (const relic of run.relics) {
		if (relic.def.score) {
			const r = relic.def.score(ctx, relic);
			if (r && (r.points !== undefined || r.mult !== undefined || r.xmult !== undefined)) {
				if (r.points !== undefined) points += r.points;
				if (r.mult !== undefined) mult += r.mult;
				if (r.xmult !== undefined) mult *= r.xmult;
				breakdown.lines.push({ label: relic.name, points: r.points, mult: r.mult, xmult: r.xmult });
			}
		}
	}

	breakdown.points = points;
	breakdown.mult = mult;
	breakdown.total = Math.floor(points * mult);
	return breakdown;
}

/** Score a finished deal. */
export function computeScore(run: Run, deal: Deal): Breakdown {
	const state = deal.state!;
	// Phantom Trick ploys add tricks that were never played.
	const tricksWon = Math.min(13, play.declarerTricks(state, deal.declarer) + (deal.phantom || 0));
	const summary = play.summarise(state, deal.declarer);
	return scorePipeline(run, deal, deal.contract!, tricksWon, summary, state);
}

const EMPTY_SUMMARY: PlaySummary = {
	declarerTricks: 0, ruffs: 0, tricksFromDummy: 0, tricksFromDeclarer: 0,
	honourWins: 0, wonLastTrick: false, wonFirstTrick: false, lastThree: 0
};
const EMPTY_STATE = { tricks: [] as Trick[] };

/**
 * What a contract would score if made exactly, undoubled, with nothing
 * earned during play: a floor the player can rely on when choosing a bid.
 */
export function projectScore(run: Run, contract: Contract): [number, Breakdown] {
	const c = { level: contract.level, strain: contract.strain, doubled: 0 };
	const b = scorePipeline(run, run.deal, c, scoring.tricksNeeded(c), EMPTY_SUMMARY, EMPTY_STATE);
	return [b.total, b];
}

export interface BidOption {
	contract: Contract;
	chance: number;
	projected: number;
}

/** Odds and projected score for every contract, for the bid screen. */
export function bidOptions(run: Run): BidOption[] {
	const deal = run.deal;
	const hand = deal.hands[deal.declarer];
	return scoring.allContracts().map((c) => {
		const est = bidding.estimateTricks(hand, deal.partnerInfo, c.strain);
		return {
			contract: c,
			chance: bidding.chanceToMake(est, scoring.tricksNeeded(c)),
			projected: projectScore(run, c)[0]
		};
	});
}

/**
 * The contract a careful player would choose: on the last deal, the safest
 * one that clears the board alone; earlier, the best balance of odds against
 * how much of the remaining target it covers.
 */
export function recommendBid(run: Run, options?: BidOption[]): Contract {
	const need = Math.max(1, run.target - run.score);
	options = options ?? bidOptions(run);
	let best: BidOption | undefined;
	let bestValue: number | undefined;
	if (run.dealsLeft <= 1) {
		for (const o of options) {
			if (o.projected >= need && (bestValue === undefined || o.chance > bestValue)) {
				best = o;
				bestValue = o.chance;
			}
		}
		if (best) return best.contract;
	}
	for (const o of options) {
		const value = o.chance * Math.min(o.projected, need) + 0.05 * o.chance * o.projected;
		if (bestValue === undefined || value > bestValue) {
			best = o;
			bestValue = value;
		}
	}
	return best!.contract;
}

// --------------------------------------------------------------------- scorepad

/** A rubber-bridge scorepad for the current rubber, from the bridge scores alone. */
export function scorepad(run: Run): Scorepad {
	if (!run.pad || run.pad.rubber !== run.rubber) {
		run.pad = {
			rubber: run.rubber,
			above: { we: [], they: [] },
			games: [{ we: [], they: [] }],
			gamesWon: 0
		};
	}
	return run.pad;
}

export function padSum(list: PadEntry[]): number {
	let t = 0;
	for (const e of list) t += e.points;
	return t;
}

/** Record one finished deal on the scorepad. */
export function recordOnPad(run: Run, contract: Contract, bridge: BridgeResult) {
	const pad = scorepad(run);
	if (bridge.made) {
		const game = pad.games[pad.games.length - 1];
		game.we.push({ points: bridge.contractPoints, contract });
		for (let i = 1; i < bridge.lines.length; i++) {
			const l = bridge.lines[i];
			pad.above.we.push({ points: l.amount, label: l.label });
		}
		if (padSum(game.we) >= 100) {
			game.won = 'we';
			pad.gamesWon++;
			pad.games.push({ we: [], they: [] });
		}
	} else {
		pad.above.they.push({ points: -bridge.total, contract, label: 'down ' + bridge.undertricks });
	}
}

/** Totals for each side: everything above plus everything below the line. */
export function padTotals(pad: Scorepad): [number, number] {
	let we = padSum(pad.above.we),
		they = padSum(pad.above.they);
	for (const g of pad.games) {
		we += padSum(g.we);
		they += padSum(g.they);
	}
	return [we, they];
}

/** Resolve a completed deal: score it, bank it, and decide what happens next. */
export function finishDeal(run: Run): Breakdown {
	const deal = run.deal;
	if (deal.result) return deal.result;

	const breakdown = computeScore(run, deal);
	deal.result = breakdown;
	recordOnPad(run, deal.contract!, breakdown.bridge);
	run.dealsLeft--;
	if (!breakdown.made && deal.safetyNet) {
		run.dealsLeft++;
		breakdown.refunded = true;
	}
	run.score += breakdown.total;

	run.stats.dealsPlayed++;
	run.stats.totalScore += breakdown.total;
	if (breakdown.total > run.stats.bestDeal) run.stats.bestDeal = breakdown.total;

	if (breakdown.made) {
		run.stats.contractsMade++;
		if (deal.contract!.level >= 6) run.stats.slamsMade++;
		if ((deal.contract!.doubled || 0) > 0) run.stats.doubledMade++;
	} else {
		run.stats.contractsFailed++;
		for (const r of run.relics) {
			if (r.def.onDealFail) {
				const out = r.def.onDealFail({ run }, r);
				if (out && out.money) run.money += out.money;
			}
		}
	}

	// Scaling relics grow after the deal is banked, so growth applies next time.
	const endCtx = { made: breakdown.made, contract: deal.contract!, run };
	for (const r of run.relics) if (r.def.onDealEnd) r.def.onDealEnd(endCtx, r);

	run.log.push({
		rubber: run.rubber,
		board: run.board,
		contract: cards.contractName(deal.contract!),
		tricks: breakdown.bridge.tricksWon,
		needed: breakdown.bridge.tricksNeeded,
		made: breakdown.made,
		score: breakdown.total
	});

	run.phase = PHASE.DEAL_SCORED;
	return breakdown;
}

/** Move on after a deal has been scored and shown. */
export function continueAfterDeal(run: Run): Phase {
	assert(run.phase === PHASE.DEAL_SCORED, 'continueAfterDeal: nothing to continue');
	if (run.score >= run.target) winBoard(run);
	else if (run.dealsLeft <= 0) run.phase = PHASE.GAME_OVER;
	else startDeal(run);
	return run.phase;
}

// --------------------------------------------------------------------- economy

export function interest(run: Run): number {
	return Math.min(MAX_INTEREST, Math.floor(run.money / INTEREST_PER));
}

export function winBoard(run: Run): Payout {
	const earned = MONEY_PER_BOARD;
	const unused = Math.max(0, run.dealsLeft) * MONEY_PER_UNUSED_DEAL;
	const int = interest(run);
	let bonus = 0;
	for (const r of run.relics) {
		if (r.def.onBoardWin) {
			const out = r.def.onBoardWin({ run }, r);
			if (out && out.money) bonus += out.money;
		}
	}
	run.lastPayout = {
		board: earned,
		unused,
		interest: int,
		relics: bonus,
		total: earned + unused + int + bonus
	};
	run.money += run.lastPayout.total;
	run.boardsWonThisRubber++;
	// Winning a vulnerable board earns a free ploy, if there's room for it.
	run.lastPayout.gift = null;
	if (run.board === BOARDS_PER_RUBBER && run.ploys.length < PLOY_SLOTS) {
		const def = ploys.randomDef(run.rng);
		run.ploys.push(ploys.instantiate(def));
		run.lastPayout.gift = def;
	}
	run.phase = PHASE.BOARD_WON;
	return run.lastPayout;
}

// --------------------------------------------------------------------- shop

export function enterShop(run: Run) {
	run.phase = PHASE.SHOP;
	run.rerollCost = BASE_REROLL_COST;
	run.shop = { items: [] };
	for (let i = 0; i < SHOP_SIZE; i++) run.shop.items[i] = rollShopItem(run);
	return run.shop;
}

export function rollShopItem(run: Run): ShopItem {
	// Roughly one slot in five offers a convention, one in four a ploy.
	const roll = run.rng.next();
	if (roll < 0.2) {
		const def = conventions.randomDef(run.rng);
		return { kind: 'convention', def, name: def.name, cost: 4 + run.strainLevels[def.strain] };
	} else if (roll < 0.45) {
		const def = ploys.randomDef(run.rng);
		return { kind: 'ploy', def, name: def.name, cost: def.cost };
	}
	const def = relics.randomUnowned(run.rng, run.relics);
	if (!def) {
		const cdef = conventions.randomDef(run.rng);
		return { kind: 'convention', def: cdef, name: cdef.name, cost: 4 + run.strainLevels[cdef.strain] };
	}
	return { kind: 'relic', def, name: def.name, cost: def.cost };
}

export function canBuy(run: Run, index: number): [boolean, string?] {
	const item = run.shop?.items[index];
	if (!item || item.sold) return [false, 'gone'];
	if (run.money < item.cost) return [false, 'too expensive'];
	if (item.kind === 'relic' && run.relics.length >= RELIC_SLOTS) return [false, 'no relic slots'];
	if (item.kind === 'ploy' && run.ploys.length >= PLOY_SLOTS) return [false, 'no ploy slots'];
	return [true];
}

export function buy(run: Run, index: number): [boolean, string?] {
	const check = canBuy(run, index);
	if (!check[0]) return check;
	const item = run.shop!.items[index];
	run.money -= item.cost;
	if (item.kind === 'relic') run.relics.push(relics.instantiate(item.def));
	else if (item.kind === 'ploy') run.ploys.push(ploys.instantiate(item.def));
	else run.strainLevels[item.def.strain]++;
	item.sold = true;
	return [true];
}

export function sellRelic(run: Run, index: number): boolean {
	const relic = run.relics[index];
	if (!relic) return false;
	run.money += Math.max(1, Math.floor(relic.cost / 2));
	run.relics.splice(index, 1);
	return true;
}

export function sellPloy(run: Run, index: number): boolean {
	if (!run.ploys[index]) return false;
	run.money += 1;
	run.ploys.splice(index, 1);
	return true;
}

// --------------------------------------------------------------------- ploys

function ployContext(run: Run): ploys.PloyCtx {
	return { run, deal: run.deal, rng: run.rng, engine: { startDeal } };
}

function ployPhaseOk(run: Run, def: PloyDef): boolean {
	if (def.when.any) return true;
	if (def.when.bid && run.phase === PHASE.BID) return true;
	if (def.when.play && run.phase === PHASE.PLAY && run.deal?.state && !run.deal.state.complete) {
		return true;
	}
	return false;
}

/**
 * Can the ploy in this slot be used right now? A card-targeted ploy with no
 * target yet reports [true, undefined, true] so the UI can ask for one.
 */
export function canUsePloy(run: Run, index: number, target?: Card): [boolean, string?, boolean?] {
	const p = run.ploys[index];
	if (!p) return [false, 'no ploy in that slot'];
	if (!ployPhaseOk(run, p.def)) return [false, ploys.whenText(p.def) + ' only'];
	if (p.def.target === 'card' && !target) return [true, undefined, true];
	return p.def.check(ployContext(run), target);
}

/** Spend a ploy. Returns ok and a message for the player. */
export function usePloy(run: Run, index: number, target?: Card): [boolean, string?] {
	const [ok, why, needsTarget] = canUsePloy(run, index, target);
	if (!ok) return [false, why];
	if (needsTarget) return [false, 'choose one of your cards'];
	const p = run.ploys.splice(index, 1)[0];
	const message = p.def.apply(ployContext(run), target);
	if (p.key !== 'vanderbilt') run.lastPloy = p.key;
	run.stats.ploysUsed++;
	return [true, message];
}

export function reroll(run: Run): boolean {
	if (run.money < run.rerollCost) return false;
	run.money -= run.rerollCost;
	run.rerollCost++;
	for (let i = 0; i < SHOP_SIZE; i++) run.shop!.items[i] = rollShopItem(run);
	return true;
}

/** Leave the shop and start the next board, rubber or the victory screen. */
export function leaveShop(run: Run): Phase {
	run.board++;
	if (run.board > BOARDS_PER_RUBBER) {
		run.board = 1;
		run.rubber++;
		run.boardsWonThisRubber = 0;
	}
	if (run.rubber > RUBBERS) {
		run.phase = PHASE.VICTORY;
		return run.phase;
	}
	startBoard(run);
	return run.phase;
}
