// Par scan: looks for programs shorter than a floor's command par, with if/while and F1 included,
// which the LV-4 test leaves out (it searches sensor floors without sensors). A hit must also stay
// within the step par, so 3 stars stays reachable at the new par. It is a best-effort search with a
// time budget per floor (TIMEOUT means not settled), not a proof.
// Usage: npm run par:scan -- <floorId|all> [budgetSec] [shard] [shards]
import { LEVELS } from '../src/levels/index';
import { FROSTLINE } from '../src/levels/frostline';
import { HEATWAVE } from '../src/levels/heatwave';
import { TWIST } from '../src/levels/twist';
import { DOCKYARD } from '../src/levels/dockyard';
import { TWINSPIRES } from '../src/levels/twinspires';
import { FRACTAL } from '../src/levels/fractal';
import { PRECINCT } from '../src/levels/precinct';
import { ACTIONS } from '../src/sim/types';
import type { Action, Condition, LevelFile, World } from '../src/sim/types';
import { applyBoth, cloneWorld, createWorld, goalsMet, sense, worldKey } from '../src/sim/world';
import { Runner } from '../src/sim/interpreter';
import { countBlocks, countCommands, parseReference } from '../src/sim/program';


class Budget extends Error {}
let deadline = 0;
let tk = 0;
const tick = () => {
  if ((++tk & 4095) === 0 && Date.now() > deadline) throw new Budget();
};

function condText(c: Condition) {
  return `${c.not ? 'not ' : ''}${c.sensor}${c.sensor === 'tile_is' ? ' ' + c.colour : ''}`;
}
function usefulActions(level: LevelFile): string[] {
  const w = createWorld(level);
  const hasBoxes = w.boxes.some((row) => row.some((n) => n > 0));
  const hasSwitch = w.tiles.some((row) => row.some((t) => t.type === 'switch'));
  let steps = hasBoxes;
  for (let y = 0; y < w.h; y++)
    for (let x = 0; x < w.w; x++)
      for (const [dx, dy] of [[1, 0], [0, 1]])
        if (x + dx < w.w && y + dy < w.h && w.tiles[y][x].height !== w.tiles[y + dy][x + dx].height) steps = true;
  const can: Record<string, boolean> = { forward: true, turn_left: true, turn_right: true, jump: steps, pick_up: hasBoxes, drop: hasBoxes, activate: hasSwitch, wait: w.ventCycle > 0 };
  return ACTIONS.filter((a) => level.commands.includes(a) && can[a]);
}

function conds(level: LevelFile): Condition[] {
  const w = createWorld(level);
  const out: Condition[] = [];
  for (const s of ['wall_ahead', ...(level.sensors ?? [])] as Condition['sensor'][]) {
    if (s === 'tile_is') {
      const cols = new Set<string>();
      for (const row of w.tiles) for (const t of row) if (t.colour) cols.add(t.colour);
      for (const col of cols) for (const not of [false, true]) out.push({ sensor: s, colour: col as never, not });
    } else for (const not of [false, true]) out.push({ sensor: s, not });
  }
  return out;
}

/**
 * Every reachable world gets a number, and a piece of program becomes a table: world in, world
 * out (or CRASH / CLEAR). Two pieces with the same table do the same thing everywhere, so only the
 * smallest is kept (observational equivalence), which keeps the search small enough to run.
 */
const CRASH = -1, CLEAR = -2;
type Frag = { t: Int32Array; e: string };

