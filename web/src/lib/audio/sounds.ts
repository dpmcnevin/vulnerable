// Every sound effect, and the background music, as synthesis recipes.
// Port of src/audio/sounds.lua. Pure TS: each entry renders a buffer; the
// browser side (sound.ts) turns buffers into Web Audio AudioBuffers.

import * as S from './synth.ts';
import type { Buffer } from './synth.ts';

function snap(b: Buffer, t: number, pitch: number, vol: number) {
	// Card on felt: a bright paper tick over a soft low thump.
	S.noise(b, t, 0.05, { vol: 0.55 * vol, decay: 0.012, highpass: 0.92 });
	S.noise(b, t, 0.08, { vol: 0.35 * vol, decay: 0.025, lowpass: 0.9 });
	S.tone(b, t, 0.07, 150 * pitch, { vol: 0.35 * vol, decay: 0.02, glide: 90 * pitch });
}

function arpeggio(notes: number[], step: number, len: number, vol: number): Buffer {
	const b = S.buffer(step * notes.length + len);
	notes.forEach((n, i) => {
		S.bell(b, i * step, len, S.midi(n), vol);
		S.tone(b, i * step, len * 0.8, S.midi(n), { wave: 'tri', vol: vol * 0.25, decay: len * 0.3 });
	});
	return b;
}

