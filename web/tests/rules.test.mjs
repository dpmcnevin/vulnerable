// Port of tests/test_rules.lua: the bridge rules core.
// The scoring cases are hand-checked against the duplicate bridge scoring
// table, not against this implementation, so they catch drift.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as cards from '../src/lib/rules/cards.ts';
import * as scoring from '../src/lib/rules/scoring.ts';
import * as play from '../src/lib/rules/play.ts';
import * as rng from '../src/lib/rules/rng.ts';

const { CLUBS: C, DIAMONDS: D, HEARTS: H, SPADES: S, NOTRUMP: NT } = cards;
const ct = (level, strain, doubled = 0) => ({ level, strain, doubled });
const total = (level, strain, tricks, vul, doubled) =>
	scoring.score(ct(level, strain, doubled), tricks, vul).total;

test('contract points', () => {
	assert.equal(scoring.contractPoints(ct(2, C)), 40);
	assert.equal(scoring.contractPoints(ct(4, S)), 120);
	assert.equal(scoring.contractPoints(ct(3, NT)), 100);
	assert.equal(scoring.contractPoints(ct(1, NT)), 40);
	assert.equal(scoring.contractPoints(ct(7, NT)), 220);
	assert.equal(scoring.contractPoints(ct(5, D)), 100);
	assert.equal(scoring.contractPoints(ct(4, S, 1)), 240);
	assert.equal(scoring.contractPoints(ct(1, S, 2)), 120);
	assert.equal(scoring.tricksNeeded(ct(4, S)), 10);
	assert.equal(scoring.tricksNeeded(ct(7, NT)), 13);
});

test('making contracts', () => {
	assert.equal(total(4, S, 10, false), 420);
	assert.equal(total(4, S, 10, true), 620);
	assert.equal(total(3, NT, 9, false), 400);
	assert.equal(total(3, NT, 9, true), 600);
	assert.equal(total(2, H, 8, false), 110);
	assert.equal(total(1, NT, 7, false), 90);
	assert.equal(total(5, D, 11, false), 400);
	assert.equal(total(6, S, 12, false), 980);
	assert.equal(total(6, S, 12, true), 1430);
	assert.equal(total(7, NT, 13, true), 2220);
	assert.equal(total(7, NT, 13, false), 1520);
	// A redoubled one-spade is worth game: 120 contract points clears 100.
	assert.equal(total(1, S, 7, false, 2), 520);
});

test('overtricks', () => {
	assert.equal(total(2, C, 10, false), 130);
	assert.equal(total(4, S, 11, false), 450);
	assert.equal(total(3, NT, 11, true), 660);
	assert.equal(total(4, S, 11, false, 1), 690);
	// 240 contract + 500 game + 50 insult + 200 doubled overtrick.
	assert.equal(total(4, S, 11, true, 1), 990);
});

test('failing contracts', () => {
	assert.equal(total(4, S, 9, false), -50);
	assert.equal(total(4, S, 9, true), -100);
	assert.equal(total(3, NT, 7, true), -200);
	assert.equal(total(4, S, 9, false, 1), -100);
	assert.equal(total(4, S, 8, false, 1), -300);
	assert.equal(total(4, S, 7, false, 1), -500);
	assert.equal(total(4, S, 6, false, 1), -800);
	assert.equal(total(4, S, 7, true, 1), -800);
	assert.equal(total(4, S, 8, false, 2), -600);
});

test('cards and seats', () => {
	assert.equal(cards.newDeck().length, 52);
	assert.equal(cards.nextSeat(cards.WEST), cards.NORTH);
	assert.equal(cards.nextSeat(cards.NORTH), cards.EAST);
	assert.equal(cards.partner(cards.SOUTH), cards.NORTH);
	assert.equal(cards.partner(cards.EAST), cards.WEST);
	assert.equal(cards.sameSide(cards.NORTH, cards.SOUTH), true);
	assert.equal(cards.sameSide(cards.NORTH, cards.EAST), false);
});

test('dealing: 13 cards each, 40 HCP, no duplicates (200 deals)', () => {
	let badSize = 0,
		badHcp = 0,
		dupes = 0;
	for (let trial = 1; trial <= 200; trial++) {
		const hands = cards.deal(rng.newRng('DEAL' + trial));
		const seen = new Set();
		let hcpTotal = 0;
		for (let seat = 1; seat <= 4; seat++) {
			if (hands[seat].length !== 13) badSize++;
			hcpTotal += cards.hcp(hands[seat]);
			for (const c of hands[seat]) {
				const code = cards.code(c);
				if (seen.has(code)) dupes++;
				seen.add(code);
			}
		}
		if (hcpTotal !== 40) badHcp++;
	}
	assert.equal(badSize, 0);
	assert.equal(badHcp, 0);
	assert.equal(dupes, 0);
});

