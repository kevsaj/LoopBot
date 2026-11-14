// The tower map: home after the first floor (doc: "Screens and flows").
// Floors stack bottom to top like the building; cleared floors light up.
// LoopBot stands on the floor you're on, newly opened floors unlock with a pop,
// and a locked floor shakes and says what opens it.

import { useEffect, useRef, useState } from 'react';
import { AntennaTip } from './rewards/AntennaTip';
import type { LevelFile } from './sim/types';
import type { Progress } from './progress';
import { isUnlocked } from './progress';
import { fx } from './audio/feedback';
import { DEMO } from './demo';
import { DailyButton } from './daily/DailyButton';
import type { DailyState } from './daily';
import type { Tower } from './levels/towers';
import { PLUS_VISIBLE, STORE_AVAILABLE, plusUnlocked, towerUnlocked } from './store/purchases';
import { dailyUnlocked } from './daily';
import { PlusSheet } from './store/PlusSheet';
import { PackSheet } from './store/PackSheet';
import type { PackId } from './store/packs';
import './heatwave.css';
import { msg, t, t as tr, tn } from './i18n';

interface Props {
  levels: LevelFile[];
  /** The tower shown, its number, and every tower for the switcher. */
  tower: number;
  towers: Tower[];
  onTowerPick(n: number): void;
  progress: Progress;
  current: number;
  onPick(index: number): void;
  onSettings(): void;
  onHome(): void;
  daily: DailyState;
  onDaily(): void;
  /** Opens the daily archive (LoopBot Plus). */
  onArchive(): void;
  onLocker(): void;
  lockerNew: boolean;
}

const SEEN_KEY = 'loopbot.seenUnlocked';

/** Display names for the bands of each tower (doc: Bands table). */
const BAND_NAMES: Record<string, string> = {
  lobby: msg('The Lobby'),
  maintenance: msg('Maintenance'),
  workshop: msg('Workshop'),
  control: msg('Control Room'),
  rooftop: msg('Rooftop'),
  frostgate: msg('The Frost Gate'),
  glacier: msg('Glacier Yard'),
  signal: msg('Signal Hut'),
  aurora: msg('Aurora Lab'),
  summit: msg('The Summit'),
  dunegate: msg('The Dune Gate'),
  furnace: msg('Furnace Hall'),
  bazaar: msg('Sky Bazaar'),
  mirage: msg('Mirage Lab'),
  crown: msg('The Crown'),
};

/** What lies under each tower, shown at the foot of its map. */
const GROUND: Record<number, string> = { 1: msg('Sub-basement'), 2: msg('Ice cellar'), 3: msg('Old cistern') };

/** Each tower's own light, used for its beacon and its row in the tower picker. */
const TOWER_LIGHT: Record<number, string> = { 1: '#7cc4ff', 2: '#9fd8ff', 3: '#ffb466', 4: '#7fd6c8' };

/** The towers the picker lists. A Plus tower only shows once Plus is on sale, or while previewing it. */
function pickable(towers: Tower[]): Tower[] {
  return towers.filter((t) => !t.plus || PLUS_VISIBLE || plusUnlocked());
}

/** Floors cleared in a tower (stars are kept by floor id, so this works for any tower). */
function clearedIn(t: Tower, progress: Progress): number {
  return t.levels.filter((l) => (progress.stars[l.id] ?? 0) > 0).length;
}

/**
 * The tower picker: a drop-down showing the tower you're in by its full name, opening onto every
 * tower with its progress, or a lock and what opens it (LoopBot Plus or a city pack). It replaces a
 * row of tabs that had no room left on phones, and a list scales as more cities arrive.
 */
