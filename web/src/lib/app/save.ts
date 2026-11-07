// Auto-save, by replay.
//
// The engine is seeded and deterministic, so a run is fully described by its
// seed and the list of actions taken in it (every bid, card, AI step, ploy and
// purchase). The game applies every action through `applyAction`, appending it
// to the log; loading replays the log through the same function, rebuilding
// the run exactly -- card identities, RNG state and all. The save is a few
// kilobytes of JSON in localStorage.

import * as cards from '../rules/cards.ts';
import * as engine from '../game/engine.ts';
import type { Card } from '../rules/cards.ts';
import type { Run } from '../game/engine.ts';
import type { Trick } from '../rules/play.ts';

export type Action =
	| { t: 'bid'; level: number; strain: number }
	| { t: 'play'; card: string }
	| { t: 'ai' }
	| { t: 'playOut' }
	| { t: 'ploy'; slot: number; target?: string }
	| { t: 'sellPloy'; slot: number }
	| { t: 'continue' }
	| { t: 'shop' }
	| { t: 'buy'; slot: number }
	| { t: 'sellRelic'; slot: number }
	| { t: 'reroll' }
	| { t: 'leave' };

export interface Save {
	version: number;
	seed: string | number;
	actions: Action[];
}

/** Bump when the engine changes in a way that would replay differently. */
export const SAVE_VERSION = 1;
const STORAGE_KEY = 'vulnerable.save';

export interface Outcome {
	ok: boolean;
	message?: string;
	tricks?: Trick[];
	step?: ReturnType<typeof engine.stepAI>;
	contract?: cards.Contract;
}

function findCard(hand: Card[], code: string): Card {
	const c = hand.find((x) => cards.code(x) === code);
	if (!c) throw new Error(`replay: ${code} not in hand`);
	return c;
}

/** Apply one action to a run. Throws if the action doesn't fit the run's state. */
export function applyAction(run: Run, a: Action): Outcome {
	switch (a.t) {
		case 'bid': {
			const contract = engine.commitBid(run, { level: a.level, strain: a.strain, doubled: 0 }, { stepwise: true });
			return { ok: true, contract };
		}
		case 'play': {
			const state = run.deal.state!;
			const card = findCard(state.hands[state.turn], a.card);
			return { ok: true, tricks: engine.playerPlay(run, card, { stepwise: true }) };
		}
		case 'ai':
			return { ok: true, step: engine.stepAI(run) };
		case 'playOut':
			engine.playOut(run);
			return { ok: true };
		case 'ploy': {
			const target = a.target ? findCard(run.deal.hands[run.deal.declarer], a.target) : undefined;
			const [ok, message] = engine.usePloy(run, a.slot, target);
			return { ok, message };
		}
		case 'sellPloy':
			return { ok: engine.sellPloy(run, a.slot) };
		case 'continue':
			engine.continueAfterDeal(run);
			return { ok: true };
		case 'shop':
			engine.enterShop(run);
			return { ok: true };
		case 'buy': {
			const [ok, message] = engine.buy(run, a.slot);
			return { ok, message };
		}
		case 'sellRelic':
			return { ok: engine.sellRelic(run, a.slot) };
		case 'reroll':
			return { ok: engine.reroll(run) };
		case 'leave':
			engine.leaveShop(run);
			return { ok: true };
	}
}

/** Rebuild a run from a save. Throws if the log doesn't replay cleanly. */
export function replay(save: Save): Run {
	const run = engine.newRun(save.seed);
	for (const a of save.actions) applyAction(run, a);
	return run;
}

export function store(save: Save) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
	} catch {
		/* private mode or full: play on without saving */
	}
}

export function load(): Save | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const save = JSON.parse(raw) as Save;
		if (save.version !== SAVE_VERSION || !Array.isArray(save.actions)) return null;
		return save;
	} catch {
		return null;
	}
}

export function clear() {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		/* ignore */
	}
}
