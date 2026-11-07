<!-- The club: four items for sale (relics, ploys, conventions), your relics
     to sell, a reroll and the way to the next board. -->
<script lang="ts">
	import { fly } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import * as engine from '../game/engine.ts';
	import * as relics from '../game/relics.ts';
	import * as ploys from '../game/ploys.ts';
	import * as conventions from '../game/conventions.ts';
	import { game } from '../app/game.svelte.ts';
	import { num } from '../app/format.ts';
	import { C, css } from '../ui/theme.ts';
	import Icon from './Icon.svelte';
	import Strain from './Strain.svelte';
	import Button from './Button.svelte';

	const L = $derived(game.layout);
	const portrait = $derived(L.orientation === 'portrait');
	const run = $derived(game.run!);
	const items = $derived.by(() => {
		void game.v;
		return run.shop!.items.map((it) => ({ ...it }));
	});
	const money = new Tween(0, { duration: 450, easing: cubicOut });
	$effect(() => {
		money.target = run.money;
	});
	const nextLabel = $derived(
		run.board === engine.BOARDS_PER_RUBBER && run.rubber === engine.RUBBERS
			? 'Claim victory'
			: run.board === engine.BOARDS_PER_RUBBER
				? 'Next rubber'
				: 'Next board'
	);

	function edge(item: engine.ShopItem) {
		if (item.kind === 'relic') return css(C.rarity[item.def.rarity]);
		return item.kind === 'ploy' ? 'var(--ploy)' : 'var(--brass)';
	}

	function buy(i: number, e: MouseEvent) {
		// Burst from the item's centre, in stage coordinates.
		const el = (e.currentTarget as HTMLElement).closest('.item') as HTMLElement;
		const stage = el.closest('.stage') as HTMLElement;
		const a = el.getBoundingClientRect(),
			b = stage.getBoundingClientRect();
		const k = stage.offsetWidth / b.width;
		game.buy(i, (a.left + a.width / 2 - b.left) * k, (a.top + a.height / 2 - b.top) * k);
	}
	function canBuy(i: number) {
		void game.v;
		return engine.canBuy(run, i);
	}
</script>

<div
	class="shop"
	class:portrait
	style:left="{L.table.x}px"
	style:top="{L.table.y}px"
	style:width="{L.table.w}px"
	style:height="{L.table.h}px"
