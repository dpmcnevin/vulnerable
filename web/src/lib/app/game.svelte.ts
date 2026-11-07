// The game controller: screens, timing, sound cues and input actions.
// Port of the logic half of src/ui/app.lua. All rules live in lib/game and
// lib/rules; this only drives them and decides what things look and sound
// like. Components read state from here and call its methods.
//
// The engine mutates its run object in place, so reactivity works through
// a version counter: `run` reads `v`, and every mutation calls `bump()`.

import * as cards from '../rules/cards.ts';
import * as engine from '../game/engine.ts';
import type { Card, Contract } from '../rules/cards.ts';
import type { Trick } from '../rules/play.ts';
import type { BidOption, Deal, Run } from '../game/engine.ts';
import * as sound from '../audio/sound.ts';
import { fx } from './fx.svelte.ts';
import { getLayout, trickXY, type Layout, type Orientation } from './layout.ts';
import { C, type Color } from '../ui/theme.ts';

const PHASE = engine.PHASE;

export const AI_DELAY = 0.42;
export const TRICK_HOLD = 1.0;
export const REVEAL_STEP = 0.3;

export interface RevealItem {
	label: string;
	points?: number;
	mult?: number;
	xmult?: number;
	bridge?: boolean;
}

class Reveal {
	items: RevealItem[];
	shown = $state(0);
	done = $state(false);
	t = 0;
	totalY = 380;
	constructor(items: RevealItem[]) {
		this.items = items;
	}
}

export interface Sweep {
	id: number;
	card: Card;
	x: number;
	y: number;
	until: number;
}

let nextCardId = 1;
const cardIds = new WeakMap<Card, number>();
/** A stable id per card object: the same card moving hand to trick keeps it. */
export function cardId(card: Card): number {
	let id = cardIds.get(card);
	if (!id) {
		id = nextCardId++;
		cardIds.set(card, id);
	}
	return id;
}

class Game {
	/** Bumped after every engine mutation. */
	v = $state(0);
	screen = $state<'menu' | 'run'>('menu');
	orientation = $state<Orientation>('landscape');
	seedInput = $state('');
	showHelp = $state(false);
	selectedBid = $state.raw<Contract | null>(null);
	bidHoverStrain = $state<number | null>(null);
	trickHold = $state.raw<{ trick: Trick; timer: number } | null>(null);
	reveal = $state.raw<Reveal | null>(null);
	toast = $state.raw<{ text: string; color: Color; id: number } | null>(null);
	modal = $state<number | null>(null);
	targeting = $state<number | null>(null);
	showPad = $state(false);
	sweeps = $state.raw<Sweep[]>([]);

	private _run: Run | null = null;
	private lastPhase: string | null = null;
	private aiTimer = 0;
	private streak = 0;
	private toastTimer = 0;
	private optionsCache: { deal: Deal; version: number; options: BidOption[]; recommended: Contract } | null = null;
	/** When each deal was first shown, so its cards fly in. */
	readonly dealIntro = new WeakMap<Deal, number>();

	/**
	 * The run, for components. The engine mutates its objects in place, so a
	 * fresh transparent Proxy is returned for each version: `$derived` values
	 * built from it then change identity whenever the run does, and markup
	 * reading their properties re-renders. Reads and writes pass straight
	 * through, so it can be handed to engine functions as is.
	 */
	get run(): Run | null {
		void this.v;
		return this._run ? new Proxy(this._run, {}) : null;
	}

	/** The current deal, versioned the same way. */
	get deal(): Deal {
		void this.v;
		return new Proxy(this._run!.deal, {});
	}

	/** The deal object itself, for identity-keyed lookups. */
	get rawDeal(): Deal {
		void this.v;
		return this._run!.deal;
	}

	get layout(): Layout {
		return getLayout(this.orientation);
	}

	bump() {
		this.v++;
	}

	// ------------------------------------------------------------------ helpers

	showToast(text: string, color: Color = C.brass) {
		this.toast = { text, color, id: (this.toast?.id ?? 0) + 1 };
		this.toastTimer = 2.6;
	}

	newRun() {
		const seed = this.seedInput !== '' ? this.seedInput.toUpperCase() : undefined;
		fx.clear();
		this._run = engine.newRun(seed);
		this.screen = 'run';
		this.selectedBid = null;
		this.optionsCache = null;
		this.trickHold = null;
		this.reveal = null;
		this.lastPhase = null;
		this.modal = null;
		this.targeting = null;
		this.sweeps = [];
		this.streak = 0;
		this.bump();
	}

