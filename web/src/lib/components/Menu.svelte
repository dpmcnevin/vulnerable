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
	const aces = $derived.by((): Placement[] => {
		const lean = mouseX < 0 ? 0 : ((mouseX - L.W / 2) / L.W) * 0.12;
		return ACES.map((card, i) => {
			const k = i + 1 - 2.5;
			return {
				id: -(i + 1),
				card,
				x: L.W / 2 + k * 70,
				y: fanY + k * k * 6 + Math.sin(t * 1.4 + i + 1) * 4,
				r: k * 0.16 + lean,
				s: 1.1,
				faceUp: true,
				z: i,
				lift: 6,
				flipDelay: 0.05,
				spawn: { x: L.W / 2, y: -150, delay: 0.15 + (i + 1) * 0.09, faceUp: false, sound: true }
			};
		});
	});

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

<div class="menu" role="presentation" onpointermove={(e) => {
	const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
	mouseX = ((e.clientX - r.left) / r.width) * L.W;
}}>
	<Felt x={0} w={L.W} h={L.H} />
	{#each aces as p (p.id)}
		<CardSprite {p} />
	{/each}

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
