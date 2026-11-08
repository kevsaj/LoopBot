// Builds the daily challenge bank: src/daily/bank.json, one puzzle per day for 52 weeks.
// Run with `npm run daily:bank` (takes a few minutes). Re-running it gives the same file unless the
// generator or its tuning changed. One caveat: the solver gets a time budget per board, so a much
// slower machine could skip a seed a fast one keeps. The committed bank.json is what ships.
//
// Day i of the bank plays on every date whose day number (days since 1970-01-01) is i mod 364.
// 364 is a whole number of weeks, so entry i always lands on the same weekday, and the weekday
// sets the difficulty: easy early in the week, hard at the weekend.

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generate } from '../src/daily/generate';
import type { DailyEntry } from '../src/daily/entry';
import { BANK_DAYS, difficultyFor } from '../src/daily/calendar';

const only = process.argv[2] ? Number(process.argv[2]) : BANK_DAYS;
const bank: DailyEntry[] = [];
const seen = new Set<string>();
const t0 = Date.now();
for (let i = 0; i < only; i++) {
  const d = difficultyFor(i);
  let tries = 0;
  for (let seed = i * 100_003 + 1; ; seed++) {
    tries++;
    if (tries > 20_000) throw new Error(`day ${i}: no new ${d} puzzle in 20000 seeds; loosen the tuning`);
    const e = generate(seed, d);
    if (!e) continue;
    const key = e.tiles.join('/');
    if (seen.has(key)) continue;
    seen.add(key);
    bank.push(e);
    break;
  }
  if (i % 28 === 0) console.log(`day ${i} (${d}) after ${tries} tries, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
writeFileSync(resolve('src/daily/bank.json'), JSON.stringify(bank) + '\n');
console.log(`wrote ${bank.length} puzzles in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
