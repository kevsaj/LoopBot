// The floor maker: paint a floor on a flat grid, pick the rules, test-play it, then share it as a
// code. Anyone with LoopBot can type or paste that code to play the floor.

import { useEffect, useMemo, useState } from 'react';
import { Board } from '../board/Board';
import { createWorld } from '../sim/world';
import type { Goal, PaletteCommand, Sensor } from '../sim/types';
import { fx } from '../audio/feedback';
import { COMMAND_META } from '../editor/commands';
import { shareText } from '../share';
import type { Draft, SavedFloor, Tool } from './draft';
import {
  ALL_COMMANDS,
  LOOKS,
  MAKER_SENSORS,
  MAX_SIZE,
  fromLevel,
  loadDraft,
  loadMyFloors,
  newDraft,
  paint,
  possibleGoals,
  problems,
  removeMyFloor,
  resize,
  saveDraft,
  saveMyFloor,
  toLevel,
} from './draft';
import { TITLE_MAX, decodeFloor, encodeFloor } from './shareCode';
import type { LevelFile } from '../sim/types';

interface Props {
  onBack(): void;
  /** Play a floor: the maker's own draft (test) or one from a code. */
  onPlay(level: LevelFile, from: 'test' | 'code'): void;
  /** The draft as it stands, lifted so a test clear can mark it solved. */
  draft: Draft;
  setDraft(update: (d: Draft) => Draft): void;
}

const TOOLS: { tool: Tool; label: string }[] = [
  { tool: '.', label: 'Floor' },
  { tool: '#', label: 'Wall' },
  { tool: '_', label: 'Gap' },
  { tool: 'up', label: 'Raise' },
  { tool: 'down', label: 'Lower' },
  { tool: 'bot', label: 'LoopBot' },
  { tool: 'e', label: 'Exit' },
  { tool: 'box', label: 'Box' },
  { tool: 'target', label: 'Target' },
  { tool: 's', label: 'Switch' },
  { tool: 'd', label: 'Door' },
  { tool: 'i', label: 'Ice' },
  { tool: 't', label: 'Thin ice' },
  { tool: 'r', label: 'Red' },
  { tool: 'g', label: 'Green' },
  { tool: 'b', label: 'Blue' },
  { tool: 'y', label: 'Yellow' },
];

const TOOL_TIPS: Partial<Record<Tool, string>> = {
  up: 'Tap a tile to raise it. LoopBot jumps up one level at a time.',
  down: 'Tap a tile to lower it.',
  bot: 'Tap to place LoopBot. Tap LoopBot again to turn it.',
  box: 'Tap to stack boxes: 1, 2, 3, then none.',
  target: 'Tap to set how many boxes a target needs: 1, 2, 3, then none.',
  s: 'Switches open and close every door. Activate one to flip it.',
  d: 'Doors are walls until a switch opens them.',
  i: 'LoopBot slides across ice until something stops it.',
  t: 'Thin ice holds once, then cracks into a gap.',
  r: 'Colour tiles are for "if tile is" questions.',
};

const GOAL_LABEL: Record<Goal, string> = {
  bot_on_exit: 'Reach the exit',
  all_targets_filled: 'Fill the targets',
  all_switches_on: 'Turn on every switch',
};

const SENSOR_LABEL: Record<Sensor, string> = {
  wall_ahead: 'wall ahead',
  box_ahead: 'box ahead',
  carrying: 'carrying',
  on_target: 'on target',
  on_switch: 'on switch',
  tile_is: 'tile is (colour)',
};

const ARROW = { north: '▲', east: '▶', south: '▼', west: '◀' };

export function useMakerDraft() {
  const [draft, setDraftState] = useState<Draft>(loadDraft);
  useEffect(() => saveDraft(draft), [draft]);
  return [draft, setDraftState] as const;
}

/** The preview can draw the floor once LoopBot stands on something (not a wall or a gap). */
const standable = (d: Draft) => {
  const t = d.tiles[d.bot.y]?.[d.bot.x];
  return t !== undefined && t !== '#' && t !== '_';
};

