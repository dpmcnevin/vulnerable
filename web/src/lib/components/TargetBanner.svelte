<!-- Picking a card for a ploy: a pulsing banner above your hand. -->
<script lang="ts">
	import { fly } from 'svelte/transition';
	import { game } from '../app/game.svelte.ts';
	import Icon from './Icon.svelte';

	const L = $derived(game.layout);
	const p = $derived(game.run!.ploys[game.targeting!]);
	$effect(() => {
		if (!p) game.targeting = null;
	});
</script>

{#if p}
	<div
		class="banner"
		style:left="{L.tableCX - 280}px"
		style:top="{L.handY[3] - 62}px"
		transition:fly={{ y: 20, duration: 200 }}
	>
		<Icon name={p.key} scale={2} />
		<span>Pick a card for {p.name}</span>
		<button onclick={() => (game.targeting = null)}>Cancel</button>
	</div>
{/if}

<style>
	.banner {
		position: absolute;
		width: 560px;
		height: 42px;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 4px;
		background: var(--sidebar);
		border: 2px solid var(--ploy);
		border-radius: 8px;
		box-shadow: 3px 4px 0 rgba(0, 0, 0, 0.35);
		color: var(--ploy-light);
		font-size: 17px;
		z-index: 90;
		animation: pulse 1.25s ease-in-out infinite;
	}
	@keyframes pulse {
		50% {
			border-color: rgba(142, 107, 209, 0.35);
		}
	}
	button {
		margin-left: auto;
		font: inherit;
		font-size: 14px;
		background: var(--panel-edge);
		color: var(--ink);
		border: none;
		border-radius: 6px;
		padding: 6px 12px;
		cursor: pointer;
	}
</style>
