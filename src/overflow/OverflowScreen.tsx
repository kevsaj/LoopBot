// Overflow's home: the tower of Babel drawn in code, the best height, and the climb in progress.

import { useState } from 'react';
import { fx } from '../audio/feedback';
import { MAX_BRICKS, PERFECT_FOR_BRICK, heightOf } from './index';
import type { OverflowState } from './index';
import { PackSheet } from '../store/PackSheet';
import { STORE_AVAILABLE, PLUS_VISIBLE } from '../store/purchases';
import { t, tn } from '../i18n';
import './overflow.css';

interface Props {
  state: OverflowState;
  /** Whether Overflow is unlocked here (bought, or a preview build). */
  unlocked: boolean;
  onBack(): void;
  onSettings(): void;
  onStart(): void;
  onContinue(): void;
  onEnd(): void;
}

/** The terraces' colours, bottom to top: brickyard, lapis gate, gardens, star stair, cloud top. */
const TIER_COLOURS = [
  ['#e8c48a', '#c99a5c', '#a87a42'],
  ['#4a7fd6', '#2f5fb3', '#24498c'],
  ['#8fcf7a', '#5ea860', '#3f8048'],
  ['#8e7ad8', '#6a56b8', '#4c3c90'],
  ['#f4f2ff', '#d6d2ee', '#b4aed6'],
];

/**
 * The tower of Babel as a stepped ziggurat, rising into the clouds and on past the top of the
 * picture (it never ends). A small LoopBot stands at the height of the climb in progress.
 */
