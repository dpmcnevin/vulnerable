// A reasonable but unspectacular player, for balance simulation.
// Port of tools/bot.lua.
//
// Bids to the board's target using the same odds and projected scores the
// bid screen shows a human, plays every deal on autopilot, and shops by a
// simple rule. A thoughtful human should do noticeably better.

import * as engine from '../src/lib/game/engine.ts';
import * as cards from '../src/lib/rules/cards.ts';
import type { Card, Contract } from '../src/lib/rules/cards.ts';
import type { Run, RunOptions } from '../src/lib/game/engine.ts';
import type { RelicDef } from '../src/lib/game/relics.ts';

/** Choose a contract: the same recommendation the bid screen shows a human. */
export function bid(run: Run): Contract {
	return engine.recommendBid(run);
}

/** A sensible target card for a card-targeted ploy, or undefined. */
function ployTarget(run: Run, key: string): Card | undefined {
	const hand = run.deal.hands[run.deal.declarer];
	const [long] = cards.longestSuit(hand);
	let best: Card | undefined;
	for (const c of hand) {
		if (engine.canUsePloy(run, 0, c)[0]) {
			if (key === 'promotion' || key === 'coup') {
				// Upgrade the lowest card of the longest suit.
				if (c.suit === long && (!best || c.rank < best.rank)) best = c;
			} else if (key === 'transfer') {
				if (c.suit !== long && (!best || c.rank < best.rank)) best = c;
			} else if (key === 'ruffing_void') {
				if (cards.countSuit(hand, c.suit) <= 2 && c.rank < 12) best = c;
			}
		}
	}
	return best;
}

/** Use every ploy that helps, before bidding. Ploys are tried from the front. */
export function usePloys(run: Run) {
	for (let k = 0; k < 4; k++) {
		const p = run.ploys[0];
		if (!p) return;
		const key = p.key;
		let used = false;
		if (p.def.target === 'card') {
			const t = ployTarget(run, key);
			if (t) used = engine.usePloy(run, 0, t)[0];
		} else if (key === 'redeal') {
			// Only throw in a hand that looks hopeless.
			const o = engine.bidOptions(run);
			const rec = engine.recommendBid(run, o);
			for (const x of o) {
				if (x.contract.level === rec.level && x.contract.strain === rec.strain && x.chance < 0.5) {
					used = engine.usePloy(run, 0)[0];
				}
			}
		} else if (key !== 'lead_out_of_turn') {
			used = engine.usePloy(run, 0)[0];
		}
		if (!used) {
			// Keep it for later by moving it to the back.
			run.ploys.push(run.ploys.shift()!);
			return;
		}
	}
}

function relicValue(def: RelicDef): number {
	return def.rarity * 10 + def.cost;
}

/** The strain this run is building around, preferring notrump and the majors. */
function focusStrain(run: Run): number {
	let best = 5,
		bestLevel = -1;
	for (const s of [5, 4, 3, 2, 1]) {
		if (run.strainLevels[s] > bestLevel) {
			best = s;
			bestLevel = run.strainLevels[s];
		}
	}
	return best;
}

/** Spend money. Upgrade relics when slots are full, and stack one strain. */
export function shop(run: Run) {
	engine.enterShop(run);
	const slots = engine.RELIC_SLOTS;
	for (let k = 0; k < 10; k++) {
		let best: number | undefined;
		let bestScore: number | undefined;
		run.shop!.items.forEach((item, i) => {
			if (!item.sold && run.money >= item.cost) {
				let score: number | undefined;
				if (item.kind === 'relic') {
					score = relicValue(item.def);
					if (run.relics.length >= slots) {
						// Worth it only as an upgrade over our weakest relic.
						let weakest = Infinity;
						for (const r of run.relics) weakest = Math.min(weakest, relicValue(r.def));
						score = score > weakest + 5 ? score : undefined;
					}
				} else if (item.kind === 'ploy') {
					score = run.ploys.length < engine.PLOY_SLOTS ? 12 : undefined;
				} else {
					score = item.def.strain === focusStrain(run) ? 30 : 4;
				}
				if (score !== undefined && (bestScore === undefined || score > bestScore)) {
					best = i;
					bestScore = score;
				}
			}
		});
		if (best === undefined) break;
		const item = run.shop!.items[best];
		if (item.kind === 'relic' && run.relics.length >= slots) {
			let wi = 0;
			let wv: number | undefined;
			run.relics.forEach((r, i) => {
				if (wv === undefined || relicValue(r.def) < wv) {
					wi = i;
					wv = relicValue(r.def);
				}
			});
			engine.sellRelic(run, wi);
		}
		if (!engine.buy(run, best)[0]) break;
	}
	// Reroll once if rich, hunting for upgrades.
	if (run.money >= 20 && engine.reroll(run)) {
		run.shop!.items.forEach((item, i) => {
			if (item.kind === 'relic' && engine.canBuy(run, i)[0]) engine.buy(run, i);
		});
	}
	engine.leaveShop(run);
}

/** Play a full run and return the finished run. */
export function playRun(seed: string | number, opts?: RunOptions & { noPloys?: boolean }): Run {
	const run = engine.newRun(seed, opts);
	for (let k = 0; k < 5000; k++) {
		const phase = run.phase;
		if (phase === engine.PHASE.BID) {
			if (!opts?.noPloys) usePloys(run);
			engine.commitBid(run, bid(run));
		} else if (phase === engine.PHASE.PLAY) {
			engine.playOut(run);
		} else if (phase === engine.PHASE.DEAL_SCORED) {
			engine.continueAfterDeal(run);
		} else if (phase === engine.PHASE.BOARD_WON) {
			shop(run);
		} else {
			return run;
		}
	}
	throw new Error('run did not terminate: ' + String(seed));
}
