<!-- Board won: the payout, itemised, and the way into the club. -->
<script lang="ts">
	import { scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { game } from '../app/game.svelte.ts';
	import { num } from '../app/format.ts';
	import Icon from './Icon.svelte';
	import Button from './Button.svelte';

	const L = $derived(game.layout);
	const run = $derived(game.run!);
	const p = $derived(run.lastPayout!);
	const rows = $derived(
		[
			['Board', p.board],
			['Unused deals', p.unused],
			['Interest', p.interest],
			...(p.relics > 0 ? [['Relics', p.relics]] : [])
		] as [string, number][]
	);
	const box = $derived({ x: L.tableCX - 230, y: L.orientation === 'portrait' ? L.table.y + 260 : 150 });
</script>

<div
	class="panel won"
	style:left="{box.x}px"
	style:top="{box.y}px"
	transition:scale={{ start: 0.6, duration: 320, easing: backOut }}
>
	<h2>Board won</h2>
	<div class="dim">{num(run.score)} scored against a target of {num(run.target)}</div>
	<div class="rows">
		{#each rows as [label, amount] (label)}
			<div class="row"><span>{label}</span><span class:brass={amount > 0} class:faint={amount <= 0}>${amount}</span></div>
		{/each}
		{#if p.gift}
			<div class="row gift"><span>Free ploy: {p.gift.name}</span><Icon name={p.gift.key} scale={2} /></div>
		{/if}
		<div class="divider"></div>
		<div class="row total"><span>Total</span><span class="brass">${p.total}</span></div>
	</div>
	<div class="foot">
		<Button pulse sound={false} onclick={() => game.enterShop()} style="width: 200px">Enter the club</Button>
	</div>
</div>

<style>
	.won {
		width: 460px;
		box-sizing: border-box;
		padding: 18px 30px;
		border-color: var(--brass);
		z-index: 120;
	}
	h2 {
		margin: 0;
		font-size: 28px;
		color: var(--good);
		text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
	}
	.dim {
		color: var(--ink-dim);
		font-size: 17px;
		margin-top: 12px;
	}
	.rows {
		margin-top: 24px;
		font-size: 17px;
	}
	.row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		height: 28px;
	}
	.gift {
		color: var(--ploy-light);
		height: 40px;
	}
	.total {
		font-size: 20px;
		font-weight: 700;
	}
	.brass {
		color: var(--brass);
	}
	.faint {
		color: var(--ink-faint);
	}
	.divider {
		height: 1px;
		background: var(--panel-edge);
		margin: 6px 0;
	}
	.foot {
		display: flex;
		justify-content: flex-end;
		margin-top: 22px;
	}
</style>