const recipes: Record<string, () => Buffer> = {
	card_play: () => {
		const b = S.buffer(0.12);
		snap(b, 0, 1, 1);
		return S.normalize(b, 0.8);
	},
	card_hover: () => {
		const b = S.buffer(0.04);
		S.tone(b, 0, 0.03, 2400, { vol: 0.4, decay: 0.006 });
		S.noise(b, 0, 0.02, { vol: 0.15, decay: 0.004, highpass: 0.95 });
		return S.normalize(b, 0.35);
	},
	deal: () => {
		const b = S.buffer(0.09);
		S.noise(b, 0, 0.07, { vol: 0.5, decay: 0.02, highpass: 0.85 });
		S.noise(b, 0.005, 0.06, { vol: 0.2, decay: 0.015, lowpass: 0.7 });
		return S.normalize(b, 0.55);
	},
	flip: () => {
		const b = S.buffer(0.1);
		S.noise(b, 0, 0.08, { vol: 0.5, decay: 0.03, highpass: 0.8, attack: 0.02 });
		return S.normalize(b, 0.5);
	},
	// Two quick bell notes a fourth apart; pitched up for each trick in a row.
	trick_win: () => {
		const b = S.buffer(0.7);
		S.bell(b, 0, 0.5, S.midi(76), 0.5);
		S.bell(b, 0.08, 0.6, S.midi(81), 0.55);
		return S.normalize(b, 0.7);
	},
	trick_lose: () => {
		const b = S.buffer(0.45);
		S.tone(b, 0, 0.4, S.midi(52), { wave: 'tri', vol: 0.5, decay: 0.12, glide: S.midi(47) });
		S.noise(b, 0, 0.12, { vol: 0.2, decay: 0.04, lowpass: 0.95 });
		return S.normalize(b, 0.6);
	},
	// Score tally tick: a short wood-block.
	tick: () => {
		const b = S.buffer(0.08);
		S.tone(b, 0, 0.06, 1200, { vol: 0.5, decay: 0.012, partials: [[2.3, 0.3, 0.5]] });
		return S.normalize(b, 0.5);
	},
	// A multiplier landing: bright FM ping.
	mult: () => {
		const b = S.buffer(0.5);
		S.tone(b, 0, 0.45, S.midi(84), { vol: 0.5, decay: 0.12, fm: { ratio: 3.5, index: 3, decay: 0.08 } });
		S.tone(b, 0, 0.3, S.midi(96), { vol: 0.15, decay: 0.05 });
		return S.normalize(b, 0.6);
	},
	// The final total slamming down.
	total: () => {
		const b = S.buffer(0.8);
		S.tone(b, 0, 0.5, 70, { vol: 0.8, decay: 0.12, glide: 45 });
		S.noise(b, 0, 0.3, { vol: 0.4, decay: 0.08, lowpass: 0.85 });
		S.bell(b, 0.01, 0.7, S.midi(72), 0.35);
		S.bell(b, 0.01, 0.7, S.midi(79), 0.3);
		return S.softClip(S.normalize(b, 0.9), 1.1);
	},
	made: () => S.normalize(arpeggio([72, 76, 79, 84], 0.085, 0.9, 0.4), 0.75),
	down: () => {
		const b = S.buffer(0.9);
		S.tone(b, 0, 0.35, S.midi(64), { wave: 'tri', vol: 0.45, decay: 0.2 });
		S.tone(b, 0.22, 0.6, S.midi(60), { wave: 'tri', vol: 0.45, decay: 0.3, glide: S.midi(58) });
		S.noise(b, 0.22, 0.25, { vol: 0.1, decay: 0.1, lowpass: 0.97 });
		return S.normalize(b, 0.6);
	},
	board_won: () => {
		const b = arpeggio([67, 72, 76, 79, 84, 88], 0.07, 1.2, 0.35);
		S.tone(b, 0, 1.0, S.midi(48), { wave: 'tri', vol: 0.3, decay: 0.5 });
		return S.normalize(b, 0.8);
	},
	game_over: () => {
		const b = S.buffer(1.6);
		[67, 63, 60, 55].forEach((n, i) => {
			S.tone(b, i * 0.25, 0.7, S.midi(n), { wave: 'tri', vol: 0.4, decay: 0.35, vibrato: [5, 0.006] });
		});
		return S.normalize(b, 0.6);
	},
	coin: () => {
		const b = S.buffer(0.5);
		S.bell(b, 0, 0.35, S.midi(88), 0.5);
		S.bell(b, 0.07, 0.4, S.midi(93), 0.5);
		return S.normalize(b, 0.55);
	},
	sell: () => {
		const b = S.buffer(0.4);
		S.bell(b, 0, 0.3, S.midi(91), 0.5);
		S.bell(b, 0.06, 0.35, S.midi(86), 0.45);
		return S.normalize(b, 0.5);
	},
	// A riffle shuffle: a quick run of tiny card snaps.
	reroll: () => {
		const b = S.buffer(0.5);
		for (let i = 0; i <= 13; i++) S.noise(b, i * 0.026, 0.04, { vol: 0.35, decay: 0.01, highpass: 0.9 });
		return S.normalize(b, 0.5);
	},
	button: () => {
		const b = S.buffer(0.07);
		S.tone(b, 0, 0.05, 660, { vol: 0.4, decay: 0.015, glide: 880 });
		S.noise(b, 0, 0.02, { vol: 0.15, decay: 0.005, highpass: 0.9 });
		return S.normalize(b, 0.4);
	},
	select: () => {
		const b = S.buffer(0.12);
		S.tone(b, 0, 0.1, S.midi(79), { vol: 0.4, decay: 0.03, fm: { ratio: 2, index: 1.2, decay: 0.03 } });
		return S.normalize(b, 0.4);
	},
	// The defenders double: a low, dramatic brass-like stab.
	doubled: () => {
		const b = S.buffer(0.9);
		for (const n of [41, 48, 53, 56]) {
			S.tone(b, 0, 0.8, S.midi(n), { wave: 'saw', vol: 0.18, attack: 0.02, decay: 0.25 });
		}
		S.noise(b, 0, 0.2, { vol: 0.3, decay: 0.05, lowpass: 0.9 });
		// Darken the saws with a crude lowpass pass.
		let y = 0;
		const d = b.data;
		for (let i = 0; i < d.length; i++) {
			y += (d[i] - y) * 0.18;
			d[i] = y;
		}
		return S.softClip(S.normalize(b, 0.85), 1.3);
	},
	// Playing a ploy: a quick shimmering rise.
	ploy: () => {
		const b = S.buffer(0.8);
		[76, 80, 83, 88, 92].forEach((n, i) => {
			S.tone(b, i * 0.045, 0.5, S.midi(n), { vol: 0.3, decay: 0.15, fm: { ratio: 2.01, index: 1.6, decay: 0.1 } });
		});
		S.noise(b, 0, 0.5, { vol: 0.06, attack: 0.1, decay: 0.2, highpass: 0.95 });
		return S.normalize(b, 0.65);
	}
};

// Reseed the noise generator per sound (in sorted name order, as the Lua
// version does), so each renders identically regardless of render order.
export const defs: Record<string, () => Buffer> = {};
{
	let seed = 1000;
	for (const name of Object.keys(recipes).sort()) {
		seed += 7919;
		const s0 = seed;
		const render = recipes[name];
		defs[name] = () => {
			S.seedNoise(s0);
			return render();
		};
	}
}

// --------------------------------------------------------------------- music

export const MUSIC_BPM = 84;
export const MUSIC_RATE = 22050;

