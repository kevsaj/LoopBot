// The floor screen: board on top, program below (see "Floor screen sketch" in the doc).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Condition, LevelFile, PaletteCommand, Routine, World } from '../sim/types';
import { FUNCTION_NAMES } from '../sim/types';
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
import { COMMAND_META, CONTROL_ORDER, PALETTE_ORDER, blockCommand } from './commands';
import { Board, snapshotBoard } from '../board/Board';
import { shareImage } from '../share';
import { canvasToBlob, drawShareCard } from '../shareImage';
import type { BoardUpdate } from '../board/BoardScene';
import { fx } from '../audio/feedback';
import { SettingsSheet } from '../SettingsSheet';
import type { Progress } from '../progress';
import { recordClear, recordFail } from '../progress';
import { maybeAskForReview } from '../review';
import { HintSheet } from './HintSheet';
import { ResultsCard } from './ResultsCard';
import { cancellingTurns, stepLine, tutorialStep, TUTORIAL_TEXT } from './tutorial';
import { track } from '../telemetry';
import { FeedbackSheet } from '../FeedbackSheet';
import { DIFFICULTY_LABEL, difficultyOn, shareText, shortDate } from '../daily';

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
}

export interface CustomProps {
  /** The back button's label, like "Floor maker". */
  back: string;
  /** Test play before the maker has cleared it: there's no par yet, so none is shown. */
  noPar?: boolean;
  /** Called on every clear. It can return a line for the results card. Tower stars aren't touched. */
  onClear(commands: number, steps: number, stars: number): string | void;
}

export interface DailyProps {
  date: string;
  /** Best stars on today's puzzle so far. */
  best: number;
  /** The streak as it stands now (it updates after a clear). */
  streak: number;
  /** A streak freeze covered yesterday (shown on the results card). */
  froze?: boolean;
  onClear(stars: number): void;
}

export function stars(level: LevelFile, commands: number, steps: number) {
  if (commands <= level.par.commands && steps <= level.par.steps) return 3;
  if (commands <= level.par.commands) return 2;
  return 1;
}