export function MakerScreen({ onBack, onPlay, draft, setDraft }: Props) {
  const [tool, setTool] = useState<Tool>('.');
  const [sheet, setSheet] = useState<'share' | 'code' | 'new' | 'mine' | null>(null);
  // Paint on the flat grid, or look at the floor as it will really appear.
  const [preview, setPreview] = useState(false);
  const previewLevel = useMemo(() => (preview && standable(draft) ? toLevel(draft) : null), [preview, draft]);
  const issues = useMemo(() => problems(draft), [draft]);
  const goals = possibleGoals(draft);
  const ready = issues.length === 0;
  const tap = (x: number, y: number) => {
    fx.tap();
    setDraft((d) => paint(d, x, y, tool));
  };
  const toggleCommand = (c: PaletteCommand) =>
    setDraft((d) => {
      let commands = d.commands.includes(c) ? d.commands.filter((v) => v !== c) : [...d.commands, c];
      if (c === 'F1' && !commands.includes('F1')) commands = commands.filter((v) => v !== 'F2'); // F2 needs F1
      if (c === 'F2' && commands.includes('F2') && !commands.includes('F1')) commands = [...commands, 'F1'];
      const slots = { ...d.slots };
      if (commands.includes('F1') && !slots.F1) slots.F1 = 4;
      if (commands.includes('F2') && !slots.F2) slots.F2 = 4;
      return { ...d, commands, slots, solved: null };
    });
  const step = (field: 'main' | 'F1' | 'F2', by: number) =>
    setDraft((d) => ({
      ...d,
      slots: {
        ...d.slots,
        [field]: Math.max(1, Math.min(field === 'main' ? 40 : 12, d.slots[field] + by)),
      },
      solved: null,
    }));
  const usesIfs = draft.commands.includes('if') || draft.commands.includes('while');
  const cell = `min(44px, calc((100vw - 48px) / ${draft.w}))`;

  return (
    <main className="maker">
      <header className="topbar">
        <div className="floor-title">
          <button type="button" className="back-btn" onClick={() => (fx.tap(), onBack())}>
            ‹ Title
          </button>
          <h1 className="floor-name">Floor maker</h1>
        </div>
        <button type="button" className="pill maker-small" onClick={() => (fx.tap(), setSheet('code'))}>
          Play a code
        </button>
      </header>

      <div className="maker-body">
        <section className="maker-canvas" aria-label="Your floor">
          <label className="maker-name">
            <span className="sr-only">Floor name</span>
            <input value={draft.title} maxLength={TITLE_MAX} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} aria-label="Floor name" />
          </label>
          <div className="mk-views" role="tablist" aria-label="View">
            <button
              type="button"
              role="tab"
              aria-selected={!preview}
              className={`mk-chip${!preview ? ' on' : ''}`}
              onClick={() => (fx.tap(), setPreview(false))}
            >
              ✎ Paint
            </button>
            <button type="button" role="tab" aria-selected={preview} className={`mk-chip${preview ? ' on' : ''}`} onClick={() => (fx.tap(), setPreview(true))}>
              ◇ 3D preview
            </button>
          </div>
          {preview ? (
            previewLevel ? (
              <div className={`board-wrap band-${draft.band} mk-preview`} key={draft.band}>
                <Board update={{ world: createWorld(previewLevel), stepMs: 0 }} rotateSignal={0} band={draft.band} />
              </div>
            ) : (
              <p className="maker-tip">LoopBot needs a floor tile to stand on before the preview can show.</p>
            )
          ) : (
            <div
              className="maker-grid"
              style={{
                gridTemplateColumns: `repeat(${draft.w}, ${cell})`,
                gridAutoRows: cell,
              }}
              role="grid"
            >
              {draft.tiles.map((row, y) =>
                row.map((t, x) => {
                  const h = draft.heights[y][x];
                  const box = draft.boxes[`${x},${y}`];
                  const target = draft.targets[`${x},${y}`];
                  const bot = draft.bot.x === x && draft.bot.y === y;
                  return (
                    <button
                      key={`${x},${y}`}
                      type="button"
                      className={`mk-cell mk-${t === '.' ? 'floor' : t === '#' ? 'wall' : t === '_' ? 'gap' : t} mk-h${h}`}
                      onClick={() => tap(x, y)}
                      aria-label={`Row ${y + 1}, column ${x + 1}`}
                    >
                      {h > 0 && <span className="mk-height">{h}</span>}
                      {target && <span className="mk-target">◎{target > 1 ? target : ''}</span>}
                      {box && <span className="mk-box">▣{box > 1 ? box : ''}</span>}
                      {bot && <span className="mk-bot">{ARROW[draft.bot.facing]}</span>}
                    </button>
                  );
                }),
              )}
            </div>
          )}
          {!preview && (
            <div className="maker-tools" role="toolbar" aria-label="Tools">
              {TOOLS.map(({ tool: t, label }) => (
                <button
                  key={t}
                  type="button"
                  className={`mk-tool mk-tool-${t === '.' ? 'floor' : t === '#' ? 'wall' : t === '_' ? 'gap' : t}${tool === t ? ' on' : ''}`}
                  aria-pressed={tool === t}
                  onClick={() => (fx.tap(), setTool(t))}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {!preview && <p className="maker-tip">{TOOL_TIPS[tool] ?? (['g', 'b', 'y'].includes(tool) ? TOOL_TIPS.r : 'Tap tiles to paint them.')}</p>}
        </section>

        <section className="maker-rules" aria-label="Rules">
          <div className="mk-row">
            <span>Size</span>
            <Stepper label="Width" value={draft.w} onChange={(w) => setDraft((d) => resize(d, w, d.h))} min={1} max={MAX_SIZE} />
            <span className="mk-x">×</span>
            <Stepper label="Depth" value={draft.h} onChange={(h) => setDraft((d) => resize(d, d.w, h))} min={1} max={MAX_SIZE} />
          </div>
          <div className="mk-row">
            <span>Look</span>
            <select value={draft.band} onChange={(e) => setDraft((d) => ({ ...d, band: e.target.value }))} aria-label="Look">
              {LOOKS.map((l) => (
                <option key={l.band} value={l.band}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div className="mk-group">
            <span>Goal</span>
            {goals.length ? (
              goals.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`mk-chip${draft.goalsOff.includes(g) ? '' : ' on'}`}
                  aria-pressed={!draft.goalsOff.includes(g)}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      goalsOff: d.goalsOff.includes(g) ? d.goalsOff.filter((v) => v !== g) : [...d.goalsOff, g],
                      solved: null,
                    }))
                  }
                >
                  {GOAL_LABEL[g]}
                </button>
              ))
            ) : (
              <em>Add an exit, a target or a switch.</em>
            )}
          </div>
          <div className="mk-group">
            <span>Commands</span>
            {ALL_COMMANDS.map((c) => (
              <button
                key={c}
                type="button"
                className={`mk-chip tone-${COMMAND_META[c].tone}${draft.commands.includes(c) ? ' on' : ''}`}
                aria-pressed={draft.commands.includes(c)}
                onClick={() => toggleCommand(c)}
              >
                {COMMAND_META[c].label}
              </button>
            ))}
          </div>
          {usesIfs && (
            <div className="mk-group">
              <span>Questions</span>
              <span className="mk-chip on fixed">wall ahead</span>
              {MAKER_SENSORS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`mk-chip${draft.sensors.includes(s) ? ' on' : ''}`}
                  aria-pressed={draft.sensors.includes(s)}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      sensors: d.sensors.includes(s) ? d.sensors.filter((v) => v !== s) : [...d.sensors, s],
                      solved: null,
                    }))
                  }
                >
                  {SENSOR_LABEL[s]}
                </button>
              ))}
            </div>
          )}
          <div className="mk-row">
            <span>Main slots</span>
            <Stepper label="Main slots" value={draft.slots.main} onChange={(v) => step('main', v - draft.slots.main)} min={1} max={40} />
          </div>
          {draft.commands.includes('F1') && (
            <div className="mk-row">
              <span>F1 slots</span>
              <Stepper label="F1 slots" value={draft.slots.F1} onChange={(v) => step('F1', v - draft.slots.F1)} min={1} max={12} />
            </div>
          )}
          {draft.commands.includes('F2') && (
            <div className="mk-row">
              <span>F2 slots</span>
              <Stepper label="F2 slots" value={draft.slots.F2} onChange={(v) => step('F2', v - draft.slots.F2)} min={1} max={12} />
            </div>
          )}

          {issues.length > 0 && (
            <ul className="maker-issues" role="status">
              {issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
          <p className="maker-status" role="status">
            {!ready
              ? 'Fix the list above, then test-play your floor.'
              : draft.solved
                ? `Cleared! Par is ${draft.solved.commands} commands and ${draft.solved.steps} steps. Ready to share.`
                : 'Clear it yourself once to share it. Your best run sets par.'}
          </p>
          <div className="maker-actions">
            <button type="button" className="pill" onClick={() => (fx.tap(), setSheet('new'))}>
              New
            </button>
            <button type="button" className="pill" onClick={() => (fx.tap(), setSheet('mine'))}>
              My floors
            </button>
          </div>
          <div className="maker-actions">
            <button type="button" className="pill primary" disabled={!ready} onClick={() => (fx.tap(), onPlay(toLevel(draft), 'test'))}>
              ▶ Test play
            </button>
            <button type="button" className="pill" disabled={!ready || !draft.solved} onClick={() => (fx.tap(), setSheet('share'))}>
              Share
            </button>
          </div>
        </section>
      </div>

      {sheet === 'share' && <ShareSheet code={encodeFloor(toLevel(draft))} title={toLevel(draft).title} par={draft.solved!} onClose={() => setSheet(null)} />}
      {sheet === 'mine' && (
        <MyFloorsSheet
          onEdit={(f) => {
            const r = decodeFloor(f.code);
            if (r.ok) setDraft(() => fromLevel(r.level));
            setSheet(null);
          }}
          onPlay={(f) => {
            const r = decodeFloor(f.code);
            if (r.ok) onPlay(r.level, 'code');
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'code' && <CodeSheet onPlay={(l) => onPlay(l, 'code')} onClose={() => setSheet(null)} />}
      {sheet === 'new' && (
        <div className="results-backdrop" onClick={() => setSheet(null)}>
          <div className="results sheet" role="dialog" aria-label="Start a new floor" onClick={(e) => e.stopPropagation()}>
            <h2>Start a new floor?</h2>
            <p>This clears the floor you're making now. Share it first if you want to keep it.</p>
            <div className="results-actions">
              <button type="button" className="pill" onClick={() => setSheet(null)}>
                Keep it
              </button>
              <button type="button" className="pill primary" onClick={() => (fx.tap(), setDraft(() => newDraft()), setSheet(null))}>
                Start over
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Stepper({ label, value, onChange, min, max }: { label: string; value: number; onChange(v: number): void; min: number; max: number }) {
  return (
    <span className="mk-stepper">
      <button type="button" aria-label={`${label} down`} disabled={value <= min} onClick={() => (fx.tap(), onChange(value - 1))}>
        −
      </button>
      <span aria-label={label}>{value}</span>
      <button type="button" aria-label={`${label} up`} disabled={value >= max} onClick={() => (fx.tap(), onChange(value + 1))}>
        +
      </button>
    </span>
  );
}

function ShareSheet({ code, title, par, onClose }: { code: string; title: string; par: { commands: number; steps: number }; onClose(): void }) {
  const [note, setNote] = useState<string | null>(null);
  // A shared floor goes in My floors, so it can be found, played or edited again later.
  useEffect(() => void saveMyFloor({ code, title, par }), [code, title, par]);
  const share = async () => {
    fx.tap();
    const r = await shareText(`Can you solve my LoopBot floor "${title}"? Open the Floor maker, tap Play a code and enter:\n${code}`);
    if (r === 'copied') setNote('Copied! Paste it anywhere.');
    else if (r === 'failed') setNote("Couldn't share from here. Copy the code by hand.");
  };
  return (
    <div className="results-backdrop" onClick={onClose}>
      <div className="results sheet" role="dialog" aria-label="Share your floor" onClick={(e) => e.stopPropagation()}>
        <h2>Share your floor</h2>
        <p>Anyone with LoopBot can play it: Floor maker, then Play a code.</p>
        <p className="maker-code" aria-label="Floor code">
          {code}
        </p>
        {note && <p className="tip">{note}</p>}
        <div className="results-actions">
          <button type="button" className="pill" onClick={onClose}>
            Close
          </button>
          <button type="button" className="pill primary" onClick={() => void share()}>
            Share code
          </button>
        </div>
      </div>
    </div>
  );
}

function CodeSheet({ onPlay, onClose }: { onPlay(l: LevelFile): void; onClose(): void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const play = () => {
    // Pull the code out of a whole pasted message ("Can you solve ... LBF1-...").
    const found = text.toUpperCase().match(/LBF1[-\s0-9A-Z]*/);
    const r = decodeFloor(found ? found[0] : text);
    if (!r.ok) {
      fx.denied();
      setError(r.error);
      return;
    }
    fx.tap();
    onPlay(r.level);
  };
  return (
    <div className="results-backdrop" onClick={onClose}>
      <div className="results sheet" role="dialog" aria-label="Play a floor code" onClick={(e) => e.stopPropagation()}>
        <h2>Play a floor code</h2>
        <p>Paste or type a code a friend sent you. It starts with LBF1.</p>
        <textarea
          className="maker-input"
          rows={3}
          value={text}
          onChange={(e) => (setText(e.target.value), setError(null))}
          placeholder="LBF1-..."
          aria-label="Floor code"
          autoCapitalize="characters"
          spellCheck={false}
        />
        {error && (
          <p className="maker-error" role="alert">
            {error}
          </p>
        )}
        <div className="results-actions">
          <button type="button" className="pill" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="pill primary" disabled={!text.trim()} onClick={play}>
            Play
          </button>
        </div>
      </div>
    </div>
  );
}

function MyFloorsSheet({ onEdit, onPlay, onClose }: { onEdit(f: SavedFloor): void; onPlay(f: SavedFloor): void; onClose(): void }) {
  const [list, setList] = useState(loadMyFloors);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className="results-backdrop" onClick={onClose}>
      <div className="results sheet mk-mine" role="dialog" aria-label="My floors" onClick={(e) => e.stopPropagation()}>
        <h2>My floors</h2>
        {list.length === 0 ? (
          <p>Floors you share show up here, so you can play, edit or send them again.</p>
        ) : (
          <ul className="mk-list">
            {list.map((f) => (
              <li key={f.code}>
                <div className="mk-list-name">
                  <strong>{f.title}</strong>
                  <span>
                    par {f.par.commands} commands · {f.par.steps} steps
                  </span>
                </div>
                <div className="mk-list-actions">
                  <button type="button" className="mk-chip on" onClick={() => (fx.tap(), onPlay(f))}>
                    Play
                  </button>
                  <button type="button" className="mk-chip on" onClick={() => (fx.tap(), onEdit(f))}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="mk-chip on"
                    onClick={async () => {
                      fx.tap();
                      const r = await shareText(`Can you solve my LoopBot floor "${f.title}"? Open the Floor maker, tap Play a code and enter:\n${f.code}`);
                      setNote(r === 'copied' ? 'Copied! Paste it anywhere.' : r === 'failed' ? "Couldn't share from here." : null);
                    }}
                  >
                    Share
                  </button>
                  <button
                    type="button"
                    className={`mk-chip${confirm === f.code ? ' on danger' : ''}`}
                    aria-label={confirm === f.code ? `Tap again to delete ${f.title}` : `Delete ${f.title}`}
                    onClick={() => {
                      fx.tap();
                      if (confirm !== f.code) return setConfirm(f.code);
                      setList(removeMyFloor(f.code));
                      setConfirm(null);
                    }}
                  >
                    {confirm === f.code ? 'Delete?' : '✕'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {note && <p className="tip">{note}</p>}
        <div className="results-actions">
          <button type="button" className="pill" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
