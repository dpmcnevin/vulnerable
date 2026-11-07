// Plays the synthesized sounds through Web Audio. Port of src/audio/sound.lua.
//
// Browsers only allow audio after a user gesture, so nothing happens until
// `unlock()` is called from a pointer or key handler. Effects are rendered
// once, then; the music loop renders in a Web Worker (or, if workers are
// unavailable, a bar at a time between frames) and starts when ready.
// Every call is guarded: without Web Audio the game simply runs silent.

import { defs, renderMusic } from './sounds.ts';
import { toFloat32, type Buffer } from './synth.ts';
import { settings } from '../ui/settings.svelte.ts';

export interface PlayOpts {
	pitch?: number;
	volume?: number;
	/** Random pitch spread, so repeated sounds don't feel machine-gunned. */
	jitter?: number;
}

const SFX_VOLUME = 0.8;
const MUSIC_VOLUME = 0.35;

let ctx: AudioContext | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;
const buffers = new Map<string, AudioBuffer>();
let musicBuffer: AudioBuffer | null = null;
let musicSource: AudioBufferSourceNode | null = null;
let musicRequested = false;

function toAudioBuffer(samples: Float32Array, rate: number): AudioBuffer {
	const ab = ctx!.createBuffer(1, samples.length, rate);
	ab.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
	return ab;
}

/** Create the audio context and render effects. Call from a user gesture. */
export function unlock() {
	if (ctx) {
		if (ctx.state === 'suspended') void ctx.resume();
		return;
	}
	try {
		const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		if (!AC) return;
		ctx = new AC();
		sfxGain = ctx.createGain();
		sfxGain.gain.value = SFX_VOLUME;
		sfxGain.connect(ctx.destination);
		musicGain = ctx.createGain();
		musicGain.gain.value = MUSIC_VOLUME;
		musicGain.connect(ctx.destination);
		for (const [name, render] of Object.entries(defs)) {
			const b: Buffer = render();
			buffers.set(name, toAudioBuffer(toFloat32(b), b.rate));
		}
		startMusicRender();
	} catch (err) {
		console.warn('audio disabled:', err);
		ctx = null;
	}
}

function startMusicRender() {
	if (musicRequested) return;
	musicRequested = true;
	const done = (samples: Float32Array, rate: number) => {
		if (!ctx) return;
		musicBuffer = toAudioBuffer(samples, rate);
		if (settings.music) startMusic();
	};
	try {
		const worker = new Worker(new URL('./music.worker.ts', import.meta.url), { type: 'module' });
		worker.onmessage = (e: MessageEvent<{ samples: Float32Array; rate: number }>) => {
			done(e.data.samples, e.data.rate);
			worker.terminate();
		};
		worker.onerror = () => {
			worker.terminate();
			renderInChunks(done);
		};
		worker.postMessage('render');
	} catch {
		renderInChunks(done);
	}
}

/** Fallback: one bar per animation frame, so the page never freezes. */
function renderInChunks(done: (s: Float32Array, rate: number) => void) {
	const gen = renderMusic();
	const step = () => {
		const r = gen.next();
		if (r.done) done(toFloat32(r.value), r.value.rate);
		else requestAnimationFrame(step);
	};
	requestAnimationFrame(step);
}

function startMusic() {
	if (!ctx || !musicBuffer || musicSource) return;
	musicSource = ctx.createBufferSource();
	musicSource.buffer = musicBuffer;
	musicSource.loop = true;
	musicSource.connect(musicGain!);
	musicSource.start();
}

function stopMusic() {
	if (!musicSource) return;
	try {
		musicSource.stop();
	} catch {
		/* already stopped */
	}
	musicSource.disconnect();
	musicSource = null;
}

/** Play an effect by name. */
export function play(name: string, opts: PlayOpts = {}) {
	if (!ctx || !settings.sfx) return;
	const buf = buffers.get(name);
	if (!buf) return;
	try {
		let pitch = opts.pitch ?? 1;
		if (opts.jitter) pitch *= 1 + (Math.random() * 2 - 1) * opts.jitter;
		const src = ctx.createBufferSource();
		src.buffer = buf;
		src.playbackRate.value = Math.max(0.1, pitch);
		const gain = ctx.createGain();
		gain.gain.value = opts.volume ?? 1;
		src.connect(gain).connect(sfxGain!);
		src.start();
	} catch {
		/* ignore */
	}
}

export function toggleMusic() {
	const on = settings.toggle('music');
	if (on) startMusic();
	else stopMusic();
}

export function toggleSfx() {
	settings.toggle('sfx');
}
