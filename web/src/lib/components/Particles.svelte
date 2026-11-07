<!-- Confetti, drawn on a canvas over the whole stage. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { fx } from '../app/fx.svelte.ts';

	let { w, h, scale }: { w: number; h: number; scale: number } = $props();
	let canvas: HTMLCanvasElement;

	onMount(() => {
		let raf = 0;
		const frame = () => {
			raf = requestAnimationFrame(frame);
			const g = canvas.getContext('2d');
			if (!g) return;
			const k = scale * (window.devicePixelRatio || 1);
			const cw = Math.round(w * k),
				ch = Math.round(h * k);
			if (canvas.width !== cw || canvas.height !== ch) {
				canvas.width = cw;
				canvas.height = ch;
			}
			g.setTransform(1, 0, 0, 1, 0, 0);
			g.clearRect(0, 0, cw, ch);
			if (fx.particles.length === 0) return;
			g.setTransform(k, 0, 0, k, 0, 0);
			fx.draw(g);
		};
		raf = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(raf);
	});
</script>

<canvas bind:this={canvas} style:width="{w}px" style:height="{h}px"></canvas>

<style>
	canvas {
		position: absolute;
		left: 0;
		top: 0;
		pointer-events: none;
		z-index: 500;
	}
</style>
