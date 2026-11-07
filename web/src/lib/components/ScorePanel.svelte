<!-- The deal's score, counted up line by line: the bridge score, then each
     convention and relic, with running points x mult beneath. -->
<script lang="ts">
	import { scale, fly } from 'svelte/transition';
	import { backOut, cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { game, PHASE } from '../app/game.svelte.ts';
	import { num } from '../app/format.ts';
	import { settings } from '../ui/settings.svelte.ts';
	import Contract from './Contract.svelte';
	import Button from './Button.svelte';
	import { strainColor } from './colors.ts';

	const L = $derived(game.layout);
	const run = $derived(game.run!);
	const deal = $derived(game.deal);
	const r = $derived(deal.result!);
	const b = $derived(r.bridge);
	const rv = $derived(game.reveal!);

	const shownItems = $derived(rv.items.slice(0, rv.shown));
	const running = $derived.by(() => {
		let points = 0,
			mult = 1;
		if (r.made) {
			for (const item of shownItems) {
				points += item.points ?? 0;
				mult += item.mult ?? 0;
				mult *= item.xmult ?? 1;
			}
		}
		return { points, mult };
	});
	const pts = new Tween(0, { duration: 260, easing: cubicOut });
	const mult = new Tween(1, { duration: 260, easing: cubicOut });
	$effect(() => {
		pts.target = running.points;
		mult.target = running.mult;
	});
	const board = new Tween(0, { duration: 700, easing: cubicOut });
	$effect(() => {
		board.target = run.score - (rv.done ? 0 : r.total);
	});

	function header(i: number): string | null {
		if (!settings.rubberView || !rv.items[i].bridge) return null;
		if (r.made && i === 0) return 'Below the line';
		if (r.made && i === 1) return 'Above the line';
		if (!r.made && i === 0) return 'Above the line, to the defenders';
		return null;
	}
	function parts(item: (typeof rv.items)[number]) {
		const out: { text: string; cls: string }[] = [];
		if (item.points) out.push({ text: (item.points > 0 ? '+' : '') + num(item.points), cls: 'chips' });
		if (item.mult) out.push({ text: `+${item.mult.toFixed(2)} mult`, cls: 'multc' });
		if (item.xmult && item.xmult !== 1) out.push({ text: `x${item.xmult.toFixed(2)}`, cls: 'multc' });
		return out;
	}

	const nextLabel = $derived(
		run.score >= run.target ? 'Board won!' : run.dealsLeft <= 0 ? 'Out of deals' : `Next deal  (${run.dealsLeft} left)`
	);
	const pw = $derived(Math.min(580, L.W - 32));
	const ph = 500;
	const box = $derived({ x: L.tableCX - pw / 2, y: L.orientation === 'portrait' ? L.table.y + 220 : 110 });
	$effect(() => {
		rv.totalY = box.y + ph - 148;
	});
	const firstAddon = $derived(rv.items.findIndex((i) => !i.bridge));
</script>

{#if run.phase === PHASE.DEAL_SCORED}
	<div
		class="panel score"
		class:made={r.made}
		style:left="{box.x}px"
		style:top="{box.y}px"
		style:width="{pw}px"
		style:height="{ph}px"
		transition:scale={{ start: 0.6, duration: 320, easing: backOut }}
	>
		<div class="title-row">
			<h2 class:good={r.made} class:bad={!r.made}>
				{#if r.made}
					{b.overtricks > 0 ? `Made with ${b.overtricks} overtrick${b.overtricks > 1 ? 's' : ''}` : 'Contract made'}
				{:else}
					Down {b.undertricks}
				{/if}
			</h2>
			<Contract contract={deal.contract!} size={28} suitColor={strainColor(deal.contract!.strain)} />
		</div>
		<div class="dim">
			{b.tricksWon} of 13 tricks · needed {b.tricksNeeded}{(deal.phantom ?? 0) > 0
				? ` · incl. ${deal.phantom} phantom`
				: ''}
		</div>

		<div class="lines">
			{#each shownItems as item, i (i)}
				{#if i === firstAddon}<div class="divider"></div>{/if}
				{#if header(i)}<div class="header">{header(i)}</div>{/if}
				<div class="line" in:fly={{ x: -20, duration: 180, easing: cubicOut }}>
					<span>{item.label}</span>
					<span class="parts">
						{#each parts(item) as part (part.text)}<span class={part.cls}>{part.text}</span>{/each}
					</span>
				</div>
			{/each}
			{#if !r.made && rv.done}
				<div class="dim note">A failed contract scores nothing toward the target.</div>
				{#if r.refunded}<div class="ploy-light note">Safety Net: you get this deal back.</div>{/if}
			{/if}
		</div>

		{#if r.made}
			<div class="totals">
				<span class="pill chips-bg">{num(pts.current)}</span>
				<span class="x">x</span>
				<span class="pill mult-bg">{mult.current.toFixed(2)}</span>
				{#if rv.done}
					<span class="total" in:scale={{ start: 1.25, duration: 250 }}>= {num(r.total)}</span>
				{/if}
			</div>
		{/if}

		<div class="board">
			<div>Board {num(board.current)} / {num(run.target)}</div>
			<div class="bar">
				<div
					class="fill"
					style:width="{Math.min(100, (100 * board.current) / Math.max(1, run.target))}%"
					style:background={run.score >= run.target && rv.done ? 'var(--good)' : 'var(--brass)'}
				></div>
			</div>
		</div>

		<div class="foot">
			{#if rv.done}
				<Button pulse onclick={() => game.continueAfterDeal()} style="width: 220px">{nextLabel}</Button>
			{:else}
				<span class="faint">click to skip</span>
			{/if}
		</div>
	</div>
{/if}

<style>
	.score {
		display: flex;
		flex-direction: column;
		padding: 18px 30px;
		gap: 6px;
		border-color: var(--bad);
		z-index: 120;
	}
	.score.made {
		border-color: var(--good);
	}
	.title-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	h2 {
		margin: 0;
		font-size: 28px;
		text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
	}
	.good {
		color: var(--good);
	}
	.bad {
		color: var(--bad);
	}
	.dim {
		color: var(--ink-dim);
		font-size: 17px;
	}
	.faint {
		color: var(--ink-faint);
		font-size: 14px;
	}
	.ploy-light {
		color: var(--ploy-light);
	}
	.lines {
		flex: 1;
		margin-top: 16px;
		overflow: hidden;
		font-size: 17px;
	}
	.line {
		display: flex;
		justify-content: space-between;
		height: 25px;
		align-items: center;
	}
	.parts {
		display: flex;
		gap: 14px;
		font-variant-numeric: tabular-nums;
	}
	.chips {
		color: var(--chips);
	}
	.multc {
		color: var(--mult);
	}
	.divider {
		height: 1px;
		background: var(--panel-edge);
		margin: 4px 0 6px;
	}
	.header {
		font-size: 12px;
		color: var(--brass-dim);
		margin-top: 2px;
	}
	.note {
		margin-top: 10px;
	}
	.totals {
		display: flex;
		align-items: center;
		gap: 8px;
		border-top: 1px solid var(--panel-edge);
		padding-top: 10px;
		height: 50px;
	}
	.pill {
		font-size: 28px;
		font-weight: 700;
		padding: 2px 12px;
		border-radius: 8px;
		box-shadow: inset 0 3px 0 rgba(255, 255, 255, 0.2);
		font-variant-numeric: tabular-nums;
	}
	.chips-bg {
		background: var(--chips);
	}
	.mult-bg {
		background: var(--mult);
	}
	.x {
		font-size: 28px;
		color: var(--ink-dim);
	}
	.total {
		margin-left: auto;
		font-size: 30px;
		font-weight: 700;
		text-shadow: 3px 3px 0 rgba(0, 0, 0, 0.6);
	}
	.board {
		font-size: 17px;
		margin-top: 8px;
	}
	.bar {
		height: 12px;
		background: var(--bg);
		border-radius: 6px;
		overflow: hidden;
		margin-top: 6px;
	}
	.fill {
		height: 100%;
	}
	.foot {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		height: 48px;
		margin-top: 8px;
	}
</style>