export function BabelArt({ height }: { height: number }) {
  const tiers = 10;
  const base = 300;
  const step = 13;
  const tierH = 26;
  const top = 360;
  const at = Math.min(tiers - 0.5, height / 5);
  const botY = top - at * tierH - 22;
  return (
    <svg className="babel-art" viewBox="0 0 400 400" role="img" aria-label={t('The tower of Babel, climbing into the clouds')}>
      <defs>
        <linearGradient id="babel-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c2a5e" />
          <stop offset="0.55" stopColor="#d9805a" />
          <stop offset="1" stopColor="#f6c98a" />
        </linearGradient>
        <radialGradient id="babel-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff2c8" />
          <stop offset="0.6" stopColor="#ffd27a" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="400" fill="url(#babel-sky)" />
      <circle cx="318" cy="250" r="64" fill="url(#babel-sun)" />
      <g fill="#fff" opacity="0.9">
        <circle cx="62" cy="40" r="1.4" />
        <circle cx="130" cy="22" r="1" />
        <circle cx="300" cy="34" r="1.2" />
        <circle cx="352" cy="70" r="1" />
        <circle cx="34" cy="96" r="1" />
      </g>
      {/* the river and the palms at the foot */}
      <path d="M0 372 C 90 360 160 384 240 374 S 360 362 400 370 V 400 H 0 Z" fill="#3a6fa8" opacity="0.85" />
      <path d="M0 362 H 400 V 376 C 330 368 270 382 200 376 S 60 368 0 378 Z" fill="#c69a5e" />
      {[34, 360].map((x) => (
        <g key={x} transform={`translate(${x} 362)`}>
          <rect x="-2" y="-34" width="4" height="34" fill="#6a4a2a" />
          <path d="M0 -34 q -16 -2 -22 8 M0 -34 q 16 -2 22 8 M0 -34 q -10 -10 -20 -10 M0 -34 q 10 -10 20 -10" stroke="#3f7a3a" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      ))}
      {/* the ziggurat: each terrace a little narrower, with a ramp up the front */}
      {Array.from({ length: tiers }, (_, i) => {
        const w = base - i * step * 2;
        const x = 200 - w / 2;
        const y = top - (i + 1) * tierH;
        const [face, side, shade] = TIER_COLOURS[Math.min(4, Math.floor(i / 2))];
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={tierH} fill={side} />
            <rect x={x} y={y} width={w} height={5} fill={face} />
            <rect x={x + w - 14} y={y} width={14} height={tierH} fill={shade} opacity="0.7" />
            {/* windows, one row per terrace */}
            {Array.from({ length: Math.max(1, Math.floor(w / 34)) }, (_, k) => (
              <rect key={k} x={x + 14 + k * 34} y={y + 10} width={7} height={11} rx={3.5} fill={shade} opacity="0.85" />
            ))}
            {i < 4 && <rect x={x} y={y + tierH - 3} width={w} height={3} fill="#f2d48a" opacity="0.55" />}
          </g>
        );
      })}
      {/* the great stair up the front, a flight on every terrace */}
      {Array.from({ length: tiers }, (_, i) => {
        const y = top - (i + 1) * tierH;
        return (
          <g key={i} opacity="0.75">
            {[0, 1, 2, 3].map((k) => (
              <rect key={k} x={192 - k * 0.5} y={y + 4 + k * 5.5} width={16 + k} height={3} fill="#fff3d6" opacity={0.35 + k * 0.1} />
            ))}
          </g>
        );
      })}
      {/* clouds wrap the top, and the tower carries on above them */}
      <g fill="#fbf6ff" opacity="0.92">
        <ellipse cx="120" cy="104" rx="80" ry="18" />
        <ellipse cx="200" cy="94" rx="70" ry="22" />
        <ellipse cx="290" cy="106" rx="86" ry="17" />
      </g>
      <rect x="176" y="12" width="48" height="80" fill="#e6e2f8" />
      <rect x="176" y="12" width="48" height="4" fill="#fff" />
      <rect x="212" y="12" width="12" height="80" fill="#c4bee0" opacity="0.7" />
      <g fill="#fbf6ff" opacity="0.95">
        <ellipse cx="200" cy="18" rx="60" ry="12" />
        <ellipse cx="150" cy="24" rx="34" ry="8" />
        <ellipse cx="256" cy="22" rx="38" ry="9" />
      </g>
      {/* LoopBot, at the height of the climb */}
      <g className="babel-bot" transform={`translate(200 ${botY})`}>
        <ellipse cx="0" cy="22" rx="9" ry="2.5" fill="#000" opacity="0.25" />
        <line x1="0" y1="-6" x2="0" y2="0" stroke="#cfc6b4" strokeWidth="1.6" />
        <circle cx="0" cy="-7" r="2.4" fill="var(--bot-eye, #7ff2e0)" />
        <rect x="-8" y="0" width="16" height="10" rx="3" fill="var(--bot-top, #f3ecdf)" />
        <rect x="-5" y="2.5" width="10" height="5" rx="2.4" fill="#2b2440" />
        <circle cx="2" cy="5" r="1.5" fill="var(--bot-eye, #7ff2e0)" />
        <rect x="-9" y="11" width="18" height="10" rx="3" fill="var(--bot-left, #e6dccb)" />
      </g>
    </svg>
  );
}

function Bricks({ n }: { n: number }) {
  return (
    <span className="ovf-bricks big" role="img" aria-label={tn(n, '{n} brick left', '{n} bricks left')}>
      {Array.from({ length: MAX_BRICKS }, (_, i) => (
        <span key={i} className={`ovf-brick${i < n ? ' on' : ''}`} aria-hidden="true" />
      ))}
    </span>
  );
}

