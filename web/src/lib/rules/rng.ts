// Deterministic pseudo-random number generator (xorshift32).
//
// A bit-for-bit port of src/rules/rng.lua. LuaJIT's `bit` library works on
// signed 32-bit integers, and so do JavaScript's `^` and `<<`; `>>>` is its
// logical right shift, matching `bit.rshift`. The state is kept signed
// exactly as the Lua version keeps it, and `>>> 0` converts to unsigned
// wherever Lua takes `% 4294967296`. A seed therefore reproduces a run
// identically in both engines (tests/conformance.test.mjs checks this).

const TWO32 = 4294967296;

/** Mix one 32-bit value. Exact: xor and shift only. */
function mix(h: number): number {
	h ^= h << 13;
	h ^= h >>> 17;
	h ^= h << 5;
	return h;
}

const encoder = new TextEncoder();

/** Hash an arbitrary string to a (signed) 32-bit integer, for word seeds. */
export function hashString(s: string): number {
	let h = 0x811c9dc5 | 0;
	for (const byte of encoder.encode(s)) {
		h = mix(h ^ byte);
	}
	return h;
}

let counter = 0;

export class RNG {
	state: number;

	constructor(state: number) {
		this.state = state;
	}

	/** Next raw 32-bit unsigned value. */
	nextUint(): number {
		this.state = mix(this.state);
		return this.state >>> 0;
	}

	/** Next float in [0, 1). */
	next(): number {
		return this.nextUint() / TWO32;
	}

	/** Integer in [min, max] inclusive. Rejection-sampled, so it stays uniform. */
	int(min: number, max: number): number {
		if (min > max) [min, max] = [max, min];
		const span = max - min + 1;
		const limit = TWO32 - (TWO32 % span);
		let v: number;
		do {
			v = this.nextUint();
		} while (!(v < limit));
		return min + (v % span);
	}

	/** True with probability `p`. */
	chance(p: number): boolean {
		return this.next() < p;
	}

	/** Fisher-Yates, in place. Same draws as the Lua version's 1-based loop. */
	shuffle<T>(t: T[]): T[] {
		for (let i = t.length; i >= 2; i--) {
			const j = this.int(1, i);
			const tmp = t[i - 1];
			t[i - 1] = t[j - 1];
			t[j - 1] = tmp;
		}
		return t;
	}

	/** Uniformly pick one element of an array. */
	pick<T>(t: readonly T[]): T | undefined {
		if (t.length === 0) return undefined;
		return t[this.int(1, t.length) - 1];
	}

	/** Pick `n` distinct elements. Does not disturb the source array. */
	sample<T>(t: readonly T[], n: number): T[] {
		const pool = t.slice();
		this.shuffle(pool);
		return pool.slice(0, Math.min(n, pool.length));
	}

	/** Independent child generator, so one subsystem's draws cannot shift another's. */
	branch(label?: string): RNG {
		return newRng((this.state ^ hashString(label ?? 'branch')) & 0xffffffff);
	}
}

/** Create a generator. `seed` may be a string, a number, or undefined (time-based). */
export function newRng(seed?: string | number): RNG {
	let state: number;
	if (typeof seed === 'string') {
		state = hashString(seed);
	} else if (typeof seed === 'number') {
		// ToInt32 is the same modulo-2^32 reduction LuaJIT's bit.band applies.
		state = Math.floor(seed) & 0xffffffff;
	} else {
		counter += 1;
		const parts = [
			String(Date.now()),
			String(typeof performance !== 'undefined' ? performance.now() : 0),
			String(Math.random()),
			String(counter)
		];
		state = hashString(parts.join('|'));
	}
	// xorshift has a fixed point at zero; nudge off it.
	if (state === 0) state = 0x9e3779b9 | 0;
	return new RNG(state);
}

export { newRng as new };

/** A pronounceable 8-character seed, for display and re-entry. */
export function randomSeedString(rng?: RNG): string {
	rng = rng ?? newRng();
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let out = '';
	for (let i = 0; i < 8; i++) {
		const k = rng.int(1, alphabet.length);
		out += alphabet[k - 1];
	}
	return out;
}
