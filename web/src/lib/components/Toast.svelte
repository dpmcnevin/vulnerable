<!-- A short message that pops in over the table and fades. -->
<script lang="ts">
	import { scale, fade } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { game } from '../app/game.svelte.ts';
	import { css } from '../ui/theme.ts';

	const L = $derived(game.layout);
	const y = $derived(L.orientation === 'portrait' ? L.handY[3] - 120 : 470);
</script>

{#if game.toast}
	{#key game.toast.id}
		<div class="toast-wrap" style:left="{L.table.x}px" style:width="{L.table.w}px" style:top="{y}px">
			<div
				class="toast"
				style:color={css(game.toast.color)}
				style:border-color={css(game.toast.color)}
				in:scale={{ start: 0.6, duration: 250, easing: backOut }}
				out:fade={{ duration: 150 }}
			>
				{game.toast.text}
			</div>
		</div>
	{/key}
{/if}

<style>
	.toast-wrap {
		position: absolute;
		display: flex;
		justify-content: center;
		pointer-events: none;
		z-index: 400;
	}
	.toast {
		max-width: calc(100% - 40px);
		padding: 10px 20px;
		background: var(--sidebar);
		border: 2px solid;
		border-radius: 8px;
		box-shadow: 3px 4px 0 rgba(0, 0, 0, 0.35);
		font-size: 20px;
		text-align: center;
	}
</style>
