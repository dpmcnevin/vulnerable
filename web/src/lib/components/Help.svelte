<!-- How to play. -->
<script lang="ts">
	import { scale, fade } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { game } from '../app/game.svelte.ts';
	import Button from './Button.svelte';

	const HELP = [
		'You are always declarer, sitting South. North is your dummy, and you play both hands.',
		"Each deal: look at your hand and your partner's bid, then choose a contract -- a level (1 to 7) and a strain. Level 4 means you must win 4 + 6 = 10 of the 13 tricks.",
		'West leads, dummy goes face up, and you play out the hand against the AI defenders. Follow suit if you can; trumps beat everything else.',
		'Contracts are scored by real duplicate bridge rules. Bidding game (100+ contract points) or a slam (level 6 or 7) earns big bonuses -- but a failed contract scores nothing.',
		"Reach each board's target within three deals. Win boards to earn money, then spend it at the club on relics, which multiply your scores, and conventions, which level up a strain.",
		'Beat all three boards in each of eight rubbers to win. The third board of every rubber, and every board from rubber five, is vulnerable: bigger bonuses, bigger targets.'
	];
	const L = $derived(game.layout);
	const pw = $derived(Math.min(760, L.W - 40));
</script>

<div class="backdrop" role="presentation" onclick={() => (game.showHelp = false)} transition:fade={{ duration: 120 }}></div>
<div
	class="panel help"
	style:left="{(L.W - pw) / 2}px"
	style:top="{L.orientation === 'portrait' ? 260 : 80}px"
	style:width="{pw}px"
	transition:scale={{ start: 0.6, duration: 320, easing: backOut }}
>
	<h2>How to play</h2>
	{#each HELP as para (para)}<p>{para}</p>{/each}
	<p class="keys">Space or Enter: the next step. Esc: back. P: scorepad. M: music. Tap a card twice on a small screen to play it.</p>
	<div class="foot"><Button onclick={() => (game.showHelp = false)} style="width: 150px">Got it</Button></div>
</div>

<style>
	.backdrop {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		z-index: 300;
	}
	.help {
		box-sizing: border-box;
		padding: 20px 30px;
		z-index: 310;
	}
	h2 {
		margin: 0 0 12px;
		font-size: 28px;
		color: var(--brass);
		text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
	}
	p {
		font-size: 17px;
		line-height: 1.35;
		margin: 0 0 12px;
	}
	.keys {
		color: var(--ink-dim);
		font-size: 14px;
	}
	.foot {
		display: flex;
		justify-content: flex-end;
	}
</style>
