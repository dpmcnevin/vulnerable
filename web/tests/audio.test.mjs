// The synthesized sounds and the generative music.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sounds from '../src/lib/audio/sounds.ts';
import { peak } from '../src/lib/audio/synth.ts';

test('every sound effect renders, is audible and never clips', () => {
	for (const [name, render] of Object.entries(sounds.defs)) {
		const b = render();
		assert.ok(b.data.length > 0, name);
		const p = peak(b);
		assert.ok(p > 0.2 && p <= 1, `${name} peak ${p}`);
	}
});

test('music takes: same seed, same take; new seed, new take', () => {
	const a = sounds.renderTakeAll('alpha');
	const a2 = sounds.renderTakeAll('alpha');
	const b = sounds.renderTakeAll('beta');
	assert.deepEqual(a.buffer.data.slice(0, 50000), a2.buffer.data.slice(0, 50000));
	let diff = 0;
	const n = Math.min(a.buffer.data.length, b.buffer.data.length);
	for (let i = 0; i < n; i += 97) diff += Math.abs(a.buffer.data[i] - b.buffer.data[i]);
	assert.ok(diff > 1, 'different seeds render different music');
});

test('music takes have room for tails and stay in range', () => {
	for (const seed of ['x', 'y', 'z']) {
		const t = sounds.renderTakeAll(seed);
		const bars = t.length / sounds.MUSIC_RATE / (240 / sounds.MUSIC_BPM);
		assert.ok(Math.abs(bars - Math.round(bars)) < 1e-3 && bars >= 40 && bars <= 48, `${seed}: ${bars} bars`);
		assert.ok(t.buffer.data.length > t.length, 'tails run past the next take start');
		const p = peak(t.buffer);
		assert.ok(p > 0.3 && p < 1, `${seed} peak ${p}`);
	}
});
