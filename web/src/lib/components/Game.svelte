<!-- The whole game: a fixed logical stage scaled to fit the window (a
     portrait stage when the window is tall), the frame loop, keyboard
     shortcuts and the audio unlock on first touch. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { game, PHASE } from '../app/game.svelte.ts';
	import { fx } from '../app/fx.svelte.ts';
	import { settings } from '../ui/settings.svelte.ts';
	import { setDeviceScale } from '../ui/images.ts';
	import * as sound from '../audio/sound.ts';
	import Menu from './Menu.svelte';
	import Felt from './Felt.svelte';
	import Table from './Table.svelte';
	import Sidebar from './Sidebar.svelte';
	import BidPanel from './BidPanel.svelte';
	import ScorePanel from './ScorePanel.svelte';
	import BoardWonPanel from './BoardWonPanel.svelte';
	import Shop from './Shop.svelte';
	import Ending from './Ending.svelte';
	import PloyModal from './PloyModal.svelte';
	import TargetBanner from './TargetBanner.svelte';
	import Scorepad from './Scorepad.svelte';
	import Help from './Help.svelte';
	import Toast from './Toast.svelte';
	import Particles from './Particles.svelte';

	let vw = $state(1280);
	let vh = $state(720);
	let ready = $state(false);

	const L = $derived(game.layout);
	const scale = $derived(Math.min(vw / L.W, vh / L.H));
	const run = $derived(game.run);

	function measure() {
		const el = document.documentElement;
		vw = el.clientWidth;
		vh = el.clientHeight;
		game.orientation = vh > vw * 1.05 ? 'portrait' : 'landscape';
	}

	$effect(() => {
		setDeviceScale(scale);
	});

	onMount(() => {
		settings.load();
		game.restore();
		measure();
		ready = true;
		window.addEventListener('resize', measure);
		let raf = 0;
		let last = performance.now();
		const frame = (now: number) => {
			const dt = Math.min(0.1, (now - last) / 1000);
			last = now;
			game.update(dt);
			fx.update(dt);
			raf = requestAnimationFrame(frame);
		};
		raf = requestAnimationFrame(frame);
		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener('resize', measure);
		};
	});

	function onKey(e: KeyboardEvent) {
		sound.unlock();
		const target = e.target as HTMLElement;
		if (target?.tagName === 'INPUT') return;
		const k = e.key.toLowerCase();
		if (k === 'm') sound.toggleMusic();
		else if (k === 'p' && game.screen === 'run') game.togglePad();
		else if (k === 'escape') game.escape();
		else if (k === ' ' || k === 'enter') {
			e.preventDefault();
			game.advance();
		} else return;
	}

	// A press anywhere during a held trick or the score count-up skips it.
	function onClickCapture(e: MouseEvent) {
		if (game.skipPress()) {
			e.stopPropagation();
			e.preventDefault();
		}
	}
</script>

<svelte:window onkeydown={onKey} onpointerdown={() => sound.unlock()} />

<div class="viewport">
	{#if ready}
		<div
			class="stage"
			style:width="{L.W}px"
			style:height="{L.H}px"
			style:transform="translate(-50%, -50%) scale({scale}) translate({fx.shakeX}px, {fx.shakeY}px)"
			onclickcapture={onClickCapture}
			role="application"
		>
			{#if game.screen === 'menu' || !run}
				<Menu />
				{#if game.showHelp}<Help />{/if}
			{:else}
				<Felt x={L.table.x} y={L.table.y} w={L.table.w} h={L.table.h} />
				{#if run.phase === PHASE.SHOP}
					<Shop />
				{:else}
					<Table {scale} />
					{#if run.phase === PHASE.BID}
						<BidPanel />
					{:else if run.phase === PHASE.DEAL_SCORED && !game.trickHold && game.reveal}
						<ScorePanel />
					{:else if run.phase === PHASE.BOARD_WON}
						<BoardWonPanel />
					{:else if run.phase === PHASE.GAME_OVER}
						<Ending victory={false} />
					{:else if run.phase === PHASE.VICTORY}
						<Ending victory={true} />
					{/if}
				{/if}
				<Sidebar />
				{#if game.showPad}<Scorepad />{/if}
				{#if game.targeting !== null}<TargetBanner />{/if}
				{#if game.modal !== null}<PloyModal />{/if}
			{/if}
			<Toast />
			<Particles w={L.W} h={L.H} {scale} />
			<div class="vignette"></div>
		</div>
	{/if}
</div>

<style>
	.viewport {
		position: fixed;
		inset: 0;
		overflow: hidden;
		background: var(--bg);
		touch-action: manipulation;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}
	.stage {
		position: absolute;
		left: 50%;
		top: 50%;
		transform-origin: 50% 50%;
		overflow: hidden;
		background: var(--bg);
	}
	.vignette {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 600;
		background: radial-gradient(ellipse 70% 78% at 50% 50%, transparent 55%, rgba(0, 0, 0, 0.6) 100%);
	}
</style>
