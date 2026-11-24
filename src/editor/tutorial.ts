// First-run tutorial (doc: "Floor screen sketch and first-run tutorial").
// Overlays only on the first floors; they never block a tap, and Settings can turn them off.

import type { Action, Block, Program, World } from '../sim/types';
import type { RunStatus, StepEvent } from '../sim/interpreter';
import { msg, t } from '../i18n';
import { COMMAND_META } from './commands';

export type TutorialStep = 'tap' | 'run' | 'more' | 'turn' | 'spin' | 'cancel' | 'pick';

export const TUTORIAL_TEXT: Record<TutorialStep, string> = {
  tap: msg('Tap a command to add it to your program.'),
  run: msg('Press Run to watch LoopBot follow your program.'),
  more: msg('Not far enough. Add more commands and run again.'),
  turn: msg('↺ ↻ Turns spin LoopBot in place. Use them to go round corners.'),
  spin: msg('↻ A turn spins LoopBot in place without moving it. After it, ↑ forward goes the new way.'),
  cancel: msg('↻ then ↺ cancel out: LoopBot ends up facing the same way. Keep just one turn.'),
  pick: msg('▲ pick up grabs the crate in front of LoopBot.'),
};

/** Turn tips (spin, cancel) show on the Lobby floors, where turning is still new. */
const TURN_TIP_FLOORS = new Set(['t1-f02', 't1-f03', 't1-f04', 't1-f05', 't1-f06', 't1-f07', 't1-f08', 't1-f09', 't1-f10']);

const isTurn = (b: Block): b is Extract<Block, { kind: 'action' }> =>
  b.kind === 'action' && (b.action === 'turn_left' || b.action === 'turn_right');

/**
 * Turns next to each other that undo each other: a left right after a right (or the other way),
 * or four turns the same way (a full circle). Returns the ids of the blocks involved, so the
 * program can mark them. Looks inside loops, ifs and every routine.
 */
export function cancellingTurns(program: Program): string[] {
  const ids = new Set<string>();
  const scan = (list: Block[]) => {
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const b = list[i + 1];
      if (b && isTurn(a) && isTurn(b) && a.action !== b.action) {
        ids.add(a.id);
        ids.add(b.id);
      }
      const four = list.slice(i, i + 4);
      if (four.length === 4 && four.every((x) => isTurn(x) && x.action === (a as { action?: string }).action)) {
        four.forEach((x) => ids.add(x.id));
      }
      if (a.kind === 'repeat' || a.kind === 'while') scan(a.body);
      if (a.kind === 'if') {
        scan(a.then);
        scan(a.else);
      }
    }
  };
  Object.values(program).forEach((list) => scan(list ?? []));
  return [...ids];
}

export function tutorialStep(s: {
  enabled: boolean;
  floorId: string;
  clearedBefore: boolean;
  program: Program;
  hasRun: boolean;
  playing: boolean;
  outcome: RunStatus | null;
}): TutorialStep | null {
  if (!s.enabled || s.clearedBefore || s.playing) return null;
  if (s.floorId === 't1-f01') {
    if (s.outcome === 'ended') return 'more';
    if (s.outcome) return null;
    if (s.program.main.length === 0) return 'tap';
    if (!s.hasRun) return 'run';
    return null;
  }
  if (!TURN_TIP_FLOORS.has(s.floorId)) return null;
  // Turns that undo each other: say so before the run, so the player never wonders why LoopBot "did not turn".
  if (cancellingTurns(s.program).length) return 'cancel';
  if (s.floorId === 't1-f02') {
    const turned = s.program.main.some(isTurn);
    if (!turned && !s.hasRun) return 'turn';
    // A run that stopped short: turning in place is the usual surprise here.
    if (s.outcome === 'ended' || s.outcome === 'crashed') return 'spin';
  }
  // Floor 3, the first crate: one line on where pick up reaches, until it's in the program.
  if (s.floorId === 't1-f03' && !s.hasRun && !s.program.main.some((b) => b.kind === 'action' && b.action === 'pick_up')) return 'pick';
  return null;
}

