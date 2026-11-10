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

interface Props {
  levels: LevelFile[];
  progress: Progress;
  current: number;
  onPick(index: number): void;
  onSettings(): void;
  onHome(): void;
  daily: DailyState;
  onDaily(): void;
  onLocker(): void;
  lockerNew: boolean;
}

const SEEN_KEY = 'loopbot.seenUnlocked';

/** Display names for the five bands of Tower 1 (doc: Bands table). */
const BAND_NAMES: Record<string, string> = {
  lobby: 'The Lobby',
  maintenance: 'Maintenance',
  workshop: 'Workshop',
  control: 'Control Room',
  rooftop: 'Rooftop',
};

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

function readSeen(): number {
  try {
    const n = Number(localStorage.getItem(SEEN_KEY));
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

export function TowerMap({ levels, progress, current, onPick, onSettings, onHome, daily, onDaily, onLocker, lockerNew }: Props) {
  const ids = levels.map((l) => l.id);
  const totalStars = ids.reduce((n, id) => n + (progress.stars[id] ?? 0), 0);
  const cleared = ids.filter((id) => (progress.stars[id] ?? 0) > 0).length;
  const unlockedCount = ids.filter((_, i) => isUnlocked(progress, ids, i)).length;
  // The furthest open floor you haven't cleared yet: what "Continue" plays.
  const firstOpen = ids.findIndex((id, i) => isUnlocked(progress, ids, i) && !(progress.stars[id] ?? 0));
  const target = firstOpen === -1 ? current : firstOpen;

  // Floors opened since the last visit get an unlock animation, once.
  const [seen] = useState(readSeen);
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
      localStorage.setItem(SEEN_KEY, String(unlockedCount));
    } catch {
      /* ignore */
    }
    if (seen > 0 && unlockedCount > seen) {
      const t = window.setTimeout(() => fx.unlock(), 450);
      return () => window.clearTimeout(t);
    }
    // Runs once when the map opens.
  }, []);

  const lockedTap = (i: number) => {
    fx.denied();
    setShaking(i);
    window.setTimeout(() => setShaking((s) => (s === i ? null : s)), 420);
    setNote(`Clear Floor ${i} to open Floor ${i + 1}.`);
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), 2200);
  };

  return (
    <div className="tower">
      <header className="topbar">
        <div className="floor-title">
          <button type="button" className="back-btn" onClick={() => (fx.tap(), onHome())} aria-label="Back to the title screen">
            ‹ Tower 1
          </button>
          <span className="floor-name">Meridian Spire</span>
        </div>
        <div className="tower-stars" aria-label={`${totalStars} of ${ids.length * 3} stars`}>
          ★ {totalStars} / {ids.length * 3}
        </div>
        <button type="button" className="icon-btn map-locker" aria-label={`Locker: looks and achievements${lockerNew ? ', something new' : ''}`} onClick={() => (fx.tap(), onLocker())}>
          🏆{lockerNew && <span className="new-dot" aria-hidden="true" />}
        </button>
        <button type="button" className="icon-btn" aria-label="Settings" onClick={() => (fx.tap(), onSettings())}>
          ⚙
        </button>
      </header>
      <div className="tower-progress" aria-label={`${cleared} of ${ids.length} floors cleared`}>
        <div className="tower-progress-bar">
          <span style={{ width: `${(cleared / ids.length) * 100}%` }} />
        </div>
        <span className="tower-progress-text">
          {cleared} / {ids.length} floors
        </span>
      </div>
      {!DEMO && <DailyButton className="tower-daily" progress={progress} daily={daily} onOpen={onDaily} />}
      <div className="tower-scroll">
        <div className="tower-roof" aria-hidden="true">
          <span className="beacon" />
        </div>
        {DEMO && <div className="tower-band demo-more">Floors 11 to 50 · in the full game</div>}
        {bandsOf(levels)
          .reverse()
          .map((band) => (
            <section key={band.key} className={`tower-section band-${band.key}`}>
              <div className="tower-band">
                {BAND_NAMES[band.key] ?? band.key} · Floors {band.first + 1} to {band.last + 1}
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
                          aria-label={open ? `Floor ${i + 1}, ${l.title}, ${stars} stars${here ? ', you are here' : ''}` : `Floor ${i + 1}, locked`}
                        >
                          <span className="tf-num">{i + 1}</span>
                          {here && <MiniBot />}
                          <span className="tf-title">{open ? l.title : 'Locked'}</span>
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
        <div className="tower-ground">Sub-basement</div>
      </div>
      <div className="tower-footer">
        {note ? (
          <p className="tower-note" role="status">
            {note}
          </p>
        ) : (
          <button type="button" className="pill primary continue" onClick={() => (fx.tap(), onPick(target))}>
            ▶ {progress.stars[ids[target]] ? 'Replay' : 'Play'} Floor {target + 1}
          </button>
        )}
      </div>
    </div>
  );
}