// Eight bars in F, a gentle lounge turnaround, two choruses with variation.
const CHORDS = [
	{ root: 41, voicing: [57, 60, 64, 65] }, // Fmaj7
	{ root: 38, voicing: [57, 60, 62, 65] }, // Dm7
	{ root: 43, voicing: [58, 62, 65, 67] }, // Gm7
	{ root: 36, voicing: [58, 60, 64, 67] }, // C7
	{ root: 41, voicing: [57, 60, 64, 65] }, // Fmaj7
	{ root: 38, voicing: [54, 57, 60, 62] }, // D7
	{ root: 43, voicing: [58, 62, 65, 67] }, // Gm7
	{ root: 36, voicing: [58, 60, 64, 67] } // C7
];

function ep(buf: Buffer, t: number, note: number, vol: number) {
	// Soft electric piano: sine with a little FM bark that fades quickly.
	S.tone(buf, t, 1.6, S.midi(note), { vol, attack: 0.006, decay: 0.6, fm: { ratio: 1, index: 1.4, decay: 0.12 } });
}

function bass(buf: Buffer, t: number, note: number, dur: number) {
	S.tone(buf, t, dur, S.midi(note), { wave: 'tri', vol: 0.42, attack: 0.008, decay: dur * 0.7, partials: [[2, 0.25, 0.4]] });
}

/**
 * Render the music loop one bar at a time. Yields progress in [0, 1) after
 * each bar (so a caller can spread the work over frames) and returns a
 * buffer whose end flows seamlessly into its start.
 */
export function* renderMusic(): Generator<number, Buffer> {
	S.seedNoise(777);
	const beat = 60 / MUSIC_BPM;
	const bars = CHORDS.length * 2;
	const loopLen = Math.floor(bars * 4 * beat * MUSIC_RATE);
	// Two spare seconds for note tails, folded back onto the start below.
	const buf = S.buffer(bars * 4 * beat + 2, MUSIC_RATE);
	const swing = (beat * 2) / 3;

	for (let bar = 0; bar < bars; bar++) {
		const chord = CHORDS[bar % CHORDS.length];
		const nextChord = CHORDS[(bar + 1) % CHORDS.length];
		const t0 = bar * 4 * beat;
		const second = bar >= CHORDS.length;

		// Walking bass: root, fifth, a passing tone, then a chromatic approach.
		const r = chord.root;
		const walk = [r, r + 7, second ? r + 9 : r + 4, nextChord.root + (bar % 2 === 0 ? 1 : -1)];
		walk.forEach((n, i) => bass(buf, t0 + i * beat, n, beat * 0.95));

		// Piano comping: Charleston rhythm, varied on the repeat.
		const hits = second ? [0, 1 + 2 / 3, 3] : [0, 1 + 2 / 3];
		for (const h of hits) {
			chord.voicing.forEach((n, k) => ep(buf, t0 + h * beat + k * 0.008, n, 0.075));
		}
		// A little melodic answer on the last bar of each phrase.
		if (bar % 4 === 3) {
			const top = chord.voicing[3] + 12;
			ep(buf, t0 + 2 * beat, top, 0.06);
			ep(buf, t0 + 2 * beat + swing, top - 2, 0.05);
			ep(buf, t0 + 3 * beat, top - 5, 0.05);
		}

		// Ride cymbal on swung eighths; brushes on 2 and 4.
		for (let b = 0; b <= 3; b++) {
			const tb = t0 + b * beat;
			S.noise(buf, tb, 0.25, { vol: 0.05, decay: 0.08, highpass: 0.97 });
			if (b === 1 || b === 3) {
				S.noise(buf, tb + swing, 0.15, { vol: 0.035, decay: 0.05, highpass: 0.97 });
				S.noise(buf, tb, 0.3, { vol: 0.06, attack: 0.03, decay: 0.1, lowpass: 0.5, highpass: 0.6 });
			}
		}
		yield bar / bars;
	}

	// Fold note tails past the loop point back onto the start.
	const d = buf.data;
	for (let i = loopLen; i < d.length; i++) d[i - loopLen] += d[i];
	const looped: Buffer = { data: d.slice(0, loopLen), rate: buf.rate };
	return S.normalize(looped, 0.75);
}

/** Render the whole loop synchronously (for workers and tests). */
export function renderMusicAll(): Buffer {
	const gen = renderMusic();
	for (;;) {
		const r = gen.next();
		if (r.done) return r.value;
	}
}
