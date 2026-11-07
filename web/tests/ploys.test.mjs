// Port of tests/test_ploys.lua.
// The most important property: no ploy ever breaks the pack. After any swap
// there must still be 52 distinct cards, 13 per hand, 40 high card points.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../src/lib/game/engine.ts';
import * as ploys from '../src/lib/game/ploys.ts';
import * as cards from '../src/lib/rules/cards.ts';
import * as play from '../src/lib/rules/play.ts';

function packIntact(deal) {
	const seen = new Set();
	let hcp = 0;
	for (let seat = 1; seat <= 4; seat++) {
		if (deal.hands[seat].length !== 13) return 'hand size';
		for (const c of deal.hands[seat]) {
			const code = cards.code(c);
			if (seen.has(code)) return 'duplicate ' + code;
			seen.add(code);
		}
		hcp += cards.hcp(deal.hands[seat]);
	}
	if (hcp !== 40) return 'hcp ' + hcp;
	for (let seat = 1; seat <= 4; seat++) {
		if (deal.original[seat].length !== 13) return 'original size';
		for (let i = 0; i < 13; i++) {
			if (deal.original[seat][i] !== deal.hands[seat][i]) return 'original out of sync';
		}
	}
	return null;
}

/** Give a run a ploy; returns its 0-based slot. */
function give(run, key) {
	run.ploys.push(ploys.instantiate(ploys.get(key)));
	return run.ploys.length - 1;
}
const south = (run) => run.deal.hands[cards.SOUTH];
const ok = (r) => r[0];

test('card-swapping ploys keep the pack legal (150 trials each)', () => {
	const broken = [];
	const used = { promotion: 0, coup: 0, transfer: 0, ruffing_void: 0, strong_partner: 0 };
	for (let trial = 1; trial <= 150; trial++) {
		for (const key of Object.keys(used)) {
			const run = engine.newRun('SWAP' + trial + key);
			const def = ploys.get(key);
			const idx = give(run, key);
			let target;
			if (def.target === 'card') target = south(run).find((c) => ok(engine.canUsePloy(run, idx, c)));
			if (def.target !== 'card' || target) {
				if (ok(engine.usePloy(run, idx, target))) used[key]++;
				const why = packIntact(run.deal);
				if (why) broken.push(key + ': ' + why);
			}
		}
	}
	assert.deepEqual(broken, []);
	for (const [key, n] of Object.entries(used)) assert.ok(n > 50, `${key} usable on many deals (${n})`);
});

test('Promotion takes the next card up', () => {
	let done = false;
	for (let trial = 1; trial <= 50 && !done; trial++) {
		const run = engine.newRun('PROMO' + trial);
		const idx = give(run, 'promotion');
		for (const c of south(run)) {
			if (!ok(engine.canUsePloy(run, idx, c))) continue;
			let expect;
			for (const seat of [cards.EAST, cards.WEST]) {
				for (const d of run.deal.hands[seat]) {
					if (d.suit === c.suit && d.rank > c.rank && (!expect || d.rank < expect.rank)) expect = d;
				}
			}
			engine.usePloy(run, idx, c);
			assert.ok(south(run).includes(expect), 'takes the next card up');
			assert.ok(!south(run).includes(c), 'gives the old card away');
			assert.ok(run.deal.wentTo.has(c), 'the defender now holds the old card');
			done = true;
			break;
		}
	}
	assert.ok(done);
});

test('The Coup takes the top card of the suit', () => {
	const run = engine.newRun('COUP');
	const idx = give(run, 'coup');
	for (const c of south(run)) {
		if (!ok(engine.canUsePloy(run, idx, c))) continue;
		let best = 0;
		for (const seat of [cards.EAST, cards.WEST])
			for (const d of run.deal.hands[seat]) if (d.suit === c.suit) best = Math.max(best, d.rank);
		engine.usePloy(run, idx, c);
		let got = 0;
		for (const x of south(run)) if (x.suit === c.suit) got = Math.max(got, x.rank);
		assert.ok(got >= best);
		break;
	}
});