test('hand evaluation', () => {
	const hand = [
		cards.card(S, 14), cards.card(S, 13), cards.card(S, 12),
		cards.card(H, 11), cards.card(H, 2),
		cards.card(D, 14), cards.card(D, 7), cards.card(D, 5), cards.card(D, 3),
		cards.card(C, 9), cards.card(C, 8), cards.card(C, 4), cards.card(C, 2)
	];
	assert.equal(cards.hcp(hand), 4 + 3 + 2 + 1 + 4);
	assert.equal(cards.countSuit(hand, S), 3);
	assert.equal(cards.longestSuit(hand)[1], 4);
	assert.equal(cards.sortedShape(hand).join('-'), '4-4-3-2');
	assert.equal(cards.isBalanced(hand), true);
	assert.equal(cards.honoursInSuit(hand, S), 3);
	assert.equal(cards.shortnessPoints(hand), 1);
});

test('reproducibility', () => {
	const codes = (hands) => hands.slice(1).map((h) => h.map(cards.code).join(' '));
	const a = cards.deal(rng.newRng('SAMESEED'));
	const b = cards.deal(rng.newRng('SAMESEED'));
	assert.deepEqual(codes(a), codes(b), 'same seed deals the same cards');
	const c = cards.deal(rng.newRng('OTHERSEED'));
	assert.notDeepEqual(codes(a)[0], codes(c)[0], 'different seed deals differently');

	// Unseeded runs started back to back must still differ.
	const seen = new Set();
	for (let i = 0; i < 50; i++) seen.add(rng.randomSeedString(rng.newRng()));
	assert.equal(seen.size, 50);
});

test('trick winners', () => {
	const trick = [
		{ seat: cards.WEST, card: cards.card(S, 14) },
		{ seat: cards.NORTH, card: cards.card(S, 3) },
		{ seat: cards.EAST, card: cards.card(H, 2) },
		{ seat: cards.SOUTH, card: cards.card(S, 13) }
	];
	assert.equal(play.trickWinner(trick, H).seat, cards.EAST, 'low trump beats the ace of the led suit');

	const trick2 = [
		{ seat: cards.WEST, card: cards.card(S, 10) },
		{ seat: cards.NORTH, card: cards.card(S, 12) },
		{ seat: cards.EAST, card: cards.card(D, 14) },
		{ seat: cards.SOUTH, card: cards.card(S, 4) }
	];
	assert.equal(play.trickWinner(trick2, NT).seat, cards.NORTH);
	assert.equal(play.trickWinner(trick2, NT).card.suit, S, 'discard cannot win');

	const trick3 = [
		{ seat: cards.WEST, card: cards.card(D, 5) },
		{ seat: cards.NORTH, card: cards.card(H, 7) },
		{ seat: cards.EAST, card: cards.card(H, 11) },
		{ seat: cards.SOUTH, card: cards.card(D, 14) }
	];
	assert.equal(play.trickWinner(trick3, H).seat, cards.EAST, 'higher trump wins');
});

test('follow-suit enforcement', () => {
	const hands = [];
	hands[cards.NORTH] = [cards.card(S, 5), cards.card(H, 9)];
	hands[cards.EAST] = [cards.card(S, 2), cards.card(D, 9)];
	hands[cards.SOUTH] = [cards.card(H, 3), cards.card(D, 4)];
	hands[cards.WEST] = [cards.card(S, 14), cards.card(C, 6)];
	const st = play.newPlay(hands, NT, cards.WEST);
	assert.equal(st.turn, cards.WEST);
	assert.equal(play.legalPlays(st, cards.WEST).length, 2);

	play.play(st, cards.WEST, st.hands[cards.WEST][0]);
	assert.equal(st.ledSuit, S);
	const northLegal = play.legalPlays(st, cards.NORTH);
	assert.equal(northLegal.length, 1, 'north must follow suit');
	assert.equal(northLegal[0].suit, S);

	play.play(st, cards.NORTH, northLegal[0]);
	play.play(st, cards.EAST, play.legalPlays(st, cards.EAST)[0]);
	assert.equal(play.legalPlays(st, cards.SOUTH).length, 2, 'void seat may discard freely');
	play.play(st, cards.SOUTH, play.legalPlays(st, cards.SOUTH)[0]);

	assert.equal(st.tricks.length, 1);
	assert.equal(st.tricks[0].winner, cards.WEST);
	assert.equal(st.voids[cards.SOUTH][S], true);
	assert.equal(st.turn, cards.WEST);
	assert.throws(() => play.play(st, cards.NORTH, st.hands[cards.NORTH][0]), /not this seat/);
});

test('random play always makes 13 tricks (50 deals)', () => {
	for (let trial = 1; trial <= 50; trial++) {
		const r = rng.newRng('PLAYOUT' + trial);
		const st = play.newPlay(cards.deal(r), r.int(1, 5), cards.WEST);
		while (!st.complete) {
			const legal = play.legalPlays(st, st.turn);
			play.play(st, st.turn, legal[r.int(1, legal.length) - 1]);
		}
		assert.equal(st.tricks.length, 13);
		assert.equal(st.nsTricks + st.ewTricks, 13);
	}
});
