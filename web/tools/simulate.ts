// Headless balance simulator. Port of tools/simulate.lua.
// Run with: node tools/simulate.ts [runs] [seedPrefix] [-v]

import * as engine from '../src/lib/game/engine.ts';
import { playRun } from './bot.ts';

const runs = Number(process.argv[2]) || 200;
const prefix = process.argv[3] ?? 'SIM';
const verbose = process.argv[4] === '-v';

const reached: Record<number, number> = {};
const boardDeaths: Record<string, number> = {};
let wins = 0,
	made = 0,
	failed = 0;
const scores: number[] = [];

for (let i = 1; i <= runs; i++) {
	const run = playRun(prefix + i);
	if (run.phase === engine.PHASE.VICTORY) wins++;
	const r = Math.min(run.rubber, engine.RUBBERS);
	reached[r] = (reached[r] ?? 0) + 1;
	if (run.phase === engine.PHASE.GAME_OVER) {
		const k = `${run.rubber}.${run.board}`;
		boardDeaths[k] = (boardDeaths[k] ?? 0) + 1;
	}
	made += run.stats.contractsMade;
	failed += run.stats.contractsFailed;
	for (const entry of run.log) scores.push(entry.score);
	if (verbose) {
		console.log(
			`${String(run.seed).padEnd(8)} ${run.phase}  rubber ${run.rubber} board ${run.board}  relics ${run.relics.length}  $${run.money}`
		);
	}
}

console.log(`\n${runs} runs  |  victories ${wins} (${((100 * wins) / runs).toFixed(1)}%)`);
console.log(
	`contracts made ${made}, failed ${failed}  (${((100 * made) / Math.max(1, made + failed)).toFixed(1)}% made)`
);

console.log('\nFurthest rubber reached:');
for (let r = 1; r <= engine.RUBBERS; r++) {
	const n = reached[r] ?? 0;
	console.log(`  rubber ${r}  ${String(n).padStart(4)}  ${'#'.repeat(Math.floor((60 * n) / runs))}`);
}

console.log('\nWhere runs ended (rubber.board):');
const keys = Object.keys(boardDeaths).sort((a, b) => {
	const [ra, ba] = a.split('.').map(Number);
	const [rb, bb] = b.split('.').map(Number);
	return ra !== rb ? ra - rb : ba - bb;
});
for (const k of keys) {
	const [r, b] = k.split('.').map(Number);
	console.log(
		`  ${k}  target ${String(engine.targetFor(r, b)).padStart(6)}  deaths ${String(boardDeaths[k]).padStart(4)}`
	);
}

scores.sort((a, b) => a - b);
const pct = (p: number) => scores[Math.max(1, Math.floor(scores.length * p)) - 1] ?? 0;
console.log(
	`\nPer-deal score  p25 ${pct(0.25)}  median ${pct(0.5)}  p75 ${pct(0.75)}  p95 ${pct(0.95)}`
);
