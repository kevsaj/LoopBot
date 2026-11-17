// A small tree-walking interpreter (see "Interpreter (for the build)" in the doc).
// It walks the program one action at a time so the editor can pause, step and
// highlight the running block. No eval, no rendering, fully deterministic.

import { BY_TALLY, FREE_ACTIONS } from './types';
import type { Action, Block, LevelFile, Program, Routine, World } from './types';
import { applyAction, asTwin, cloneWorld, createWorld, goalsMet, parked, sense, twinError } from './world';
import { msg } from '../i18n';

export const STEP_LIMIT = 500; // CR-9
export const CALL_DEPTH_LIMIT = 32; // CR-6
/** Guards loops that never act (e.g. `while not wall_ahead: turn_left; turn_right` is fine, but an empty while is not). */
export const TICK_LIMIT = 10_000;

export type RunStatus = 'ready' | 'running' | 'cleared' | 'crashed' | 'ended';

export interface StepEvent {
  /** The action block that ran. */
  blockId: string;
  /** Ids of the call blocks currently on the stack, outermost first (ED-13). */
  callStack: string[];
  routine: Routine;
  action: Action;
  ok: boolean;
  error?: string;
  /** Twin Spires: set on a step Echo took (CR-TWIN). */
  who?: 'twin';
  /** Twin Spires: what Echo did in the same step as LoopBot's event. */
  twin?: StepEvent;
}

export type Outcome =
  | { status: 'cleared'; steps: number }
  | { status: 'crashed'; steps: number; error: string; blockId: string | null }
  | { status: 'ended'; steps: number };

type Yielded = { type: 'step'; event: StepEvent };

class Halt extends Error {
  constructor(
    public reason: string,
    public blockId: string | null,
  ) {
    super(reason);
  }
}

function* runBlocks(
  program: Program,
  world: World,
  blocks: Block[],
  routine: Routine,
  callStack: string[],
  ticks: { n: number },
  twin = false,
  /** Fractal (CR-RECUR): this routine's depth n on a recursion floor, else null. */
  depth: number | null = null,
): Generator<Yielded, void, void> {
  // Echo's copy of the program acts and senses as Echo (CR-TWIN)
  const as = <T,>(fn: () => T): T => (twin ? asTwin(world, fn) : fn());
  for (const block of blocks) {
    if (++ticks.n > TICK_LIMIT) throw new Halt(msg('ERR: step limit, possible endless loop'), block.id);
    switch (block.kind) {
      case 'action': {
        const res = as(() => applyAction(world, block.action));
        yield {
          type: 'step',
          event: {
            blockId: block.id,
            callStack,
            routine,
            action: block.action,
            ok: res.ok,
            ...(res.ok ? {} : { error: res.error }),
            ...(twin ? { who: 'twin' as const } : {}),
          },
        };
        break;
      }
      case 'repeat': {
        // "repeat tally" reads the tally once, as the loop starts (CR-TALLY)
        const times = block.times === BY_TALLY ? world.tally : block.times;
        for (let i = 0; i < times; i++) {
          yield* runBlocks(program, world, block.body, routine, callStack, ticks, twin, depth);
        }
        break;
      }
      case 'if':
        yield* runBlocks(program, world, as(() => sense(world, block.cond)) ? block.then : block.else, routine, callStack, ticks, twin, depth);
        break;
      case 'while':
        while (as(() => sense(world, block.cond))) {
          if (++ticks.n > TICK_LIMIT) throw new Halt(msg('ERR: step limit, possible endless loop'), block.id);
          yield* runBlocks(program, world, block.body, routine, callStack, ticks, twin, depth);
        }
        break;
      case 'call': {
        // Fractal (CR-RECUR): main sets the depth, a call inside a function goes one level down,
        // and a call that reaches depth 0 returns at once (the base case).
        const n = depth === null ? null : routine === 'main' ? (block.depth ?? 1) : depth - 1;
        if (n !== null && n <= 0) break;
        if (callStack.length >= CALL_DEPTH_LIMIT) throw new Halt(msg('ERR: too many nested calls'), block.id);
        yield* runBlocks(program, world, program[block.fn], block.fn, [...callStack, block.id], ticks, twin, n);
        break;
      }
    }
  }
}

/**
 * Runs a program against a floor, one step at a time.
 * The program is never modified (ED-15); Reset is just `new Runner(...)`.
 */
export class Runner {
  world: World;
  steps = 0;
  status: RunStatus = 'ready';
  outcome: Outcome | null = null;
  private gen: Generator<Yielded, void, void>;
  /** Twin Spires: Echo's own run of the same program (CR-TWIN). */
  private twinGen: Generator<Yielded, void, void> | null = null;
  private mainDone = false;
  private twinDone = false;

