// A small tree-walking interpreter (see "Interpreter (for the build)" in the doc).
// It walks the program one action at a time so the editor can pause, step and
// highlight the running block. No eval, no rendering, fully deterministic.

import { BY_TALLY, FREE_ACTIONS, PARTNER_ROUTINE } from './types';
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
  /** Twin Spires: set on a step Echo took (CR-TWIN). Precinct 404: a step the partner took. */
  who?: 'twin';
  /** Precinct 404 (CR-RADIO): this 'wait' step was a wait for radio, with no call in yet. */
  listening?: boolean;
  /** Precinct 404: instant actions (radio calls, a call used up) the bot did along with this step. */
  instant?: Action[];
  /** Twin Spires: what Echo did in the same step as LoopBot's event. */
  twin?: StepEvent;
}

export type Outcome =
  | { status: 'cleared'; steps: number }
  | { status: 'crashed'; steps: number; error: string; blockId: string | null }
  | { status: 'ended'; steps: number };

/**
 * Precinct 404 only. 'mark': the bot is about to take a step. 'sense': it is about to read a sensor
 * for an if or a while. A bot's turn reads its sensors and takes one step, then carries on through
 * instant actions (a radio call right after a step reaches the partner in the same step), and stops
 * at the next sensor or step, so that sensors always read the world as it is when the turn begins.
 */
