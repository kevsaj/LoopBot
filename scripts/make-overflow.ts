// Builds the Overflow bank: src/overflow/bank.json, the floors the endless climb draws from.
// Run with `npm run overflow:bank` (takes a few minutes). Re-running it gives the same file unless
// the generator or its tuning changed. As with the daily bank, the solver gets a time budget per
// board, so a much slower machine could skip a seed a fast one keeps. The committed file ships.
//
// Each tier holds PER_KIND floors of every trick it mixes in. In the game each floor is also turned
// and mirrored at random (8 ways, same pars), so a climb almost never sees the same board twice.

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateOverflow, TIER_KINDS } from '../src/overflow/generate';
import { transformEntry } from '../src/overflow/entry';
import type { OverflowEntry, Tier } from '../src/overflow/entry';

const PER_KIND: Record<Tier, number> = { 1: 60, 2: 30, 3: 30, 4: 30 };
const bank: OverflowEntry[] = [];
const seen = new Set<string>();
const t0 = Date.now();
for (const tier of [1, 2, 3, 4] as Tier[]) {
  for (const [k, kind] of TIER_KINDS[tier].entries()) {
    let made = 0;
    let tries = 0;
    for (let seed = tier * 10_000_019 + k * 1_000_003 + 1; made < PER_KIND[tier]; seed++) {
      if (++tries > 40_000) throw new Error(`tier ${tier} ${kind}: only ${made} floors in 40000 seeds; loosen the tuning`);
      const e = generateOverflow(seed, tier, kind);
      if (!e) continue;
      // the same board turned or mirrored is the same floor
      const keys = [false, true].flatMap((m) => [0, 1, 2, 3].map((rot) => transformEntry(e, rot, m).tiles.join('/')));
      if (keys.some((x) => seen.has(x))) continue;
      keys.forEach((x) => seen.add(x));
      bank.push(e);
      made++;
    }
    console.log(`tier ${tier} ${kind}: ${made} floors after ${tries} tries, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
}
writeFileSync(resolve('src/overflow/bank.json'), JSON.stringify(bank) + '\n');
console.log(`wrote ${bank.length} floors in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
