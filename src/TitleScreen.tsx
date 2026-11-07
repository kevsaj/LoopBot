// The title screen, with LoopBot booting up as its intro (about 1.5 s): the sky fades in, LoopBot
// drops onto the skyline, its eye and antenna light up, the name and the Play button arrive.
// A tap anywhere skips straight to the end, and reduced motion shows it settled.

import { useEffect, useState } from 'react';
import type { LevelFile } from './sim/types';
import type { Progress } from './progress';
import { isUnlocked } from './progress';
import { fx } from './audio/feedback';
import { reducedMotion } from './fx/confetti';
import { DEMO } from './demo';

interface Props {
  levels: LevelFile[];
  progress: Progress;
  /** Played the intro already this session: open settled. */
  booted: boolean;
  onBooted(): void;
  onPlay(index: number): void;
  onTower(): void;
  onSettings(): void;
}

const INTRO_MS = 1500;

/** LoopBot, large, drawn like the app icon. The eye and antenna light are separate so they can boot. */
function BigBot({ poked }: { poked: boolean }) {
  return (
    <svg className={`title-bot${poked ? ' poked' : ''}`} viewBox="-200 -300 400 560" aria-hidden="true">
      <ellipse cx="0" cy="262" rx="150" ry="16" fill="#140f24" opacity=".45" />
      <g className="tb-antenna">
        <rect x="-7" y="-250" width="14" height="80" rx="7" fill="#cfc3a8" />
        <circle className="tb-light" cx="0" cy="-262" r="30" />
      </g>
      <rect x="-150" y="30" width="300" height="220" rx="34" fill="#d9d0bd" />
      <rect x="-150" y="30" width="300" height="190" rx="34" fill="#ece5d4" />
      <circle className="tb-led" cx="-70" cy="140" r="16" />
      <rect x="-185" y="-180" width="370" height="230" rx="44" fill="#d9d0bd" />
      <rect x="-185" y="-180" width="370" height="205" rx="44" fill="#f6f1e6" />
      <rect x="-130" y="-130" width="260" height="110" rx="55" fill="#221f38" />
      <g className="tb-eye">
        <ellipse cx="18" cy="-75" rx="58" ry="34" fill="#7ff2e0" />
        <ellipse cx="2" cy="-86" rx="16" ry="9" fill="#e8fffb" />
      </g>
    </svg>
  );
}

export function TitleScreen({ levels, progress, booted, onBooted, onPlay, onTower, onSettings }: Props) {
  const [settled, setSettled] = useState(() => booted || reducedMotion());
  const [poked, setPoked] = useState(false);
  useEffect(() => {
    if (settled) return onBooted();
    const t = window.setTimeout(() => setSettled(true), INTRO_MS);
    return () => window.clearTimeout(t);
  }, [settled, onBooted]);

  const ids = levels.map((l) => l.id);
  const cleared = ids.filter((id) => (progress.stars[id] ?? 0) > 0).length;
  const stars = ids.reduce((n, id) => n + (progress.stars[id] ?? 0), 0);
  // Play goes to the furthest open floor you haven't cleared, or the top one when all are.
  const open = ids.findIndex((id, i) => isUnlocked(progress, ids, i) && !(progress.stars[id] ?? 0));
  const next = open === -1 ? ids.length - 1 : open;
  const fresh = cleared === 0;

  const poke = () => {
    fx.voice('poke');
    setPoked(true);
    window.setTimeout(() => setPoked(false), 450);
  };

  return (
    <div
      className={`title-screen${settled ? ' settled' : ''}`}
      onPointerDown={() => {
        if (!settled) setSettled(true);
      }}
    >
      <div className="title-sky" aria-hidden="true">
        <span className="title-sun" />
        <span className="title-skyline" />
      </div>
      <button type="button" className="icon-btn title-settings" aria-label="Settings" onClick={() => (fx.tap(), onSettings())}>
        ⚙
      </button>

      <div className="title-hero">
        <button type="button" className="title-bot-btn" aria-label="LoopBot" onClick={() => settled && poke()}>
          <BigBot poked={poked} />
        </button>
        <h1 className="title-name">
          Loop<span>Bot</span>
        </h1>
        <p className="title-sub">Tower 1 · Meridian Spire{DEMO ? ' · Demo' : ''}</p>
      </div>

      <div className="title-actions">
        <button
          type="button"
          className="pill primary title-play"
          onClick={() => {
            fx.voice('ready');
            onPlay(next);
          }}
        >
          <span className="title-play-label">▶ {fresh ? 'Play' : 'Continue'}</span>
          <span className="title-play-floor">
            Floor {next + 1} · {levels[next].title}
          </span>
        </button>
        {!fresh && (
          <button type="button" className="pill title-map" onClick={() => (fx.tap(), onTower())}>
            Tower map <span className="title-stats">★ {stars} · {cleared} / {ids.length} floors</span>
          </button>
        )}
      </div>
    </div>
  );
}
