// Every sound effect, and the background music, as synthesis recipes.
// Port of src/audio/sounds.lua. Pure TS: each entry renders a buffer; the
// browser side (sound.ts) turns buffers into Web Audio AudioBuffers.

import * as S from './synth.ts';
import type { Buffer } from './synth.ts';
import { newRng, type RNG } from '../rules/rng.ts';

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
 * The original 16-bar loop, exactly as src/audio/sounds.lua renders it. Kept
 * so the conformance test can check the synth against Lua; the game itself
 * plays the longer arrangement in renderMusic below.
 *
 * Renders one bar at a time. Yields progress in [0, 1) after
 * each bar (so a caller can spread the work over frames) and returns a
 * buffer whose end flows seamlessly into its start.
 */
export function* renderMusicClassic(): Generator<number, Buffer> {
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

function drain(gen: Generator<number, Buffer>): Buffer {
	for (;;) {
		const r = gen.next();
		if (r.done) return r.value;
	}
}

/** The original loop, synchronously (for the conformance test). */
export function renderMusicClassicAll(): Buffer {
	return drain(renderMusicClassic());
}


// ------------------------------------------------------- generative arrangement
//
// The web port's music. Rather than one fixed loop, each pass of the music
// is a fresh "take" generated from a seed: a ~40-bar AABA-style chart whose
// section order, bass feel, comping rhythms, drum patterns and vibraphone
// melodies are all drawn from the seed. The player renders the next take
// while the current one plays and schedules it to start exactly where this
// one ends, so the music keeps changing without a seam. The same seed always
// renders the same take.

type Chord = { root: number; voicing: number[] };

const A_CHANGES = CHORDS;
// The last A can swap in a turnaround: Fmaj7 Dm7 Gm7 C7 | Am7 D7 Gm7 C7.
const A_TURNAROUND: Chord[] = [
	CHORDS[0], CHORDS[1], CHORDS[2], CHORDS[3],
	{ root: 45, voicing: [55, 60, 64, 67] }, // Am7
	{ root: 38, voicing: [54, 57, 60, 64] }, // D7
	CHORDS[6],
	{ root: 36, voicing: [58, 61, 64, 67] } // C7(b9)
];
// Two bridges to the subdominant.
const BRIDGES: Chord[][] = [
	[
		{ root: 46, voicing: [57, 60, 62, 65] }, // Bbmaj7
		{ root: 39, voicing: [55, 58, 61, 63] }, // Eb7
		{ root: 45, voicing: [55, 60, 64, 67] }, // Am7
		{ root: 38, voicing: [54, 57, 60, 64] }, // D7(9)
		{ root: 43, voicing: [58, 62, 65, 69] }, // Gm9
		{ root: 43, voicing: [58, 60, 65, 67] }, // Gm11
		{ root: 36, voicing: [58, 62, 64, 69] }, // C13
		{ root: 36, voicing: [58, 61, 64, 68] } // C7(b9)
	],
	[
		{ root: 41, voicing: [57, 60, 63, 65] }, // F7
		{ root: 46, voicing: [57, 60, 62, 65] }, // Bbmaj7
		{ root: 46, voicing: [56, 61, 62, 65] }, // Bbm6
		{ root: 41, voicing: [57, 60, 64, 65] }, // Fmaj7
		{ root: 43, voicing: [58, 62, 65, 69] }, // Gm9
		{ root: 36, voicing: [58, 62, 64, 69] }, // C13
		{ root: 45, voicing: [55, 60, 64, 67] }, // Am7
		{ root: 36, voicing: [58, 61, 64, 68] } // C7(b9)
	]
];

const T = 2 / 3; // the swung upbeat
// Comping patterns (hit beats within a bar).
const COMPS = [
	[0, 1 + T], [1 + T], [0, 2 + T], [1 + T, 3], [T, 2], [1 + T, 3], [0, 1 + T, 3],
	[T, 2 + T], [1, 2 + T], [0, 1 + T, 3 + T], [0, 2], [2 + T], [T, 1 + T, 3]
];

interface Section {
	chords: Chord[];
	bass: 'two' | 'walk';
	comp: number[][];
	melody: boolean;
	ride: 'light' | 'swing' | 'busy';
}

/** Draw a take's form from the seed. */
function arrange(rng: RNG): Section[] {
	const pickComp = () => Array.from({ length: 4 }, () => COMPS[rng.int(1, COMPS.length) - 1]);
	const ride = (): Section['ride'] => (['light', 'swing', 'swing', 'busy'] as const)[rng.int(1, 4) - 1];
	const bridge = BRIDGES[rng.int(1, BRIDGES.length) - 1];
	// The first section always starts gently, the last winds down, so takes
	// join smoothly; the middle varies.
	const middle: Section[] = [
		{ chords: A_CHANGES, bass: 'walk', comp: pickComp(), melody: true, ride: ride() },
		{ chords: bridge, bass: 'walk', comp: pickComp(), melody: true, ride: rng.chance(0.6) ? 'busy' : 'swing' },
		{ chords: A_CHANGES, bass: rng.chance(0.8) ? 'walk' : 'two', comp: pickComp(), melody: rng.chance(0.8), ride: ride() }
	];
	// Sometimes an extra chorus of the A or the bridge.
	if (rng.chance(0.35)) {
		middle.splice(rng.int(1, middle.length), 0, {
			chords: rng.chance(0.5) ? A_CHANGES : bridge,
			bass: 'walk',
			comp: pickComp(),
			melody: true,
			ride: ride()
		});
	}
	return [
		{ chords: A_CHANGES, bass: 'two', comp: pickComp(), melody: rng.chance(0.3), ride: 'light' },
		...middle,
		{ chords: rng.chance(0.6) ? A_TURNAROUND : A_CHANGES, bass: 'two', comp: pickComp(), melody: false, ride: 'light' }
	];
}

// F major plus the blue Eb, for passing tones in the melody.
const SCALE = [0, 2, 4, 5, 7, 9, 10, 11].map((x) => (x + 5) % 12);

function vibes(buf: Buffer, t: number, note: number, vol: number, dur = 0.9) {
	S.tone(buf, t, dur, S.midi(note), {
		vol,
		attack: 0.003,
		decay: dur * 0.55,
		vibrato: [5.5, 0.004],
		partials: [[4.0, 0.18, 0.25], [10.0, 0.05, 0.1]]
	});
}

function kick(buf: Buffer, t: number, vol = 0.18) {
	S.tone(buf, t, 0.18, 70, { vol, attack: 0.002, decay: 0.05, glide: 42 });
}

/** A four-bar phrase of melody over the given chords, as [beatOffset, note, len]. */
function phrase(rng: RNG, chords: Chord[], firstBar: number): [number, number, number][] {
	const RHYTHMS = [
		[0, 1, 1 + T, 2 + T], [T, 1 + T, 2, 3], [0, T, 1 + T, 3], [0, 2, 2 + T, 3 + T],
		[1, 1 + T, 2 + T, 3], [0, 1 + T, 3], [T, 1, 2, 2 + T, 3 + T], [0, 1, 2, 3]
	];
	const out: [number, number, number][] = [];
	let note = chords[firstBar % chords.length].voicing[3] + 12 + rng.int(-3, 3);
	// Sometimes the vibes sit out a bar, leaving space.
	const rest = rng.chance(0.35) ? rng.int(1, 3) - 1 : -1;
	for (let k = 0; k < 4; k++) {
		const chord = chords[(firstBar + k) % chords.length];
		const tones = chord.voicing.flatMap((n) => [n + 12, n + 24]);
		if (k === rest) continue;
		if (k === 3) {
			const target = tones.reduce((a, b) => (Math.abs(b - note) < Math.abs(a - note) ? b : a));
			out.push([k * 4 + (rng.chance(0.5) ? 0 : T), target, 2.2]);
			note = target;
			continue;
		}
		const rhythm = RHYTHMS[rng.int(1, RHYTHMS.length) - 1];
		rhythm.forEach((b, i) => {
			if (Number.isInteger(b) || rng.chance(0.35)) {
				const want = note + rng.int(-4, 4);
				note = tones.reduce((a, c) => (Math.abs(c - want) < Math.abs(a - want) ? c : a));
			} else {
				const dir = rng.chance(0.5) ? 1 : -1;
				let n = note + dir;
				while (!SCALE.includes(((n % 12) + 12) % 12)) n += dir;
				note = n;
			}
			note = Math.max(67, Math.min(91, note));
			const next = i + 1 < rhythm.length ? rhythm[i + 1] : 4;
			out.push([k * 4 + b, note, Math.min(1.2, (next - b) * (60 / MUSIC_BPM) + 0.25)]);
		});
	}
	return out;
}

export interface Take {
	/** Samples, including up to two seconds of ringing tails past `length`. */
	buffer: Buffer;
	/** Where the next take should start, in samples. */
	length: number;
}

/**
 * Render one take of the music for `seed`. Yields progress after each bar.
 * The returned buffer runs past `length` with note tails, which overlap the
 * start of the next take when they are scheduled back to back.
 */
export function* renderTake(seed: string): Generator<number, Take> {
	const rng = newRng('lounge:' + seed);
	S.seedNoise(rng.int(1, 2147483646));
	const sections = arrange(rng);
	const beat = 60 / MUSIC_BPM;
	const bars = sections.reduce((n, sec) => n + sec.chords.length, 0);
	const length = Math.floor(bars * 4 * beat * MUSIC_RATE);
	const buf = S.buffer(bars * 4 * beat + 2, MUSIC_RATE);
	const swing = beat * T;
	const plan = sections.flatMap((sec) => sec.chords);

	let bar = 0;
	for (const sec of sections) {
		const sectionStart = bar;
		if (sec.melody) {
			for (let ph = 0; ph < sec.chords.length; ph += 4) {
				for (const [b, n, len] of phrase(rng, sec.chords, ph)) {
					vibes(buf, (sectionStart * 4 + ph * 4 + b) * beat + (rng.next() - 0.5) * 0.012, n, 0.055 + rng.next() * 0.015, len);
				}
			}
		}

		for (let i = 0; i < sec.chords.length; i++, bar++) {
			const chord = plan[bar];
			// The bar after the take's last is the first of the next take: F.
			const nextChord = plan[bar + 1] ?? CHORDS[0];
			const t0 = bar * 4 * beat;
			const r = chord.root;
			const phraseEnd = i % 4 === 3;

			if (sec.bass === 'two') {
				bass(buf, t0, r, beat * 1.9);
				bass(buf, t0 + 2 * beat, phraseEnd ? nextChord.root + 1 : r + 7, beat * 1.9);
			} else {
				const third = chord.voicing.some((n) => (n - r) % 12 === 3) ? r + 3 : r + 4;
				const passing = [r + 7, third, r + 9, r + 5][rng.int(1, 4) - 1];
				const approach = nextChord.root + (rng.chance(0.5) ? 1 : -1);
				const walk = [r, rng.chance(0.5) ? third : r + 7, passing, approach];
				walk.forEach((n, k) => bass(buf, t0 + k * beat, n, beat * 0.95));
				if (rng.chance(0.25)) bass(buf, t0 + 2 * beat + swing, passing + 1, beat * 0.3);
			}

			const hits = sec.comp[i % sec.comp.length];
			const lift = rng.chance(0.15) ? 12 : 0;
			const roll = rng.chance(0.3) ? 0.022 : 0.008;
			for (const h of hits) {
				chord.voicing.forEach((n, k) => ep(buf, t0 + h * beat + k * roll, n + (k === 3 ? lift : 0), 0.07));
			}
			if (phraseEnd && !sec.melody) {
				const top = chord.voicing[3] + 12;
				const shapes = [[0, -2, -5], [-1, -3, -5], [2, 0, -3], [0, 2, 4]];
				const shape = shapes[rng.int(1, shapes.length) - 1];
				ep(buf, t0 + 2 * beat, top + shape[0], 0.06);
				ep(buf, t0 + 2 * beat + swing, top + shape[1], 0.05);
				ep(buf, t0 + 3 * beat, top + shape[2], 0.05);
			}

			for (let b = 0; b <= 3; b++) {
				const tb = t0 + b * beat;
				S.noise(buf, tb, 0.25, { vol: sec.ride === 'light' ? 0.035 : 0.05, decay: 0.08, highpass: 0.97 });
				const skip = sec.ride === 'busy' ? true : sec.ride === 'swing' ? b === 1 || b === 3 : b === 3;
				if (skip) S.noise(buf, tb + swing, 0.15, { vol: 0.035, decay: 0.05, highpass: 0.97 });
				if (b === 1 || b === 3) {
					S.noise(buf, tb, 0.3, { vol: 0.06, attack: 0.03, decay: 0.1, lowpass: 0.5, highpass: 0.6 });
				}
			}
			if (sec.ride !== 'light' && (i % 2 === 0 || rng.chance(0.3))) kick(buf, t0, 0.12);
			if (phraseEnd && rng.chance(0.7)) {
				for (let k = 0; k < 3; k++) {
					S.noise(buf, t0 + 3 * beat + (k * beat) / 3, 0.12, {
						vol: 0.04 + k * 0.012,
						decay: 0.04,
						lowpass: 0.55,
						highpass: 0.5
					});
				}
			}
			yield bar / bars;
		}
	}

	// A fixed gain rather than per-take normalising, so takes match in level.
	const d = buf.data;
	for (let i = 0; i < d.length; i++) d[i] = Math.max(-0.98, Math.min(0.98, d[i] * 1.1));
	return { buffer: buf, length };
}

/** Render a take synchronously (for the worker and tests). */
export function renderTakeAll(seed: string): Take {
	const gen = renderTake(seed);
	for (;;) {
		const r = gen.next();
		if (r.done) return r.value;
	}
}
