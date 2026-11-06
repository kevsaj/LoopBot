// The floor screen: board on top, program below (see "Floor screen sketch" in the doc).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LevelFile, PaletteCommand, Routine, World } from '../sim/types';
import { FUNCTION_NAMES } from '../sim/types';
import { Runner } from '../sim/interpreter';
import type { Outcome } from '../sim/interpreter';
import { createWorld } from '../sim/world';
import { countCommands, makeBlock } from '../sim/program';
import type { Block } from '../sim/types';
import { useEditor } from './useEditor';
import { ProgramList } from './ProgramList';
import { EditorDnd, PaletteChip } from './dnd';
import { CodeView } from './CodeView';
import { Terminal } from './Terminal';
import { COMMAND_META, PALETTE_ORDER, blockCommand } from './commands';
import { Board } from '../board/Board';
import type { BoardUpdate } from '../board/BoardScene';
import { fx } from '../audio/feedback';
import { SettingsSheet } from '../SettingsSheet';
import type { Progress } from '../progress';
import { recordClear, recordFail } from '../progress';
import { HintSheet } from './HintSheet';
import { tutorialStep, TUTORIAL_TEXT } from './tutorial';

const SPEEDS = [
  { label: '1x', ms: 520 },
  { label: '2x', ms: 260 },
  { label: '4x', ms: 130 },
];

interface Props {
  level: LevelFile;
  floorNumber: number;
  floorCount: number;
  progress: Progress;
  setProgress(update: (p: Progress) => Progress): void;
  onGo(index: number): void;
  onTower(): void;
}

export function stars(level: LevelFile, commands: number, steps: number) {
  if (commands <= level.par.commands && steps <= level.par.steps) return 3;
  if (commands <= level.par.commands) return 2;
  return 1;
}

