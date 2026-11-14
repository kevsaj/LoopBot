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
import { msg, t } from '../i18n';

interface Props {
  onBack(): void;
  /** Play a floor: the maker's own draft (test) or one from a code. */
  onPlay(level: LevelFile, from: 'test' | 'code'): void;
  /** The draft as it stands, lifted so a test clear can mark it solved. */
  draft: Draft;
  setDraft(update: (d: Draft) => Draft): void;
}

const TOOLS: { tool: Tool; label: string }[] = [
  { tool: '.', label: msg('Floor') },
  { tool: '#', label: msg('Wall') },
  { tool: '_', label: msg('Gap') },
  { tool: 'up', label: msg('Raise') },
  { tool: 'down', label: msg('Lower') },
  { tool: 'bot', label: msg('LoopBot') },
  { tool: 'e', label: msg('Exit') },
  { tool: 'box', label: msg('Box') },
  { tool: 'target', label: msg('Target') },
  { tool: 's', label: msg('Switch') },
  { tool: 'd', label: msg('Door') },
  { tool: 'i', label: msg('Ice') },
  { tool: 't', label: msg('Thin ice') },
  { tool: 'r', label: msg('Red') },
  { tool: 'g', label: msg('Green') },
  { tool: 'b', label: msg('Blue') },
  { tool: 'y', label: msg('Yellow') },
];

const TOOL_TIPS: Partial<Record<Tool, string>> = {
  up: msg('Tap a tile to raise it. LoopBot jumps up one level at a time.'),
  down: msg('Tap a tile to lower it.'),
  bot: msg('Tap to place LoopBot. Tap LoopBot again to turn it.'),
  box: msg('Tap to stack boxes: 1, 2, 3, then none.'),
  target: msg('Tap to set how many boxes a target needs: 1, 2, 3, then none.'),
  s: msg('Switches open and close every door. Activate one to flip it.'),
  d: msg('Doors are walls until a switch opens them.'),
  i: msg('LoopBot slides across ice until something stops it.'),
  t: msg('Thin ice holds once, then cracks into a gap.'),
  r: msg('Colour tiles are for "if tile is" questions.'),
};

const GOAL_LABEL: Record<Goal, string> = {
  bot_on_exit: msg('Reach the exit'),
  all_targets_filled: msg('Fill the targets'),
  all_switches_on: msg('Turn on every switch'),
};

