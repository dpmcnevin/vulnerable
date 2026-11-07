<!-- The run's status: rubber and board, target and score, the contract,
     money, strain levels, relics and ploys. A column beside the table in
     landscape; a strip above it in portrait. -->
<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import * as cards from '../rules/cards.ts';
	import * as play from '../rules/play.ts';
	import * as scoring from '../rules/scoring.ts';
	import * as engine from '../game/engine.ts';
	import * as relics from '../game/relics.ts';
	import * as conventions from '../game/conventions.ts';
	import { game, PHASE } from '../app/game.svelte.ts';
	import { num } from '../app/format.ts';
	import { settings } from '../ui/settings.svelte.ts';
	import { C, css } from '../ui/theme.ts';
	import Icon from './Icon.svelte';
	import Contract from './Contract.svelte';
	import Strain from './Strain.svelte';
	import { strainColor } from './colors.ts';

	const L = $derived(game.layout);
	const portrait = $derived(L.orientation === 'portrait');
	const run = $derived(game.run!);
	const deal = $derived(game.deal);

	// Hold back the latest deal's points until its count-up has finished.
	const pending = $derived(
		run.phase === PHASE.DEAL_SCORED && deal.result && (game.trickHold || !game.reveal?.done) ? deal.result.total : 0
	);
	const score = new Tween(0, { duration: 600, easing: cubicOut });
	const money = new Tween(0, { duration: 450, easing: cubicOut });
	$effect(() => {
		score.target = run.score - pending;
	});
	$effect(() => {
		money.target = run.money;
	});
	const reached = $derived(run.score >= run.target);

	const effects = $derived.by(() => {
		void game.v;
		const d = deal;
		return [
			[d.kibitzed, 'kibitzer', "The Kibitzer: dummy's cards are known"],
			[d.seeDefenders, 'double_dummy', "Double Dummy: the defenders' cards are showing"],
			[d.declarerLeads, 'lead_out_of_turn', 'Lead Out of Turn: you lead first'],
			[d.noDouble, 'psych', "Psych: the defenders won't double"],
			[d.carelessDefense, 'table_talk', 'Table Talk: the defenders play carelessly'],
			[(d.phantom ?? 0) > 0, 'phantom_trick', 'Phantom Trick: an extra trick counts for you'],
			[d.safetyNet, 'safety_net', "Safety Net: a failed contract won't cost this deal"]
		].filter((e) => e[0]) as [boolean, string, string][];
	});

	const tricks = $derived.by(() => {
		void game.v;
		if (!deal.contract) return null;
		const made = deal.state ? play.declarerTricks(deal.state, deal.declarer) : 0;
		const need = scoring.tricksNeeded(deal.contract);
		const lost = deal.state ? deal.state.ewTricks : 0;
		const trumpLabel =
			deal.contract.strain === cards.NOTRUMP
				? 'no trumps'
				: 'trumps: ' + cards.STRAINS[deal.contract.strain].name.toLowerCase();
		return { made, need, note: `${trumpLabel} · can lose ${Math.max(0, 13 - need - lost)} more` };
	});

	function levelTip(s: number) {
		const lvl = run.strainLevels[s];
		const [pts, m] = conventions.bonusFor(lvl);
		return `${cards.STRAINS[s].name} level ${lvl}: +${pts} points, +${m.toFixed(2)} mult on contracts in this strain.`;
	}
</script>

<aside
	class="sidebar"
	class:portrait
	style:left="{L.sidebar.x}px"
	style:top="{L.sidebar.y}px"
	style:width="{L.sidebar.w}px"
	style:height="{L.sidebar.h}px"