function search(level: LevelFile, maxSize: number): string | null {
  const actions = usefulActions(level);
  const cs = conds(level);
  const hasRep = level.commands.includes('repeat');
  const hasWhile = level.commands.includes('while');
  const hasIf = level.commands.includes('if');
  const hasF1 = level.commands.includes('F1');
  const mainSlots = level.slots.main ?? Infinity;
  const f1Slots = level.slots.F1 ?? 0;
  // every reachable state
  const start = createWorld(level);
  const idx = new Map<string, number>();
  const worlds: World[] = [];
  const add = (w: World) => {
    const k = worldKey(w);
    let i = idx.get(k);
    if (i === undefined) { i = worlds.length; idx.set(k, i); worlds.push(w); }
    return i;
  };
  add(start);
  const actT: Int32Array[] = actions.map(() => new Int32Array(0));
  const rows: number[][] = actions.map(() => []);
  for (let i = 0; i < worlds.length; i++) {
    tick();
    if (worlds.length > 300_000) throw new Budget();
    for (let a = 0; a < actions.length; a++) {
      const w = cloneWorld(worlds[i]);
      const r = applyBoth(w, actions[a] as Action);
      rows[a][i] = !r.ok ? CRASH : goalsMet(w) ? CLEAR : add(w);
    }
  }
  const N = worlds.length;
  actions.forEach((_, a) => (actT[a] = Int32Array.from(rows[a])));
  const condT = cs.map((c) => worlds.map((w) => sense(w, c)));
  const S0 = 0;

  const seq = (A: Int32Array, B: Int32Array) => {
    const o = new Int32Array(N);
    for (let s = 0; s < N; s++) { const r = A[s]; o[s] = r < 0 ? r : B[r]; }
    return o;
  };
  const rep = (A: Int32Array, n: number) => { let o = A; for (let i = 1; i < n; i++) o = seq(o, A); return o; };
  const whl = (c: boolean[], A: Int32Array) => {
    const o = new Int32Array(N);
    for (let s = 0; s < N; s++) {
      let x = s, g = 0;
      while (x >= 0 && c[x]) { x = A[x]; if (++g > 600) { x = CRASH; break; } }
      o[s] = x;
    }
    return o;
  };
  const iff = (c: boolean[], A: Int32Array, B: Int32Array | null) => {
    const o = new Int32Array(N);
    for (let s = 0; s < N; s++) o[s] = c[s] ? A[s] : B ? B[s] : s;
    return o;
  };
  const ident = Int32Array.from({ length: N }, (_, i) => i);
  const hashT = (t: Int32Array) => {
    let h = 2166136261 >>> 0, h2 = 7;
    for (let i = 0; i < t.length; i++) { h = Math.imul(h ^ t[i], 16777619); h2 = (h2 * 31 + t[i]) | 0; }
    return `${h >>> 0}:${h2}`;
  };

  // Observationally distinct lists by size. atoms: [table, name]
  function enumerate(atoms: Frag[], maxK: number, onFrag?: (f: Frag, k: number) => boolean) {
    const L: Frag[][] = [[]];
    const seen = new Set<string>([hashT(ident)]);
    const allCrash = (t: Int32Array) => { for (let s = 0; s < N; s++) if (t[s] !== CRASH) return false; return true; };
    const push = (out: Frag[], t: Int32Array, e: string, k: number) => {
      tick();
      const h = hashT(t);
      if (seen.has(h)) return false;
      seen.add(h);
      if (allCrash(t)) return false;
      const f = { t, e };
      out.push(f);
      if (onFrag && onFrag(f, k)) return true;
      if (out.length > 400_000) throw new Budget();
      return false;
    };
    for (let k = 1; k <= maxK; k++) {
      const out: Frag[] = [];
      L.push(out);
      if (k === 1) { for (const a of atoms) if (push(out, a.t, a.e, k)) return { L, hit: a }; continue; }
      for (const b of L[k - 1]) {
        if (hasRep) for (let n = 2; n <= 9; n++) if (push(out, rep(b.t, n), `repeat ${n} { ${b.e} }`, k)) return { L, hit: out[out.length - 1] };
        if (hasWhile) for (let c = 0; c < cs.length; c++) if (push(out, whl(condT[c], b.t), `while ${condText(cs[c])} { ${b.e} }`, k)) return { L, hit: out[out.length - 1] };
      }
      if (hasIf)
        for (let t = 1; t <= k - 1; t++)
          for (const a of L[t]) {
            const elses: (Frag | null)[] = k - 1 - t === 0 ? [null] : L[k - 1 - t];
            for (const b of elses)
              for (let c = 0; c < cs.length; c++)
                if (push(out, iff(condT[c], a.t, b ? b.t : null), `if ${condText(cs[c])} { ${a.e} }${b ? ` else { ${b.e} }` : ''}`, k)) return { L, hit: out[out.length - 1] };
          }
      for (let a = 1; a < k; a++)
        for (const x of L[a]) for (const y of L[k - a]) if (push(out, seq(x.t, y.t), `${x.e} ${y.e}`, k)) return { L, hit: out[out.length - 1] };
    }
    return { L, hit: null };
  }

  const base: Frag[] = actions.map((a, i) => ({ t: actT[i], e: a }));
  // A hit has to clear within the step par too, so 3 stars stays reachable at the new command par.
  const ok = (e: string) => {
    try {
      const o = new Runner(parseReference(e), level).runToEnd();
      return o.status === 'cleared' && o.steps <= level.par.steps;
    } catch {
      return false;
    }
  };
  // plain programs, no F1
  {
    // Past main's slots, a whole program can still sit in F1 with main just calling it (one more block).
    const wrapCap = hasF1 ? Math.min(f1Slots, maxSize - 1) : 0;
    let wrapped = false;
    const r = enumerate(base, Math.max(Math.min(maxSize, mainSlots), wrapCap), (f, k) => {
      if (f.t[S0] !== CLEAR) return false;
      if (k <= mainSlots && k <= maxSize && ok(f.e)) return true;
      if (k <= wrapCap && ok(`F1 def F1 { ${f.e} }`)) return (wrapped = true);
      return false;
    });
    if (r.hit) return wrapped ? `F1 def F1 { ${r.hit.e} }` : r.hit.e;
  }
  if (!hasF1) return null;
  // F1 bodies by size, then main around each
  for (let n = 3; n <= maxSize; n++) {
    const bodies = enumerate(base, Math.min(f1Slots, n - 1)).L;
    
    for (let s1 = Math.min(n - 1, f1Slots); s1 >= 2; s1--) {
      const m = Math.min(n - s1, mainSlots);
      if (m < 1) continue;
      for (const b of bodies[s1] ?? []) {
        const r = enumerate([...base, { t: b.t, e: 'F1' }], m, (f) => f.t[S0] === CLEAR && ok(`${f.e} def F1 { ${b.e} }`));
        if (r.hit) return `${r.hit.e} def F1 { ${b.e} }`;
      }
    }
  }
  return null;
}

