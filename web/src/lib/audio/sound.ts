// Plays the synthesized sounds through Web Audio. Port of src/audio/sound.lua.
//
// Browsers only allow audio after a user gesture, so nothing happens until
// `unlock()` is called from a pointer or key handler. Effects are rendered
// once, then. The music is generative: each pass is a new take rendered from
// a fresh seed in a Web Worker (or, without workers, a bar per frame), and
// each take is scheduled to start exactly where the previous one ends, its
// ringing tails overlapping the next take's opening.
// Every call is guarded: without Web Audio the game simply runs silent.

import { defs, renderTake } from './sounds.ts';
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
		const AC =
			window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

interface ReadyTake {
	buffer: AudioBuffer;
	/** Seconds until the next take should start. */
	length: number;
}

let musicRequested = false;
let worker: Worker | null = null;
let workerFailed = false;
let takeCount = 0;
/** The next take, rendered and waiting to be scheduled. */
let nextTake: ReadyTake | null = null;
let rendering = false;
let playing = false;
/** Sources scheduled now or in the future, so they can be stopped. */
let sources: AudioBufferSourceNode[] = [];
/** Context time at which the next take should begin. */
let nextStart = 0;
let lastTake: ReadyTake | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function newSeed(): string {
	takeCount++;
	return `${Date.now().toString(36)}-${takeCount}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

/** Render a take in the background; `done` gets it when ready. */
function renderNext(done: (t: ReadyTake) => void) {
	if (rendering) return;
	rendering = true;
	const seed = newSeed();
	const finish = (samples: Float32Array, rate: number, length: number) => {
		rendering = false;
		if (!ctx) return;
		done({ buffer: toAudioBuffer(samples, rate), length: length / rate });
	};
	if (!workerFailed) {
		try {
			worker ??= new Worker(new URL('./music.worker.ts', import.meta.url), { type: 'module' });
			worker.onmessage = (e: MessageEvent<{ samples: Float32Array; rate: number; length: number }>) =>
				finish(e.data.samples, e.data.rate, e.data.length);
			worker.onerror = () => {
				workerFailed = true;
				worker?.terminate();
				worker = null;
				rendering = false;
				renderNext(done);
			};
			worker.postMessage({ seed });
			return;
		} catch {
			workerFailed = true;
		}
	}
	// Fallback: one bar per animation frame, so the page never freezes.
	const gen = renderTake(seed);
	const step = () => {
		const r = gen.next();
		if (r.done) finish(toFloat32(r.value.buffer), r.value.buffer.rate, r.value.length);
		else requestAnimationFrame(step);
	};
	requestAnimationFrame(step);
}

function startMusicRender() {
	if (musicRequested) return;
	musicRequested = true;
	renderNext((t) => {
		nextTake = t;
		if (settings.music) startMusic();
	});
}

/** Schedule the waiting take at `nextStart`, then render the one after. */
function scheduleNext() {
	if (!ctx || !playing) return;
	// If the next take isn't ready in time, replay the last one.
	const take = nextTake ?? lastTake;
	if (!take) return;
	nextTake = null;
	lastTake = take;
	const src = ctx.createBufferSource();
	src.buffer = take.buffer;
	src.connect(musicGain!);
	src.start(nextStart);
	src.onended = () => {
		sources = sources.filter((s) => s !== src);
	};
	sources.push(src);
	const startedAt = nextStart;
	nextStart += take.length;
	renderNext((t) => (nextTake = t));
	// Wake a few seconds before this take ends to queue the next.
	const wakeIn = Math.max(0.5, nextStart - ctx.currentTime - 4);
	timer = setTimeout(scheduleNext, wakeIn * 1000);
	void startedAt;
}

function startMusic() {
	if (!ctx || playing || !nextTake) return;
	playing = true;
	nextStart = ctx.currentTime + 0.1;
	scheduleNext();
}

function stopMusic() {
	playing = false;
	if (timer) clearTimeout(timer);
	timer = null;
	for (const src of sources) {
		try {
			src.stop();
		} catch {
			/* already stopped */
		}
		src.disconnect();
	}
	sources = [];
	// Resume later with the take that was queued (or the last one).
	nextTake ??= lastTake;
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
