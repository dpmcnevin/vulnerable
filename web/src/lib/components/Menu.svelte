<!-- The main menu: a fan of four aces, the title, a seed box and settings. -->
<script lang="ts">
	import * as cards from '../rules/cards.ts';
	import { game, PHASE } from '../app/game.svelte.ts';
	import { settings } from '../ui/settings.svelte.ts';
	import * as sound from '../audio/sound.ts';
	import Felt from './Felt.svelte';
	import CardSprite from './CardSprite.svelte';
	import Button from './Button.svelte';
	import type { Placement } from './placement.ts';

	const L = $derived(game.layout);
	const ACES = [1, 2, 3, 4].map((s) => cards.card(s, 14));

	let mouseX = $state(-1);
	let t = $state(0);
	$effect(() => {
		let raf = 0;
		const start = performance.now();
		const frame = () => {
			t = (performance.now() - start) / 1000;
			raf = requestAnimationFrame(frame);
		};
		raf = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(raf);
	});

	const fanY = $derived(L.orientation === 'portrait' ? 230 : 120);

	// The aces can be picked up and dropped anywhere; a tap flips one over.
	let moved = $state<({ x: number; y: number; r: number } | null)[]>([null, null, null, null]);
	let faceUp = $state([true, true, true, true]);
	let order = $state([0, 1, 2, 3]);
	let drag = $state.raw<{ i: number; id: number; dx: number; dy: number; sx: number; sy: number; x: number; y: number; moved: boolean } | null>(null);
	let stageEl: HTMLElement | null = null;

	function fanSpot(i: number) {
		const lean = mouseX < 0 ? 0 : ((mouseX - L.W / 2) / L.W) * 0.12;
		const k = i + 1 - 2.5;
		return {
			x: L.W / 2 + k * 70,
			y: fanY + k * k * 6 + Math.sin(t * 1.4 + i + 1) * 4,
			r: k * 0.16 + lean
		};
	}
	function spot(i: number) {
		if (drag?.i === i && drag.moved) return { x: drag.x, y: drag.y, r: 0 };
		return moved[i] ?? fanSpot(i);
	}
	const aces = $derived.by((): Placement[] =>
		ACES.map((card, i) => {
			const p = spot(i);
			const held = drag?.i === i && drag.moved;
			return {
				id: -(i + 1),
				card,
				x: p.x,
				y: p.y,
				r: p.r,
				s: held ? 1.2 : 1.1,
				faceUp: faceUp[i],
				z: held ? 50 : 10 + order.indexOf(i),
				lift: held ? 26 : 6,
				flipDelay: 0.05,
				spawn: { x: L.W / 2, y: -150, delay: 0.15 + (i + 1) * 0.09, faceUp: false, sound: true }
			};
		})
	);

	function point(e: PointerEvent): [number, number] {
		const r = stageEl!.getBoundingClientRect();
		const k = stageEl!.offsetWidth / r.width;
		return [(e.clientX - r.left) * k, (e.clientY - r.top) * k];
	}
	function grab(e: PointerEvent, i: number) {
		if (e.button !== 0) return;
		e.stopPropagation();
		stageEl = (e.currentTarget as HTMLElement).closest('.stage') as HTMLElement;
		const [x, y] = point(e);
		const p = spot(i);
		drag = { i, id: e.pointerId, dx: x - p.x, dy: y - p.y, sx: x, sy: y, x: p.x, y: p.y, moved: false };
		order = [...order.filter((j) => j !== i), i];
	}
	function dragMove(e: PointerEvent) {
		if (!drag || e.pointerId !== drag.id) return;
		const [x, y] = point(e);
		const isMoved = drag.moved || Math.hypot(x - drag.sx, y - drag.sy) > 6;
		if (isMoved && !drag.moved) sound.play('card_hover', { jitter: 0.1, volume: 0.6 });
		drag = { ...drag, x: x - drag.dx, y: y - drag.dy, moved: isMoved };
	}
	function drop(e: PointerEvent) {
		const d = drag;
		if (!d || e.pointerId !== d.id) return;
		drag = null;
		if (d.moved) {
			const tilt = ((((d.x * 7 + d.y * 13) % 11) + 11) % 11 - 5) * 0.03;
			moved[d.i] = { x: Math.max(40, Math.min(L.W - 40, d.x)), y: Math.max(56, Math.min(L.H - 56, d.y)), r: tilt };
			sound.play('card_play', { jitter: 0.1 });
		} else {
			faceUp[d.i] = !faceUp[d.i];
		}
	}
	function resetFan() {
		moved = [null, null, null, null];
		faceUp = [true, true, true, true];
		sound.play('reroll');
	}
	const scattered = $derived(moved.some((m) => m) || faceUp.some((f) => !f));

	const canContinue = $derived(
		!!game.run && game.run.phase !== PHASE.GAME_OVER && game.run.phase !== PHASE.VICTORY
	);
	let seedEl: HTMLInputElement;

	function onSeed(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		game.seedInput = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
		el.value = game.seedInput;
	}
</script>