const ALL = [...LEVELS, ...FROSTLINE, ...HEATWAVE, ...TWIST, ...DOCKYARD, ...TWINSPIRES, ...FRACTAL, ...PRECINCT];
const [, , which = 'all', budgetS = '20', shard = '0', shards = '1'] = process.argv;
const list = ALL.filter((l, i) => (which === 'all' ? i % Number(shards) === Number(shard) : l.id === which));
for (const level of list) {
  const sensors = level.commands.includes('if') || level.commands.includes('while');
  if (level.partner || level.recursion || level.twin || level.commands.includes('repeat_tally') || level.commands.includes('F2')) {
    console.log(`${level.id}\tSKIP\t${level.par.commands}`);
    continue;
  }
  if (!sensors && !level.commands.includes('F1')) continue; // already proven by the full LV-4 search
  deadline = Date.now() + Number(budgetS) * 1000;
  try {
    const found = search(level, level.par.commands - 1);
    if (found) {
      const p = parseReference(found);
      const o = new Runner(p, level).runToEnd();
      const fits = (['main', 'F1'] as const).every((r) => countBlocks(p[r]) <= (level.slots[r] ?? 0));
      console.log(`${level.id}\tBEAT\t${level.par.commands}\t${countCommands(p)}\t${o.status}/${o.steps}\tfits=${fits}\t${found}`);
    } else console.log(`${level.id}\tOK\t${level.par.commands}`);
  } catch (e) {
    if (e instanceof Budget) console.log(`${level.id}\tTIMEOUT\t${level.par.commands}`);
    else throw e;
  }
}
