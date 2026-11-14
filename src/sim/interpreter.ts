// A small tree-walking interpreter (see "Interpreter (for the build)" in the doc).
// It walks the program one action at a time so the editor can pause, step and
// highlight the running block. No eval, no rendering, fully deterministic.

import type { Action, Block, LevelFile, Program, Routine, World } from './types';
import { applyAction, cloneWorld, createWorld, goalsMet, sense } from './world';
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
): Generator<Yielded, void, void> {
  for (const block of blocks) {
    if (++ticks.n > TICK_LIMIT) throw new Halt(msg('ERR: step limit, possible endless loop'), block.id);
    switch (block.kind) {
      case 'action': {
        const res = applyAction(world, block.action);
        yield {
          type: 'step',
          event: {
            blockId: block.id,
            callStack,
            routine,
            action: block.action,
            ok: res.ok,
            ...(res.ok ? {} : { error: res.error }),
          },
        };
        break;
      }
      case 'repeat':
        for (let i = 0; i < block.times; i++) {
          yield* runBlocks(program, world, block.body, routine, callStack, ticks);
        }
        break;
      case 'if':
        yield* runBlocks(program, world, sense(world, block.cond) ? block.then : block.else, routine, callStack, ticks);
        break;
      case 'while':
        while (sense(world, block.cond)) {
          if (++ticks.n > TICK_LIMIT) throw new Halt(msg('ERR: step limit, possible endless loop'), block.id);
          yield* runBlocks(program, world, block.body, routine, callStack, ticks);
        }
        break;
      case 'call':
        if (callStack.length >= CALL_DEPTH_LIMIT) throw new Halt(msg('ERR: too many nested calls'), block.id);
        yield* runBlocks(program, world, program[block.fn], block.fn, [...callStack, block.id], ticks);
        break;
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

  constructor(program: Program, level: LevelFile) {
    this.world = createWorld(level);
    // A plain JSON copy, not structuredClone: that only arrived in Android System WebView 98
    // and Safari 15.4, and an older WebView crashed here on Run (Nov 2026 playtest errors).
    // A Program is plain data (ids, strings, numbers, nested arrays), so JSON copies it exactly.
    const frozen = JSON.parse(JSON.stringify(program)) as Program;
    this.gen = runBlocks(frozen, this.world, frozen.main, 'main', [], { n: 0 });
  }

  get done() {
    return this.outcome !== null;
  }

  /** Executes exactly one action (or finishes). Returns the step event, if one ran. */
  step(): StepEvent | null {
    if (this.outcome) return null;
    this.status = 'running';
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
    this.steps++;
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
