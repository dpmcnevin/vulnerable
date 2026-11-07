<!-- Choose your contract: a 7x5 grid of every contract, colored by the
     chance to make it, with the projected score and a recommendation. -->
<script lang="ts">
	import { scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import * as cards from '../rules/cards.ts';
	import * as scoring from '../rules/scoring.ts';
	import { game } from '../app/game.svelte.ts';
	import { num, pct } from '../app/format.ts';
	import Contract from './Contract.svelte';
	import Strain from './Strain.svelte';
	import Suit from './Suit.svelte';
	import Button from './Button.svelte';
	import { strainColor } from './colors.ts';

	const L = $derived(game.layout);
	const run = $derived(game.run!);
	const deal = $derived(game.deal);
	const need = $derived(Math.max(0, run.target - run.score));
	const info = $derived.by(() => {
		void game.v;
		return deal.partnerInfo;
	});
	const options = $derived.by(() => {
		void game.v;
		return game.options();
	});
	const rec = $derived.by(() => {
		void game.v;
		return game.recommended();
	});
	const myHcp = $derived(cards.hcp(deal.hands[deal.declarer]));

	function chanceColor(p: number) {
		if (p >= 0.7) return 'var(--good)';
		if (p >= 0.45) return 'var(--warn)';
		return 'var(--bad)';
	}
	function chanceRGB(p: number) {
		if (p >= 0.7) return '79, 191, 122';
		if (p >= 0.45) return '227, 179, 65';
		return '224, 96, 79';
	}

	let hovered = $state<number | null>(null);
	$effect(() => {
		game.bidHoverStrain = hovered !== null ? options[hovered].contract.strain : null;
	});
	$effect(() => () => {
		game.bidHoverStrain = null;
	});

	const detail = $derived.by(() => {
		if (hovered !== null) return options[hovered];
		const sel = game.selectedBid;
		return sel ? options.find((o) => o.contract.level === sel.level && o.contract.strain === sel.strain) : undefined;
	});

	const portrait = $derived(L.orientation === 'portrait');
	const box = $derived(
		portrait
			? { x: 16, y: L.table.y + 166, w: L.W - 32, h: 590 }
			: { x: L.table.x + 18, y: 16, w: L.table.w - 36, h: 560 }
	);
</script>

<div
	class="panel bid"
	style:left="{box.x}px"
	style:top="{box.y}px"
	style:width="{box.w}px"
	style:height="{box.h}px"
	transition:scale={{ start: 0.6, duration: 320, easing: backOut }}
>
	<div class="top">
		<h2>Choose your contract</h2>
		<div class="need">Need {num(need)} more · {run.dealsLeft} deal{run.dealsLeft === 1 ? '' : 's'} left</div>
	</div>
	<div class="info">
		<span>Your hand: {myHcp} points</span>
		{#if info.exact && info.hand}
			<span class="partner">
				<span class="ploy-light">Dummy:</span>
				{#each [4, 3, 2, 1] as s (s)}
					{@const ranks = cards.cardsOfSuit(info.hand, s).map((c) => cards.RANK_NAMES[c.rank]).join('')}
					<span class="holding"><Suit suit={s} size={14} color={strainColor(s)} />{ranks || '-'}</span>
				{/each}
				<span class="dim">{info.hcp} points</span>
			</span>
		{:else}
			<span class="partner">
				<span class="dim">Partner's bid:</span>
				<span>{info.range.low}-{Math.min(info.range.high, 24)} points</span>
				{#if info.longSuits.length > 0}
					{#each info.longSuits as ls (ls.suit)}
						<span class="holding">{ls.length}<Suit suit={ls.suit} size={16} color={strainColor(ls.suit)} /></span>
					{/each}
				{:else if info.balanced}
					<span>balanced</span>
				{:else}
					<span class="dim">no long suit</span>
				{/if}
			</span>
		{/if}
	</div>

	<div class="grid">
		<div></div>
		{#each [1, 2, 3, 4, 5] as s (s)}
			<div class="col-head"><Strain strain={s} size={18} /></div>
		{/each}
		{#each [1, 2, 3, 4, 5, 6, 7] as level (level)}
			<div class="row-head">{level}</div>
			{#each [1, 2, 3, 4, 5] as s (s)}
				{@const idx = (level - 1) * 5 + (s - 1)}
				{@const o = options[idx]}
				{@const isSel = game.selectedBid?.level === level && game.selectedBid?.strain === s}
				{@const isRec = rec?.level === level && rec?.strain === s}
				<button
					class="cell"
					class:sel={isSel}
					class:rec={isRec}
					style:--rgb={chanceRGB(o.chance)}
					onpointerenter={(e) => e.pointerType === 'mouse' && (hovered = idx)}
					onpointerleave={() => hovered === idx && (hovered = null)}
					onclick={() => game.selectBid(o.contract)}
				>
					{#if o.projected >= need && need > 0}<span class="clears"></span>{/if}
					<span class="c"><Contract contract={o.contract} size={20} suitColor={strainColor(s)} /></span>
					{#if isRec}<span class="star">★</span>{/if}
					<span class="nums">
						<span style:color={chanceColor(o.chance)}>{pct(o.chance)}</span>
						<span class="dim">{num(o.projected)}</span>
					</span>
				</button>
			{/each}
		{/each}
	</div>

	<div class="foot">
		<div class="detail">
			{#if detail}
				<Contract contract={detail.contract} size={20} suitColor={strainColor(detail.contract.strain)} />
				<span class="dim">
					needs {scoring.tricksNeeded(detail.contract)} of 13 tricks · {pct(detail.chance)} to make · scores at least
					{num(detail.projected)}
				</span>
			{:else}
				<span class="dim small"
					>Green is safe, red is a stretch. A brass edge clears the board on its own. The starred cell is the
					recommended bid.</span
				>
			{/if}
		</div>
		<Button enabled={game.selectedBid !== null} pulse onclick={() => game.commitSelectedBid()} style="width: 186px"
			>{game.selectedBid ? 'Bid' : 'Pick a contract'}</Button
		>
	</div>
</div>

<style>
	.bid {
		display: flex;
		flex-direction: column;
		padding: 14px 24px 14px;
		gap: 8px;
		z-index: 120;
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
	}
	h2 {
		margin: 0;
		font-size: 28px;
		text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
	}
	.need,
	.dim {
		color: var(--ink-dim);
	}
	.need {
		font-size: 17px;
	}
	.info {
		display: flex;
		gap: 28px;
		font-size: 17px;
		flex-wrap: wrap;
		row-gap: 4px;
	}
	.partner {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.holding {
		display: inline-flex;
		align-items: center;
		gap: 3px;
	}
	.ploy-light {
		color: var(--ploy-light);
	}
	.grid {
		display: grid;
		grid-template-columns: 36px repeat(5, 1fr);
		grid-auto-rows: 44px;
		grid-template-rows: 24px;
		gap: 6px;
		flex: 1;
		align-content: start;
	}
	.col-head {
		display: flex;
		justify-content: center;
		align-items: center;
	}
	.row-head {
		display: flex;
		align-items: center;
		font-size: 20px;
		color: var(--ink-dim);
	}
	.cell {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 10px 0 12px;
		border: none;
		border-radius: 6px;
		background: rgba(var(--rgb), 0.16);
		color: var(--ink);
		font: inherit;
		cursor: pointer;
		transition:
			background 0.1s,
			transform 0.1s;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
	}
	.cell:hover {
		background: rgba(var(--rgb), 0.34);
		transform: translateY(-1px);
	}
	.cell.rec {
		box-shadow: inset 0 0 0 1px var(--brass-dim);
	}
	.cell.sel {
		box-shadow: 0 0 0 3px var(--ink);
	}
	.clears {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 4px;
		border-radius: 2px;
		background: var(--brass);
	}
	.star {
		position: absolute;
		left: 42%;
		color: var(--brass);
		font-size: 16px;
		animation: twinkle 1.57s ease-in-out infinite;
	}
	@keyframes twinkle {
		50% {
			transform: scale(1.25);
		}
	}
	.nums {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		font-size: 14px;
		line-height: 1.2;
		font-variant-numeric: tabular-nums;
	}
	.foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}
	.detail {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 16px;
	}
	.small {
		font-size: 14px;
	}
</style>
