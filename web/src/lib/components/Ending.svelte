<!-- The end of a run: won all eight rubbers, or ran out of deals. -->
<script lang="ts">
	import { scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import * as engine from '../game/engine.ts';
	import { game } from '../app/game.svelte.ts';
	import { num } from '../app/format.ts';
	import Button from './Button.svelte';

	let { victory }: { victory: boolean } = $props();
	const L = $derived(game.layout);
	const run = $derived(game.run!);
	const s = $derived(run.stats);
	const sub = $derived(
		victory
			? 'You beat all eight rubbers.'
			: `Fell on ${engine.boardName(run)} of rubber ${run.rubber}, ${num(Math.max(0, run.target - run.score))} short.`
	);
	const rows = $derived([
		['Deals played', String(s.dealsPlayed)],
		['Contracts made', `${s.contractsMade} of ${s.dealsPlayed}`],
		['Slams made', String(s.slamsMade)],
		['Doubled contracts made', String(s.doubledMade)],
		['Best deal', num(s.bestDeal)],
		['Seed', String(run.seed)]
	]);
	const box = $derived({ x: L.tableCX - 260, y: L.orientation === 'portrait' ? L.table.y + 240 : 130 });
</script>

<div
	class="panel ending"
	class:victory
	style:left="{box.x}px"
	style:top="{box.y}px"
	transition:scale={{ start: 0.6, duration: 320, easing: backOut }}
>
	<h2>{victory ? 'Rubber won!' : 'Out of deals'}</h2>
	<div class="dim">{sub}</div>
	<div class="rows">
		{#each rows as [label, value] (label)}
			<div class="row"><span>{label}</span><span class="brass">{value}</span></div>
		{/each}
	</div>
	<div class="foot">
		<Button variant="plain" onclick={() => game.toMenu()} style="width: 170px">Main menu</Button>
		<Button
			pulse
			onclick={() => {
				game.seedInput = '';
				game.newRun();
			}}
			style="width: 170px">New run</Button
		>
	</div>
</div>

<style>
	.ending {
		width: 520px;
		box-sizing: border-box;
		padding: 20px 30px;
		border-color: var(--bad);
		z-index: 120;
	}
	.ending.victory {
		border-color: var(--brass);
	}
	h2 {
		margin: 0;
		font-size: 44px;
		color: var(--bad);
		text-shadow: 4px 4px 0 rgba(0, 0, 0, 0.6);
	}
	.victory h2 {
		color: var(--brass);
	}
	.dim {
		color: var(--ink-dim);
		font-size: 17px;
		margin-top: 12px;
	}
	.rows {
		margin-top: 22px;
		font-size: 17px;
	}
	.row {
		display: flex;
		justify-content: space-between;
		height: 28px;
	}
	.brass {
		color: var(--brass);
	}
	.foot {
		display: flex;
		justify-content: space-between;
		margin-top: 26px;
	}
</style>
