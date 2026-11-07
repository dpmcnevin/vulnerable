// A tiny additive/FM synthesizer. Port of src/audio/synth.lua.
//
// A buffer is an array of samples in [-1, 1] at its own rate. Instruments
// add into a buffer rather than overwrite it, so layering is just calling
// more. Rendering accumulates in a Float64Array (as Lua's doubles do);
// `toFloat32` hands the result to Web Audio.

export const RATE = 44100;
const TAU = Math.PI * 2;
const { sin, exp, floor, abs, min, max } = Math;

export interface Buffer {
	data: Float64Array;
	rate: number;
}

export function buffer(seconds: number, rate = RATE): Buffer {
	return { data: new Float64Array(floor(seconds * rate)), rate };
}

export function duration(buf: Buffer): number {
	return buf.data.length / buf.rate;
}

/** MIDI note number to frequency. */
export function midi(note: number): number {
	return 440 * 2 ** ((note - 69) / 12);
}

// Deterministic noise, so sounds are identical every launch.
let noiseState = 22222;
function noiseSample(): number {
	noiseState = (noiseState * 1103515245 + 12345) % 2147483648;
	return noiseState / 1073741824 - 1;
}
export function seedNoise(s: number) {
	noiseState = s;
}

type Wave = (p: number) => number;
const mod1 = (p: number) => p - floor(p); // Lua's p % 1 (floored)
const WAVES: Record<string, Wave> = {
	sine: (p) => sin(p * TAU),
	tri: (p) => {
		p = mod1(p);
		return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
	},
	saw: (p) => 2 * mod1(p) - 1,
	square: (p) => (mod1(p) < 0.5 ? 1 : -1)
};

/**
 * Linear attack, exponential decay to an optional sustain level, and a
 * short linear release at the very end so the note never clicks off.
 */
function envelope(t: number, dur: number, attack: number, decay: number, sustain: number): number {
	let a = t < attack ? t / attack : sustain + (1 - sustain) * exp(-(t - attack) / decay);
	const release = min(0.012, dur * 0.25);
	if (t > dur - release) a *= max(0, (dur - t) / release);
	return a;
}

export interface ToneOpts {
	wave?: 'sine' | 'tri' | 'saw' | 'square';
	vol?: number;
	attack?: number;
	decay?: number;
	sustain?: number;
	glide?: number;
	vibrato?: [number, number];
	fm?: { ratio: number; index: number; decay?: number };
	partials?: [number, number, number?][];
}

/** Add a pitched note. */
export function tone(buf: Buffer, start: number, dur: number, freq: number, opts: ToneOpts = {}) {
	const { rate, data } = buf;
	const wave = WAVES[opts.wave ?? 'sine'];
	const vol = opts.vol ?? 0.5;
	const attack = opts.attack ?? 0.004;
	const decay = opts.decay ?? dur;
	const sustain = opts.sustain ?? 0;
	const { glide, vibrato: vib, fm, partials } = opts;
	const i0 = floor(start * rate);
	const n = floor(dur * rate);
	let phase = 0,
		fmPhase = 0;
	const pPhase = partials ? partials.map(() => 0) : [];
	for (let j = 0; j < n; j++) {
		const i = i0 + j;
		if (i >= data.length) break;
		const t = j / rate;
		let f = freq;
		if (glide !== undefined) f = freq + (glide - freq) * min(1, t / dur);
		if (vib) f = f * (1 + vib[1] * sin(TAU * vib[0] * t));
		let s: number;
		if (fm) {
			const index = fm.index * (fm.decay ? exp(-t / fm.decay) : 1);
			fmPhase += (f * fm.ratio) / rate;
			s = sin(TAU * phase + index * sin(TAU * fmPhase));
		} else {
			s = wave(phase);
		}
		if (partials) {
			for (let k = 0; k < partials.length; k++) {
				const pt = partials[k];
				pPhase[k] += (f * pt[0]) / rate;
				s += pt[1] * sin(TAU * pPhase[k]) * exp(-t / (decay * (pt[2] ?? 1)));
			}
		}
		phase += f / rate;
		if (i >= 0) data[i] += s * vol * envelope(t, dur, attack, decay, sustain);
	}
}

export interface NoiseOpts {
	vol?: number;
	attack?: number;
	decay?: number;
	/** 0..1 smoothing, higher = darker */
	lowpass?: number;
	/** 0..1, higher = thinner */
	highpass?: number;
}

/** Add filtered noise. */
export function noise(buf: Buffer, start: number, dur: number, opts: NoiseOpts = {}) {
	const { rate, data } = buf;
	const vol = opts.vol ?? 0.3;
	const attack = opts.attack ?? 0.002;
	const decay = opts.decay ?? dur;
	const lp = opts.lowpass ?? 0;
	const hp = opts.highpass ?? 0;
	const i0 = floor(start * rate);
	const n = floor(dur * rate);
	let low = 0,
		prevIn = 0,
		prevOut = 0;
	for (let j = 0; j < n; j++) {
		const i = i0 + j;
		if (i >= data.length) break;
		const t = j / rate;
		const x = noiseSample();
		low += (x - low) * (1 - lp);
		let y = low;
		if (hp > 0) {
			const out = hp * (prevOut + y - prevIn);
			prevIn = y;
			prevOut = out;
			y = out;
		}
		if (i >= 0) data[i] += y * vol * envelope(t, dur, attack, decay, 0);
	}
}

/** A struck bell: inharmonic partials that fade faster the higher they are. */
export function bell(buf: Buffer, start: number, dur: number, freq: number, vol = 0.3) {
	tone(buf, start, dur, freq, {
		vol,
		attack: 0.002,
		decay: dur * 0.35,
		partials: [
			[2.0, 0.45, 0.6],
			[2.76, 0.3, 0.4],
			[5.4, 0.12, 0.2]
		]
	});
}

/** Scale so the loudest sample sits at `peakLevel`. */
export function normalize(buf: Buffer, peakLevel = 0.9): Buffer {
	const m = peak(buf);
	if (m > 0) {
		const k = peakLevel / m;
		const d = buf.data;
		for (let i = 0; i < d.length; i++) d[i] *= k;
	}
	return buf;
}

/** Soft-clip, for gentle saturation on layered sounds. */
export function softClip(buf: Buffer, drive = 1.2): Buffer {
	const d = buf.data;
	for (let i = 0; i < d.length; i++) {
		const e = exp(2 * d[i] * drive);
		d[i] = (e - 1) / (e + 1);
	}
	return buf;
}

export function peak(buf: Buffer): number {
	let m = 0;
	const d = buf.data;
	for (let i = 0; i < d.length; i++) m = max(m, abs(d[i]));
	return m;
}

export function toFloat32(buf: Buffer): Float32Array {
	return Float32Array.from(buf.data);
}
