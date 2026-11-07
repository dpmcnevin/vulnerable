<!-- A strain: a suit symbol, or "NT" for notrump. -->
<script lang="ts">
	import Suit from './Suit.svelte';
	import { strainColor } from './colors.ts';

	let { strain, size = 16, color }: { strain: number; size?: number; color?: string } = $props();
	const col = $derived(color ?? strainColor(strain));
</script>

{#if strain === 5}
	<span class="nt" style:color={col} style:font-size="{size * 0.9}px">NT</span>
{:else}
	<Suit suit={strain} {size} color={col} />
{/if}

<style>
	.nt {
		font-weight: 700;
		letter-spacing: -0.02em;
	}
</style>