const SENSOR_LABEL: Record<Sensor, string> = {
  wall_ahead: msg('wall ahead'),
  box_ahead: msg('box ahead'),
  carrying: msg('carrying'),
  on_target: msg('on target'),
  on_switch: msg('on switch'),
  tile_is: msg('tile is (colour)'),
  heat_ahead: msg('heat ahead'),
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
            ‹ {t('Title')}
          </button>
          <h1 className="floor-name">{t('Floor maker')}</h1>
        </div>
        <button type="button" className="pill maker-small" onClick={() => (fx.tap(), setSheet('code'))}>
          {t('Play a code')}
        </button>
      </header>

      <div className="maker-body">
        <section className="maker-canvas" aria-label={t('Your floor')}>
          <label className="maker-name">
            <span className="sr-only">{t('Floor name')}</span>
            <input value={draft.title} maxLength={TITLE_MAX} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} aria-label={t('Floor name')} />
          </label>
          <div className="mk-views" role="tablist" aria-label={t('View')}>
            <button
              type="button"
              role="tab"
              aria-selected={!preview}
              className={`mk-chip${!preview ? ' on' : ''}`}
              onClick={() => (fx.tap(), setPreview(false))}
            >
              ✎ {t('Paint')}
            </button>
            <button type="button" role="tab" aria-selected={preview} className={`mk-chip${preview ? ' on' : ''}`} onClick={() => (fx.tap(), setPreview(true))}>
              ◇ {t('3D preview')}
            </button>
          </div>
          {preview ? (
            previewLevel ? (
              <div className={`board-wrap band-${draft.band} mk-preview`} key={draft.band}>
                <Board update={{ world: createWorld(previewLevel), stepMs: 0 }} rotateSignal={0} band={draft.band} />
              </div>
            ) : (
              <p className="maker-tip">{t('LoopBot needs a floor tile to stand on before the preview can show.')}</p>
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
                row.map((tile, x) => {
                  const h = draft.heights[y][x];
                  const box = draft.boxes[`${x},${y}`];
                  const target = draft.targets[`${x},${y}`];
                  const bot = draft.bot.x === x && draft.bot.y === y;
                  return (
                    <button
                      key={`${x},${y}`}
                      type="button"
                      className={`mk-cell mk-${tile === '.' ? 'floor' : tile === '#' ? 'wall' : tile === '_' ? 'gap' : tile} mk-h${h}`}
                      onClick={() => tap(x, y)}
                      aria-label={t('Row {row}, column {col}', { row: y + 1, col: x + 1 })}
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
            <div className="maker-tools" role="toolbar" aria-label={t('Tools')}>
              {TOOLS.map(({ tool: tl, label }) => (
                <button
                  key={tl}
                  type="button"
                  className={`mk-tool mk-tool-${tl === '.' ? 'floor' : tl === '#' ? 'wall' : tl === '_' ? 'gap' : tl}${tool === tl ? ' on' : ''}`}
                  aria-pressed={tool === tl}
                  onClick={() => (fx.tap(), setTool(tl))}
                >
                  {t(label)}
                </button>
              ))}
            </div>
          )}
          {!preview && <p className="maker-tip">{t(TOOL_TIPS[tool] ?? (['g', 'b', 'y'].includes(tool) ? TOOL_TIPS.r! : 'Tap tiles to paint them.'))}</p>}
        </section>

        <section className="maker-rules" aria-label={t('Rules')}>
          <div className="mk-row">
            <span>{t('Size')}</span>
            <Stepper label={t('Width')} value={draft.w} onChange={(w) => setDraft((d) => resize(d, w, d.h))} min={1} max={MAX_SIZE} />
            <span className="mk-x">×</span>
            <Stepper label={t('Depth')} value={draft.h} onChange={(h) => setDraft((d) => resize(d, d.w, h))} min={1} max={MAX_SIZE} />
          </div>
          <div className="mk-row">
            <span>{t('Look')}</span>
            <select value={draft.band} onChange={(e) => setDraft((d) => ({ ...d, band: e.target.value }))} aria-label={t('Look')}>
              {LOOKS.map((l) => (
                <option key={l.band} value={l.band}>
                  {t(l.label)}
                </option>
              ))}
            </select>
          </div>
          <div className="mk-group">
            <span>{t('Goal')}</span>
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
                  {t(GOAL_LABEL[g])}
                </button>
              ))
            ) : (
              <em>{t('Add an exit, a target or a switch.')}</em>
            )}
          </div>
          <div className="mk-group">
            <span>{t('Commands')}</span>
            {ALL_COMMANDS.map((c) => (
              <button
                key={c}
                type="button"
                className={`mk-chip tone-${COMMAND_META[c].tone}${draft.commands.includes(c) ? ' on' : ''}`}
                aria-pressed={draft.commands.includes(c)}
                onClick={() => toggleCommand(c)}
              >
                {t(COMMAND_META[c].label)}
              </button>
            ))}
          </div>
          {usesIfs && (
            <div className="mk-group">
              <span>{t('Questions')}</span>
              <span className="mk-chip on fixed">{t('wall ahead')}</span>
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
                  {t(SENSOR_LABEL[s])}
                </button>
              ))}
            </div>
          )}
          <div className="mk-row">
            <span>{t('Main slots')}</span>
            <Stepper label={t('Main slots')} value={draft.slots.main} onChange={(v) => step('main', v - draft.slots.main)} min={1} max={40} />
          </div>
          {draft.commands.includes('F1') && (
            <div className="mk-row">
              <span>{t('{name} slots', { name: 'F1' })}</span>
              <Stepper label={t('{name} slots', { name: 'F1' })} value={draft.slots.F1} onChange={(v) => step('F1', v - draft.slots.F1)} min={1} max={12} />
            </div>
          )}
          {draft.commands.includes('F2') && (
            <div className="mk-row">
              <span>{t('{name} slots', { name: 'F2' })}</span>
              <Stepper label={t('{name} slots', { name: 'F2' })} value={draft.slots.F2} onChange={(v) => step('F2', v - draft.slots.F2)} min={1} max={12} />
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
              ? t('Fix the list above, then test-play your floor.')
              : draft.solved
                ? t('Cleared! Par is {commands} commands and {steps} steps. Ready to share.', { commands: draft.solved.commands, steps: draft.solved.steps })
                : t('Clear it yourself once to share it. Your best run sets par.')}
          </p>
          <div className="maker-actions">
            <button type="button" className="pill" onClick={() => (fx.tap(), setSheet('new'))}>
              {t('New')}
            </button>
            <button type="button" className="pill" onClick={() => (fx.tap(), setSheet('mine'))}>
              {t('My floors')}
            </button>
          </div>
          <div className="maker-actions">
            <button type="button" className="pill primary" disabled={!ready} onClick={() => (fx.tap(), onPlay(toLevel(draft), 'test'))}>
              ▶ {t('Test play')}
            </button>
            <button type="button" className="pill" disabled={!ready || !draft.solved} onClick={() => (fx.tap(), setSheet('share'))}>
              {t('Share')}
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
          <div className="results sheet" role="dialog" aria-label={t('Start a new floor')} onClick={(e) => e.stopPropagation()}>
            <h2>{t('Start a new floor?')}</h2>
            <p>{t("This clears the floor you're making now. Share it first if you want to keep it.")}</p>
            <div className="results-actions">
              <button type="button" className="pill" onClick={() => setSheet(null)}>
                {t('Keep it')}
              </button>
              <button type="button" className="pill primary" onClick={() => (fx.tap(), setDraft(() => newDraft()), setSheet(null))}>
                {t('Start over')}
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
      <button type="button" aria-label={t('{name} down', { name: label })} disabled={value <= min} onClick={() => (fx.tap(), onChange(value - 1))}>
        −
      </button>
      <span aria-label={label}>{value}</span>
      <button type="button" aria-label={t('{name} up', { name: label })} disabled={value >= max} onClick={() => (fx.tap(), onChange(value + 1))}>
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
    const r = await shareText(t('Can you solve my LoopBot floor "{title}"? Open the Floor maker, tap Play a code and enter:', { title }) + `\n${code}`);
    if (r === 'copied') setNote(t('Copied! Paste it anywhere.'));
    else if (r === 'failed') setNote(t("Couldn't share from here. Copy the code by hand."));
  };
  return (
    <div className="results-backdrop" onClick={onClose}>
      <div className="results sheet" role="dialog" aria-label={t('Share your floor')} onClick={(e) => e.stopPropagation()}>
        <h2>{t('Share your floor')}</h2>
        <p>{t('Anyone with LoopBot can play it: Floor maker, then Play a code.')}</p>
        <p className="maker-code" aria-label={t('Floor code')}>
          {code}
        </p>
        {note && <p className="tip">{note}</p>}
        <div className="results-actions">
          <button type="button" className="pill" onClick={onClose}>
            {t('Close')}
          </button>
          <button type="button" className="pill primary" onClick={() => void share()}>
            {t('Share code')}
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
      setError(t(r.error));
      return;
    }
    fx.tap();
    onPlay(r.level);
  };
  return (
    <div className="results-backdrop" onClick={onClose}>
      <div className="results sheet" role="dialog" aria-label={t('Play a floor code')} onClick={(e) => e.stopPropagation()}>
        <h2>{t('Play a floor code')}</h2>
        <p>{t('Paste or type a code a friend sent you. It starts with LBF1.')}</p>
        <textarea
          className="maker-input"
          rows={3}
          value={text}
          onChange={(e) => (setText(e.target.value), setError(null))}
          placeholder="LBF1-..."
          aria-label={t('Floor code')}
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
            {t('Cancel')}
          </button>
          <button type="button" className="pill primary" disabled={!text.trim()} onClick={play}>
            {t('Play')}
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
      <div className="results sheet mk-mine" role="dialog" aria-label={t('My floors')} onClick={(e) => e.stopPropagation()}>
        <h2>{t('My floors')}</h2>
        {list.length === 0 ? (
          <p>{t('Floors you share show up here, so you can play, edit or send them again.')}</p>
        ) : (
          <ul className="mk-list">
            {list.map((f) => (
              <li key={f.code}>
                <div className="mk-list-name">
                  <strong>{f.title}</strong>
                  <span>
                    {t('par {commands} commands · {steps} steps', { commands: f.par.commands, steps: f.par.steps })}
                  </span>
                </div>
                <div className="mk-list-actions">
                  <button type="button" className="mk-chip on" onClick={() => (fx.tap(), onPlay(f))}>
                    {t('Play')}
                  </button>
                  <button type="button" className="mk-chip on" onClick={() => (fx.tap(), onEdit(f))}>
                    {t('Edit')}
                  </button>
                  <button
                    type="button"
                    className="mk-chip on"
                    onClick={async () => {
                      fx.tap();
                      const r = await shareText(t('Can you solve my LoopBot floor "{title}"? Open the Floor maker, tap Play a code and enter:', { title: f.title }) + `\n${f.code}`);
                      setNote(r === 'copied' ? t('Copied! Paste it anywhere.') : r === 'failed' ? t("Couldn't share from here.") : null);
                    }}
                  >
                    {t('Share')}
                  </button>
                  <button
                    type="button"
                    className={`mk-chip${confirm === f.code ? ' on danger' : ''}`}
                    aria-label={confirm === f.code ? t('Tap again to delete {title}', { title: f.title }) : t('Delete {title}', { title: f.title })}
                    onClick={() => {
                      fx.tap();
                      if (confirm !== f.code) return setConfirm(f.code);
                      setList(removeMyFloor(f.code));
                      setConfirm(null);
                    }}
                  >
                    {confirm === f.code ? t('Delete?') : '✕'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {note && <p className="tip">{note}</p>}
        <div className="results-actions">
          <button type="button" className="pill" onClick={onClose}>
            {t('Close')}
          </button>
        </div>
      </div>
    </div>
  );
}