test('Ruffing Void, Transfer and Strong Partner', () => {
	let voided = false;
	for (let trial = 1; trial <= 30 && !voided; trial++) {
		const r = engine.newRun('VOID' + trial);
		const i = give(r, 'ruffing_void');
		const c = south(r).find((c) => ok(engine.canUsePloy(r, i, c)));
		if (c) {
			const suit = c.suit;
			engine.usePloy(r, i, c);
			voided = cards.countSuit(south(r), suit) === 0;
		}
	}
	assert.ok(voided, 'Ruffing Void leaves you void in the chosen suit');

	const r = engine.newRun('XFER');
	const [long, before] = cards.longestSuit(south(r));
	const i = give(r, 'transfer');
	const c = south(r).find((c) => ok(engine.canUsePloy(r, i, c)));
	engine.usePloy(r, i, c);
	assert.equal(cards.countSuit(south(r), long), before + 1);

	const r2 = engine.newRun('STRONG');
	const hcpBefore = cards.hcp(r2.deal.hands[cards.NORTH]);
	engine.usePloy(r2, give(r2, 'strong_partner'));
	assert.ok(cards.hcp(r2.deal.hands[cards.NORTH]) > hcpBefore);
	assert.equal(r2.deal.partnerInfo.hcp, cards.hcp(r2.deal.hands[cards.NORTH]));
});

test('Kibitzer', () => {
	const run = engine.newRun('KIBITZ');
	engine.usePloy(run, give(run, 'kibitzer'));
	assert.ok(run.deal.kibitzed);
	assert.equal(run.deal.partnerInfo.exact, true);
	assert.equal(run.deal.partnerInfo.hcp, cards.hcp(run.deal.hands[cards.NORTH]));
	assert.ok(!ok(engine.canUsePloy(run, give(run, 'kibitzer'))), 'a second Kibitzer is refused');
});

test('Redeal', () => {
	const run = engine.newRun('REDEAL');
	const old = run.deal,
		left = run.dealsLeft;
	engine.usePloy(run, give(run, 'redeal'));
	assert.notEqual(run.deal, old);
	assert.equal(run.dealsLeft, left);
	assert.equal(run.phase, engine.PHASE.BID);
});

test('Lead Out of Turn', () => {
	const run = engine.newRun('LEAD');
	engine.usePloy(run, give(run, 'lead_out_of_turn'));
	engine.commitBid(run, { level: 1, strain: cards.NOTRUMP }, { stepwise: true });
	assert.equal(run.deal.state.turn, cards.SOUTH);
	assert.ok(engine.isPlayerTurn(run));
});

test('Psych prevents every double', () => {
	let doubledWith = 0,
		doubledWithout = 0;
	for (let trial = 1; trial <= 60; trial++) {
		const a = engine.newRun('PSY' + trial);
		engine.usePloy(a, give(a, 'psych'));
		if (engine.commitBid(a, { level: 7, strain: cards.NOTRUMP }).doubled > 0) doubledWith++;
		const b = engine.newRun('PSY' + trial);
		if (engine.commitBid(b, { level: 7, strain: cards.NOTRUMP }).doubled > 0) doubledWithout++;
	}
	assert.ok(doubledWithout > 10);
	assert.equal(doubledWith, 0);
});

test('Table Talk gains tricks on average', () => {
	let withTalk = 0,
		without = 0;
	for (let trial = 1; trial <= 120; trial++) {
		const a = engine.newRun('TALK' + trial);
		engine.usePloy(a, give(a, 'table_talk'));
		engine.commitBid(a, { level: 1, strain: cards.NOTRUMP });
		engine.playOut(a);
		withTalk += a.deal.result.bridge.tricksWon;
		const b = engine.newRun('TALK' + trial);
		engine.commitBid(b, { level: 1, strain: cards.NOTRUMP });
		engine.playOut(b);
		without += b.deal.result.bridge.tricksWon;
	}
	assert.ok(withTalk > without, `${withTalk / 120} vs ${without / 120}`);
});

