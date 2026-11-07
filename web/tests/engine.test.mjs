// Port of tests/test_engine.lua: the run engine, relics, shop and scorepad.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../src/lib/game/engine.ts';
import * as relics from '../src/lib/game/relics.ts';
import * as cards from '../src/lib/rules/cards.ts';
import * as play from '../src/lib/rules/play.ts';
import * as scoring from '../src/lib/rules/scoring.ts';
import * as bot from '../tools/bot.ts';

test('you always hold the stronger partnership and hand (300 deals)', () => {
	let weakSide = 0,
		weakDeclarer = 0;
	for (let i = 1; i <= 300; i++) {
		const d = engine.newRun('DEALS' + i).deal;
		if (cards.hcp(d.hands[cards.NORTH]) + cards.hcp(d.hands[cards.SOUTH]) < 20) weakSide++;
		if (cards.hcp(d.hands[cards.SOUTH]) < cards.hcp(d.hands[cards.NORTH])) weakDeclarer++;
	}
	assert.equal(weakSide, 0);
	assert.equal(weakDeclarer, 0);
});

test('bid flow and a whole deal played by hand', () => {
	const run = engine.newRun('BIDFLOW');
	assert.equal(run.phase, engine.PHASE.BID);
	assert.equal(run.dealsLeft, engine.DEALS_PER_BOARD);
	engine.commitBid(run, { level: 2, strain: cards.SPADES });
	assert.equal(run.phase, engine.PHASE.PLAY);
	assert.equal(run.deal.state.played[0].seat, cards.WEST, 'West made the opening lead');
	assert.equal(run.deal.dummyVisible, true);
	assert.equal(engine.isPlayerTurn(run), true);

	let guard = 0;
	while (run.phase === engine.PHASE.PLAY) {
		guard++;
		const legal = play.legalPlays(run.deal.state, run.deal.state.turn);
		engine.playerPlay(run, legal[0]);
		assert.ok(guard < 40);
	}
	assert.equal(run.phase, engine.PHASE.DEAL_SCORED);
	assert.equal(run.deal.state.tricks.length, 13);
	assert.equal(run.dealsLeft, engine.DEALS_PER_BOARD - 1);
});

test('scoring pipeline: projections, relics and conventions', () => {
	const run = engine.newRun('PROJ');
	const c = { level: 4, strain: cards.SPADES, doubled: 0 };
	assert.equal(engine.projectScore(run, c)[0], scoring.score(c, 10, run.vulnerable).total);

	run.relics[0] = relics.instantiate(relics.get('purist'));
	const nt = { level: 3, strain: cards.NOTRUMP, doubled: 0 };
	assert.equal(engine.projectScore(run, nt)[0], scoring.score(nt, 9, run.vulnerable).total + 140);
	assert.equal(engine.projectScore(run, c)[0], scoring.score(c, 10, run.vulnerable).total);

	run.relics[1] = relics.instantiate(relics.get('bold_bidding'));
	const five = { level: 5, strain: cards.CLUBS, doubled: 0 };
	assert.equal(engine.projectScore(run, five)[0], scoring.score(five, 11, run.vulnerable).total + 300);

	const run2 = engine.newRun('CONV');
	run2.strainLevels[cards.HEARTS] = 3;
	const h = { level: 4, strain: cards.HEARTS, doubled: 0 };
	const base = scoring.score(h, 10, run2.vulnerable).total;
	assert.equal(engine.projectScore(run2, h)[0], Math.floor((base + 60) * 2.2));
});

test('a failed contract scores nothing toward the target', () => {
	const run = engine.newRun('FAIL');
	run.relics[0] = relics.instantiate(relics.get('purist'));
	engine.commitBid(run, { level: 7, strain: cards.NOTRUMP });
	engine.playOut(run);
	if (!run.deal.result.made) {
		assert.equal(run.deal.result.total, 0);
		assert.equal(run.score, 0);
	}
});

test('scaling relics', () => {
	const regular = relics.instantiate(relics.get('club_regular'));
	const def = regular.def;
	def.onDealEnd({ made: true, contract: { level: 2, strain: 1 } }, regular);
	def.onDealEnd({ made: false, contract: { level: 2, strain: 1 } }, regular);
	def.onDealEnd({ made: true, contract: { level: 2, strain: 1 } }, regular);
	assert.equal(regular.state.points, 50);
	assert.match(relics.textFor(regular), /now \+50/);

	const master = relics.instantiate(relics.get('master_points'));
	master.def.onDealEnd({ made: true, contract: { level: 2, strain: 4 } }, master);
	assert.equal(master.state.mult, undefined, 'Master Points ignores part-scores');
	master.def.onDealEnd({ made: true, contract: { level: 4, strain: 4 } }, master);
	assert.equal(master.state.mult, 0.2);

	const a = relics.instantiate(relics.get('club_regular'));
	const b = relics.instantiate(relics.get('club_regular'));
	a.def.onDealEnd({ made: true }, a);
	assert.equal(b.state.points, undefined, 'instances do not share state');
});