	/** Odds and projections for every contract, recomputed when the deal changes. */
	options(): BidOption[] {
		const run = this._run!;
		const c = this.optionsCache;
		if (!c || c.deal !== run.deal || c.version !== run.deal.version) {
			const options = engine.bidOptions(run);
			this.optionsCache = {
				deal: run.deal,
				version: run.deal.version,
				options,
				recommended: engine.recommendBid(run, options)
			};
		}
		return this.optionsCache!.options;
	}

	recommended(): Contract | null {
		this.options();
		return this.optionsCache?.recommended ?? null;
	}

	optionFor(level: number, strain: number): BidOption | undefined {
		return this.options().find((o) => o.contract.level === level && o.contract.strain === strain);
	}

	/**
	 * The suit currently treated as trumps: the contract's strain during play,
	 * or the hovered/selected contract's strain as a preview while bidding.
	 */
	currentTrump(): number | null {
		const run = this.run;
		const deal = run?.deal;
		if (!deal) return null;
		let strain: number | null | undefined = null;
		if (run.phase === PHASE.BID) strain = this.bidHoverStrain ?? this.selectedBid?.strain;
		else if (deal.contract && (run.phase === PHASE.PLAY || run.phase === PHASE.DEAL_SCORED)) strain = deal.contract.strain;
		if (!strain || strain === cards.NOTRUMP) return null;
		return strain;
	}

	// ------------------------------------------------------------------ tricks

	private holdTrick(trick: Trick | null | undefined) {
		if (!trick) return;
		this.trickHold = { trick, timer: TRICK_HOLD };
		const deal = this._run!.deal;
		if (cards.sameSide(trick.winner, deal.declarer)) {
			this.streak++;
			sound.play('trick_win', { pitch: Math.min(1.6, 1 + 0.07 * (this.streak - 1)) });
			const [x, y] = trickXY(this.layout, trick.winner);
			fx.burst(x, y, 14, [C.gold, C.goldLight, C.ink], 200, { life: 0.6, size: 6 });
		} else {
			this.streak = 0;
			sound.play('trick_lose', { jitter: 0.04 });
		}
	}

	/** Clear the held trick, sweeping its cards toward whoever won it. */
	endTrickHold() {
		const hold = this.trickHold;
		if (!hold) return;
		this.trickHold = null;
		const [x, y] = this.layout.seatOrigin[hold.trick.winner];
		this.sweep(hold.trick.plays.map((p) => p.card), x, y);
		sound.play('deal', { volume: 0.6, pitch: 0.8 });
	}

	private sweep(list: Card[], x: number, y: number) {
		const until = performance.now() + 450;
		this.sweeps = [...this.sweeps, ...list.map((card) => ({ id: cardId(card), card, x, y, until }))];
	}

	// ------------------------------------------------------------------ actions

	selectBid(c: Contract) {
		this.selectedBid = c;
		sound.play('select', { pitch: 0.9 + c.level * 0.05 });
	}

	commitSelectedBid() {
		const run = this._run;
		if (!run || run.phase !== PHASE.BID || !this.selectedBid) return;
		const c = engine.commitBid(run, this.selectedBid, { stepwise: true });
		this.aiTimer = AI_DELAY;
		this.streak = 0;
		if (c.doubled > 0) {
			sound.play('doubled');
			fx.shake(9);
			this.showToast('The defenders double!  Make it and score big; fail and it hurts.', C.bad);
		}
		this.bump();
	}

	playCard(card: Card) {
		const run = this._run!;
		if (this.trickHold || !engine.isPlayerTurn(run)) return;
		const tricks = engine.playerPlay(run, card, { stepwise: true });
		sound.play('card_play', { jitter: 0.08 });
		this.holdTrick(tricks[0]);
		this.aiTimer = AI_DELAY;
		this.bump();
	}

	playOut() {
		const run = this._run!;
		if (run.phase !== PHASE.PLAY) return;
		this.trickHold = null;
		engine.playOut(run);
		sound.play('reroll');
		this.bump();
	}

	openPloy(i: number) {
		this.modal = i;
		sound.play('select');
	}