function TowerSwitch({ tower, towers, progress, onPick, onLocked }: { tower: number; towers: Tower[]; progress: Progress; onPick(n: number): void; onLocked(t: Tower): void }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // (A city pack tower is only in the list at all in preview builds and store builds: see levels/towers.ts.)
  const shown = pickable(towers);

  useEffect(() => {
    if (!open) return;
    // Opening moves focus onto the tower you're in, so the arrow keys and a screen reader start there.
    listRef.current?.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const items = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('.tp-row') ?? [])];
      const at = items.indexOf(document.activeElement as HTMLButtonElement);
      items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (shown.length < 2) return null;
  const here = shown.find((t) => t.n === tower) ?? shown[0];
  // Plain rgba rather than CSS color-mix(), which older Android WebViews don't have.
  const light = (t: Tower) => {
    const hex = TOWER_LIGHT[t.n] ?? TOWER_LIGHT[1];
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return { ['--tp-light' as string]: hex, ['--tp-soft' as string]: `rgba(${r}, ${g}, ${b}, 0.16)`, ['--tp-glow' as string]: `rgba(${r}, ${g}, ${b}, 0.45)` };
  };
  const toggle = () => {
    fx.tap();
    setOpen((o) => !o);
  };

  return (
    <div className={`tower-picker${open ? ' open' : ''}`}>
      {open && <div className="tp-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <button
        ref={triggerRef}
        type="button"
        className="tp-trigger"
        style={light(here)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('Tower {n}, {name}. Change tower', { n: here.n, name: tr(here.name) })}
        onClick={toggle}
      >
        <span className="tp-badge" aria-hidden="true">
          {here.n}
        </span>
        <span className="tp-text">
          <span className="tp-kicker">
            {tr('Tower {n}', { n: here.n })} · {here.city}
          </span>
          <span className="tp-name">{tr(here.name)}</span>
        </span>
        <span className="tp-change" aria-hidden="true">
          <span className="tp-change-label">{t('Change')}</span>
          <svg className="tp-chevron" viewBox="0 0 16 16">
            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open && (
        <div ref={listRef} className="tp-list" role="menu" aria-label={t('Towers')}>
          {shown.map((x) => {
            const locked = !towerUnlocked(x);
            const isHere = x.n === tower;
            const done = clearedIn(x, progress);
            const total = x.levels.length;
            const opens = x.pack ? tr('{city} city pack', { city: x.city }) : 'LoopBot Plus';
            return (
              <button
                key={x.n}
                type="button"
                role="menuitem"
                className={`tp-row${isHere ? ' here' : ''}${locked ? ' locked' : ''}`}
                style={light(x)}
                aria-current={isHere ? 'true' : undefined}
                aria-label={
                  locked
                    ? t('Tower {n}, {name}, locked: comes with {what}', { n: x.n, name: tr(x.name), what: opens })
                    : t('Tower {n}, {name}, {done} of {total} floors cleared', { n: x.n, name: tr(x.name), done, total })
                }
                onClick={() => {
                  setOpen(false);
                  if (isHere) return fx.tap();
                  if (locked) return onLocked(x);
                  fx.tap();
                  onPick(x.n);
                }}
              >
                <span className="tp-badge" aria-hidden="true">
                  {x.n}
                </span>
                <span className="tp-text">
                  <span className="tp-name">{tr(x.name)}</span>
                  <span className="tp-sub">{locked ? `${x.city} · ${x.pack ? tr('City pack') : 'LoopBot Plus'}` : `${x.city} · ${tr('{n} / {total} floors', { n: done, total })}`}</span>
                </span>
                <span className="tp-state" aria-hidden="true">
                  {locked ? (
                    <svg className="tp-lock" viewBox="0 0 16 18">
                      <path d="M4 8V5.5a4 4 0 0 1 8 0V8" fill="none" stroke="currentColor" strokeWidth="2" />
                      <rect x="2" y="8" width="12" height="9" rx="2" fill="currentColor" />
                    </svg>
                  ) : isHere ? (
                    <svg className="tp-check" viewBox="0 0 16 16">
                      <path d="M3 8.5l3.2 3.2L13 5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <span className="tp-go">›</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Splits the floors into their bands, in play order. */
function bandsOf(levels: LevelFile[]) {
  const bands: { key: string; first: number; last: number; floors: number[] }[] = [];
  levels.forEach((l, i) => {
    const last = bands[bands.length - 1];
    if (last && last.key === l.band) {
      last.last = i;
      last.floors.push(i);
    } else bands.push({ key: l.band, first: i, last: i, floors: [i] });
  });
  return bands;
}

const seenKey = (tower: number) => (tower === 1 ? SEEN_KEY : `${SEEN_KEY}.t${tower}`);

function readSeen(tower: number): number {
  try {
    const n = Number(localStorage.getItem(seenKey(tower)));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** LoopBot in miniature, drawn in code like the board art. */
export function MiniBot() {
  return (
    <svg className="mini-bot" viewBox="0 0 24 28" aria-hidden="true">
      <line x1="12" y1="2.5" x2="12" y2="6" stroke="var(--bot-right, #cfc6b4)" strokeWidth="1.4" />
      <AntennaTip cx={12} cy={2.2} r={1.9} />
      <rect x="5" y="6" width="14" height="9" rx="2.5" style={{ fill: 'var(--bot-top, #f3ecdf)' }} />
      <rect x="8" y="8.5" width="9" height="4.2" rx="2" fill="#2b2440" />
      <circle cx="14" cy="10.6" r="1.3" style={{ fill: 'var(--bot-eye, #7ff2e0)' }} />
      <rect x="4" y="16" width="16" height="9" rx="2.5" style={{ fill: 'var(--bot-left, #e6dccb)' }} />
      <rect x="7" y="25" width="3" height="2.5" rx="1" fill="#b9ad98" />
      <rect x="14" y="25" width="3" height="2.5" rx="1" fill="#b9ad98" />
    </svg>
  );
}

export function TowerMap({ levels, tower, towers, onTowerPick, progress, current, onPick, onSettings, onHome, daily, onDaily, onArchive, onLocker, lockerNew }: Props) {
  const ids = levels.map((l) => l.id);
  const totalStars = ids.reduce((n, id) => n + (progress.stars[id] ?? 0), 0);
  const cleared = ids.filter((id) => (progress.stars[id] ?? 0) > 0).length;
  const unlockedCount = ids.filter((_, i) => isUnlocked(progress, ids, i)).length;
  // The furthest open floor you haven't cleared yet: what "Continue" plays.
  const firstOpen = ids.findIndex((id, i) => isUnlocked(progress, ids, i) && !(progress.stars[id] ?? 0));
  const target = firstOpen === -1 ? current : firstOpen;

  // Floors opened since the last visit get an unlock animation, once.
  const [seen] = useState(() => readSeen(tower));
  const fresh = (i: number) => i >= Math.max(1, seen) && i < unlockedCount && seen > 0;
  const [shaking, setShaking] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const noteTimer = useRef<number | undefined>(undefined);

  const currentRef = useRef<HTMLLIElement>(null);
  // The slide-in ripples out from the floor you're on, which is what the map scrolls to; counting
  // from the roof made the floors in view wait up to two seconds to appear.
  const rowOf = (i: number) => Math.min(12, Math.abs(i - current));
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' });
    try {
      localStorage.setItem(seenKey(tower), String(unlockedCount));
    } catch {
      /* ignore */
    }
    if (seen > 0 && unlockedCount > seen) {
      const t = window.setTimeout(() => fx.unlock(), 450);
      return () => window.clearTimeout(t);
    }
    // Runs once when the map opens.
  }, []);

  const [plusSheet, setPlusSheet] = useState(false);
  const [packSheet, setPackSheet] = useState<PackId | null>(null);
  const lockedTower = (t: Tower) => {
    fx.denied();
    if (PLUS_VISIBLE && STORE_AVAILABLE) return t.pack ? setPackSheet(t.pack) : setPlusSheet(true);
    setNote(t.pack ? tr('{city} is a city pack. It opens when the store does.', { city: t.city }) : tr('{city} comes with LoopBot Plus.', { city: t.city }));
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), 2200);
  };
  const name = t(towers.find((x) => x.n === tower)?.name ?? 'Meridian Spire');
  const pickerShown = pickable(towers).length > 1;

  const lockedTap = (i: number) => {
    fx.denied();
    setShaking(i);
    window.setTimeout(() => setShaking((s) => (s === i ? null : s)), 420);
    setNote(t('Clear Floor {n} to open Floor {next}.', { n: i, next: i + 1 }));
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), 2200);
  };

  return (
    <div className={`tower tower-${tower}`} role="main">
      <header className="topbar">
        <div className="floor-title">
          <button type="button" className="back-btn" onClick={() => (fx.tap(), onHome())} aria-label={t('Tower {n}: back to the title screen', { n: tower })}>
            ‹ {t('Tower {n}', { n: tower })}
          </button>
          {/* With the tower picker showing the name right below, the title stays for screen readers only. */}
          <h1 className={`floor-name${pickerShown ? ' sr-only' : ''}`}>{name}</h1>
        </div>
        <div className="tower-stars" aria-label={t('{n} of {total} stars', { n: totalStars, total: ids.length * 3 })}>
          ★ {totalStars} / {ids.length * 3}
        </div>
        <button type="button" className="icon-btn map-locker" aria-label={lockerNew ? t('Locker: looks and achievements, something new') : t('Locker: looks and achievements')} onClick={() => (fx.tap(), onLocker())}>
          🏆{lockerNew && <span className="new-dot" aria-hidden="true" />}
        </button>
        <button type="button" className="icon-btn" aria-label={t('Settings')} onClick={() => (fx.tap(), onSettings())}>
          ⚙
        </button>
      </header>
      <div className="tower-progress" aria-label={t('{n} of {total} floors cleared', { n: cleared, total: ids.length })}>
        <div className="tower-progress-bar">
          <span style={{ width: `${(cleared / ids.length) * 100}%` }} />
        </div>
        <span className="tower-progress-text">
          {t('{n} / {total} floors', { n: cleared, total: ids.length })}
        </span>
      </div>
      <TowerSwitch tower={tower} towers={towers} progress={progress} onPick={onTowerPick} onLocked={lockedTower} />
      {!DEMO && <DailyButton className="tower-daily" progress={progress} daily={daily} onOpen={onDaily} />}
      {!DEMO && dailyUnlocked(progress) && (PLUS_VISIBLE || plusUnlocked()) && (
        <button type="button" className="link-btn daily-archive-link" onClick={() => (fx.tap(), onArchive())}>
          📅 {t('Daily archive: replay missed days')}
        </button>
      )}
      <div className="tower-scroll">
        <div className="tower-roof" aria-hidden="true">
          <span className="beacon" />
        </div>
        {DEMO && <div className="tower-band demo-more">{t('Floors 11 to 50 · in the full game')}</div>}
        {bandsOf(levels)
          .reverse()
          .map((band) => (
            <section key={band.key} className={`tower-section band-${band.key}`}>
              <div className="tower-band">
                {t(BAND_NAMES[band.key] ?? band.key)} · {t('Floors {first} to {last}', { first: band.first + 1, last: band.last + 1 })}
              </div>
              <ol className="tower-floors" reversed>
                {band.floors
                  .map((i) => ({ l: levels[i], i }))
                  .reverse()
                  .map(({ l, i }) => {
                    const row = rowOf(i);
                    const open = isUnlocked(progress, ids, i);
                    const stars = progress.stars[l.id] ?? 0;
                    const boss = (i + 1) % 10 === 0;
                    const here = i === current;
                    const cls = [
                      'tower-floor',
                      stars ? 'cleared' : '',
                      stars === 3 ? 'perfect' : '',
                      open ? '' : 'locked',
                      boss ? 'boss' : '',
                      here ? 'current' : '',
                      open && fresh(i) ? 'fresh' : '',
                      shaking === i ? 'shake' : '',
                    ]
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <li key={l.id} ref={here ? currentRef : undefined} style={{ ['--row' as string]: row }}>
                        <button
                          type="button"
                          className={cls}
                          aria-disabled={!open}
                          onClick={() => {
                            if (!open) return lockedTap(i);
                            fx.tap();
                            onPick(i);
                          }}
                          aria-label={
                            open
                              ? here
                                ? tn(stars, 'Floor {floor}, {title}, {n} star, you are here', 'Floor {floor}, {title}, {n} stars, you are here', { floor: i + 1, title: l.title })
                                : tn(stars, 'Floor {floor}, {title}, {n} star', 'Floor {floor}, {title}, {n} stars', { floor: i + 1, title: l.title })
                              : t('Floor {n}, locked', { n: i + 1 })
                          }
                        >
                          <span className="tf-num">{i + 1}</span>
                          {here && <MiniBot />}
                          <span className="tf-title">{open ? l.title : t('Locked')}</span>
                          {open ? (
                            <span className="tf-stars" aria-hidden="true">
                              {[1, 2, 3].map((s) => (
                                <span key={s} className={s <= stars ? 'on' : ''}>
                                  ★
                                </span>
                              ))}
                            </span>
                          ) : (
                            <svg className="tf-lock" viewBox="0 0 16 18" aria-hidden="true">
                              <path d="M4 8V5.5a4 4 0 0 1 8 0V8" fill="none" stroke="currentColor" strokeWidth="2" />
                              <rect x="2" y="8" width="12" height="9" rx="2" fill="currentColor" />
                            </svg>
                          )}
                        </button>
                      </li>
                    );
                  })}
              </ol>
            </section>
          ))}
        <div className="tower-ground">{t(GROUND[tower] ?? GROUND[1])}</div>
      </div>
      <div className="tower-footer">
        {note ? (
          <p className="tower-note" role="status">
            {note}
          </p>
        ) : (
          <button type="button" className="pill primary continue" onClick={() => (fx.tap(), onPick(target))}>
            ▶ {progress.stars[ids[target]] ? t('Replay Floor {n}', { n: target + 1 }) : t('Play Floor {n}', { n: target + 1 })}
          </button>
        )}
      </div>
      {plusSheet && <PlusSheet onClose={() => setPlusSheet(false)} />}
      {packSheet && <PackSheet pack={packSheet} onClose={() => setPackSheet(null)} />}
    </div>
  );
}