export function OverflowScreen({ state, unlocked, onBack, onSettings, onStart, onContinue, onEnd }: Props) {
  const run = state.run;
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const locked = () => {
    fx.denied();
    if (PLUS_VISIBLE && STORE_AVAILABLE) return setSheet(true);
    setNote(t('Overflow opens when the store does.'));
  };
  return (
    <main className="ovf-hub">
      <header className="topbar">
        <div className="floor-title">
          <button type="button" className="back-btn" onClick={() => (fx.tap(), onBack())} aria-label={t('Overflow: back to the tower map')}>
            ‹ {t('Tower map')}
          </button>
          <h1 className="floor-name">Overflow</h1>
        </div>
        <button type="button" className="icon-btn" aria-label={t('Settings')} onClick={() => (fx.tap(), onSettings())}>
          ⚙
        </button>
      </header>
      <div className="ovf-scroll">
        <div className="ovf-hero">
          <BabelArt height={run ? heightOf(run) : state.best} />
          <p className="ovf-kicker">{t('The endless climb')}</p>
        </div>
        <div className="ovf-stats">
          <div className="ovf-stat">
            <span className="ovf-stat-num">{state.best}</span>
            <span className="ovf-stat-label">{tn(state.best, 'best height (floor)', 'best height (floors)')}</span>
          </div>
          <div className="ovf-stat">
            <span className="ovf-stat-num">{state.climbs}</span>
            <span className="ovf-stat-label">{tn(state.climbs, 'climb', 'climbs')}</span>
          </div>
        </div>

        {run ? (
          <section className="ovf-card" aria-label={t('Climb in progress')}>
            <p className="ovf-card-title">{t('Climb in progress')}</p>
            <p className="ovf-card-line">
              {t('Floor {n}', { n: run.floor })} · ★ {run.stars + run.done} · <Bricks n={run.bricks} />
            </p>
            {confirmEnd ? (
              <div className="ovf-actions">
                <p className="ovf-confirm">{tn(heightOf(run), 'End this climb at {n} floor?', 'End this climb at {n} floors?')}</p>
                <button type="button" className="pill" onClick={() => (fx.tap(), setConfirmEnd(false))}>
                  {t('Keep climbing')}
                </button>
                <button type="button" className="pill danger" onClick={() => (fx.tap(), setConfirmEnd(false), onEnd())}>
                  {t('End climb')}
                </button>
              </div>
            ) : (
              <div className="ovf-actions">
                <button type="button" className="pill" onClick={() => (fx.tap(), setConfirmEnd(true))}>
                  {t('End climb')}
                </button>
                <button type="button" className="pill primary" onClick={() => (fx.tap(), onContinue())}>
                  {run.done ? t('Climb on →') : t('Continue →')}
                </button>
              </div>
            )}
          </section>
        ) : (
          <section className="ovf-card">
            {state.last && (
              <p className="ovf-card-line">
                {tn(state.last.height, 'Last climb: {n} floor', 'Last climb: {n} floors')} · ★ {state.last.stars}
              </p>
            )}
            <button type="button" className={`pill primary ovf-start${unlocked ? '' : ' locked'}`} onClick={() => (unlocked ? (fx.tap(), onStart()) : locked())}>
              {unlocked ? t('Start a climb') : `🔒 ${t('Get Overflow')}`}
            </button>
            {note && (
              <p className="tip" role="status">
                {note}
              </p>
            )}
          </section>
        )}

        <ul className="ovf-rules">
          <li>
            <span aria-hidden="true">∞</span> {t('Every floor is solvable, and every climb is shuffled, so no two look alike.')}
          </li>
          <li>
            <span aria-hidden="true">🧱</span> {t('You start with {n} bricks. Skipping a floor costs one.', { n: MAX_BRICKS })}
          </li>
          <li>
            <span aria-hidden="true">★</span> {tn(PERFECT_FOR_BRICK, 'Clear {n} floor in a row with 3 stars to win a brick back.', 'Clear {n} floors in a row with 3 stars to win a brick back.')}
          </li>
          <li>
            <span aria-hidden="true">🏛️</span> {t('Higher up, tricks from the other towers mix in: switches, ice, vents, turntables, Echo and mosaics.')}
          </li>
        </ul>
      </div>
      {sheet && <PackSheet pack="overflow" onClose={() => setSheet(false)} />}
    </main>
  );
}
