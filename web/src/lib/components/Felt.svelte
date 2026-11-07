<!-- Green baize with a slow art deco sunburst rising from below the table. -->
<script lang="ts">
	let { x, y = 0, w, h }: { x: number; y?: number; w: number; h: number } = $props();
</script>

<div class="felt" style:left="{x}px" style:top="{y}px" style:width="{w}px" style:height="{h}px">
	<div class="burst" style:left="{w / 2 - 1400}px" style:top="{h + 120 - 1400}px"></div>
</div>

<style>
	.felt {
		position: absolute;
		overflow: hidden;
		background: var(--felt);
	}
	.burst {
		position: absolute;
		width: 2800px;
		height: 2800px;
		border-radius: 50%;
		background: repeating-conic-gradient(from 0deg, rgba(28, 82, 57, 0.35) 0deg 5deg, transparent 5deg 10deg);
		animation: sway 42s ease-in-out infinite;
	}
	@keyframes sway {
		0%,
		100% {
			transform: rotate(-2.3deg);
		}
		50% {
			transform: rotate(2.3deg);
		}
	}
</style>
