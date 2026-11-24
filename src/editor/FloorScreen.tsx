// The floor screen: board on top, program below (see "Floor screen sketch" in the doc).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Condition, LevelFile, PaletteCommand, PartnerName, Routine, World } from '../sim/types';
import { FUNCTION_NAMES, PARTNER_ROUTINE } from '../sim/types';
import { Runner } from '../sim/interpreter';
import type { Outcome } from '../sim/interpreter';
import { createWorld } from '../sim/world';
import type { Spot } from '../sim/program';
import { MAX_DEPTH, canPlace, countBlocks, countCommands, findBlock, listAt, makeBlock, spotOf, toCode } from '../sim/program';
import type { Block } from '../sim/types';
import { useEditor } from './useEditor';
import { ProgramList } from './ProgramList';
import { EditorDnd, PaletteChip } from './dnd';
import { CodeEditor, CodeView } from './CodeView';
import { Terminal } from './Terminal';
import { COMMAND_META, CONTROL_ORDER, EXTRA_ORDER, PALETTE_ORDER, blockCommand } from './commands';
import { Board, snapshotBoard } from '../board/Board';
import { shareImage } from '../share';
import { canvasToBlob, drawShareCard } from '../shareImage';
import { towerOf } from '../levels/towers';
import { LEVELS } from '../levels';
import { STEP_HELP_AFTER, introPalette, isIntroFloor, newCommands, nextStep, pathPreview } from './firstFloors';
import type { BoardUpdate } from '../board/BoardScene';
import { BackButton, Icon } from '../ui/Icon';
import { fx } from '../audio/feedback';
import { bumpMs, landMs } from '../fx/feel';
import { reducedMotion } from '../a11y/motion';
import { SettingsSheet } from '../SettingsSheet';
import type { Progress } from '../progress';
import { recordClear, recordFail } from '../progress';
import { maybeAskForReview } from '../review';
import { HintSheet } from './HintSheet';
import { answerNudge, loadComeback, shouldAskNudge } from '../comeback';
import { ResultsCard } from './ResultsCard';
import { cancellingTurns, partnerLine, spinNote, stepLine, twinNote, tutorialStep, TUTORIAL_TEXT } from './tutorial';
import { track } from '../telemetry';
import { FeedbackSheet } from '../FeedbackSheet';
import { markSurveyDone, surveyDue } from '../survey';
import { SurveySheet } from '../survey/SurveyCards';
import { DIFFICULTY_LABEL, TWIST_ICON, TWIST_RULE, difficultyOn, shareText, shortDate, twistOn } from '../daily';
import { msg, t, tn } from '../i18n';
import { announce } from '../a11y/announce';
import { describeBrief } from '../a11y/describe';
import { Medallion, TERRACE_INFO } from '../overflow/OverflowScreen';
import { terraceOf } from '../overflow';
import { flavourOf } from '../colourful';

/** Keys typed into a text box (code editor, feedback, maker) are never play shortcuts. */
function typingTarget(el: EventTarget | null): boolean {
  return el instanceof HTMLElement && (el.isContentEditable || el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement);
}

const SPEEDS = [
  { label: '1x', ms: 520 },
  { label: '2x', ms: 260 },
  { label: '4x', ms: 130 },
];
const SPEED_KEY = 'loopbot.speed';

/** The run speed is remembered across floors, so a player who likes 4x keeps it. */
function loadSpeed(): number {
  try {
    const n = Number(localStorage.getItem(SPEED_KEY) ?? 1);
    return Number.isInteger(n) && n >= 0 && n < SPEEDS.length ? n : 1;
  } catch {
    return 1;
  }
}

interface Props {
  level: LevelFile;
  floorNumber: number;
  floorCount: number;
  progress: Progress;
  setProgress(update: (p: Progress) => Progress): void;
  onGo(index: number): void;
  onTower(): void;
  /** Set when this is the daily challenge rather than a tower floor. */
  daily?: DailyProps;
  /** Set for a player-made floor (floor maker test play, or a share code). */
  custom?: CustomProps;
  /** Set for a floor of an Overflow climb (src/overflow). */
  overflow?: OverflowProps;
}

export interface OverflowProps {
  /** The floor of the climb, from 1. */
  floor: number;
  bricks: number;
  /** 3-star clears in a row so far on this climb (three win a brick back). */
  perfect: number;
  /** Called on every clear; says whether it set a new record and will earn a brick back. */
  onClear(stars: number): { record: boolean; brick: boolean };
  /** Skip this floor for a brick. */
  onSkip(): void;
}

export interface CustomProps {
  /** The back button's label, like "Floor maker". */
  back: string;
  /** Test play before the maker has cleared it: there's no par yet, so none is shown. */
  noPar?: boolean;
  /** The results card's heading (default "Your floor"). */
  title?: string;
  /** Called on every clear. It can return a line for the results card. Tower stars aren't touched. */
  onClear(commands: number, steps: number, stars: number): string | void;
}

export interface DailyProps {
  date: string;
  /** The Sunday boss rather than the day's puzzle. */
  boss?: boolean;
  /** Opens the Sunday boss (offered on the results card after Sunday's daily). */
  onBoss?(): void;
  /** Best stars on today's puzzle so far. */
  best: number;
  /** The streak as it stands now (it updates after a clear). */
  streak: number;
  /** A streak freeze covered yesterday (shown on the results card). */
  froze?: boolean;
  onClear(stars: number): void;
}