type StepYield = { type: 'step'; event: StepEvent };
type Yielded = StepYield | { type: 'mark' } | { type: 'sense' };

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
  /** Precinct 404 (CR-PARTNER): yield a mark before every step, and wait for radio calls. */
  partner = false,
): Generator<Yielded, void, void> {
  // Echo's copy of the program acts and senses as Echo (CR-TWIN)
  const as = <T,>(fn: () => T): T => (twin ? asTwin(world, fn) : fn());
  for (const block of blocks) {
    if (++ticks.n > TICK_LIMIT) throw new Halt(msg('ERR: step limit, possible endless loop'), block.id);
    switch (block.kind) {
      case 'action': {
        if (partner && block.action === 'listen') {
          // CR-RADIO: hold, a step at a time, until a call is in; then use it up at once
          const inbox = () => as(() => world.bot.radio ?? 0);
          while (!inbox()) {
            yield { type: 'mark' };
            if (inbox()) break;
            if (++ticks.n > TICK_LIMIT) throw new Halt(msg('ERR: step limit, possible endless loop'), block.id);
            const res = as(() => applyAction(world, 'wait'));
            yield {
              type: 'step',
              event: { blockId: block.id, callStack, routine, action: 'wait', ok: res.ok, listening: true, ...(res.ok ? {} : { error: res.error }), ...(twin ? { who: 'twin' as const } : {}) },
            };
          }
        } else if (partner && !FREE_ACTIONS.has(block.action)) yield { type: 'mark' };
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
          yield* runBlocks(program, world, block.body, routine, callStack, ticks, twin, depth, partner);
        }
        break;
      }
      case 'if':
        if (partner) yield { type: 'sense' };
        yield* runBlocks(program, world, as(() => sense(world, block.cond)) ? block.then : block.else, routine, callStack, ticks, twin, depth, partner);
        break;
      case 'while':
        for (;;) {
          if (partner) yield { type: 'sense' };
          if (!as(() => sense(world, block.cond))) break;
          if (++ticks.n > TICK_LIMIT) throw new Halt(msg('ERR: step limit, possible endless loop'), block.id);
          yield* runBlocks(program, world, block.body, routine, callStack, ticks, twin, depth, partner);
        }
        break;
      case 'call': {
        // Fractal (CR-RECUR): main sets the depth, a call inside a function goes one level down,
        // and a call that reaches depth 0 returns at once (the base case).
        const n = depth === null ? null : routine === 'main' ? (block.depth ?? 1) : depth - 1;
        if (n !== null && n <= 0) break;
        if (callStack.length >= CALL_DEPTH_LIMIT) throw new Halt(msg('ERR: too many nested calls'), block.id);
        yield* runBlocks(program, world, program[block.fn], block.fn, [...callStack, block.id], ticks, twin, n, partner);
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
  /** Precinct 404 (CR-PARTNER): each bot runs its own program, and they take turns. */
  private partner = false;
  /** Precinct 404: whether a bot's program is stopped at a mark, its next step not yet taken. */
  private pending = { main: false, twin: false };

  constructor(program: Program, level: LevelFile) {
    this.world = createWorld(level);
    // A plain JSON copy, not structuredClone: that only arrived in Android System WebView 98
    // and Safari 15.4, and an older WebView crashed here on Run (Nov 2026 playtest errors).
    // A Program is plain data (ids, strings, numbers, nested arrays), so JSON copies it exactly.
    const frozen = JSON.parse(JSON.stringify(program)) as Program;
    // Fractal (CR-RECUR): main has no depth of its own, but its calls give one (depth 0 marks the floor)
    const depth = level.recursion ? 0 : null;
    if (this.world.partner) {
      // CR-PARTNER: LoopBot runs main, the partner runs its own routine; F1 and F2 are shared
      this.partner = true;
      this.gen = runBlocks(frozen, this.world, frozen.main, 'main', [], { n: 0 }, false, null, true);
      this.twinGen = runBlocks(frozen, this.world, frozen[PARTNER_ROUTINE], PARTNER_ROUTINE, [], { n: 0 }, true, null, true);
      return;
    }
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
    if (this.partner) return this.stepPartners();
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
    const ev = (r.value as StepYield).event;
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
        else main = (r.value as StepYield).event;
      }
      if (!main || main.ok) {
        if (!this.twinDone && parked(w, w.twin!)) this.twinDone = true;
        if (!this.twinDone) {
          const r = this.twinGen!.next();
          if (r.done) this.twinDone = true;
          else twin = (r.value as StepYield).event;
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

  /**
   * One bot's turn on a partner floor (CR-PARTNER): it runs until it has taken one step, then on
   * through any instant actions, and stops just before its next sensor check or step. Instant
   * actions done along the way (radio calls) ride on the step's event. ev is null when the bot
   * took no step: its program ended, perhaps after a last radio call.
   */
  private turn(who: 'main' | 'twin'): { ev: StepEvent | null; failed: StepEvent | null } {
    const gen = who === 'main' ? this.gen : this.twinGen!;
    const instant: Action[] = [];
    let step: StepEvent | null = null;
    this.pending[who] = false;
    for (;;) {
      const r = gen.next();
      if (r.done) {
        if (who === 'main') this.mainDone = true;
        else this.twinDone = true;
        break;
      }
      if (r.value.type === 'mark' || r.value.type === 'sense') {
        if (step) {
          this.pending[who] = true;
          break;
        }
        continue;
      }
      const ev = r.value.event;
      if (!ev.ok) return { ev: null, failed: ev };
      if (FREE_ACTIONS.has(ev.action)) instant.push(ev.action);
      else step = ev;
    }
    if (step && instant.length) step = { ...step, instant };
    return { ev: step, failed: null };
  }

  /**
   * One step on a partner floor (CR-PARTNER): LoopBot takes its turn, then the partner takes its
   * own. A parked bot, or one whose program has ended, sits out. If each bot is either stopped or
   * waiting for a radio call with none in, nobody can send one any more, and the run stops.
   */
  private stepPartners(): StepEvent | null {
    const w = this.world;
    let main: StepEvent | null = null;
    let twin: StepEvent | null = null;
    try {
      if (!this.mainDone && parked(w, w.bot)) this.mainDone = true;
      if (!this.mainDone) {
        const r = this.turn('main');
        if (r.failed) {
          this.steps++;
          this.finish({ status: 'crashed', steps: this.steps, error: `${r.failed.error} at step ${this.steps}`, blockId: r.failed.blockId });
          return r.failed;
        }
        main = r.ev;
      }
      if (!this.twinDone && parked(w, w.twin!)) this.twinDone = true;
      if (!this.twinDone) {
        const r = this.turn('twin');
        if (r.failed) {
          this.steps++;
          this.finish({ status: 'crashed', steps: this.steps, error: `${twinError(r.failed.error ?? '', w.partner)} at step ${this.steps}`, blockId: r.failed.blockId });
          return main ? { ...main, twin: r.failed } : r.failed;
        }
        twin = r.ev;
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
    this.steps++;
    const ev: StepEvent = main ? (twin ? { ...main, twin } : main) : twin!;
    const stuck = (e: StepEvent | null, stopped: boolean, inbox: number | undefined) => stopped || (!!e?.listening && !inbox);
    const deadlock =
      !!(main?.listening || twin?.listening) &&
      stuck(main, this.mainDone, w.bot.radio) &&
      stuck(twin, this.twinDone, w.twin!.radio);
    if (goalsMet(w)) {
      this.finish({ status: 'cleared', steps: this.steps });
    } else if (deadlock) {
      const who = main?.listening ? main : twin!;
      this.finish({ status: 'crashed', steps: this.steps, error: msg('ERR: waiting for a radio call that never comes'), blockId: who.blockId });
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
