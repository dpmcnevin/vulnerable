// Renders music takes off the main thread: post a seed, get samples back.

import { renderTakeAll } from './sounds.ts';
import { toFloat32 } from './synth.ts';

self.onmessage = (e: MessageEvent<{ seed: string }>) => {
	const take = renderTakeAll(e.data.seed);
	const samples = toFloat32(take.buffer);
	(self as unknown as Worker).postMessage(
		{ seed: e.data.seed, samples, rate: take.buffer.rate, length: take.length },
		[samples.buffer]
	);
};
