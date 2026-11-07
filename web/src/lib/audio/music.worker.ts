// Renders the music loop off the main thread and posts the samples back.

import { renderMusicAll } from './sounds.ts';
import { toFloat32 } from './synth.ts';

self.onmessage = () => {
	const buf = renderMusicAll();
	const samples = toFloat32(buf);
	(self as unknown as Worker).postMessage({ samples, rate: buf.rate }, [samples.buffer]);
};