export function FloorScreen({ level, floorNumber, floorCount, progress, setProgress, onGo, onTower, daily, custom }: Props) {
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
  const routines = useMemo(
    () => (['main', ...FUNCTION_NAMES] as Routine[]).filter((r) => (level.slots[r] ?? 0) > 0),
    [level],
  );
  // The program tab being edited, and whether the read-only code view is showing over it.
  const [routine, setRoutine] = useState<Routine>('main');
  const [showCode, setShowCode] = useState(false);
  // Rooftop pro mode: a non-zero number while the code is being typed (it also keys a fresh text box).
  const [typing, setTyping] = useState(0);
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
  const [terminal, setTerminal] = useState<string>(level.story.intro ?? '> ready');
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
  // Player-made floors don't count as tower fails (the stuck-floor stats are for tower floors).
  const fail = useCallback(() => {
    if (!customRef.current) setProgress((p) => recordFail(p, level.id));
  }, [setProgress, level.id]);
  const [rotateSignal, setRotateSignal] = useState(0);
  const [sheet, setSheet] = useState<'hints' | 'settings' | 'feedback' | null>(null);
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
      if (!quiet) setTerminal('> reset');
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
        if (playingRef.current) setTerminal('> program changed: run stopped');
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
      setActiveIds(new Set([ev.blockId, ...ev.callStack]));
      if (ev.ok) fx.step(ev.action);
      // Say what each step did. Turns get spelled out: they spin LoopBot without moving it,
      // which new players often miss when they only watch the board.
      if (ev.ok && ev.action) setTerminal(stepLine(ev.action));
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
    });
    if (o) {
      setPlaying(false);
      setOutcome(o);
      const v = visit.current;
      v.runs += 1;
      track({ type: 'run', floor: level.id, result: o.status, commands: countCommands(program), steps: o.steps, run: v.runs });
      if (o.status === 'crashed') {
        setCrashId(o.blockId);
        setTerminal(o.error);
        fx.crash();
        fx.voice('uhoh', 0.35);
        fail();
      } else if (o.status === 'cleared') {
        const s = stars(level, countCommands(program), o.steps);
        setTerminal(`> floor cleared in ${o.steps} steps`);
        fx.win();
        fx.voice('yay', 0.55);
        if (customRef.current) {
          setPrevBest(0);
          setCustomNote(customRef.current.onClear(countCommands(program), o.steps, s) || null);
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
            ? `> program ended after ${o.steps} steps. Two turns in your program cancel out, so LoopBot ends up facing the same way.`
            : `> program ended after ${o.steps} steps. Not there yet: add more commands.`,
        );
        fx.denied();
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
    fx.tap();
    if (playing) {
      setPlaying(false); // Pause
      setTerminal('> paused');
      return;
    }
    if (program.main.length === 0) {
      setTerminal('> the program is empty. Tap a command below to add it.');
      fx.denied();
      return;
    }
    if (!runner.current || runner.current.done) {
      reset(true);
      setTerminal('> running');
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
      setTerminal('> the program is empty. Tap a command below to add it.');
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
      setTerminal(`> ${COMMAND_META[cmd].label} unlocks on a later floor`);
      return false;
    }
    if (full) {
      fx.denied();
      setTerminal(`> no empty slots left in ${routine}`);
      return false;
    }
    if (!canPlace(list, spot, makeBlock(cmd))) {
      fx.denied();
      setTerminal(`> loops can only nest ${MAX_DEPTH} deep`);
      return false;
    }
    return true;
  };
  const add = (cmd: PaletteCommand) => {
    if (typing) {
      // The text box would overwrite a block added behind it.
      fx.denied();
      setTerminal('> finish typing (Use this code or Cancel) to add blocks');
      return;
    }
    if (!canAdd(cmd)) return;
    editor.insert(routine, cmd);
    fx.snap();
  };
  // Dragged in from the palette: lands where it was dropped.
  const drop = (cmd: PaletteCommand, spot: Spot) => {
    editor.place(routine, spot, makeBlock(cmd));
    fx.snap();
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
      setTerminal(`> no room to put it back in ${deleted.r}`);
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
    setTerminal('> program cleared. Undo brings it back.');
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

  // Keyboard: Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z or Ctrl+Y redo (ED-16 full keyboard control on web)
  const undoRef = useRef({ undo, redo });
  undoRef.current = { undo, redo };
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
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const palette = [
    ...PALETTE_ORDER,
    ...CONTROL_ORDER.filter((c) => level.commands.includes(c)),
    ...FUNCTION_NAMES.filter((f) => (level.slots[f] ?? 0) > 0),
  ];
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
  const pulse = (cmd: PaletteCommand) =>
    (tut === 'tap' && cmd === 'forward') || (tut === 'turn' && (cmd === 'turn_left' || cmd === 'turn_right'));

  return (
    <main className={`floor${tab === 'code' && typing ? ' typing-code' : ''}`}>
      <header className="topbar">
        <div className="floor-title">
          {custom ? (
            <button type="button" className="back-btn" onClick={() => (fx.tap(), onTower())} aria-label={`${custom.back}: back`}>
              ‹ {custom.back}
            </button>
          ) : daily ? (
            <button type="button" className="back-btn" onClick={() => (fx.tap(), onTower())} aria-label={`Daily · ${shortDate(daily.date)}: back`}>
              ‹ Daily · {shortDate(daily.date)}
            </button>
          ) : (
            <button type="button" className="back-btn" onClick={() => (fx.tap(), onTower())} aria-label={`Tower · Floor ${floorNumber}: back to the tower map`}>
              ‹ Tower · Floor {floorNumber}
            </button>
          )}
          <h1 className="floor-name">
            {level.title}
            {daily && <span className={`daily-diff diff-${difficultyOn(daily.date)}`}>{DIFFICULTY_LABEL[difficultyOn(daily.date)]}</span>}
          </h1>
        </div>
        {level.hints.length > 0 && (
          <button type="button" className="hint-btn" onClick={() => (fx.tap(), setSheet('hints'))} aria-label={`Hint, ${progress.hints} left`}>
            Hint <span className="hint-count">{progress.hints}</span>
          </button>
        )}
        <button type="button" className="icon-btn fb-btn" aria-label="Send feedback about this floor" onClick={() => (fx.tap(), setSheet('feedback'))}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="8.5" cy="9.5" r="1.2" fill="currentColor" />
            <circle cx="12" cy="9.5" r="1.2" fill="currentColor" />
            <circle cx="15.5" cy="9.5" r="1.2" fill="currentColor" />
          </svg>
        </button>
        <button type="button" className="icon-btn" aria-label="Settings" onClick={() => (fx.tap(), setSheet('settings'))}>
          ⚙
        </button>
      </header>

      <section className={`board-wrap band-${level.band}`}>
        <Board update={board} rotateSignal={rotateSignal} band={level.band} />
        <div className="step-counter" aria-live="polite">
          <span>
            {total} / {Object.values(level.slots).reduce((a, b) => a + (b ?? 0), 0)} commands{custom?.noPar ? '' : ` · par ${level.par.commands}`}
          </span>
          <span>step {steps}</span>
        </div>
        <button type="button" className="rotate-btn" onClick={() => (fx.tap(), setRotateSignal((n) => n + 1))} aria-label="Rotate view: turn the camera a quarter turn. LoopBot does not move.">
          ⟲ Rotate view
        </button>
        <Terminal text={terminal} status={status} />
      </section>

      <section className="editor">
        <EditorDnd blocks={list} canAdd={canAdd} onDrop={drop} onMove={(id, to) => (editor.move(routine, id, to), fx.snap())}>
        <div className="run-controls">
          <button type="button" className={`pill primary${playing ? ' on' : ''}${tut === 'run' ? ' pulse' : ''}`} onClick={run}>
            {playing ? '❚❚ Pause' : '▶ Run'}
          </button>
          <button type="button" className="pill" onClick={step}>
            ⏭ Step
          </button>
          <button type="button" className="pill" onClick={() => (fx.tap(), reset())}>
            ⟲ Reset
          </button>
          <button type="button" className="pill speed" onClick={() => (fx.tap(), setSpeed((s) => (s + 1) % SPEEDS.length))} aria-label={`Speed ${SPEEDS[speed].label}`}>
            {SPEEDS[speed].label}
          </button>
        </div>

        <div className="tabs">
          <div className="tab-list" role="tablist" aria-label="Program">
          {routines.map((r) => (
            <button key={r} type="button" role="tab" aria-selected={tab === r} className={`tab${tab === r ? ' on' : ''}`} onClick={() => (fx.tap(), setShowCode(false), setTyping(0), setRoutine(r))}>
              {r === 'main' ? 'Main' : r}
            </button>
          ))}
          </div>
          <span className="tab-gap" />
          <button type="button" className="tab-tool" onClick={undo} disabled={!editor.state.past.length} aria-label="Undo">
            ↶
          </button>
          <button type="button" className="tab-tool" onClick={redo} disabled={!editor.state.future.length} aria-label="Redo">
            ↷
          </button>
          <button type="button" className={`tab-tool clear${confirmClear ? ' confirm' : ''}`} onClick={clear} disabled={total === 0 && !confirmClear}>
            {confirmClear ? 'Clear all?' : 'Clear'}
          </button>
          <button type="button" aria-pressed={tab === 'code'} className={`tab${tab === 'code' ? ' on' : ''}`} onClick={() => (fx.tap(), setTyping(0), setShowCode((v) => !v))}
            aria-label={showCode ? 'Code, showing. Tap again to go back to the program' : 'Code'}>
            Code
          </button>
        </div>

        <div className="program-wrap">
          {tut && (
            <div className={`tutorial-bubble tut-${tut}`} role="status">
              {TUTORIAL_TEXT[tut]}
            </div>
          )}
          {tab === 'code' && typing ? (
            <CodeEditor
              key={typing}
              program={program}
              routines={routines}
              level={level}
              onApply={(p, n) => {
                fx.snap();
                editor.setProgram(p);
                setTerminal(`> code loaded: ${n} command${n === 1 ? '' : 's'}`);
              }}
              onError={(msg) => {
                fx.denied();
                setTerminal(`> ${msg}`);
              }}
              onClose={() => setTyping(0)}
            />
          ) : tab === 'code' ? (
            <>
              <CodeView program={program} routines={routines} activeIds={activeIds} crashId={crashId} />
              {level.typing && (
                <button type="button" className="pill type-btn" onClick={() => (fx.tap(), reset(true), setTyping((n) => n + 1))}>
                  ✎ Type code
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
            />
          )}
          {deleted && (
            <div className="undo-toast" role="status">
              Deleted {COMMAND_META[blockCommand(deleted.block)].label}
              <button type="button" onClick={undoDelete}>
                Undo
              </button>
            </div>
          )}
        </div>

        <div className="palette" aria-label="Commands">
          {palette.map((cmd) => {
            const meta = COMMAND_META[cmd];
            const allowed = level.commands.includes(cmd);
            return (
              <PaletteChip
                key={cmd}
                cmd={cmd}
                allowed={allowed && tab !== 'code'}
                inactive={!allowed || full}
                className={`chip tone-${meta.tone}${allowed ? '' : ' locked'}${allowed && full ? ' full' : ''}${pulse(cmd) ? ' pulse' : ''}`}
                label={allowed ? `Add ${meta.label} (tap, or drag it into the program)` : `${meta.label}, locked on this floor`}
                onClick={() => add(cmd)}
              >
                <span className="glyph" aria-hidden="true">
                  {meta.glyph}
                </span>
                <span>{meta.label}</span>
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

      {showResults && outcome?.status === 'cleared' && (
        <ResultsCard
          floorNumber={floorNumber}
          tower={level.id.startsWith('t2-') ? 2 : 1}
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
          custom={custom && { note: customNote, noPar: custom.noPar }}
          onShareImage={
            daily || custom
              ? undefined
              : async () => {
                  const card = drawShareCard({
                    title: `Floor ${floorNumber} · ${level.title}`,
                    subtitle: 'Tower 1 · Meridian Spire',
                    stars: earned,
                    band: level.band,
                    board: await snapshotBoard(),
                    code: toCode(program, routines),
                    commands: total,
                    steps: outcome.steps,
                    par: level.par,
                  });
                  const png = await canvasToBlob(card);
                  if (!png) return 'failed';
                  return shareImage(png, `I cleared Floor ${floorNumber} of LoopBot in ${total} commands. Can you do it in fewer?`, `loopbot-floor-${floorNumber}.png`);
                }
          }
          daily={
            daily && {
              date: daily.date,
              streak: daily.streak,
              froze: daily.froze,
              share: shareText(daily.date, level, earned, total, daily.streak),
            }
          }
        />
      )}
    </main>
  );
}