>
	<div class="head">
		<div>
			<h1>The Club</h1>
			<div class="dim">Spend your winnings before the next board.</div>
		</div>
		<div class="money">${num(money.current)}</div>
	</div>

	{#key game.shopRolls}
		<div class="items">
			{#each items as item, i (i)}
				{@const can = canBuy(i)}
				<div
					class="item panel-like"
					style:border-color={edge(item)}
					style:animation-delay="{i * 0.4}s"
					in:fly={{ y: 60, duration: 350, delay: i * 80, easing: backOut }}
				>
					{#if item.kind === 'relic'}
						<div class="kind" style:color={edge(item)}>{relics.RARITY_NAME[item.def.rarity]} relic</div>
						<div class="title-row"><h3>{item.name}</h3><Icon name={item.def.key} scale={3} /></div>
						<p>{item.def.text}</p>
					{:else if item.kind === 'ploy'}
						<div class="kind ploy">Ploy</div>
						<div class="title-row"><h3>{item.name}</h3><Icon name={item.def.key} scale={3} /></div>
						<p>{item.def.text}</p>
						<p class="small ploy-light">{ploys.whenText(item.def)}</p>
					{:else}
						{@const s = item.def.strain}
						{@const lvl = run.strainLevels[s]}
						{@const now = conventions.bonusFor(lvl)}
						{@const next = conventions.bonusFor(lvl + 1)}
						<div class="kind brass">Convention</div>
						<h3>{item.name}</h3>
						<p class="lvl">Level up <Strain strain={s} size={18} /></p>
						<p class="ink">Lv.{lvl} → Lv.{lvl + 1}</p>
						<p>+{next[0]} points, +{next[1].toFixed(2)} mult</p>
						<p class="small faint">(was +{now[0]}, +{now[1].toFixed(2)})</p>
						<p class="small faint">{item.def.flavour}</p>
					{/if}
					<div class="buy">
						{#if item.sold}
							<div class="sold">SOLD</div>
						{:else}
							<Button
								enabled={can[0]}
								sound={false}
								title={can[0] ? undefined : `Can't buy: ${can[1]}`}
								onclick={(e) => buy(i, e)}
								style="width: 100%">Buy ${item.cost}</Button
							>
						{/if}
					</div>
					{#if item.sold}<div class="sold-cover"></div>{/if}
				</div>
			{/each}
		</div>
	{/key}

	<div class="owned">
		<h3>Your relics {run.relics.length}/{engine.RELIC_SLOTS}</h3>
		<div class="relic-row">
			{#each { length: engine.RELIC_SLOTS }, i (i)}
				{@const relic = run.relics[i]}
				{#if relic}
					<div class="relic panel-like" style:border-color={css(C.rarity[relic.def.rarity])} title={relics.textFor((void game.v, relic))}>
						<div class="relic-head"><Icon name={relic.key} scale={2} /><span>{relic.name}</span></div>
						<Button variant="plain" size="sm" sound="sell" onclick={() => game.sellRelic(i)} style="width: 100%"
							>Sell ${Math.max(1, Math.floor(relic.cost / 2))}</Button
						>
					</div>
				{:else}
					<div class="relic empty">empty</div>
				{/if}
			{/each}
		</div>
	</div>

	<div class="foot">
		<Button
			variant="plain"
			sound="reroll"
			enabled={run.money >= run.rerollCost}
			onclick={() => game.reroll()}
			style="width: 190px; height: 44px">Reroll ${run.rerollCost}</Button
		>
		<Button pulse onclick={() => game.leaveShop()} style="width: 210px; height: 44px">{nextLabel}</Button>
	</div>
</div>

<style>
	.shop {
		position: absolute;
		box-sizing: border-box;
		padding: 18px 30px 26px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		z-index: 110;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}
	h1 {
		margin: 0;
		font-size: 44px;
		color: var(--brass);
		text-shadow: 4px 4px 0 rgba(0, 0, 0, 0.6);
	}
	.money {
		font-size: 44px;
		font-weight: 700;
		color: var(--brass);
		text-shadow: 4px 4px 0 rgba(0, 0, 0, 0.6);
		font-variant-numeric: tabular-nums;
	}
	.dim {
		color: var(--ink-dim);
		font-size: 17px;
	}
	.items {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 18px;
		height: 290px;
	}
	.portrait .items {
		grid-template-columns: repeat(2, 1fr);
		height: auto;
		grid-auto-rows: 270px;
	}
	.panel-like {
		position: relative;
		background: var(--panel);
		border: 2px solid var(--brass-dim);
		border-radius: 10px;
		box-shadow: 3px 5px 0 rgba(0, 0, 0, 0.35);
	}
	.item {
		display: flex;
		flex-direction: column;
		padding: 12px 16px;
		overflow: hidden;
		animation: bobitem 3.9s ease-in-out infinite;
	}
	@keyframes bobitem {
		50% {
			transform: translateY(-3px);
		}
	}
	.kind {
		font-size: 14px;
	}
	.ploy {
		color: var(--ploy);
	}
	.brass {
		color: var(--brass);
	}
	.ploy-light {
		color: var(--ploy-light);
	}
	.faint {
		color: var(--ink-faint);
	}
	.ink {
		color: var(--ink) !important;
	}
	.title-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 8px;
	}
	h3 {
		margin: 6px 0 4px;
		font-size: 20px;
		text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
	}
	p {
		margin: 6px 0 0;
		font-size: 16px;
		line-height: 1.3;
		color: var(--ink-dim);
	}
	p.small {
		font-size: 14px;
	}
	.lvl {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.buy {
		margin-top: auto;
		padding-top: 8px;
	}
	.sold {
		text-align: center;
		font-size: 28px;
		font-weight: 700;
		color: var(--ink-dim);
	}
	.sold-cover {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		border-radius: 8px;
	}
	.owned h3 {
		margin: 0 0 8px;
	}
	.relic-row {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 12px;
	}
	.relic {
		height: 110px;
		box-sizing: border-box;
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}
	.relic-head {
		display: flex;
		gap: 8px;
		align-items: center;
		font-size: 15px;
		line-height: 1.15;
	}
	.relic.empty {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg);
		border-radius: 10px;
		color: var(--ink-faint);
		font-size: 14px;
	}
	.portrait .relic-row {
		grid-template-columns: repeat(3, 1fr);
	}
	.foot {
		margin-top: auto;
		display: flex;
		justify-content: space-between;
	}
</style>