  constructor(program: Program, level: LevelFile) {
    this.world = createWorld(level);
    // A plain JSON copy, not structuredClone: that only arrived in Android System WebView 98
    // and Safari 15.4, and an older WebView crashed here on Run (Nov 2026 playtest errors).
    // A Program is plain data (ids, strings, numbers, nested arrays), so JSON copies it exactly.
    const frozen = JSON.parse(JSON.stringify(program)) as Program;
    // Fractal (CR-RECUR): main has no depth of its own, but its calls give one (depth 0 marks the floor)
    const depth = level.recursion ? 0 : null;
    this.gen = runBlocks(frozen, this.world, frozen.main, 'main', [], { n: 0 }, false, depth);
    if (this.world.twin) this.twinGen = runBlocks(frozen, this.world, frozen.main, 'main', [], { n: 0 }, true);
  }

  get done() {
    return this.outcome !== null;
  }

  /** Executes exactly one action (or finishes). Returns the step event, if one ran. Counting costs no step. */
  step(): StepEvent | null {
    if (this.outcome) return null;
    this.status = 'running';
    if (this.twinGen) return this.stepTwins();
    let r: IteratorResult<Yielded, void>;
    try {
      r = this.gen.next();
    } catch (e) {
      if (e instanceof Halt) {
        this.finish({ status: 'crashed', steps: this.steps, error: e.reason, blockId: e.blockId });
        return null;
      }
      throw e;
    }
    if (r.done) {
      this.finish(goalsMet(this.world) ? { status: 'cleared', steps: this.steps } : { status: 'ended', steps: this.steps });
      return null;
    }
    const ev = r.value.event;
    if (!FREE_ACTIONS.has(ev.action)) this.steps++;
    if (!ev.ok) {
      this.finish({ status: 'crashed', steps: this.steps, error: `${ev.error} at step ${this.steps}`, blockId: ev.blockId });
    } else if (goalsMet(this.world)) {
      this.finish({ status: 'cleared', steps: this.steps }); // CR-10: cleared mid-program
    } else if (this.steps >= STEP_LIMIT) {
      this.finish({
        status: 'crashed',
        steps: this.steps,
        error: msg('ERR: step limit, possible endless loop'),
        blockId: ev.blockId,
      });
    }
    return ev;
  }

  /**
   * One step on a Twin Spires floor (CR-TWIN): LoopBot takes its next action, then Echo takes its
   * own. A bot parked on an exit, or whose program has ended, sits the step out. Returns
   * LoopBot's event with Echo's alongside, or Echo's alone once LoopBot has stopped.
   */
  private stepTwins(): StepEvent | null {
    const w = this.world;
    let main: StepEvent | null = null;
    let twin: StepEvent | null = null;
    try {
      if (!this.mainDone && parked(w, w.bot)) this.mainDone = true;
      if (!this.mainDone) {
        const r = this.gen.next();
        if (r.done) this.mainDone = true;
        else main = r.value.event;
      }
      if (!main || main.ok) {
        if (!this.twinDone && parked(w, w.twin!)) this.twinDone = true;
        if (!this.twinDone) {
          const r = this.twinGen!.next();
          if (r.done) this.twinDone = true;
          else twin = r.value.event;
        }
      }
    } catch (e) {
      if (e instanceof Halt) {
        this.finish({ status: 'crashed', steps: this.steps, error: e.reason, blockId: e.blockId });
        return null;
      }
      throw e;
    }
    if (!main && !twin) {
      this.finish(goalsMet(w) ? { status: 'cleared', steps: this.steps } : { status: 'ended', steps: this.steps });
      return null;
    }
    if ((main && !FREE_ACTIONS.has(main.action)) || (twin && !FREE_ACTIONS.has(twin.action))) this.steps++;
    const ev: StepEvent = main ? (twin ? { ...main, twin } : main) : twin!;
    if (main && !main.ok) {
      this.finish({ status: 'crashed', steps: this.steps, error: `${main.error} at step ${this.steps}`, blockId: main.blockId });
    } else if (twin && !twin.ok) {
      this.finish({ status: 'crashed', steps: this.steps, error: `${twinError(twin.error ?? '')} at step ${this.steps}`, blockId: twin.blockId });
    } else if (goalsMet(w)) {
      this.finish({ status: 'cleared', steps: this.steps });
    } else if (this.steps >= STEP_LIMIT) {
      this.finish({ status: 'crashed', steps: this.steps, error: msg('ERR: step limit, possible endless loop'), blockId: ev.blockId });
    }
    return ev;
  }

  /** Runs to completion. Used by tests and the level checks. */
  runToEnd(): Outcome {
    while (!this.outcome) this.step();
    return this.outcome!;
  }

  snapshot(): World {
    return cloneWorld(this.world);
  }

  private finish(o: Outcome) {
    this.outcome = o;
    this.status = o.status;
  }
}
