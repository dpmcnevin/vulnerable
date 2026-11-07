<!-- One card on the table. Layout says where the card should be; the sprite
     chases it with springs (position, rotation, scale, and the flip angle),
     which gives deal-ins, plays, flips and sweeps the same lively feel. -->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { Spring } from 'svelte/motion';
	import type { Placement } from './placement.ts';
	import { cardBack, cardFace } from '../ui/images.ts';
	import { settings } from '../ui/settings.svelte.ts';
	import { CARD_H, CARD_W } from '../ui/theme.ts';
	import * as sound from '../audio/sound.ts';

	let { p }: { p: Placement } = $props();

	const init = untrack(() => ({
		x: p.spawn?.x ?? p.x,
		y: p.spawn?.y ?? p.y,
		r: p.spawn?.r ?? p.r,
		s: p.s,
		face: p.spawn?.faceUp ?? p.faceUp,
		delay: p.spawn?.delay ?? 0,
		sound: !!p.spawn?.sound
	}));

	const pos = new Spring({ x: init.x, y: init.y, r: init.r, s: init.s }, { stiffness: 0.11, damping: 0.6 });
	const flip = new Spring(init.face ? 0 : 180, { stiffness: 0.09, damping: 0.62 });
	let launched = $state(init.delay <= 0);
	let face = $state(init.face);

	onMount(() => {
		if (launched) return;
		const t = setTimeout(() => {
			launched = true;
			if (init.sound) sound.play('deal', { jitter: 0.1, volume: 0.7 });
		}, init.delay * 1000);
		return () => clearTimeout(t);
	});

	$effect(() => {
		const target = { x: p.x, y: p.y, r: p.r, s: p.s };
		if (launched) pos.target = target;
	});

	const want = $derived(p.faceUp);
	const flipDelay = $derived(p.flipDelay ?? 0);
	$effect(() => {
		if (!launched || want === untrack(() => face)) return;
		const target = want;
		const t = setTimeout(() => {
			face = target;
			flip.target = target ? 0 : 180;
			sound.play('flip', { jitter: 0.08, volume: 0.7 });
		}, flipDelay * 1000);
		return () => clearTimeout(t);
	});

	const front = $derived(cardFace(p.card, !!p.trump, settings.pixelCards, settings.fourColor));
	const back = $derived(cardBack(settings.pixelCards));
	const lift = $derived(p.lift ?? 0);
	const shadowOff = $derived(3 + lift * 0.35);
	const shadowA = $derived(0.32 - Math.min(0.12, lift * 0.004));

	// Restart the hover wobble each time the card becomes hovered.
	let wobbleKey = $state(0);
	$effect(() => {
		if (p.hovered) wobbleKey = untrack(() => wobbleKey) + 1;
	});
</script>

<div
	class="sprite"
	class:hidden={!launched}
	class:fade={p.fade}
	style:z-index={p.z}
	style:transform="translate3d({pos.current.x - CARD_W / 2}px, {pos.current.y - CARD_H / 2}px, 0) rotate({pos.current
		.r}rad) scale({pos.current.s})"
>
	<div
		class="sway"
		class:idle={p.idle != null}
		style:animation-delay={p.idle != null ? `${-p.idle * 0.77}s` : undefined}
	>
		{#key wobbleKey}
			<div class="wobble" class:on={wobbleKey > 0}>
				<div class="flipper" style:transform="rotateY({flip.current}deg)">
					<div
						class="face front"
						class:pixel={settings.pixelCards}
						style:box-shadow="{shadowOff * 0.6}px {shadowOff}px 0 rgba(0,0,0,{shadowA})"
					>
						<img src={front} alt="" draggable="false" />
						{#if p.dim}<div class="dim"></div>{/if}
						{#if p.highlight}<div class="ring" style:border-color={p.highlight}></div>{/if}
					</div>
					<div
						class="face back"
						class:pixel={settings.pixelCards}
						style:box-shadow="{-shadowOff * 0.6}px {shadowOff}px 0 rgba(0,0,0,{shadowA})"
					>
						<img src={back} alt="" draggable="false" />
					</div>
				</div>
			</div>
		{/key}
	</div>
</div>

<style>
	.sprite {
		position: absolute;
		left: 0;
		top: 0;
		width: 80px;
		height: 112px;
		pointer-events: none;
		transform-origin: 50% 50%;
		will-change: transform;
	}
	.hidden {
		visibility: hidden;
	}
	.fade {
		opacity: 0;
		transition: opacity 0.38s ease-in;
	}
	.sway,
	.wobble {
		width: 100%;
		height: 100%;
	}
	.sway.idle {
		animation: sway 4.83s ease-in-out infinite;
	}
	@keyframes sway {
		0%,
		100% {
			transform: rotate(-0.46deg);
		}
		50% {
			transform: rotate(0.46deg);
		}
	}
	.wobble.on {
		animation: wobble 0.34s linear;
	}
	@keyframes wobble {
		0% {
			transform: rotate(0);
		}
		20% {
			transform: rotate(3.5deg);
		}
		45% {
			transform: rotate(-2.6deg);
		}
		70% {
			transform: rotate(1.4deg);
		}
		100% {
			transform: rotate(0);
		}
	}
	.flipper {
		position: relative;
		width: 100%;
		height: 100%;
		transform-style: preserve-3d;
	}
	.face {
		position: absolute;
		inset: 0;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
		border-radius: 8px;
	}
	.face.pixel {
		border-radius: 4px;
	}
	.face img {
		width: 100%;
		height: 100%;
		display: block;
	}
	.face.pixel img {
		image-rendering: pixelated;
	}
	.back {
		transform: rotateY(180deg);
	}
	.dim {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: rgba(15, 25, 23, 0.5);
	}
	.ring {
		position: absolute;
		inset: -3px;
		border: 3px solid;
		border-radius: 10px;
	}
</style>