test('Phantom Trick and Safety Net', () => {
	const run = engine.newRun('PHANTOM');
	engine.usePloy(run, give(run, 'phantom_trick'));
	engine.commitBid(run, { level: 1, strain: cards.NOTRUMP });
	engine.playOut(run);
	const real = play.declarerTricks(run.deal.state, cards.SOUTH);
	assert.equal(run.deal.result.bridge.tricksWon, Math.min(13, real + 1));

	const net = engine.newRun('NET');
	engine.usePloy(net, give(net, 'safety_net'));
	const left = net.dealsLeft;
	engine.commitBid(net, { level: 7, strain: cards.NOTRUMP });
	engine.playOut(net);
	if (!net.deal.result.made) {
		assert.equal(net.dealsLeft, left);
		assert.equal(net.deal.result.refunded, true);
	}
});

test('High Stakes and Vanderbilt', () => {
	const run = engine.newRun('STAKES');
	run.money = 9;
	assert.ok(ok(engine.usePloy(run, give(run, 'high_stakes'))));
	assert.equal(run.money, 18);
	run.money = 40;
	run.phase = engine.PHASE.SHOP;
	engine.usePloy(run, give(run, 'high_stakes'));
	assert.equal(run.money, 55, 'capped at +$15, and works in the shop');

	const v = engine.newRun('VANDER');
	const idx = give(v, 'vanderbilt');
	assert.ok(!ok(engine.canUsePloy(v, idx)), 'Vanderbilt needs a previous ploy');
	engine.usePloy(v, give(v, 'psych'));
	assert.ok(ok(engine.usePloy(v, 0)));
	assert.equal(v.ploys[0]?.key, 'psych');
});

test('timing: targets and phases', () => {
	const run = engine.newRun('TIMING');
	const idx = give(run, 'promotion');
	const [okay, , needs] = engine.canUsePloy(run, idx);
	assert.ok(okay && needs, 'a targeted ploy asks for a target');
	assert.ok(!ok(engine.usePloy(run, idx)));
	engine.commitBid(run, { level: 1, strain: cards.NOTRUMP }, { stepwise: true });
	const [ok2, why] = engine.canUsePloy(run, idx, south(run)[0] ?? run.deal.state.hands[cards.SOUTH][0]);
	assert.ok(!ok2);
	assert.match(why, /bid/);
	assert.ok(ok(engine.canUsePloy(run, give(run, 'phantom_trick'))));
});

test('ploy slots and the shop', () => {
	const run = engine.newRun('SLOTS');
	run.money = 100;
	engine.enterShop(run);
	run.shop.items[0] = { kind: 'ploy', def: ploys.get('psych'), name: 'Psych', cost: 3 };
	run.shop.items[1] = { kind: 'ploy', def: ploys.get('redeal'), name: 'Redeal', cost: 3 };
	run.shop.items[2] = { kind: 'ploy', def: ploys.get('coup'), name: 'Coup', cost: 5 };
	assert.ok(ok(engine.buy(run, 0)));
	assert.ok(ok(engine.buy(run, 1)));
	assert.deepEqual(engine.canBuy(run, 2), [false, 'no ploy slots']);
	const m = run.money;
	engine.sellPloy(run, 0);
	assert.equal(run.money, m + 1);
	assert.equal(run.ploys.length, 1);

	let seen = 0;
	for (let i = 0; i < 300; i++) if (engine.rollShopItem(run).kind === 'ploy') seen++;
	assert.ok(seen > 45 && seen < 110, `${seen}/300`);
});

test('a vulnerable board win gifts a ploy', () => {
	const run = engine.newRun('GIFT');
	run.board = engine.BOARDS_PER_RUBBER;
	run.ploys = [];
	engine.winBoard(run);
	assert.ok(run.ploys.length === 1 && run.lastPayout.gift);
	run.board = 1;
	run.ploys = [];
	engine.winBoard(run);
	assert.equal(run.ploys.length, 0);
});

test('every ploy is well-formed', () => {
	const seen = new Set();
	for (const d of ploys.DEFS) {
		assert.ok(d.text && d.cost && d.when && d.check && d.apply && !seen.has(d.key), d.key);
		seen.add(d.key);
	}
	assert.equal(ploys.DEFS.length, 15);
});