/** A crash line in the current language: "ERR: blocked ahead at step 4". */
function runError(error: string): string {
  const m = /^(.*) at step (\d+)$/.exec(error);
  return m ? t('{error} at step {n}', { error: echoError(m[1]), n: m[2] }) : echoError(error);
}

/** Twin Spires: an error that happened to Echo starts "Echo:" (CR-TWIN), and both parts translate. */
const ECHO_PREFIX = msg('Echo:');
/** Precinct 404: an error that happened to the partner starts with its name, "DASH:" (CR-PARTNER). */
const PARTNER_PREFIX = /^(DASH|LEDGER): /;
function echoError(error: string): string {
  const partner = PARTNER_PREFIX.exec(error);
  if (partner) return `${partner[1]}: ${t(error.slice(partner[0].length))}`;
  return error.startsWith(`${ECHO_PREFIX} `) ? `${t(ECHO_PREFIX)} ${t(error.slice(ECHO_PREFIX.length + 1))}` : t(error);
}

/**
 * A routine's tab name: Main, F1, F2, F3. On a Precinct 404 partner floor (CR-PARTNER), Main is
 * LoopBot's program and the partner's program is shown under the partner's name.
 */
export function routineName(r: Routine, partner: PartnerName | null = null): string {
  if (partner && r === 'main') return 'LoopBot';
  if (partner && r === PARTNER_ROUTINE) return partner;
  return r === 'main' ? t('Main') : r;
}

export function stars(level: LevelFile, commands: number, steps: number) {
  if (commands <= level.par.commands && steps <= level.par.steps) return 3;
  if (commands <= level.par.commands) return 2;
  return 1;
}

