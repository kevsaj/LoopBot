// Builds the daily challenge banks. Run with `npm run daily:bank` (a few minutes) and
// `npm run daily:boss` (much longer: boss boards are big and the solver works hard on them).
// Re-running gives the same files unless the generator or its tuning changed. One caveat: the
// solver gets a time budget per board, so a much slower machine could skip a seed a fast one keeps.
// The committed JSON is what ships.
//
// src/daily/bank.json: day i of the bank plays on every date whose day number (days since
// 1970-01-01) is i mod 364. 364 is a whole number of weeks, so entry i always lands on the same
// weekday (which sets the difficulty) and in the same theme week (which sets Wednesday to Friday's rule).
//
// src/daily/boss.json: one Sunday boss per week for 52 weeks, then it starts over.
//   node make-daily.mjs boss [from] [to]   builds weeks from..to-1 into boss.part-<from>.json
//   node make-daily.mjs boss-merge         joins the parts into boss.json
// so the slow boss build can run as several processes at once.

import { readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BOSS_TUNING, TUNING, generate } from '../src/daily/generate';
import type { DailyEntry, Difficulty, Twist } from '../src/daily/entry';
import { BANK_DAYS, BOSS_WEEKS, difficultyFor, twistFor } from '../src/daily/calendar';

const t0 = Date.now();
const secs = () => ((Date.now() - t0) / 1000).toFixed(1);

function find(i: number, d: Difficulty, tw: Twist | undefined, seen: Set<string>, base: number): DailyEntry {
  let tries = 0;
  for (let seed = i * 100_003 + base; ; seed++) {
    tries++;
    if (tries > 20_000) throw new Error(`#${i}: no new ${d} puzzle in 20000 seeds; loosen the tuning`);
    const e = generate(seed, d, d === 'boss' ? BOSS_TUNING : TUNING, tw);
    if (!e) continue;
    const key = e.tiles.join('/');
    if (seen.has(key)) continue;
    seen.add(key);
    return e;
  }
}

const mode = process.argv[2];
if (mode === 'boss') {
  const from = Number(process.argv[3] ?? 0);
  const to = Number(process.argv[4] ?? BOSS_WEEKS);
  const out: DailyEntry[] = [];
  const seen = new Set<string>();
  for (let w = from; w < to; w++) {
    out.push(find(w, 'boss', undefined, seen, 50_001));
    console.log(`boss week ${w} at ${secs()} s`);
  }
  writeFileSync(resolve(`src/daily/boss.part-${String(from).padStart(2, '0')}.json`), JSON.stringify(out) + '\n');
} else if (mode === 'boss-merge') {
  const parts = readdirSync(resolve('src/daily'))
    .filter((f) => /^boss\.part-\d+\.json$/.test(f))
    .sort();
  const all: DailyEntry[] = parts.flatMap((f) => JSON.parse(readFileSync(resolve('src/daily', f), 'utf8')));
  if (all.length !== BOSS_WEEKS) throw new Error(`have ${all.length} boss puzzles, need ${BOSS_WEEKS}`);
  if (new Set(all.map((e) => e.tiles.join('/'))).size !== all.length) throw new Error('two boss puzzles share a board; rebuild that part');
  writeFileSync(resolve('src/daily/boss.json'), JSON.stringify(all) + '\n');
  parts.forEach((f) => unlinkSync(resolve('src/daily', f)));
  console.log(`wrote ${all.length} boss puzzles`);
} else {
  const only = mode ? Number(mode) : BANK_DAYS;
  const bank: DailyEntry[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < only; i++) {
    const d = difficultyFor(i);
    // Tight-fit days keep the classic puzzle (same seeds) and just take away the spare slots.
    bank.push(find(i, d, twistFor(i) ?? undefined, seen, 1));
    if (i % 28 === 0) console.log(`day ${i} (${d}) at ${secs()} s`);
  }
  writeFileSync(resolve('src/daily/bank.json'), JSON.stringify(bank) + '\n');
  console.log(`wrote ${bank.length} puzzles in ${secs()} s`);
}
