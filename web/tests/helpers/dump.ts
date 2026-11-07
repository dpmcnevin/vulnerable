// The TypeScript half of the conformance check: produces the same structure
// as tools/dump_fixture.lua, so tests/conformance.test.mjs can compare the two.

import * as cards from '../../src/lib/rules/cards.ts';
import * as rngLib from '../../src/lib/rules/rng.ts';
import * as scoring from '../../src/lib/rules/scoring.ts';
import * as play from '../../src/lib/rules/play.ts';
import * as engine from '../../src/lib/game/engine.ts';
import * as bot from '../../tools/bot.ts';
import * as pixelcards from '../../src/lib/ui/pixelcards.ts';
import * as icons from '../../src/lib/ui/icons.ts';
import * as sounds from '../../src/lib/audio/sounds.ts';
import type { Bitmap } from '../../src/lib/ui/pixel.ts';
import type { Buffer } from '../../src/lib/audio/synth.ts';
import type { Card, Hand, Hands } from '../../src/lib/rules/cards.ts';
import type { Run } from '../../src/lib/game/engine.ts';

const handCodes = (hand: Hand) => hand.map(cards.code);
const dealCodes = (hands: Hands) => [1, 2, 3, 4].map((s) => handCodes(hands[s]));

export function summariseRun(run: Run) {
	return {
		phase: run.phase,
		rubber: run.rubber,
		board: run.board,
		money: run.money,
		score: run.score,
		target: run.target,
		relics: run.relics.map((r) => r.key),
		ploys: run.ploys.map((p) => p.key),
		strainLevels: run.strainLevels.slice(1),
		stats: run.stats,
		log: run.log.map((e) => [e.rubber, e.board, e.contract, e.tricks, e.score]),
		rngState: run.rng.state >>> 0
	};
}

const str = (v: unknown) => (v === undefined || v === null ? 'nil' : String(v));

export function randomPlayer(seed: string) {
	const run = engine.newRun(seed);
	const me = rngLib.newRng('player:' + seed);
	const trace: string[] = [];
	for (let k = 0; k < 400; k++) {
		const phase = run.phase;
		if (phase === engine.PHASE.BID) {
			const deal = run.deal;
			trace.push(handCodes(deal.hands[deal.declarer]).join(''));
			if (run.ploys.length > 0 && me.chance(0.5)) {
				const hand = deal.hands[deal.declarer];
				const [ok, msg] = engine.usePloy(run, 0, me.pick(hand));
				trace.push('ploy ' + str(ok) + ' ' + str(msg));
			}
			if (run.phase === engine.PHASE.BID) {
				const opts = engine.bidOptions(run);
				const pick = me.chance(0.5) ? engine.recommendBid(run, opts) : me.pick(opts)!.contract;
				const c = engine.commitBid(run, pick, { stepwise: true });
				trace.push('bid ' + cards.contractName(c));
			}
		} else if (phase === engine.PHASE.PLAY) {
			if (engine.isPlayerTurn(run)) {
				const state = run.deal.state!;
				const legal = play.legalPlays(state, state.turn);
				const c = me.pick(legal) as Card;
				engine.playerPlay(run, c, { stepwise: true });
				trace.push(cards.code(c));
			} else {
				const step = engine.stepAI(run)!;
				trace.push(step.seat + cards.code(step.card));
			}
		} else if (phase === engine.PHASE.DEAL_SCORED) {
			const r = run.deal.result!;
			trace.push(`scored ${r.total} ${r.made}`);
			engine.continueAfterDeal(run);
		} else if (phase === engine.PHASE.BOARD_WON) {
			engine.enterShop(run);
			for (let i = 0; i < engine.SHOP_SIZE; i++) {
				if (engine.canBuy(run, i)[0] && me.chance(0.6)) engine.buy(run, i);
			}
			if (me.chance(0.3) && engine.reroll(run)) trace.push('reroll');
			trace.push('shop ' + run.shop!.items.map((it) => it.kind + ':' + it.def.key).join(','));
			engine.leaveShop(run);
		} else {
			break;
		}
	}
	return { trace, final: summariseRun(run) };
}