export function FloorScreen({ level, floorNumber, floorCount, progress, setProgress, onGo, onTower, daily, custom, overflow }: Props) {
  const editor = useEditor(level.id, level.starter);
  const { program } = editor.state;
  // The questions if and while can ask here: wall ahead always, plus the floor's own sensors.
  const conditions = useMemo<Condition[]>(() => {
    const out: Condition[] = [];
    for (const sensor of ['wall_ahead', ...(level.sensors ?? [])] as const) {
      if (sensor === 'tile_is') {
        for (const colour of ['r', 'g', 'b', 'y'] as const) if (level.tiles.some((row) => row.includes(colour))) out.push({ sensor, colour });
      } else if (!out.some((c) => c.sensor === sensor)) out.push({ sensor });
    }
    return out;
  }, [level]);
  // Precinct 404 (CR-PARTNER): the partner's program sits next to LoopBot's, before the functions
  const partner: PartnerName | null = level.partner ? (level.partner.who ?? 'DASH') : null;
  const routines = useMemo(
    () => ((level.partner ? ['main', PARTNER_ROUTINE, 'F1', 'F2'] : ['main', ...FUNCTION_NAMES]) as Routine[]).filter((r) => (level.slots[r] ?? 0) > 0),
    [level],
  );
  const nameOf = (r: Routine) => routineName(r, partner);
  // The program tab being edited, and whether the read-only code view is showing over it.
  const [routine, setRoutine] = useState<Routine>('main');
  const [showCode, setShowCode] = useState(false);
  // Rooftop pro mode: a non-zero number while the code is being typed (it also keys a fresh text box).
  const [typing, setTyping] = useState(0);
  /** The tutorial tip the player tapped away (floor and step), so it stays hidden until the next tip. */
  const [tipDismissed, setTipDismissed] = useState<string | null>(null);
  const tab: Routine | 'code' = showCode ? 'code' : routine;

  // --- run state ---
  const runner = useRef<Runner | null>(null);
  const [board, setBoard] = useState<BoardUpdate>(() => ({ world: createWorld(level), stepMs: 0 }));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(loadSpeed);
  useEffect(() => {
    try {
      localStorage.setItem(SPEED_KEY, String(speed));
    } catch {
      /* ignore */
    }
  }, [speed]);
  const [steps, setSteps] = useState(0);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [crashId, setCrashId] = useState<string | null>(null);
  const [terminal, setTerminal] = useState<string>(() => level.story.intro ?? t('> ready'));
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [showResults, setShowResults] = useState(false);
  // Best stars before the latest clear, so the results card can say "New best!".
  const [prevBest, setPrevBest] = useState(0);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const dailyRef = useRef(daily);
  dailyRef.current = daily;
  const customRef = useRef(custom);
  customRef.current = custom;
  const [customNote, setCustomNote] = useState<string | null>(null);
  const overflowRef = useRef(overflow);
  overflowRef.current = overflow;
  const [climbNote, setClimbNote] = useState<{ record: boolean; brick: boolean } | null>(null);
  // Skipping costs a brick, so it takes a second tap to confirm.
  const [skipArmed, setSkipArmed] = useState(false);
  useEffect(() => {
    if (!skipArmed) return;
    const id = window.setTimeout(() => setSkipArmed(false), 3000);
    return () => window.clearTimeout(id);
  }, [skipArmed]);
  // Player-made and Overflow floors don't count as tower fails (the stuck-floor stats are for tower floors).
  const fail = useCallback(() => {
    if (!customRef.current && !overflowRef.current) setProgress((p) => recordFail(p, level.id));
  }, [setProgress, level.id]);
  const [rotateSignal, setRotateSignal] = useState(0);
  const [sheet, setSheet] = useState<'hints' | 'settings' | 'feedback' | 'survey' | null>(null);
  // The player survey link on the results card (Tower 1 Floor 5 on, until answered once).
  const [offerSurvey, setOfferSurvey] = useState(() => !daily && !custom && !overflow && surveyDue(level.id));
  // Anonymous play stats for this visit to the floor (see src/telemetry.ts).
  const visit = useRef({ start: Date.now(), runs: 0, hints: 0, cleared: false });
  useEffect(() => {
    const v = visit.current;
    track({ type: 'floor_start', floor: level.id });
    return () => {
      const seconds = Math.min(3600, Math.round((Date.now() - v.start) / 1000));
      track({ type: 'floor_leave', floor: level.id, cleared: v.cleared, runs: v.runs, hints: v.hints, seconds });
    };
  }, [level.id]);
  const [hasRun, setHasRun] = useState(false);
  /** Failed runs this visit: after STEP_HELP_AFTER the first floors offer "Show me the next step". */
  const [missed, setMissed] = useState(0);
  // The results card waits for the light-up wave; a reset or a new run cancels it.
  const resultsTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(resultsTimer.current), []);

  const reset = useCallback(
    (quiet = false) => {
      window.clearTimeout(resultsTimer.current);
      runner.current = null;
      setPlaying(false);
      setSteps(0);
      setActiveIds(new Set());
      setCrashId(null);
      setOutcome(null);
      setShowResults(false);
      setBoard({ world: createWorld(level), stepMs: 0 });
      if (!quiet) setTerminal(t('> reset'));
    },
    [level],
  );

  // ED-15: a run never edits the program; any edit ends the current run.
  const programRef = useRef(program);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  useEffect(() => {
    if (programRef.current !== program) {
      programRef.current = program;
      if (runner.current) {
        // Say why the run stopped, unless the edit already says what happened (Clear, typed code).
        if (playingRef.current) setTerminal(t('> program changed: run stopped'));
        reset(true);
      }
    }
  }, [program, reset]);

  const stepOnce = useCallback(() => {
    if (!runner.current || runner.current.done) {
      window.clearTimeout(resultsTimer.current);
      runner.current = new Runner(program, level);
      fx.voice('ready');
      setOutcome(null);
      setCrashId(null);
      setShowResults(false);
    }
    const r = runner.current;
    const ev = r.step();
    const world: World = r.snapshot();
    setSteps(r.steps);
    if (ev) {
      // Precinct 404: light up what both bots are running
      setActiveIds(new Set([ev.blockId, ...ev.callStack, ...(world.partner && ev.twin ? [ev.twin.blockId, ...ev.twin.callStack] : [])]));
      // A move that lands gets its footfall when LoopBot touches down (src/fx/feel.ts).
      if (ev.ok) fx.step(ev.action, ev.action === 'forward' || ev.action === 'jump' ? landMs(SPEEDS[speed].ms) : 0);
      // Say what each step did. Turns get spelled out: they spin LoopBot without moving it,
      // which new players often miss when they only watch the board.
      if (world.partner) setTerminal(partnerLine(ev, world));
      else if (ev.ok && ev.action) {
        const spun = spinNote(ev.action, world);
        const line = spun ? `${stepLine(ev.action)} · ${spun}` : stepLine(ev.action);
        // Twin Spires: say when a bot parks, and whose step it was once LoopBot has parked
        const note = twinNote(ev, world);
        setTerminal(ev.who === 'twin' ? `${t('Echo:')} ${line}${note}` : `${line}${note}`);
      }
    }
    const o = r.outcome;
    const cleared = o?.status === 'cleared';
    setBoard({
      world,
      action: ev?.action,
      crashed: o?.status === 'crashed',
      cleared,
      stars: cleared ? stars(level, countCommands(program), o.steps) : undefined,
      stepMs: SPEEDS[speed].ms,
      ...(world.twin
        ? {
            action: ev?.who === 'twin' ? undefined : ev?.action,
            twinAction: ev?.who === 'twin' ? ev.action : ev?.twin?.action,
            crashWho: o?.status === 'crashed' && (o.error.startsWith(`${ECHO_PREFIX} `) || PARTNER_PREFIX.test(o.error)) ? ('twin' as const) : ('bot' as const),
          }
        : {}),
    });
    if (o) {
      setPlaying(false);
      setOutcome(o);
      const v = visit.current;
      v.runs += 1;
      track({ type: 'run', floor: level.id, result: o.status, commands: countCommands(program), steps: o.steps, run: v.runs });
      if (o.status === 'crashed') {
        setCrashId(o.blockId);
        setTerminal(runError(o.error));
        // Screen readers: the terminal reads the error; then where LoopBot ended up.
        announce(describeBrief(world));
        // Heard and felt when LoopBot bumps on the board, not when the step starts.
        const bump = world.twin ? 0 : bumpMs(SPEEDS[speed].ms, ev?.action, reducedMotion());
        fx.crash(bump);
        setMissed((n) => n + 1);
        fx.voice('uhoh', 0.35 + bump / 1000);
        fail();
      } else if (o.status === 'cleared') {
        const s = stars(level, countCommands(program), o.steps);
        setTerminal(tn(o.steps, '> floor cleared in {n} step', '> floor cleared in {n} steps'));
        // The fanfare waits for LoopBot to land on the lift.
        const land = landMs(SPEEDS[speed].ms);
        fx.win(land);
        fx.voice('yay', 0.55 + land / 1000);
        if (customRef.current) {
          setPrevBest(0);
          setCustomNote(customRef.current.onClear(countCommands(program), o.steps, s) || null);
        } else if (overflowRef.current) {
          // Overflow stars live with the climb, not the tower's star count.
          setPrevBest(0);
          setClimbNote(overflowRef.current.onClear(s));
        } else if (dailyRef.current) {
          // Daily stars live with the daily streak, not the tower's star count.
          setPrevBest(dailyRef.current.best);
          dailyRef.current.onClear(s);
        } else {
          setPrevBest(progressRef.current.stars[level.id] ?? 0);
          setProgress((p) => recordClear(p, level.id, s));
          maybeAskForReview(level.id, s, SPEEDS[speed].ms + 4500);
        }
        if (!v.cleared) {
          v.cleared = true;
          const seconds = Math.min(3600, Math.round((Date.now() - v.start) / 1000));
          track({ type: 'floor_clear', floor: level.id, stars: s, runs: v.runs, hints: v.hints, seconds });
        }
        window.clearTimeout(resultsTimer.current);
        resultsTimer.current = window.setTimeout(() => setShowResults(true), SPEEDS[speed].ms + 900); // let the light-up wave play first
      } else {
        setActiveIds(new Set());
        setTerminal(
          cancellingTurns(program).length
            ? tn(o.steps, '> program ended after {n} step. Two turns in your program cancel out, so LoopBot ends up facing the same way.', '> program ended after {n} steps. Two turns in your program cancel out, so LoopBot ends up facing the same way.')
            : tn(o.steps, '> program ended after {n} step. Not there yet: add more commands.', '> program ended after {n} steps. Not there yet: add more commands.'),
        );
        announce(describeBrief(world));
        fx.denied();
        setMissed((n) => n + 1);
        fail();
      }
    } else if (!ev) {
      setPlaying(false);
    }
  }, [program, level, speed, setProgress, fail]);

  // Run loop
  const stepRef = useRef(stepOnce);
  stepRef.current = stepOnce;
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => stepRef.current(), SPEEDS[speed].ms);
    return () => window.clearInterval(id);
  }, [playing, speed]);

  const run = () => {
    if (playing) {
      fx.tap();
      setPlaying(false); // Pause
      setTerminal(t('> paused'));
      return;
    }
    if (program.main.length === 0) {
      fx.tap();
      setTerminal(t('> the program is empty. Tap a command below to add it.'));
      fx.denied();
      return;
    }
    fx.run();
    if (!runner.current || runner.current.done) {
      reset(true);
      setTerminal(t('> running'));
    }
    setHasRun(true);
    setPlaying(true);
    // first step right away, so a tap feels instant
    window.setTimeout(() => stepRef.current(), 0);
  };

  const step = () => {
    fx.tap();
    setPlaying(false);
    if (program.main.length === 0) {
      setTerminal(t('> the program is empty. Tap a command below to add it.'));
      fx.denied();
      return;
    }
    if (runner.current?.done) reset(true);
    setHasRun(true);
    stepOnce();
  };

  // --- editing ---
  const limit = level.slots[routine] ?? 0;
  const total = countCommands(program);
  const list = program[routine];
  const full = countBlocks(list) >= limit;
  const [deleted, setDeleted] = useState<{ r: Routine; spot: Spot; block: Block } | null>(null);
  const deletedTimer = useRef<number | undefined>(undefined);
  const [confirmClear, setConfirmClear] = useState(false);

  const cursorSpot = (): Spot => editor.state.cursor[routine] ?? { parent: null, index: list.length };
  const canAdd = (cmd: PaletteCommand, spot: Spot = cursorSpot()) => {
    if (!level.commands.includes(cmd)) {
      fx.denied();
      setTerminal(t('> {command} unlocks on a later floor', { command: t(COMMAND_META[cmd].label) }));
      return false;
    }
    if (full) {
      fx.denied();
      setTerminal(t('> no empty slots left in {routine}', { routine: nameOf(routine) }));
      return false;
    }
    if (!canPlace(list, spot, makeBlock(cmd))) {
      fx.denied();
      setTerminal(t('> loops can only nest {n} deep', { n: MAX_DEPTH }));
      return false;
    }
    return true;
  };
  const add = (cmd: PaletteCommand) => {
    if (typing) {
      // The text box would overwrite a block added behind it.
      fx.denied();
      setTerminal(t('> finish typing (Use this code or Cancel) to add blocks'));
      return;
    }
    if (!canAdd(cmd)) return;
    editor.insert(routine, cmd);
    fx.snap();
    sayAdded(cmd);
  };
  // Screen readers: say what went in, and how full the program is now.
  const sayAdded = (cmd: PaletteCommand) =>
    announce(t('{command} added. {used} of {slots} used in {routine}.', { command: t(COMMAND_META[cmd].label), used: countBlocks(list) + 1, slots: limit, routine: nameOf(routine) }));
  // Dragged in from the palette: lands where it was dropped.
  const drop = (cmd: PaletteCommand, spot: Spot) => {
    editor.place(routine, spot, makeBlock(cmd));
    fx.snap();
    sayAdded(cmd);
  };

  const del = (id: string) => {
    const spot = spotOf(list, id);
    const removed = findBlock(list, id);
    if (!spot || !removed) return;
    editor.remove(routine, id);
    fx.remove();
    setDeleted({ r: routine, spot, block: removed });
    window.clearTimeout(deletedTimer.current);
    deletedTimer.current = window.setTimeout(() => setDeleted(null), 4000); // ED-3
  };

  const undoDelete = () => {
    if (!deleted) return;
    const target = program[deleted.r];
    // The slots may have filled up since, or the loop it sat in may be gone.
    if (countBlocks(target) + countBlocks([deleted.block]) > (level.slots[deleted.r] ?? 0)) {
      fx.denied();
      setTerminal(t('> no room to put it back in {routine}', { routine: nameOf(deleted.r) }));
      return;
    }
    const spot = listAt(target, deleted.spot.parent) ? deleted.spot : { parent: null, index: target.length };
    editor.place(deleted.r, spot, deleted.block);
    setDeleted(null);
    fx.undo();
  };

  const clear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      fx.tap();
      window.setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    setConfirmClear(false);
    editor.clear();
    fx.remove();
    setTerminal(t('> program cleared. Undo brings it back.'));
  };

  const undo = () => {
    if (!editor.state.past.length) return fx.denied();
    editor.undo();
    setDeleted(null);
    fx.undo();
  };
  const redo = () => {
    if (!editor.state.future.length) return fx.denied();
    editor.redo();
    fx.undo();
  };

  // Keyboard: Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z or Ctrl+Y redo (ED-16 full keyboard control on web).
  // Plus play keys for desktops (web, Chromebooks, Google Play Games on PC): R runs or pauses,
  // S steps, and 1-9 add the palette command in that spot.
  const undoRef = useRef({ undo, redo, run: () => {}, step: () => {}, addNth: (_n: number) => {} });
  undoRef.current.undo = undo;
  undoRef.current.redo = redo;
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSheet(null);
        setShowResults(false);
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      // Typing code: the text box keeps its own undo.
      if (e.target instanceof HTMLTextAreaElement) return;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) undoRef.current.redo();
        else undoRef.current.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        undoRef.current.redo();
      } else if (!mod && !e.altKey && !e.repeat && !typingTarget(e.target) && !document.querySelector('[role="dialog"]')) {
        const k = e.key.toLowerCase();
        if (k === 'r') undoRef.current.run();
        else if (k === 's') undoRef.current.step();
        else if (/^[1-9]$/.test(e.key)) undoRef.current.addNth(Number(e.key) - 1);
        else return;
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Floors 1 to 5 show only the commands they have (src/editor/firstFloors.ts).
  const palette = introPalette(level, [
    ...PALETTE_ORDER,
    ...EXTRA_ORDER.filter((c) => level.commands.includes(c)),
    ...CONTROL_ORDER.filter((c) => level.commands.includes(c)),
    ...FUNCTION_NAMES.filter((f) => (level.slots[f] ?? 0) > 0 && !(partner && f === PARTNER_ROUTINE)),
  ]);
  undoRef.current.run = run;
  undoRef.current.step = step;
  undoRef.current.addNth = (n) => {
    const cmd = palette[n];
    if (!cmd || tab === 'code') return;
    add(cmd);
  };
  const status = outcome?.status ?? (playing ? 'running' : steps > 0 ? 'paused' : 'ready');
  const earned = outcome?.status === 'cleared' ? stars(level, total, outcome.steps) : 0;
  const tut = tutorialStep({
    enabled: progress.tutorial,
    floorId: level.id,
    clearedBefore: (progress.stars[level.id] ?? 0) > 0,
    program,
    hasRun,
    playing,
    outcome: outcome?.status ?? null,
  });
  const cancelIds = useMemo(() => new Set(cancellingTurns(program)), [program]);
  const tipKey = tut && `${level.id}:${tut}`;
  const showTip = !!tut && tipKey !== tipDismissed;
  const pulse = (cmd: PaletteCommand) =>
    ((tut === 'tap' || tut === 'more') && cmd === 'forward') ||
    (tut === 'turn' && (cmd === 'turn_left' || cmd === 'turn_right')) ||
    (tut === 'pick' && cmd === 'pick_up');
  // A command this intro floor brings in wears a "New" badge until the floor is cleared.
  const clearedBefore = (progress.stars[level.id] ?? 0) > 0;
  const fresh = useMemo(
    () => (clearedBefore || custom || daily || overflow ? new Set<string>() : newCommands(level.id, (id) => LEVELS.find((l) => l.id === id)?.commands)),
    [level.id, clearedBefore, custom, daily, overflow],
  );
  // Floors 1 to 5: after two misses, offer to add the next right command (src/editor/firstFloors.ts).
  const helpStep = useMemo(
    () => (!custom && !daily && !overflow && !playing && missed >= STEP_HELP_AFTER && isIntroFloor(level.id) ? nextStep(level, program) : null),
    [custom, daily, overflow, playing, missed, level, program],
  );
  const applyHelpStep = () => {
    if (!helpStep) return;
    fx.snap();
    editor.setProgram(helpStep.program);
    setMissed(0);
    const meta = COMMAND_META[helpStep.added];
    setTerminal(t('> added the next step: {command}. Press Run.', { command: `${meta.glyph} ${t(meta.label)}` }));
    track({ type: 'hint', floor: level.id, tier: 0, free: true });
  };
  // Floors 1 to 3: dotted footsteps show where the program will take LoopBot, until Run.
  const preview = useMemo(
    () => (progress.tutorial && !custom && !daily && !overflow && !playing && steps === 0 ? pathPreview(level, program) : null),
    [progress.tutorial, custom, daily, overflow, playing, steps, level, program],
  );

  return (
    <main className={`floor${tab === 'code' && typing ? ' typing-code' : ''}${overflow ? ' ovf-floor' : ''}`}>
      <header className="topbar">
        <BackButton
          onClick={() => (fx.tap(), onTower())}
          label={
            custom
              ? t('{place}: back', { place: custom.back })
              : overflow
                ? t('{place}: back', { place: t('Overflow · Floor {n}', { n: overflow.floor }) })
                : daily
                  ? t('{place}: back', { place: daily.boss ? t('Sunday boss · {date}', { date: shortDate(daily.date) }) : t('Daily · {date}', { date: shortDate(daily.date) }) })
                  : t('Tower · Floor {n}: back to the tower map', { n: floorNumber })
          }
        />
        <div className="floor-title">
          {overflow ? (
            <div className="ovf-line">
              <span className="screen-kicker">{t('Overflow · Floor {n}', { n: overflow.floor })}</span>
              <span className="ovf-bricks" role="img" aria-label={tn(overflow.bricks, '{n} brick left', '{n} bricks left')}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className={`ovf-brick${i < overflow.bricks ? ' on' : ''}`} aria-hidden="true" />
                ))}
              </span>
            </div>
          ) : (
            <span className="screen-kicker">
              <span aria-hidden="true">{custom ? custom.back : daily ? (daily.boss ? t('Sunday boss · {date}', { date: shortDate(daily.date) }) : t('Daily · {date}', { date: shortDate(daily.date) })) : t('Floor {n}', { n: floorNumber })}</span>
              {daily && (daily.boss ? <span className="daily-diff diff-boss">👑 {t('Boss')}</span> : <span className={`daily-diff diff-${difficultyOn(daily.date)}`}>{t(DIFFICULTY_LABEL[difficultyOn(daily.date)])}</span>)}
            </span>
          )}
          <h1 className="floor-name">
            {level.title}
          </h1>
          {daily && !daily.boss && twistOn(daily.date) && (
            <p className="daily-rule">
              <span aria-hidden="true">{TWIST_ICON[twistOn(daily.date)!]}</span> {t(TWIST_RULE[twistOn(daily.date)!])}
            </p>
          )}
        </div>
        {overflow && (
          <button
            type="button"
            className={`pill ovf-skip${skipArmed ? ' armed' : ''}`}
            disabled={overflow.bricks <= 0 || outcome?.status === 'cleared'}
            aria-label={overflow.bricks <= 0 ? t('No bricks left to skip with: clear this floor to climb on') : skipArmed ? t('Tap again to skip this floor for a brick') : t('Skip this floor for a brick')}
            onClick={() => {
              if (!skipArmed) return (fx.tap(), setSkipArmed(true));
              fx.denied();
              overflow.onSkip();
            }}
          >
            {skipArmed ? t('Skip? −1 brick') : t('Skip')}
          </button>
        )}
        {level.hints.length > 0 && (
          <button type="button" className="hint-btn" onClick={() => (fx.tap(), setSheet('hints'))} aria-label={t('Hint, {n} left', { n: progress.hints })}>
            <Icon name="hint" size={20} />
            <span className="hint-count">{progress.hints}</span>
          </button>
        )}
        <button type="button" className="icon-btn fb-btn" aria-label={t('Send feedback about this floor')} onClick={() => (fx.tap(), setSheet('feedback'))}>
          <Icon name="chat" />
        </button>
        <button type="button" className="icon-btn" aria-label={t('Settings')} onClick={() => (fx.tap(), setSheet('settings'))}>
          <Icon name="settings" />
        </button>
      </header>

      <section className={`board-wrap band-${level.band}`} data-flavour={flavourOf(level.band)}>
        <Board update={board} rotateSignal={rotateSignal} band={level.band} preview={preview} />
        <div className="step-counter" aria-live="polite">
          <span>
            {t('{used} / {slots} commands', { used: total, slots: Object.values(level.slots).reduce((a, b) => a + (b ?? 0), 0) })}
            {custom?.noPar ? '' : ` · ${t('par {n}', { n: level.par.commands })}`}
          </span>
          <span>{t('step {n}', { n: steps })}</span>
        </div>
        {overflow && (
          <span className="ovf-altitude">
            <Medallion terrace={terraceOf(overflow.floor)} reached size={18} />
            {t(TERRACE_INFO[terraceOf(overflow.floor)].name)}
          </span>
        )}
        <button type="button" className="rotate-btn" onClick={() => (fx.tap(), setRotateSignal((n) => n + 1))} aria-label={t('Rotate view: turn the camera a quarter turn. LoopBot does not move.')}>
          <Icon name="rotate" size={16} /> {t('Rotate view')}
        </button>
        {/* The tutorial tip floats over the foot of the board, above PATCH's line, so it never takes
            room from the program (on short or zoomed-in phones that room is only a few lines). On those
            short screens the tip stands in for PATCH's line until it is tapped away or done. */}
        <div className={`board-foot${showTip || helpStep ? ' with-tip' : ''}`}>
          {helpStep && (
            <button type="button" className="step-help" onClick={applyHelpStep}>
              <Icon name="hint" size={18} /> {t('Show me the next step')}
            </button>
          )}
          {showTip && tut && !helpStep && (
            // A tap anywhere on the tip hides it; the × is the button for keyboards and screen readers.
            <div className={`tutorial-bubble tut-${tut}`} role="status" onClick={() => (fx.tap(), setTipDismissed(tipKey))}>
              <span>{t(TUTORIAL_TEXT[tut])}</span>
              <button type="button" className="tip-x" aria-label={t('Hide this tip')}>
                ×
              </button>
            </div>
          )}
          <Terminal text={terminal} status={status} />
        </div>
      </section>

      <section className="editor">
        <EditorDnd blocks={list} canAdd={canAdd} onDrop={drop} onMove={(id, to) => (editor.move(routine, id, to), fx.snap())}>
        <div className="run-controls">
          <button type="button" className={`pill primary${playing ? ' on' : ''}${tut === 'run' ? ' pulse' : ''}`} onClick={run} aria-keyshortcuts="R" title={`${t('Run')} / ${t('Pause')} (R)`}>
            <Icon name={playing ? 'pause' : 'play'} size={18} />
            {playing ? t('Pause') : t('Run')}
            {/* Floor 1 opens with forward already placed: the first thing to do is press Run. */}
            {tut === 'run' && level.id === 't1-f01' && <TapHand />}
          </button>
          <button type="button" className="pill" onClick={step} aria-keyshortcuts="S" title={`${t('Step')} (S)`}>
            <Icon name="step" size={18} /> {t('Step')}
          </button>
          <button type="button" className="pill" onClick={() => (fx.tap(), reset())}>
            <Icon name="reset" size={18} /> {t('Reset')}
          </button>
          <button type="button" className="pill speed" onClick={() => (fx.tap(), setSpeed((s) => (s + 1) % SPEEDS.length))} aria-label={t('Speed {speed}', { speed: SPEEDS[speed].label })}>
            {SPEEDS[speed].label}
          </button>
        </div>

        <div className="tabs">
          <div className="tab-list" role="tablist" aria-label={t('Program')}>
          {routines.map((r) => (
            <button key={r} type="button" role="tab" aria-selected={tab === r} className={`tab${tab === r ? ' on' : ''}`} onClick={() => (fx.tap(), setShowCode(false), setTyping(0), setRoutine(r))}>
              {nameOf(r)}
            </button>
          ))}
          </div>
          <span className="tab-gap" />
          <button type="button" className="tab-tool" onClick={undo} disabled={!editor.state.past.length} aria-label={t('Undo')}>
            ↶
          </button>
          <button type="button" className="tab-tool" onClick={redo} disabled={!editor.state.future.length} aria-label={t('Redo')}>
            ↷
          </button>
          <button type="button" className={`tab-tool clear${confirmClear ? ' confirm' : ''}`} onClick={clear} disabled={total === 0 && !confirmClear}>
            {confirmClear ? t('Clear all?') : t('Clear')}
          </button>
          <button type="button" aria-pressed={tab === 'code'} className={`tab${tab === 'code' ? ' on' : ''}`} onClick={() => (fx.tap(), setTyping(0), setShowCode((v) => !v))}
            aria-label={showCode ? t('Code, showing. Tap again to go back to the program') : t('Code')}>
            {t('Code')}
          </button>
        </div>

        <div className="program-wrap">
          {tab === 'code' && typing ? (
            <CodeEditor
              key={typing}
              program={program}
              routines={routines}
              level={level}
              onApply={(p, n) => {
                fx.snap();
                editor.setProgram(p);
                setTerminal(tn(n, '> code loaded: {n} command', '> code loaded: {n} commands'));
              }}
              onError={(msg) => {
                fx.denied();
                setTerminal(`> ${msg}`);
              }}
              onClose={() => setTyping(0)}
            />
          ) : tab === 'code' ? (
            <>
              <CodeView program={program} routines={routines} activeIds={activeIds} crashId={crashId} recursion={!!level.recursion} partner={partner} />
              {level.typing && (
                <button type="button" className="pill type-btn" onClick={() => (fx.tap(), reset(true), setTyping((n) => n + 1))}>
                  ✎ {t('Type code')}
                </button>
              )}
            </>
          ) : (
            <ProgramList
              blocks={list}
              limit={limit}
              cursor={editor.state.cursor[routine] ?? null}
              activeIds={activeIds}
              crashId={crashId}
              cancelIds={cancelIds}
              onCursor={(spot) => {
                fx.tap();
                editor.setCursor(routine, spot);
              }}
              onMove={(id, to) => {
                editor.move(routine, id, to);
                fx.snap();
              }}
              onTimes={(id, n) => {
                fx.tap();
                editor.setTimes(routine, id, n);
              }}
              onDelete={del}
              conditions={conditions}
              onCond={(id, c) => {
                fx.tap();
                editor.setCond(routine, id, c);
              }}
              recursion={level.recursion ? (routine === 'main' ? 'main' : 'fn') : undefined}
            />
          )}
          {deleted && (
            <div className="undo-toast" role="status">
              {t('Deleted {command}', { command: t(COMMAND_META[blockCommand(deleted.block)].label) })}
              <button type="button" onClick={undoDelete}>
                {t('Undo')}
              </button>
            </div>
          )}
        </div>

        <div className="palette" role="group" aria-label={t('Commands')}>
          {palette.map((cmd, i) => {
            const meta = COMMAND_META[cmd];
            const allowed = level.commands.includes(cmd);
            return (
              <PaletteChip
                key={cmd}
                cmd={cmd}
                allowed={allowed && tab !== 'code'}
                inactive={!allowed || full}
                className={`chip tone-${meta.tone}${allowed ? '' : ' locked'}${allowed && full ? ' full' : ''}${pulse(cmd) ? ' pulse' : ''}`}
                label={allowed ? t('Add {command} (tap, or drag it into the program)', { command: t(meta.label) }) : t('{command}, locked on this floor', { command: t(meta.label) })}
                shortcut={i < 9 ? String(i + 1) : undefined}
                onClick={() => add(cmd)}
              >
                <span className="glyph" aria-hidden="true">
                  {meta.glyph}
                </span>
                <span>{t(meta.label)}</span>
                {fresh.has(cmd) && <span className="new-badge">{t('New')}</span>}
                {/* Floor 1: a tapping finger on forward when the program is empty or a run stopped short. */}
                {(tut === 'tap' || tut === 'more') && cmd === 'forward' && <TapHand />}
              </PaletteChip>
            );
          })}
        </div>
        </EditorDnd>
      </section>

      {sheet === 'hints' && (
        <HintSheet
          level={level}
          progress={progress}
          setProgress={setProgress}
          onClose={() => setSheet(null)}
          onReveal={(tier, free) => {
            visit.current.hints += 1;
            track({ type: 'hint', floor: level.id, tier, free });
          }}
          onFeedback={() => setSheet('feedback')}
        />
      )}

      {sheet === 'settings' && (
        <SettingsSheet progress={progress} setProgress={setProgress} onClose={() => setSheet(null)} floor={level.id} floorTitle={level.title} />
      )}

      {sheet === 'feedback' && <FeedbackSheet floor={level.id} floorTitle={level.title} onClose={() => setSheet(null)} />}
      {sheet === 'survey' && (
        <SurveySheet
          floor={level.id}
          floorTitle={level.title}
          onSent={() => (markSurveyDone(), setOfferSurvey(false))}
          onClose={() => setSheet(null)}
        />
      )}

      {showResults && outcome?.status === 'cleared' && (
        <ResultsCard
          floorNumber={floorNumber}
          tower={Number(/^t(\d+)-/.exec(level.id)?.[1] ?? 1)}
          floorCount={floorCount}
          earned={earned}
          prevBest={prevBest}
          commands={total}
          steps={outcome.steps}
          par={level.par}
          outro={level.story.outro}
          onClose={() => setShowResults(false)}
          onRetry={reset}
          onNext={() => onGo(floorNumber)}
          onTower={onTower}
          onSurvey={offerSurvey ? () => setSheet('survey') : undefined}
          custom={custom && { note: customNote, noPar: custom.noPar, title: custom.title }}
          nudge={
            !daily && !custom && !overflow && level.id === 't1-f01' && prevBest === 0 && shouldAskNudge(loadComeback(), progress)
              ? { answer: (yes) => answerNudge(yes, progressRef.current) }
              : undefined
          }
          overflow={overflow && { floor: overflow.floor, record: !!climbNote?.record, brick: !!climbNote?.brick, streak: climbNote?.brick ? 3 : earned >= 3 ? Math.min(2, overflow.perfect + 1) : 0 }}
          onShareImage={
            custom || overflow
              ? undefined
              : async () => {
                  const tw = towerOf(Number(/^t(\d+)-/.exec(level.id)?.[1] ?? 1));
                  const card = drawShareCard({
                    title: daily ? (daily.boss ? t('Sunday boss · {date}', { date: shortDate(daily.date) }) : t('Daily · {date}', { date: shortDate(daily.date) })) : t('Floor {n} · {title}', { n: floorNumber, title: level.title }),
                    subtitle: daily
                      ? daily.boss
                        ? t('The biggest floor of the week')
                        : twistOn(daily.date)
                          ? `${t('{difficulty} puzzle', { difficulty: t(DIFFICULTY_LABEL[difficultyOn(daily.date)]) })} · ${t(TWIST_RULE[twistOn(daily.date)!])}`
                          : t('{difficulty} puzzle', { difficulty: t(DIFFICULTY_LABEL[difficultyOn(daily.date)]) })
                      : t('Tower {n} · {name}', { n: tw.n, name: tw.name }),
                    stars: earned,
                    band: level.band,
                    board: await snapshotBoard(),
                    code: daily ? undefined : toCode(program, routines, !!level.recursion, partner),
                    daily: daily && { streak: daily.boss ? 0 : daily.streak },
                    commands: total,
                    steps: outcome.steps,
                    par: level.par,
                  });
                  const png = await canvasToBlob(card);
                  if (!png) return 'failed';
                  if (daily) {
                    const text = shareText(daily.date, level, earned, total, daily.streak, daily.boss);
                    return shareImage(png, text, `loopbot-${daily.boss ? 'boss' : 'daily'}-${daily.date}.png`);
                  }
                  return shareImage(png, tn(total, 'I cleared Floor {floor} of LoopBot in {n} command. Can you do it in fewer?', 'I cleared Floor {floor} of LoopBot in {n} commands. Can you do it in fewer?', { floor: floorNumber }), `loopbot-floor-${floorNumber}.png`);
                }
          }
          daily={
            daily && {
              date: daily.date,
              boss: daily.boss,
              onBoss: daily.onBoss,
              streak: daily.boss ? 0 : daily.streak,
              froze: daily.froze,
              share: shareText(daily.date, level, earned, total, daily.streak, daily.boss),
            }
          }
        />
      )}
    </main>
  );
}

/** A finger that taps on the spot, drawn in SVG (still with Reduce motion: the CSS stops it moving). */
function TapHand() {
  return (
    <span className="tap-hand" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="30" height="30">
        <path
          d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10l4.6.9a2 2 0 0 1 1.6 2.2l-.6 4.6A3 3 0 0 1 14.6 20.3H11a3 3 0 0 1-2.4-1.2l-3.2-4.3a1.4 1.4 0 0 1 2.1-1.8L9 14.5z"
          fill="#fff"
          stroke="#1b1d2a"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
