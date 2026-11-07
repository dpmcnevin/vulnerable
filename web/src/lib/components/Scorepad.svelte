<!-- A rubber-bridge scorepad for the current rubber: WE and THEY, above and
     below the line. Bridge points only; relic multipliers aren't bridge. -->
<script lang="ts">
	import { scale, fade } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import * as engine from '../game/engine.ts';
	import type { PadEntry } from '../game/engine.ts';
	import { game } from '../app/game.svelte.ts';
	import { num } from '../app/format.ts';
	import Contract from './Contract.svelte';
	import { paperColor } from './colors.ts';

	const L = $derived(game.layout);
	const run = $derived(game.run!);
	const pad = $derived.by(() => {
		void game.v;
		return engine.scorepad(run);
	});
	const totals = $derived(engine.padTotals(pad));
	// Above the line, each new score is written above the last: the first
	// entry sits on the line. Only the most recent ones fit.
	const MAX_ABOVE = 9;
	const above = (list: PadEntry[]) => list.slice(Math.max(0, list.length - MAX_ABOVE));
</script>

{#snippet entry(e: PadEntry)}
	<div class="entry">
		<span class="pts">{num(e.points)}</span>
		<span class="what">
			{#if e.contract}<Contract contract={e.contract} size={14} color="#1f2133" suitColor={paperColor(e.contract.strain)} />{/if}
			{#if e.label}<span class="lab">{e.label}</span>{/if}
		</span>
	</div>
{/snippet}

<div class="backdrop" role="presentation" onclick={() => (game.showPad = false)} transition:fade={{ duration: 120 }}></div>
<div
	class="pad"
	style:left="{L.tableCX - 260}px"
	style:top="{L.orientation === 'portrait' ? L.table.y + 60 : 60}px"
	transition:scale={{ start: 0.6, duration: 320, easing: backOut }}
>
	<div class="title">Scorepad · Rubber {run.rubber}</div>
	<div class="sub">Bridge points only; relic multipliers aren't part of rubber bridge.</div>
	<div class="cols">
		<div class="col-head">WE</div>
		<div class="col-head">THEY</div>
	</div>
	<!-- One continuous WE | THEY divider runs down the whole body. -->
	<div class="body">
		<div class="above">
			<div class="side">{#each above(pad.above.we) as e, i (i)}{@render entry(e)}{/each}</div>
			<div class="side">{#each above(pad.above.they) as e, i (i)}{@render entry(e)}{/each}</div>
		</div>
		<div class="below">
			{#each pad.games as g, gi (gi)}
				<div class="game">
					<div class="side">{#each g.we as e, i (i)}{@render entry(e)}{/each}</div>
					<div class="side">{#each g.they as e, i (i)}{@render entry(e)}{/each}</div>
				</div>
				{#if g.won}<div class="ruled"><span>game {gi + 1}</span></div>{/if}
			{/each}
		</div>
	</div>
	<div class="totals">
		<span class="lab">Total</span>
		<span class="big">{num(totals[0])}</span>
		<span class="big">{num(totals[1])}</span>
	</div>
	<div class="sub">Games won: {pad.gamesWon}</div>
</div>

<style>
	.backdrop {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		z-index: 300;
	}
	.pad {
		position: absolute;
		width: 520px;
		height: 600px;
		box-sizing: border-box;
		padding: 14px 20px;
		display: flex;
		flex-direction: column;
		background: #f2ebd6;
		color: #1f2133;
		border: 2px solid var(--brass-dim);
		border-radius: 6px;
		box-shadow: 4px 6px 0 rgba(0, 0, 0, 0.35);
		z-index: 310;
	}
	.title {
		text-align: center;
		font-size: 20px;
		font-weight: 700;
	}
	.sub {
		text-align: center;
		font-size: 12px;
		color: #666b80;
		margin-top: 4px;
	}
	.cols,
	.above,
	.game,
	.totals {
		display: grid;
		grid-template-columns: 1fr 1fr;
	}
	.body {
		position: relative;
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	.body::before {
		content: '';
		position: absolute;
		left: calc(50% - 1px);
		top: 0;
		bottom: 0;
		width: 2px;
		background: #1f2133;
	}
	.cols {
		margin-top: 12px;
		border-bottom: 2px solid #1f2133;
		padding-bottom: 4px;
	}
	.col-head {
		text-align: center;
		font-size: 20px;
		font-weight: 700;
	}
	.above {
		height: 210px;
		flex: none;
		align-items: end;
		border-bottom: 3px solid #b8263a;
		padding-bottom: 4px;
	}
	.above .side {
		display: flex;
		flex-direction: column-reverse;
	}
	.side {
		padding: 0 10px;
	}
	.below {
		flex: 1;
		overflow: hidden;
		padding-top: 6px;
	}
	.game .side {
		min-height: 4px;
	}
	.entry {
		display: grid;
		grid-template-columns: 70px 1fr;
		gap: 10px;
		align-items: center;
		height: 22px;
		font-size: 17px;
	}
	.pts {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.what {
		display: inline-flex;
		gap: 6px;
		align-items: center;
	}
	.lab {
		font-size: 12px;
		color: #666b80;
	}
	/* A won game is ruled off right across the pad. */
	.ruled {
		border-top: 1px solid #1f2133;
		margin: 3px 0 6px;
		padding-left: 12px;
		font-size: 12px;
		line-height: 1.4;
		color: #666b80;
	}
	.totals {
		position: relative;
		border-top: 2px solid #1f2133;
		padding-top: 6px;
	}
	.totals .lab {
		position: absolute;
		left: 4px;
		top: 12px;
		font-size: 14px;
	}
	.big {
		text-align: center;
		font-size: 28px;
		font-weight: 700;
	}
</style>
