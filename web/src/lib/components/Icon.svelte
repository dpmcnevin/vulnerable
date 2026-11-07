<!-- A 16x16 relic or ploy icon on its cream tile, drawn pixel-crisp. -->
<script lang="ts">
	import { icon } from '../ui/images.ts';

	let { name, scale = 2, title }: { name: string; scale?: number; title?: string } = $props();
	const px = $derived(18 * scale);
</script>

<img class="icon" src={icon(name)} width={px} height={px} alt={title ?? name} {title} draggable="false" />

<style>
	.icon {
		image-rendering: pixelated;
		display: block;
		flex: none;
	}
</style>
