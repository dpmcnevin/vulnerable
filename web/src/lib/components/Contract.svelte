<!-- "4♠", "3NT X": a level, a strain symbol and any double. -->
<script lang="ts">
	import type { Contract } from '../rules/cards.ts';
	import Strain from './Strain.svelte';

	let {
		contract,
		size = 20,
		color = 'var(--ink)',
		suitColor
	}: { contract: Contract; size?: number; color?: string; suitColor?: string } = $props();
</script>

<span class="contract" style:font-size="{size}px" style:color>
	{contract.level}<Strain strain={contract.strain} size={size * 0.78} color={suitColor} />{#if contract.doubled > 0}<span
			class="x">{contract.doubled === 2 ? ' XX' : ' X'}</span
		>{/if}
</span>

<style>
	.contract {
		display: inline-flex;
		align-items: center;
		gap: 0.12em;
		font-weight: 700;
		white-space: nowrap;
		line-height: 1;
	}
	.x {
		color: var(--bad);
		margin-left: 0.15em;
	}
</style>