test('economy and shop', () => {
	const run = engine.newRun('SHOP');
	run.money = 100;
	engine.enterShop(run);
	assert.equal(run.shop.items.length, engine.SHOP_SIZE);
	const before = run.money;
	const item = run.shop.items[0];
	assert.equal(engine.buy(run, 0)[0], true);
	assert.equal(run.money, before - item.cost);
	assert.equal(engine.buy(run, 0)[0], false, 'cannot buy the same slot twice');

	run.relics = [];
	for (let i = 0; i < engine.RELIC_SLOTS; i++) run.relics[i] = relics.instantiate(relics.DEFS[i]);
	run.shop.items[1] = { kind: 'relic', def: relics.DEFS[19], name: 'x', cost: 1 };
	assert.deepEqual(engine.canBuy(run, 1), [false, 'no relic slots']);

	const cost = run.rerollCost;
	const m = run.money;
	assert.equal(engine.reroll(run), true);
	assert.equal(run.money, m - cost);
	assert.equal(run.rerollCost, cost + 1);

	const count = run.relics.length;
	const cash = run.money;
	engine.sellRelic(run, 0);
	assert.equal(run.relics.length, count - 1);
	assert.ok(run.money > cash);
});

test('interest', () => {
	const run = engine.newRun('INTEREST');
	run.money = 23;
	assert.equal(engine.interest(run), 4);
	run.money = 200;
	assert.equal(engine.interest(run), engine.MAX_INTEREST);
});

test('vulnerability and targets', () => {
	assert.equal(engine.isVulnerable(1, 3), true);
	assert.equal(engine.isVulnerable(1, 1), false);
	assert.equal(engine.isVulnerable(5, 1), true);
	for (let r = 1; r <= engine.RUBBERS; r++) {
		for (let b = 2; b <= engine.BOARDS_PER_RUBBER; b++) {
			assert.ok(engine.targetFor(r, b) > engine.targetFor(r, b - 1), `rising within rubber ${r}`);
		}
		if (r > 1) assert.ok(engine.targetFor(r, 1) > engine.targetFor(r - 1, 1));
	}
});

test('rubber scorepad', () => {
	const run = engine.newRun('PAD');
	const record = (level, strain, tricks, vul) => {
		const c = { level, strain, doubled: 0 };
		engine.recordOnPad(run, c, scoring.score(c, tricks, vul));
	};
	const pad = engine.scorepad(run);
	record(2, cards.HEARTS, 8, false);
	assert.equal(engine.padSum(pad.games[0].we), 60);
	assert.equal(pad.gamesWon, 0);
	record(2, cards.SPADES, 9, false);
	assert.equal(pad.gamesWon, 1);
	assert.equal(pad.games[0].won, 'we');
	assert.equal(pad.games.length, 2);
	assert.match(pad.above.we[pad.above.we.length - 2].label, /Overtricks/);
	record(4, cards.SPADES, 8, true);
	assert.equal(engine.padSum(pad.above.they), 200);
	const [we, they] = engine.padTotals(pad);
	assert.ok(we > 120);
	assert.equal(they, 200);

	run.rubber = 2;
	assert.equal(engine.scorepad(run).gamesWon, 0, 'new rubber, new pad');
});

test('deals played through the engine land on the pad', () => {
	const run = engine.newRun('PADFLOW');
	engine.commitBid(run, { level: 1, strain: cards.NOTRUMP });
	engine.playOut(run);
	const pad = engine.scorepad(run);
	assert.ok(pad.games[0].we.length + pad.above.we.length + pad.above.they.length > 0);
});

test('whole bot runs reach an ending and replay identically', () => {
	let finished = 0,
		bad = 0;
	for (let i = 1; i <= 60; i++) {
		const run = bot.playRun('WHOLE' + i);
		if (run.phase === engine.PHASE.VICTORY || run.phase === engine.PHASE.GAME_OVER) finished++;
		if (run.money < 0 || run.relics.length > engine.RELIC_SLOTS) bad++;
	}
	assert.equal(finished, 60);
	assert.equal(bad, 0);
	const a = bot.playRun('REPLAY'),
		b = bot.playRun('REPLAY');
	assert.equal(a.rubber, b.rubber);
	assert.equal(a.stats.totalScore, b.stats.totalScore);
});

test('bot win rate matches the Lua balance (~15-18% over 400 runs)', () => {
	let wins = 0;
	for (let i = 1; i <= 400; i++) if (bot.playRun('SIM' + i).phase === engine.PHASE.VICTORY) wins++;
	const rate = wins / 400;
	assert.ok(rate > 0.1 && rate < 0.25, `win rate ${rate}`);
});