<svelte:window onpointermove={dragMove} onpointerup={drop} onpointercancel={() => (drag = null)} />

<div class="menu" role="presentation" onpointermove={(e) => {
	const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
	mouseX = ((e.clientX - r.left) / r.width) * L.W;
}}>
	<Felt x={0} w={L.W} h={L.H} />
	{#each aces as p (p.id)}
		<CardSprite {p} />
	{/each}
	<!-- Grab handles that follow the aces (rotation ignored: a generous target). -->
	{#each aces as p, i (p.id)}
		<div
			class="grab"
			class:held={drag?.i === i && drag.moved}
			role="button"
			tabindex="-1"
			aria-label="Ace"
			style:left="{p.x - 46}px"
			style:top="{p.y - 64}px"
			style:z-index={p.z + 1}
			onpointerdown={(e) => grab(e, i)}
		></div>
	{/each}
	{#if scattered}
		<button class="tidy" onclick={resetFan}>Tidy the aces</button>
	{/if}

	<div class="content" style:top="{fanY + 90}px">
		<h1>VULNERABLE</h1>
		<div class="sub">a contract bridge roguelike</div>

		<div class="buttons">
			{#if canContinue}
				<Button size="lg" pulse onclick={() => (game.screen = 'run')} style="width: 260px">Continue run</Button>
			{/if}
			<Button size="lg" pulse={!game.run} onclick={() => game.newRun()} style="width: 260px">New run</Button>
			<input
				bind:this={seedEl}
				class="seed"
				placeholder="Seed (optional)"
				value={game.seedInput}
				oninput={onSeed}
				onkeydown={(e) => {
					e.stopPropagation();
					if (e.key === 'Enter') game.newRun();
					if (e.key === 'Escape') seedEl.blur();
				}}
				autocomplete="off"
				autocapitalize="characters"
				spellcheck="false"
				maxlength="12"
			/>
			<Button variant="plain" onclick={() => (game.showHelp = true)} style="width: 260px">How to play</Button>
		</div>

		<div class="settings">
			<Button variant="plain" size="sm" onclick={() => sound.toggleMusic()} style="width: 96px"
				>{settings.music ? 'Music on' : 'Music off'}</Button
			>
			<Button variant="plain" size="sm" onclick={() => sound.toggleSfx()} style="width: 96px"
				>{settings.sfx ? 'Sound on' : 'Sound off'}</Button
			>
			<Button
				variant="plain"
				size="sm"
				onclick={() => settings.toggle('fourColor')}
				title="Four-color deck: green clubs and orange diamonds, as many bridge players prefer."
				style="width: 96px">{settings.fourColor ? '4 colors' : '2 colors'}</Button
			>
			<Button
				variant="plain"
				size="sm"
				onclick={() => settings.toggle('pixelCards')}
				title="Pixel-art or smooth cards."
				style="width: 96px">{settings.pixelCards ? 'Pixel' : 'Smooth'}</Button
			>
			<Button
				variant="plain"
				size="sm"
				onclick={() => settings.toggle('rubberView')}
				title="Rubber view labels each deal's bridge score above and below the line, as on a rubber-bridge scorepad (press P in a run for the full pad)."
				style="width: 96px">{settings.rubberView ? 'Rubber view' : 'Plain view'}</Button
			>
		</div>
	</div>
</div>

<style>
	.menu {
		position: absolute;
		inset: 0;
	}
	.grab {
		position: absolute;
		width: 92px;
		height: 128px;
		cursor: grab;
		touch-action: none;
	}
	.grab.held {
		cursor: grabbing;
	}
	.tidy {
		position: absolute;
		right: 20px;
		bottom: 20px;
		z-index: 60;
		font: inherit;
		font-size: 14px;
		background: var(--panel-edge);
		color: var(--ink);
		border: none;
		border-radius: 6px;
		padding: 6px 12px;
		cursor: pointer;
	}
	.content {
		position: absolute;
		left: 0;
		right: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	h1 {
		margin: 0;
		font-size: 72px;
		letter-spacing: 0.04em;
		color: var(--brass);
		text-shadow: 6px 6px 0 rgba(0, 0, 0, 0.6);
	}
	.sub {
		font-size: 20px;
		color: var(--ink-dim);
		margin-bottom: 22px;
	}
	.buttons {
		display: flex;
		flex-direction: column;
		gap: 12px;
		align-items: center;
	}
	.seed {
		width: 260px;
		height: 40px;
		box-sizing: border-box;
		padding: 0 14px;
		font: inherit;
		font-size: 17px;
		color: var(--ink);
		background: var(--felt-edge);
		border: 2px solid var(--panel-edge);
		border-radius: 6px;
		outline: none;
		letter-spacing: 0.06em;
	}
	.seed:focus {
		background: var(--panel);
		border-color: var(--brass);
	}
	.seed::placeholder {
		color: var(--ink-faint);
		letter-spacing: normal;
	}
	.settings {
		display: flex;
		gap: 4px;
		margin-top: 20px;
		flex-wrap: wrap;
		justify-content: center;
	}
</style>
