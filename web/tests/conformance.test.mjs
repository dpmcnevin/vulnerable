// Lua conformance: the TypeScript engine must reproduce the Lua engine bit
// for bit. The fixture is produced by `npm run fixture` (tools/dump_fixture.lua,
// run under luajit against the Lua game in the parent folder) and committed,
// so this test needs no Lua installed. Regenerate it whenever the Lua engine
// changes, then port the change until this passes again.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dump, dumpPixels, dumpAudio } from './helpers/dump.ts';

const fixture = JSON.parse(
	readFileSync(new URL('./fixtures/lua-conformance.json', import.meta.url), 'utf8')
);
// Round-trip through JSON so both sides have the same plain shape.
const ours = JSON.parse(JSON.stringify(dump()));

test('string hash matches Lua', () => {
	assert.deepEqual(ours.hash, fixture.hash);
});

test('rng streams (nextUint, int, seed strings, shuffle, branch) match Lua', () => {
	assert.deepEqual(ours.streams, fixture.streams);
});

test('deals and partner descriptions match Lua', () => {
	assert.deepEqual(ours.deals, fixture.deals);
});

test('scoring table and board targets match Lua', () => {
	assert.deepEqual(ours.scores, fixture.scores);
	assert.deepEqual(ours.targets, fixture.targets);
});

test('bot runs match Lua exactly', () => {
	assert.equal(ours.botRuns.length, fixture.botRuns.length);
	for (let i = 0; i < fixture.botRuns.length; i++) {
		assert.deepEqual(ours.botRuns[i], fixture.botRuns[i], `bot run ${fixture.botRuns[i].seed}`);
	}
});

test('stepwise human-style runs (ploys, shop, rerolls) match Lua exactly', () => {
	assert.equal(ours.playerRuns.length, fixture.playerRuns.length);
	for (let i = 0; i < fixture.playerRuns.length; i++) {
		const a = ours.playerRuns[i],
			b = fixture.playerRuns[i];
		assert.deepEqual(a.run.trace, b.run.trace, `trace for ${b.seed}`);
		assert.deepEqual(a.run.final, b.run.final, `final state for ${b.seed}`);
	}
});

test('pixel-art cards, back and icons match Lua pixel for pixel', () => {
	const px = dumpPixels();
	assert.deepEqual(px.pixel, fixture.pixel);
	assert.equal(px.pixelBack, fixture.pixelBack);
	assert.deepEqual(px.icons, fixture.icons);
});

test('synthesized sounds and music match Lua', () => {
	const audio = dumpAudio();
	const close = (a, b, label) =>
		assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${label}: ${a} vs ${b}`);
	const compare = (a, b, label) => {
		assert.equal(a.n, b.n, `${label} length`);
		assert.equal(a.rate, b.rate, `${label} rate`);
		close(a.sumAbs, b.sumAbs, `${label} sumAbs`);
		close(a.sumSq, b.sumSq, `${label} sumSq`);
		a.probe.forEach((v, i) => close(v, b.probe[i], `${label} probe ${i}`));
	};
	assert.deepEqual(audio.sounds.map((s) => s[0]), fixture.sounds.map((s) => s[0]));
	audio.sounds.forEach((s, i) => compare(s[1], fixture.sounds[i][1], s[0]));
	compare(audio.music, fixture.music, 'music');
});