export function FloorScreen({ level, floorNumber, floorCount, progress, setProgress, onGo, onTower }: Props) {
  const editor = useEditor(level.id);
  const { program } = editor.state;
  const routines = useMemo(
    () => (['main', ...FUNCTION_NAMES] as Routine[]).filter((r) => (level.slots[r] ?? 0) > 0),
    [level],
  );
  // The program tab being edited, and whether the read-only code view is showing over it.
  const [routine, setRoutine] = useState<Routine>('main');
  const [showCode, setShowCode] = useState(false);
  const tab: Routine | 'code' = showCode ? 'code' : routine;

  // --- run state ---
  const runner = useRef<Runner | null>(null);
  const [board, setBoard] = useState<BoardUpdate>(() => ({ world: createWorld(level), stepMs: 0 }));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [steps, setSteps] = useState(0);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [crashId, setCrashId] = useState<string | null>(null);
  const [terminal, setTerminal] = useState<string>(level.story.intro ?? '> ready');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [rotateSignal, setRotateSignal] = useState(0);
  const [sheet, setSheet] = useState<'hints' | 'settings' | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const reset = useCallback(
    (quiet = false) => {
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
  useEffect(() => {
    if (programRef.current !== program) {
      programRef.current = program;
      if (runner.current) reset(true);
    }
  }, [program, reset]);

  const stepOnce = useCallback(() => {
    if (!runner.current || runner.current.done) {
      runner.current = new Runner(program, level);
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
    }
    const o = r.outcome;
    setBoard({ world, action: ev?.action, crashed: o?.status === 'crashed', cleared: o?.status === 'cleared', stepMs: SPEEDS[speed].ms });
    if (o) {
      setPlaying(false);
      setOutcome(o);
      if (o.status === 'crashed') {
        setCrashId(o.blockId);
        setTerminal(o.error);
        fx.crash();
        setProgress((p) => recordFail(p, level.id));
      } else if (o.status === 'cleared') {
        const s = stars(level, countCommands(program), o.steps);
        setTerminal(`> floor cleared in ${o.steps} steps`);
        fx.win();
        setProgress((p) => recordClear(p, level.id, s));
        window.setTimeout(() => setShowResults(true), SPEEDS[speed].ms + 900); // let the light-up wave play first
      } else {
        setActiveIds(new Set());
        setTerminal(`> program ended after ${o.steps} steps. Not there yet: add more commands.`);
        fx.denied();
        setProgress((p) => recordFail(p, level.id));
      }
    } else if (!ev) {
      setPlaying(false);
    }
  }, [program, level, speed, setProgress]);

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
  const full = list.length >= limit;
  const [deleted, setDeleted] = useState<{ r: Routine; index: number; block: Block } | null>(null);
  const deletedTimer = useRef<number | undefined>(undefined);
  const [confirmClear, setConfirmClear] = useState(false);

  const canAdd = (cmd: PaletteCommand) => {
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
    return true;
  };
  const add = (cmd: PaletteCommand) => {
    if (!canAdd(cmd)) return;
    editor.insert(routine, cmd);
    fx.snap();
  };
  // Dragged in from the palette: lands where it was dropped.
  const drop = (cmd: PaletteCommand, index: number) => {
    editor.restore(routine, index, makeBlock(cmd));
    fx.snap();
  };

  const del = (index: number) => {
    const block = list[index];
    editor.remove(routine, index);
    fx.remove();
    setDeleted({ r: routine, index, block });
    window.clearTimeout(deletedTimer.current);
    deletedTimer.current = window.setTimeout(() => setDeleted(null), 4000); // ED-3
  };

  const undoDelete = () => {
    if (!deleted) return;
    editor.restore(deleted.r, deleted.index, deleted.block);
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
      const mod = e.ctrlKey || e.metaKey;
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

  const palette = [...PALETTE_ORDER, ...FUNCTION_NAMES.filter((f) => (level.slots[f] ?? 0) > 0)];
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
  const pulse = (cmd: PaletteCommand) =>
    (tut === 'tap' && cmd === 'forward') || (tut === 'turn' && (cmd === 'turn_left' || cmd === 'turn_right'));

  return (
    <div className="floor">
      <header className="topbar">
        <div className="floor-title">
          <button type="button" className="back-btn" onClick={() => (fx.tap(), onTower())} aria-label="Back to the tower map">
            ‹ Tower · Floor {floorNumber}
          </button>
          <span className="floor-name">{level.title}</span>
        </div>
        {level.hints.length > 0 && (
          <button type="button" className="hint-btn" onClick={() => (fx.tap(), setSheet('hints'))} aria-label={`Hint, ${progress.hints} left`}>
            Hint <span className="hint-count">{progress.hints}</span>
          </button>
        )}
        <button type="button" className="icon-btn" aria-label="Settings" onClick={() => (fx.tap(), setSheet('settings'))}>
          ⚙
        </button>
      </header>

      <section className="board-wrap">
        <Board update={board} rotateSignal={rotateSignal} />
        <div className="step-counter" aria-live="polite">
          <span>
            {total} / {Object.values(level.slots).reduce((a, b) => a + (b ?? 0), 0)} commands · par {level.par.commands}
          </span>
          <span>step {steps}</span>
        </div>
        <button type="button" className="rotate-btn" onClick={() => (fx.tap(), setRotateSignal((n) => n + 1))} aria-label="Turn the board 90 degrees">
          ⟲ Turn 90
        </button>
        <Terminal text={terminal} status={status} />
      </section>

      <section className="editor">
        <EditorDnd blocks={list} canAdd={canAdd} onDrop={drop} onMove={(from, to) => editor.move(routine, from, to)}>
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

        <div className="tabs" role="tablist">
          {routines.map((r) => (
            <button key={r} type="button" role="tab" aria-selected={tab === r} className={`tab${tab === r ? ' on' : ''}`} onClick={() => (fx.tap(), setShowCode(false), setRoutine(r))}>
              {r === 'main' ? 'Main' : r}
            </button>
          ))}
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
          <button type="button" role="tab" aria-selected={tab === 'code'} className={`tab${tab === 'code' ? ' on' : ''}`} onClick={() => (fx.tap(), setShowCode((v) => !v))}
            aria-label={showCode ? 'Code (tap again to go back to the program)' : 'Code'}>
            Code
          </button>
        </div>

        <div className="program-wrap">
          {tut && (
            <div className={`tutorial-bubble tut-${tut}`} role="status">
              {TUTORIAL_TEXT[tut]}
            </div>
          )}
          {tab === 'code' ? (
            <CodeView program={program} routines={routines} activeIds={activeIds} crashId={crashId} />
          ) : (
            <ProgramList
              blocks={list}
              limit={limit}
              cursor={editor.state.cursor[routine] ?? null}
              activeIds={activeIds}
              crashId={crashId}
              onTap={(i) => {
                fx.tap();
                editor.setCursor(routine, i + 1 >= list.length ? null : i + 1);
              }}
              onTapEnd={() => {
                fx.tap();
                editor.setCursor(routine, null);
              }}
              onDelete={del}
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

      {sheet === 'hints' && <HintSheet level={level} progress={progress} setProgress={setProgress} onClose={() => setSheet(null)} />}

      {sheet === 'settings' && <SettingsSheet progress={progress} setProgress={setProgress} onClose={() => setSheet(null)} />}

      {showResults && outcome?.status === 'cleared' && (
        <div className="results-backdrop" onClick={() => setShowResults(false)}>
          <div className="results" role="dialog" aria-label="Floor cleared" onClick={(e) => e.stopPropagation()}>
            <h2>Floor {floorNumber} cleared</h2>
            <div className="stars" aria-label={`${earned} of 3 stars`}>
              {[1, 2, 3].map((i) => (
                <span key={i} className={i <= earned ? 'star on' : 'star'}>
                  ★
                </span>
              ))}
            </div>
            <table className="score">
              <tbody>
                <tr>
                  <td>Commands</td>
                  <td>{total}</td>
                  <td className="par">par {level.par.commands}</td>
                </tr>
                <tr>
                  <td>Steps</td>
                  <td>{outcome.steps}</td>
                  <td className="par">par {level.par.steps}</td>
                </tr>
              </tbody>
            </table>
            {earned < 3 && <p className="tip">Fewer commands = more stars.</p>}
            {level.story.outro && <p className="story">{level.story.outro}</p>}
            <div className="results-actions">
              <button type="button" className="pill" onClick={() => (fx.tap(), reset())}>
                Try again
              </button>
              {floorNumber === floorCount && (
                <button type="button" className="pill primary" onClick={() => (fx.tap(), onTower())}>
                  Tower
                </button>
              )}
              {floorNumber < floorCount && (
                <button type="button" className="pill primary" onClick={() => (fx.tap(), onGo(floorNumber))}>
                  Next floor →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
