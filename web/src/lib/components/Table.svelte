<!-- The card table: both hands, the defenders, the trick in the middle and
     cards sweeping off to whoever won it. Every card is one keyed sprite, so
     a card played from a hand flies to the trick rather than reappearing. -->
<script lang="ts">
	import * as cards from '../rules/cards.ts';
	import * as play from '../rules/play.ts';
	import * as engine from '../game/engine.ts';
	import type { Card } from '../rules/cards.ts';
	import { game, cardId, PHASE } from '../app/game.svelte.ts';
	import { handSlots, trickXY, tossAngle, type Slot } from '../app/layout.ts';
	import { C, CARD_H, CARD_W, css } from '../ui/theme.ts';
	import * as sound from '../audio/sound.ts';
	import CardSprite from './CardSprite.svelte';
	import Button from './Button.svelte';
	import { cardBack } from '../ui/images.ts';
	import { settings } from '../ui/settings.svelte.ts';
	import type { Placement } from './placement.ts';

	let { scale = 1 }: { scale?: number } = $props();

	const L = $derived(game.layout);
	const run = $derived(game.run!);
	const deal = $derived(game.deal);

	let hover = $state<{ seat: number; id: number } | null>(null);

	interface HandView {
		seat: number;
		slots: Slot[];
		isTurn: boolean;
		targetMode: boolean;
		legal: Set<Card>;
	}

	const hands = $derived.by((): HandView[] => {
		void game.v;
		const out: HandView[] = [];
		for (const seat of [cards.NORTH, cards.SOUTH]) {
			const hand = deal.state ? deal.state.hands[seat] : deal.hands[seat];
			const isTurn =
				run.phase === PHASE.PLAY && engine.isPlayerTurn(run) && deal.state!.turn === seat && !game.trickHold;
			const legal = new Set<Card>(isTurn ? play.legalPlays(deal.state!, seat) : []);
			const targetMode = game.targeting !== null && seat === cards.SOUTH && run.phase === PHASE.BID;
			out.push({ seat, slots: handSlots(L, hand, seat), isTurn, targetMode, legal });
		}
		return out;
	});

	const placements = $derived.by((): Placement[] => {
		void game.v;
		const out: Placement[] = [];
		const now = performance.now();
		const raw = game.rawDeal;
		let intro = game.dealIntro.get(raw);
		if (intro === undefined) {
			intro = now;
			game.dealIntro.set(raw, now);
		}
		const fresh = now - intro < 400;
		const trump = game.currentTrump();

		for (const h of hands) {
			const faceUp = h.seat === cards.SOUTH || deal.dummyVisible;
			const origin = L.seatOrigin[h.seat];
			h.slots.forEach((s, idx) => {
				const id = cardId(s.card);
				const hovered = hover?.id === id && (h.isTurn || h.targetMode);
				const playable = h.legal.has(s.card) || h.targetMode;
				const lift = hovered ? 24 : playable ? 8 : 0;
				let spawn: Placement['spawn'];
				let flipDelay = 0;
				const from = deal.cameFrom.get(s.card);
				if (fresh) {
					spawn = {
						x: origin[0],
						y: origin[1],
						r: 0,
						delay: idx * 0.045 + (h.seat === cards.NORTH ? 0.25 : 0),
						faceUp: false,
						sound: true
					};
					if (faceUp) flipDelay = 0.28 + idx * 0.025;
				} else if (from) {
					const o = L.seatOrigin[from];
					spawn = { x: o[0], y: o[1], r: 0.6, faceUp };
				}
				if (h.seat === cards.NORTH && !fresh) flipDelay = 0.05 + (idx + 1) * 0.035;
				out.push({
					id,
					card: s.card,
					x: s.cx,
					y: s.cy - lift,
					r: hovered ? 0 : s.r,
					s: hovered ? 1.1 : 1,
					faceUp,
					z: hovered ? 45 : 10 + idx,
					lift,
					dim: h.isTurn && !h.legal.has(s.card) && faceUp,
					highlight: hovered ? css(h.targetMode ? C.ploy : C.brass) : null,
					trump: s.card.suit === trump,
					idle: s.idle,
					flipDelay,
					hovered,
					spawn
				});
			});
		}

		// Double Dummy: the defenders' hands, face up in a column.
		if (deal.seeDefenders && deal.state) {
			for (const seat of [cards.WEST, cards.EAST]) {
				const d = L.defender[seat];
				const o = L.seatOrigin[seat];
				const x = seat === cards.WEST ? d.x - 20 : d.x + 20;
				deal.state.hands[seat].forEach((c, i) => {
					out.push({
						id: cardId(c),
						card: c,
						x,
						y: d.y - 4 + i * 17,
						r: 0,
						s: 0.55,
						faceUp: true,
						z: 5 + i,
						trump: !!deal.contract && c.suit === deal.contract.strain,
						spawn: { x: o[0], y: o[1], faceUp: false }
					});
				});
			}
		}

		// The trick in progress, or the one being held after it completed.
		const plays = game.trickHold ? game.trickHold.trick.plays : (deal.state?.trick ?? []);
		const winner = game.trickHold?.trick.winner;
		plays.forEach((pl, i) => {
			const [x, y] = trickXY(L, pl.seat);
			const o = L.seatOrigin[pl.seat];
			const isWinner = winner === pl.seat;
			out.push({
				id: cardId(pl.card),
				card: pl.card,
				x,
				y,
				r: tossAngle(pl.card),
				s: isWinner ? 1.08 : 1,
				faceUp: true,
				z: 60 + i,
				lift: isWinner ? 10 : 2,
				highlight: isWinner ? css(C.brass) : null,
				trump: !!deal.contract && pl.card.suit === deal.contract.strain,
				spawn: { x: o[0], y: o[1], r: 0, faceUp: true }
			});
		});

		// Cards sweeping off to the trick's winner (or to a ploy's receiver).
		const placed = new Set(out.map((p) => p.id));
		for (const sw of game.sweeps) {
			if (placed.has(sw.id)) continue;
			out.push({
				id: sw.id,
				card: sw.card,
				x: sw.x,
				y: sw.y,
				r: tossAngle(sw.card) + 0.4,
				s: 0.55,
				faceUp: true,
				z: 70,
				fade: true
			});
		}
		return out;
	});

	// Hover sound and wobble, once per newly hovered card.
	let lastHover: number | null = null;
	$effect(() => {
		const id = hover?.id ?? null;
		if (id !== null && id !== lastHover) sound.play('card_hover', { jitter: 0.15, volume: 0.6 });
		lastHover = id;
	});

	function enter(e: PointerEvent, seat: number, card: Card) {
		if (e.pointerType === 'mouse') hover = { seat, id: cardId(card) };
	}
	function leave(e: PointerEvent, card: Card) {
		if (e.pointerType === 'mouse' && hover?.id === cardId(card)) hover = null;
	}

	let lastPointer = 'mouse';
	function activate(h: HandView, s: Slot) {
		const id = cardId(s.card);
		// On a small touch target, the first tap lifts the card and the second plays it.
		const small = s.w * scale < 44;
		if (lastPointer !== 'mouse' && small && hover?.id !== id) {
			hover = { seat: h.seat, id };
			return;
		}
		hover = null;
		if (h.targetMode) game.applyPloy(game.targeting!, s.card);
		else if (h.legal.has(s.card)) game.playCard(s.card);
	}

	const defendersActive = $derived(!!deal.state && !deal.state.complete);
	function defenderCount(seat: number) {
		return deal.state ? deal.state.hands[seat].length : 13;
	}

	const trickWinnerText = $derived.by(() => {
		const w = game.trickHold?.trick.winner;
		if (!w) return null;
		return cards.sameSide(w, deal.declarer) ? { text: 'Your trick', good: true } : { text: "Defenders' trick", good: false };
	});