	/** Spend the ploy in slot `index` (on `target`, for card-targeted ploys). */
	applyPloy(index: number, target?: Card): boolean {
		const run = this._run!;
		const deal = run.deal;
		const p = run.ploys[index];
		if (!p) return false;
		// Remember which hand each of your cards is in, so cards that change
		// hands can be swept away to whoever received them.
		const before = new Map<Card, number>();
		if (deal && !deal.state) {
			for (const seat of [cards.NORTH, cards.SOUTH]) for (const c of deal.hands[seat]) before.set(c, seat);
		}
		const [ok, msg] = engine.usePloy(run, index, target);
		if (!ok) {
			this.showToast(msg ?? 'not now', C.bad);
			sound.play('trick_lose', { volume: 0.6 });
			return false;
		}
		this.modal = null;
		this.targeting = null;
		sound.play('ploy');
		this.showToast(`${p.name}:  ${msg}`, C.ploy);
		const [bx, by] = this.layout.ployBurst;
		fx.burst(bx, by, 26, [C.ploy, C.ployLight, C.gold], 260, { life: 0.8 });
		if (run.deal === deal) {
			for (const [c, seat] of before) {
				const to = deal.wentTo.get(c);
				if (!deal.hands[seat].includes(c) && to) {
					const [x, y] = this.layout.seatOrigin[to];
					this.sweep([c], x, y);
				}
			}
		}
		this.bump();
		return true;
	}

	usePloyFromModal() {
		const run = this._run!;
		const i = this.modal;
		if (i === null) return;
		const [ok, , needsTarget] = engine.canUsePloy(run, i);
		if (!ok) return;
		if (needsTarget) {
			this.modal = null;
			this.targeting = i;
			sound.play('select');
		} else {
			this.applyPloy(i);
		}
	}

	sellPloy(i: number) {
		engine.sellPloy(this._run!, i);
		sound.play('sell');
		this.modal = null;
		this.bump();
	}

	/** Skip the score count-up straight to the total. */
	finishReveal() {
		const rv = this.reveal;
		if (!rv || rv.done) return;
		rv.shown = rv.items.length;
		rv.t = Math.max(rv.t, (rv.items.length + 1) * REVEAL_STEP);
	}

	continueAfterDeal() {
		const run = this._run!;
		if (run.phase !== PHASE.DEAL_SCORED || this.trickHold) return;
		if (this.reveal && !this.reveal.done) {
			this.finishReveal();
			return;
		}
		engine.continueAfterDeal(run);
		this.selectedBid = null;
		this.bump();
	}

	enterShop() {
		const run = this._run!;
		if (run.phase !== PHASE.BOARD_WON) return;
		sound.play('coin');
		engine.enterShop(run);
		this.bump();
	}

	buy(i: number, x: number, y: number) {
		const run = this._run!;
		if (engine.buy(run, i)[0]) {
			sound.play('coin');
			fx.burst(x, y, 30, C.confetti, 300, { life: 0.9 });
			fx.shake(3);
		}
		this.bump();
	}

	sellRelic(i: number) {
		engine.sellRelic(this._run!, i);
		sound.play('sell');
		this.bump();
	}

	reroll() {
		if (engine.reroll(this._run!)) {
			sound.play('reroll');
			this.shopRolls++;
		}
		this.bump();
	}
	/** Bumped on reroll so the shop's cards re-animate in. */
	shopRolls = $state(0);

	leaveShop() {
		engine.leaveShop(this._run!);
		this.selectedBid = null;
		this.bump();
	}

	togglePad() {
		this.showPad = !this.showPad;
	}

	toMenu() {
		this.screen = 'menu';
	}

	/** Escape: close the innermost overlay, else go to the menu. */
	escape() {
		if (this.screen === 'menu') {
			this.showHelp = false;
			return;
		}
		if (this.showPad) this.showPad = false;
		else if (this.modal !== null) this.modal = null;
		else if (this.targeting !== null) this.targeting = null;
		else this.screen = 'menu';
	}

	/** Space / Enter: the obvious next step. */
	advance() {
		if (this.screen === 'menu') {
			this.newRun();
			return;
		}
		const run = this._run!;
		if (this.trickHold) this.endTrickHold();
		else if (run.phase === PHASE.BID) this.commitSelectedBid();
		else if (run.phase === PHASE.DEAL_SCORED) this.continueAfterDeal();
		else if (run.phase === PHASE.BOARD_WON) this.enterShop();
	}

