<!-- A ploy's details: use it (picking a card next, if it needs one), sell it,
     or close. Clicking outside closes it. -->
<script lang="ts">
	import { scale, fade } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import * as engine from '../game/engine.ts';
	import * as ploys from '../game/ploys.ts';
	import { game } from '../app/game.svelte.ts';
	import Icon from './Icon.svelte';
	import Button from './Button.svelte';

	const L = $derived(game.layout);
	const run = $derived(game.run!);
	const i = $derived(game.modal!);
	const p = $derived(run.ploys[i]);
	const check = $derived.by(() => {
		void game.v;
		return engine.canUsePloy(run, i);
	});
</script>

{#if p}
	<div class="backdrop" role="presentation" onclick={() => (game.modal = null)} transition:fade={{ duration: 120 }}></div>
	<div
		class="panel modal"
		style:left="{L.tableCX - 240}px"
		style:top="{L.orientation === 'portrait' ? L.table.y + 260 : 190}px"
		transition:scale={{ start: 0.6, duration: 320, easing: backOut }}
	>
		<div class="head">
			<Icon name={p.key} scale={4} />
			<div>
				<h2>{p.name}</h2>
				<div class="when">Ploy · {ploys.whenText(p.def)}</div>
			</div>
		</div>
		<p>{p.def.text}</p>
		{#if !check[0]}
			<div class="bad">Can't use it now: {check[1]}</div>
		{:else if check[2]}
			<div class="dim">You'll pick the card next.</div>
		{:else}
			<div class="dim">&nbsp;</div>
		{/if}
		<div class="foot">
			<Button variant="plain" sound="sell" onclick={() => game.sellPloy(i)} style="width: 120px"
				>Sell $1</Button
			>
			<Button variant="plain" onclick={() => (game.modal = null)} style="width: 120px">Cancel</Button>
			<Button
				variant="ploy"
				sound={false}
				enabled={check[0]}
				pulse={check[0]}
				onclick={() => game.usePloyFromModal()}
				style="width: 136px; margin-left: auto">Use</Button
			>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		z-index: 300;
	}
	.modal {
		width: 480px;
		box-sizing: border-box;
		padding: 20px 24px;
		border-color: var(--ploy);
		z-index: 310;
	}
	.head {
		display: flex;
		gap: 16px;
		align-items: center;
	}
	h2 {
		margin: 0;
		font-size: 28px;
		text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
	}
	.when {
		color: var(--ploy-light);
		font-size: 14px;
		margin-top: 6px;
	}
	p {
		font-size: 17px;
		line-height: 1.35;
		min-height: 48px;
	}
	.bad {
		color: var(--bad);
		font-size: 14px;
	}
	.dim {
		color: var(--ink-dim);
		font-size: 14px;
	}
	.foot {
		display: flex;
		gap: 12px;
		margin-top: 22px;
	}
</style>