>
	<section class="head">
		<div class="title-row">
			<h1>VULNERABLE</h1>
			<button class="pad-btn" title="Rubber-bridge scorepad: above and below the line (P)" onclick={() => game.togglePad()}
				>Scorepad</button
			>
		</div>
		<div class="rubber">Rubber {Math.min(run.rubber, engine.RUBBERS)} of {engine.RUBBERS}</div>
		<div class="board-row">
			<span class="dim">{engine.boardName(run)}</span>
			{#if run.vulnerable}<span class="vul">VUL</span>{/if}
		</div>
	</section>

	<section class="target box">
		<div class="row">
			<div>
				<div class="label">Target</div>
				<div class="big">{num(run.target)}</div>
			</div>
			<div class="right">
				<div class="label">Scored</div>
				<div class="big" class:good={reached}>{num(score.current)}</div>
			</div>
		</div>
		<div class="bar">
			<div
				class="fill"
				style:width="{Math.min(100, (100 * score.current) / Math.max(1, run.target))}%"
				style:background={reached ? 'var(--good)' : 'var(--brass)'}
			></div>
		</div>
		<div class="deals">
			<span class="tiny">Deals</span>
			{#each { length: engine.DEALS_PER_BOARD }, i (i)}
				<span class="dot" class:used={i + 1 > run.dealsLeft}></span>
			{/each}
		</div>
	</section>

	<section class="contract">
		<div class="row">
			<div>
				<div class="label-row">
					<span class="label">Contract</span>
					{#each effects as e (e[1])}
						<span title={e[2]}><Icon name={e[1]} scale={1} title={e[2]} /></span>
					{/each}
				</div>
				{#if deal.contract}
					<div class="contract-big">
						<Contract contract={deal.contract} size={28} suitColor={strainColor(deal.contract.strain)} />
					</div>
				{:else}
					<div class="faint bidding">bidding…</div>
				{/if}
			</div>
			{#if tricks}
				<div class="right">
					<div class="label">Tricks</div>
					<div class="big" class:good={tricks.made >= tricks.need}>{tricks.made} / {tricks.need}</div>
				</div>
			{/if}
		</div>
		{#if tricks}<div class="tiny faint">{tricks.note}</div>{/if}
	</section>

	<section class="money">
		<div class="row">
			<div>
				<div class="label">Money</div>
				<div class="big brass">${num(money.current)}</div>
			</div>
			<div class="right">
				<div class="label">Interest</div>
				<div class="dim body">+${engine.interest(run)}</div>
			</div>
		</div>
		<div class="levels">
			<span class="label">Levels</span>
			{#each [1, 2, 3, 4, 5] as s (s)}
				<span class="level" title={levelTip(s)}>
					<Strain strain={s} size={16} />
					<span class:brass={run.strainLevels[s] > 1} class:faint={run.strainLevels[s] <= 1}
						>{run.strainLevels[s]}</span
					>
				</span>
			{/each}
		</div>
	</section>

	<section class="relics">
		<div class="label">Relics {run.relics.length}/{engine.RELIC_SLOTS}</div>
		<div class="relic-list">
			{#each { length: engine.RELIC_SLOTS }, i (i)}
				{@const relic = run.relics[i]}
				{#if relic}
					<div
						class="relic"
						title="{relic.name} ({relics.RARITY_NAME[relic.def.rarity]})&#10;{relics.textFor(relic)}"
					>
						<Icon name={relic.key} scale={2} />
						<span class="rarity" style:background={css(C.rarity[relic.def.rarity])}></span>
						<span class="name">{relic.name}</span>
					</div>
				{:else}
					<div class="relic empty"></div>
				{/if}
			{/each}
		</div>
	</section>

	<section class="ploys">
		<div class="label">Ploys {run.ploys.length}/{engine.PLOY_SLOTS}</div>
		<div class="ploy-row">
			{#each { length: engine.PLOY_SLOTS }, i (i)}
				{@const p = run.ploys[i]}
				{#if p}
					{@const usable = engine.canUsePloy(run, i)[0]}
					<button
						class="ploy"
						class:usable
						title="{p.name}&#10;{p.def.text}&#10;(click for options)"
						onclick={() => game.openPloy(i)}
					>
						<Icon name={p.key} scale={2} />
						<span class="name">{p.name}</span>
					</button>
				{:else}
					<div class="ploy empty">empty</div>
				{/if}
			{/each}
		</div>
	</section>

	<div class="hint">Seed {run.seed} · M: music {settings.music ? 'on' : 'off'}</div>
</aside>

<style>
	.sidebar {
		position: absolute;
		box-sizing: border-box;
		background: var(--sidebar);
		border-right: 3px solid var(--brass-dim);
		padding: 14px 18px;
		color: var(--ink);
		display: flex;
		flex-direction: column;
		gap: 10px;
		z-index: 100;
	}
	.sidebar > section {
		flex: none;
	}
	.sidebar.portrait {
		border-right: none;
		border-bottom: 3px solid var(--brass-dim);
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		grid-template-areas:
			'head target relics'
			'contract money relics'
			'ploys ploys relics';
		column-gap: 16px;
		row-gap: 6px;
		padding: 12px 16px;
		padding-top: max(12px, env(safe-area-inset-top));
	}
	.portrait .head {
		grid-area: head;
	}
	.portrait .target {
		grid-area: target;
	}
	.portrait .contract {
		grid-area: contract;
	}
	.portrait .money {
		grid-area: money;
	}
	.portrait .relics {
		grid-area: relics;
	}
	.portrait .ploys {
		grid-area: ploys;
	}
	.portrait .hint {
		display: none;
	}
	h1 {
		margin: 0;
		font-size: 20px;
		letter-spacing: 0.06em;
		color: var(--brass);
		text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
	}
	.title-row,
	.row,
	.board-row,
	.label-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
	}
	.label-row {
		justify-content: flex-start;
		gap: 3px;
	}
	.label-row .label {
		margin-right: 8px;
	}
	.row {
		align-items: flex-start;
	}
	.right {
		text-align: right;
	}
	.pad-btn {
		font: inherit;
		font-size: 12px;
		background: var(--panel-edge);
		color: var(--ink);
		border: none;
		border-radius: 6px;
		padding: 4px 10px;
		cursor: pointer;
	}
	.rubber {
		font-size: 17px;
		margin-top: 6px;
	}
	.dim {
		color: var(--ink-dim);
		font-size: 14px;
	}
	.faint {
		color: var(--ink-faint);
	}
	.brass {
		color: var(--brass);
	}
	.good {
		color: var(--good) !important;
	}
	.vul {
		background: var(--bad);
		color: var(--ink);
		font-size: 14px;
		border-radius: 4px;
		padding: 1px 12px;
		animation: vul 2.1s ease-in-out infinite;
	}
	@keyframes vul {
		50% {
			filter: brightness(0.8);
		}
	}
	.box {
		background: var(--panel);
		border: 2px solid var(--brass-dim);
		border-radius: 10px;
		padding: 8px 12px;
		margin: 0 -6px;
	}
	.portrait .box {
		margin: 0;
	}
	.label {
		font-size: 14px;
		color: var(--ink-dim);
	}
	.tiny {
		font-size: 12px;
	}
	.big {
		font-size: 28px;
		font-weight: 700;
		text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
		font-variant-numeric: tabular-nums;
	}
	.body {
		font-size: 17px;
		margin-top: 4px;
	}
	.bar {
		height: 10px;
		background: var(--bg);
		border-radius: 5px;
		overflow: hidden;
		margin: 6px 0;
	}
	.fill {
		height: 100%;
		border-radius: 5px;
	}
	.deals {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--ink-dim);
	}
	.dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--brass);
	}
	.dot.used {
		background: var(--panel-edge);
	}
	.contract-big {
		margin-top: 8px;
		min-height: 30px;
	}
	.bidding {
		margin-top: 10px;
		font-size: 17px;
	}
	.levels {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 8px;
		font-size: 14px;
	}
	.level {
		display: inline-flex;
		align-items: center;
		gap: 3px;
	}
	.relic-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-top: 4px;
	}
	.relic {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 36px;
		background: var(--panel);
		border-radius: 5px;
		margin: 0 -4px;
		font-size: 14px;
		overflow: hidden;
	}
	.portrait .relic {
		margin: 0;
		height: 38px;
	}
	.relic.empty {
		background: var(--bg);
	}
	.rarity {
		width: 3px;
		height: 24px;
		border-radius: 1px;
		flex: none;
	}
	.relic .name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.ploy-row {
		display: flex;
		gap: 8px;
		margin-top: 4px;
	}
	.ploy {
		flex: 1;
		display: flex;
		align-items: flex-start;
		gap: 4px;
		height: 44px;
		padding: 4px;
		box-sizing: border-box;
		background: var(--panel);
		border: 1px solid var(--panel-edge);
		border-radius: 6px;
		color: var(--ink);
		font: inherit;
		font-size: 12px;
		text-align: left;
		cursor: pointer;
		overflow: hidden;
	}
	.ploy.usable {
		border: 2px solid var(--ploy);
		animation: ploypulse 1.57s ease-in-out infinite;
	}
	@keyframes ploypulse {
		50% {
			border-color: rgba(142, 107, 209, 0.3);
		}
	}
	.ploy.empty {
		justify-content: center;
		align-items: center;
		color: var(--ink-faint);
		background: var(--bg);
		cursor: default;
	}
	.hint {
		margin-top: auto;
		font-size: 12px;
		color: var(--ink-faint);
	}
</style>