const STEP_LINE: Record<Action, string> = {
  forward: msg('> ↑ forward: one tile ahead'),
  jump: msg('> ⤴ jump'),
  turn_left: msg('> ↺ turn left: spun in place, did not move'),
  turn_right: msg('> ↻ turn right: spun in place, did not move'),
  pick_up: msg('> ▲ pick up'),
  drop: msg('> ▼ drop'),
  activate: msg('> ◉ activate'),
  wait: msg('> ‖ wait: stayed put for one step'),
  tally_up: msg('> + tally + 1: counted, no step taken'),
  tally_down: msg('> − tally − 1: counted, no step taken'),
  radio: msg('> ≋ radio: sent a call, no step taken'),
  listen: msg('> ⧗ wait for radio: a call was in, no step taken'),
};

/**
 * Precinct 404 (CR-PARTNER): one line for a step on a partner floor, saying what each bot did:
 * "> LoopBot ↑ forward + ≋ radio · DASH ⧗ waiting for radio". Parking at an exit is noted too.
 */
export function partnerLine(ev: StepEvent, w: World): string {
  if (!w.partner || !w.twin) return stepLine(ev.action);
  const what = (e: StepEvent | undefined): string => {
    if (!e) return t('stays put');
    const main = e.listening ? `⧗ ${t('waiting for radio')}` : `${COMMAND_META[e.action].glyph} ${t(COMMAND_META[e.action].label)}`;
    const extra = (e.instant ?? []).map((a) => ` + ${COMMAND_META[a].glyph} ${t(COMMAND_META[a].label)}`).join('');
    return main + extra;
  };
  const atExit = (b: { x: number; y: number }) => w.tiles[b.y][b.x].type === 'exit';
  const botStep = ev.who === 'twin' ? undefined : ev;
  const twinStep = ev.who === 'twin' ? ev : ev.twin;
  const moved = (e: StepEvent | undefined) => !!e && e.ok && (e.action === 'forward' || e.action === 'jump');
  let line = `> LoopBot ${what(botStep)} · ${w.partner} ${what(twinStep)}`;
  if (moved(botStep) && atExit(w.bot)) line += ` · ${t('LoopBot parked at its exit')}`;
  if (moved(twinStep) && atExit(w.twin)) line += ` · ${t('{name} parked at its exit', { name: w.partner })}`;
  return line;
}

/**
 * Twin Spires (CR-TWIN): the words added to a step's line when a bot just parked at its lift.
 * Starts with " · " when there is something to say, so it can go straight after the step line.
 */
export function twinNote(ev: StepEvent, w: World): string {
  if (!w.twin || w.partner) return '';
  const atExit = (b: { x: number; y: number }) => w.tiles[b.y][b.x].type === 'exit';
  const moved = (e: StepEvent | undefined) => !!e && e.ok && (e.action === 'forward' || e.action === 'jump');
  const botStep = ev.who === 'twin' ? undefined : ev;
  const twinStep = ev.who === 'twin' ? ev : ev.twin;
  const notes: string[] = [];
  if (moved(botStep) && atExit(w.bot) && !atExit(w.twin)) notes.push(t('LoopBot parked at its lift and waits for Echo'));
  if (moved(twinStep) && atExit(w.twin) && !atExit(w.bot)) notes.push(t('Echo parked at its lift and waits for LoopBot'));
  return notes.length ? ` · ${notes.join(' · ')}` : '';
}

/** The terminal line for one step of a run. */
export function stepLine(action: Action): string {
  return t(STEP_LINE[action]);
}

/**
 * Twist turntables (CR-SPIN) turn LoopBot as it arrives, which is easy to miss on the board, so
 * the terminal says so. Returns the extra words for a step that landed on a working turntable.
 */
export function spinNote(action: Action, w: World): string | null {
  if (action !== 'forward' && action !== 'jump') return null;
  const tile = w.tiles[w.bot.y]?.[w.bot.x];
  if (tile?.type !== 'spinner' || w.boxes[w.bot.y][w.bot.x] > 0) return null;
  return tile.spin === -1 ? t('the turntable turned LoopBot left') : t('the turntable turned LoopBot right');
}