</script>

<div class="table" style:left="{L.table.x}px" style:top="{L.table.y}px" style:width="{L.table.w}px" style:height="{L.table.h}px">
</div>

<div
	class="oval"
	style:left="{L.tableCX - L.ovalRX}px"
	style:top="{L.trickCY - L.ovalRY}px"
	style:width="{L.ovalRX * 2}px"
	style:height="{L.ovalRY * 2}px"
></div>

<!-- Defenders: a stack of backs (or, with Double Dummy, sprites placed above). -->
{#each [cards.WEST, cards.EAST] as seat (seat)}
	{@const d = L.defender[seat]}
	{@const n = defenderCount(seat)}
	{@const active = defendersActive && deal.state?.turn === seat}
	{#if !(deal.seeDefenders && deal.state)}
		{#each { length: n }, i (i)}
			<img
				class="stack-back"
				class:pixel={settings.pixelCards}
				src={cardBack(settings.pixelCards)}
				alt=""
				draggable="false"
				style:left="{d.x - CARD_W / 2}px"
				style:top="{d.y + i * d.step - CARD_H / 2}px"
				style:transform="rotate({Math.PI / 2 + (seat === cards.WEST ? 0.04 : -0.04)}rad) scale(0.66)"
			/>
		{/each}
	{/if}
	<div class="seat-label" class:active style:left="{d.labelX}px" style:top="{d.labelY}px" style:text-align={d.align}>
		{cards.SEATS[seat].name.toUpperCase()}
		{#if active}<span class="thinking"></span>{/if}
	</div>
	{#if n > 0}
		<div
			class="count"
			style:left="{d.labelX}px"
			style:top="{d.y + d.step * n + 40}px"
			style:text-align={d.align}
		>
			{n} cards
		</div>
	{/if}
{/each}

{#each placements as p (p.id)}
	<CardSprite {p} />
{/each}

<!-- Stable hit zones for your two hands (sprites move; these don't). -->
{#each hands as h (h.seat)}
	{#if h.isTurn || h.targetMode}
		{#each h.slots as s (cardId(s.card))}
			{#if h.targetMode || h.legal.has(s.card)}
				<button
					class="slot"
					aria-label="Play {cards.name(s.card)}"
					style:left="{s.x}px"
					style:top="{L.handY[h.seat] - 20}px"
					style:width="{s.w}px"
					style:height="{CARD_H + 20}px"
					onpointerenter={(e) => enter(e, h.seat, s.card)}
					onpointerleave={(e) => leave(e, s.card)}
					onpointerdown={(e) => (lastPointer = e.pointerType)}
					onclick={() => activate(h, s)}
				></button>
			{/if}
		{/each}
	{/if}
	{@const hand = h.slots}
	{#if hand.length > 0}
		{@const labelY = h.seat === cards.NORTH ? L.handY[h.seat] + CARD_H + 6 : L.handY[h.seat] - 26}
		{@const active = !!deal.state && deal.state.turn === h.seat && !deal.state.complete}
		<div class="hand-label" class:active style:left="{L.tableCX - 200}px" style:top="{labelY}px">
			{cards.SEATS[h.seat].name.toUpperCase()} · {cards.SEATS[h.seat].label}
		</div>
		{#if h.isTurn}
			<div
				class="your-play"
				style:left="{L.tableCX - 200}px"
				style:top="{labelY + (h.seat === cards.NORTH ? 18 : -20)}px"
			>
				{h.seat === cards.NORTH ? 'Your play from dummy' : 'Your play'}
			</div>
		{/if}
	{/if}
{/each}

{#if trickWinnerText}
	<div
		class="trick-text"
		class:good={trickWinnerText.good}
		style:left="{L.tableCX - 150}px"
		style:top="{L.trickCY + (L.orientation === 'portrait' ? 175 : 150)}px"
	>
		{trickWinnerText.text}
	</div>
{/if}

{#if run.phase === PHASE.PLAY}
	<div class="playout" style:left="{L.playOut.x}px" style:top="{L.playOut.y}px">
		<Button
			variant="plain"
			size="sm"
			style="width: {L.playOut.w}px; height: {L.playOut.h}px; font-size: 17px"
			title="Let the autopilot finish this deal for you. Quicker, but it plays worse than a careful declarer."
			sound={false}
			onclick={() => game.playOut()}>Play it out</Button
		>
	</div>
{/if}

<style>
	.table {
		position: absolute;
	}
	.oval {
		position: absolute;
		border-radius: 50%;
		background: rgba(14, 45, 32, 0.55);
		border: 2px solid rgba(138, 106, 44, 0.6);
		box-shadow: inset 0 0 0 6px rgba(14, 45, 32, 0.55), inset 0 0 0 8px rgba(138, 106, 44, 0.6);
		pointer-events: none;
	}
	.stack-back {
		position: absolute;
		width: 80px;
		height: 112px;
		border-radius: 8px;
		box-shadow: 3px 4px 0 rgba(0, 0, 0, 0.3);
		pointer-events: none;
	}
	.stack-back.pixel {
		image-rendering: pixelated;
		border-radius: 4px;
	}
	.seat-label,
	.count {
		position: absolute;
		width: 140px;
		font-size: 14px;
		color: var(--ink-dim);
		text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
		pointer-events: none;
	}
	.count {
		font-size: 12px;
		color: var(--ink-faint);
		text-shadow: none;
	}
	.seat-label.active {
		color: var(--brass);
	}
	.thinking {
		display: inline-block;
		width: 8px;
		height: 8px;
		margin-left: 6px;
		border-radius: 50%;
		background: var(--brass);
		animation: blink 0.78s ease-in-out infinite;
	}
	@keyframes blink {
		50% {
			opacity: 0.1;
		}
	}
	.slot {
		position: absolute;
		z-index: 80;
		background: transparent;
		border: none;
		padding: 0;
		cursor: pointer;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
	}
	.hand-label,
	.your-play {
		position: absolute;
		width: 400px;
		text-align: center;
		font-size: 14px;
		color: var(--ink-dim);
		text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
		pointer-events: none;
		z-index: 50;
	}
	.hand-label.active {
		color: var(--brass);
	}
	.your-play {
		color: var(--brass);
		animation: glow 1.25s ease-in-out infinite;
	}
	@keyframes glow {
		50% {
			opacity: 0.35;
		}
	}
	.trick-text {
		position: absolute;
		width: 300px;
		text-align: center;
		font-size: 20px;
		font-weight: 700;
		color: var(--bad);
		text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
		pointer-events: none;
		z-index: 75;
	}
	.trick-text.good {
		color: var(--good);
	}
	.playout {
		position: absolute;
		z-index: 85;
	}
</style>
