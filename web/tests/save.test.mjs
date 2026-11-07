// Auto-save by replay: a run rebuilt from its seed and action log must match
// the original exactly, at every point along the way.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../src/lib/game/engine.ts';
import * as play from '../src/lib/rules/play.ts';
import * as cards from '../src/lib/rules/cards.ts';
import * as rngLib from '../src/lib/rules/rng.ts';
import { applyAction, replay } from '../src/lib/app/save.ts';
import { summariseRun } from './helpers/dump.ts';

/** Play a run the way the UI does, choosing with a seeded "player", logging every action. */
function playLogged(seed, steps) {
	const run = engine.newRun(seed);
	const me = rngLib.newRng('saver:' + seed);
	const actions = [];
	const act = (a) => {
		actions.push(a);
		return applyAction(run, a);
	};
	for (let k = 0; k < steps; k++) {
		const phase = run.phase;
		if (phase === engine.PHASE.BID) {
			if (run.ploys.length && me.chance(0.4)) {
				const t = me.pick(run.deal.hands[run.deal.declarer]);
				const [ok, , needs] = engine.canUsePloy(run, 0, t);
				if (ok && !needs) act({ t: 'ploy', slot: 0, target: cards.code(t) });
			}
			if (run.phase === engine.PHASE.BID) {
				const c = engine.recommendBid(run);
				act({ t: 'bid', level: c.level, strain: c.strain });
			}
		} else if (phase === engine.PHASE.PLAY) {
			if (engine.isPlayerTurn(run)) {
				if (me.chance(0.05)) act({ t: 'playOut' });
				else {
					const st = run.deal.state;
					act({ t: 'play', card: cards.code(me.pick(play.legalPlays(st, st.turn))) });
				}
			} else act({ t: 'ai' });
		} else if (phase === engine.PHASE.DEAL_SCORED) act({ t: 'continue' });
		else if (phase === engine.PHASE.BOARD_WON) {
			act({ t: 'shop' });
			for (let i = 0; i < engine.SHOP_SIZE; i++) if (engine.canBuy(run, i)[0] && me.chance(0.7)) act({ t: 'buy', slot: i });
			if (run.money >= run.rerollCost && me.chance(0.3)) act({ t: 'reroll' });
			if (run.relics.length > 3 && me.chance(0.3)) act({ t: 'sellRelic', slot: 0 });
			act({ t: 'leave' });
		} else break;
	}
	return { run, actions };
}

test('a replayed save rebuilds the run exactly, at any point', () => {
	for (const seed of ['SAVE1', 'SAVE2', 'SAVE3']) {
		for (const steps of [1, 37, 160, 800, 3000]) {
			const { run, actions } = playLogged(seed, steps);
			const copy = replay({ version: 1, seed, actions: JSON.parse(JSON.stringify(actions)) });
			assert.deepEqual(summariseRun(copy), summariseRun(run), `${seed} after ${steps} steps`);
			assert.equal(copy.phase, run.phase);
			assert.equal(copy.deal.hands.slice(1).map((h) => h.map(cards.code).join()).join('|'),
				run.deal.hands.slice(1).map((h) => h.map(cards.code).join()).join('|'));
			if (run.deal.state) {
				assert.equal(copy.deal.state.turn, run.deal.state.turn);
				assert.equal(copy.deal.state.trick.map((p) => cards.code(p.card)).join(), run.deal.state.trick.map((p) => cards.code(p.card)).join());
			}
		}
	}
});

test('a save that does not fit the run is rejected', () => {
	assert.throws(() => replay({ version: 1, seed: 'X', actions: [{ t: 'play', card: 'AS' }] }));
});
