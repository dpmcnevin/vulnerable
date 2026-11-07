<!-- A suit symbol drawn from the same geometry as the smooth cards. -->
<script lang="ts">
	let { suit, size = 16, color = 'currentColor' }: { suit: number; size?: number; color?: string } = $props();
</script>

<svg class="suit" width={size} height={size} viewBox="-1 -1 2 2" aria-hidden="true">
	<g fill={color}>
		{#if suit === 2}
			<polygon points="0,-1 0.72,0 0,1 -0.72,0" />
		{:else if suit === 3}
			<circle cx={-0.494} cy={-0.28} r={0.52} />
			<circle cx={0.494} cy={-0.28} r={0.52} />
			<polygon points="-0.98,-0.12 0.98,-0.12 0,1" />
		{:else if suit === 4}
			<circle cx={-0.475} cy={0.18} r={0.5} />
			<circle cx={0.475} cy={0.18} r={0.5} />
			<polygon points="-0.96,0.05 0.96,0.05 0,-1" />
			<polygon points="0,0.2 -0.35,1 0.35,1" />
		{:else}
			<circle cx={0} cy={-0.5} r={0.42} />
			<circle cx={-0.5} cy={0.08} r={0.42} />
			<circle cx={0.5} cy={0.08} r={0.42} />
			<circle cx={0} cy={0} r={0.252} />
			<polygon points="0,0 -0.32,1 0.32,1" />
		{/if}
	</g>
</svg>

<style>
	.suit {
		display: inline-block;
		vertical-align: -0.12em;
		overflow: visible;
	}
</style>