	/**
	 * A click or tap anywhere on the run screen: skips a held trick or the
	 * score count-up, as in the original. Returns true if it was consumed.
	 */
	skipPress(): boolean {
		if (this.screen !== 'run') return false;
		if (this.trickHold) {
			this.endTrickHold();
			return true;
		}
		const run = this._run!;
		if (this.reveal && !this.reveal.done && run.phase === PHASE.DEAL_SCORED) {
			this.finishReveal();
			return true;
		}
		return false;
	}

	// ------------------------------------------------------------------ phases

	private buildReveal(): Reveal {
		const result = this._run!.deal.result!;
		const items: RevealItem[] = result.bridge.lines.map((l) => ({ label: l.label, points: l.amount, bridge: true }));
		if (result.made) {
			for (const l of result.lines.slice(1)) items.push({ label: l.label, points: l.points, mult: l.mult, xmult: l.xmult });
		}
		return new Reveal(items);
	}

	private onPhaseEnter(phase: string) {
		const run = this._run!;
		const L = this.layout;
		this.modal = null;
		this.targeting = null;
		if (phase === PHASE.DEAL_SCORED) {
			this.reveal = this.buildReveal();
			if (!run.deal.result!.made) sound.play('down');
		} else if (phase === PHASE.BOARD_WON) {
			sound.play('board_won');
			fx.burst(L.tableCX, L.table.y + 240, 60, C.confetti, 420, { life: 1.4, size: 9 });
		} else if (phase === PHASE.GAME_OVER) {
			sound.play('game_over');
		} else if (phase === PHASE.VICTORY) {
			sound.play('board_won');
			for (let i = 0; i < 4; i++) {
				fx.burst(L.tableCX + (i - 1.5) * (L.table.w / 4.5), L.table.y + 200, 50, C.confetti, 460, { life: 1.8, size: 10 });
			}
		}
	}

	private updateReveal(dt: number) {
		const rv = this.reveal;
		if (!rv || rv.done) return;
		rv.t += dt;
		while (rv.shown < rv.items.length && rv.t >= (rv.shown + 1) * REVEAL_STEP) {
			rv.shown++;
			const item = rv.items[rv.shown - 1];
			if (item.mult || item.xmult) {
				sound.play('mult', { pitch: 1 + 0.04 * rv.shown });
				fx.shake(2.5);
			} else {
				sound.play('tick', { pitch: 1 + 0.06 * rv.shown });
			}
		}
		if (rv.shown >= rv.items.length && rv.t >= (rv.items.length + 1) * REVEAL_STEP) {
			rv.done = true;
			const r = this._run!.deal.result!;
			if (r.made) {
				sound.play('total');
				sound.play('made');
				const strength = Math.min(14, 3 + Math.log10(Math.max(10, r.total)) * 2.4);
				fx.shake(strength);
				fx.burst(this.layout.tableCX + 150, rv.totalY, 18 + Math.floor(strength * 2), C.confetti, 320, {
					life: 1.0,
					size: 8
				});
			}
		}
	}

	/** Advance timers, the AI and the count-up. Called every animation frame. */
	update(dt: number) {
		if (this.toast) {
			this.toastTimer -= dt;
			if (this.toastTimer <= 0) this.toast = null;
		}
		if (this.sweeps.length) {
			const now = performance.now();
			if (this.sweeps.some((s) => s.until <= now)) this.sweeps = this.sweeps.filter((s) => s.until > now);
		}
		const run = this._run;
		if (this.screen !== 'run' || !run) return;

		if (run.phase !== this.lastPhase) {
			this.lastPhase = run.phase;
			this.onPhaseEnter(run.phase);
		}

		if (this.trickHold) {
			this.trickHold.timer -= dt;
			if (this.trickHold.timer <= 0) this.endTrickHold();
			return;
		}

		this.updateReveal(dt);

		if (run.phase === PHASE.PLAY && !engine.isPlayerTurn(run)) {
			this.aiTimer -= dt;
			if (this.aiTimer <= 0) {
				const step = engine.stepAI(run);
				sound.play('card_play', { jitter: 0.08 });
				this.holdTrick(step?.trick);
				this.aiTimer = AI_DELAY;
				this.bump();
			}
		}
	}
}

export const game = new Game();
export { PHASE };