export function dump() {
	const out: Record<string, unknown> = {};

	out.hash = ['', 'a', 'VULNERABLE', 'SIM1', 'player:7', 'héllo ♠'].map((s) => [
		s,
		rngLib.hashString(s) >>> 0
	]);
	out.streams = ['ABC', 'SIM42', 1, 12345, -7, 4294967297, 0].map((seed) => {
		const r = rngLib.newRng(seed);
		const seq: (number | string)[] = [];
		for (let i = 1; i <= 8; i++) seq.push(r.nextUint());
		for (let i = 1; i <= 8; i++) seq.push(r.int(1, 13 + i));
		seq.push(rngLib.randomSeedString(r));
		seq.push(handCodes(r.shuffle(cards.newDeck())).join(''));
		seq.push(r.branch('shop').nextUint());
		return { seed, values: seq };
	});

	out.deals = [];
	for (let i = 1; i <= 20; i++) {
		const run = engine.newRun('DEAL' + i);
		(out.deals as unknown[]).push({
			seed: 'DEAL' + i,
			hands: dealCodes(run.deal.hands),
			partner: run.deal.partnerInfo.text,
			target: run.target
		});
	}

	const scores: number[] = [];
	for (let level = 1; level <= 7; level++)
		for (let strain = 1; strain <= 5; strain++)
			for (let doubled = 0; doubled <= 2; doubled++)
				for (const vul of [false, true])
					for (let tricks = 0; tricks <= 13; tricks += 3)
						scores.push(scoring.score({ level, strain, doubled }, tricks, vul).total);
	out.scores = scores;
	const targets: number[] = [];
	for (let rubber = 1; rubber <= 11; rubber++)
		for (let board = 1; board <= 3; board++) targets.push(engine.targetFor(rubber, board));
	out.targets = targets;

	const botRuns: unknown[] = [];
	for (let i = 1; i <= 60; i++)
		botRuns.push({ seed: 'CONF' + i, ploys: true, result: summariseRun(bot.playRun('CONF' + i)) });
	for (let i = 1; i <= 15; i++)
		botRuns.push({
			seed: 'NOPLOY' + i,
			ploys: false,
			result: summariseRun(bot.playRun('NOPLOY' + i, { noPloys: true }))
		});
	out.botRuns = botRuns;

	const playerRuns: unknown[] = [];
	for (let i = 1; i <= 25; i++) playerRuns.push({ seed: 'HUMAN' + i, run: randomPlayer('HUMAN' + i) });
	out.playerRuns = playerRuns;
	return out;
}

const hex2 = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
function serialise(b: Bitmap): number {
	const parts = b.px.map((c) => (c ? hex2(c[0]) + hex2(c[1]) + hex2(c[2]) + hex2(c[3] ?? 1) : '.'));
	// Fill holes (never-set pixels) the way Lua's table.concat sees them.
	for (let i = 0; i < b.w * b.h; i++) if (parts[i] === undefined) parts[i] = '.';
	return rngLib.hashString(parts.join(',')) >>> 0;
}

export function dumpPixels() {
	const pixel: unknown[] = [];
	for (const four of [true, false]) {
		for (const card of cards.newDeck()) {
			for (const trump of [false, true]) {
				pixel.push([cards.code(card), four, trump, serialise(pixelcards.faceBitmap(card, trump, four))]);
			}
		}
	}
	const keys = [...Object.keys(icons.ICONS), 'no_such_icon'].sort();
	return {
		pixel,
		pixelBack: serialise(pixelcards.backBitmap()),
		icons: keys.map((k) => [k, serialise(icons.bitmap(k))])
	};
}

function stats(buf: Buffer) {
	const d = buf.data;
	let sumAbs = 0,
		sumSq = 0;
	for (let i = 0; i < d.length; i++) {
		sumAbs += Math.abs(d[i]);
		sumSq += d[i] * d[i];
	}
	const at = (k: number) => (k >= 1 && k <= d.length ? d[k - 1] : 0);
	return {
		n: d.length,
		rate: buf.rate,
		sumAbs,
		sumSq,
		probe: [at(1), at(Math.floor(d.length / 3)), at(Math.floor(d.length / 2))]
	};
}

export function dumpAudio() {
	const names = Object.keys(sounds.defs).sort();
	return {
		sounds: names.map((k) => [k, stats(sounds.defs[k]())]),
		music: stats(sounds.renderMusicAll())
	};
}
