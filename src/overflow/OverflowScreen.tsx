// Overflow's home: the tower of Babel by night, the record, the terraces reached and the climb in
// progress. Overflow is a paid mode, so this screen gets its own look: lapis and gold, glazed-brick
// friezes, and art drawn in code (no image files, nothing licensed).

import { useState } from 'react';
import type { ReactNode } from 'react';
import { fx } from '../audio/feedback';
import { MAX_BRICKS, PERFECT_FOR_BRICK, TERRACES, heightOf, terraceOf } from './index';
import type { OverflowState, Terrace } from './index';
import { PackSheet } from '../store/PackSheet';
import { STORE_AVAILABLE, PLUS_VISIBLE } from '../store/purchases';
import { msg, t, tn } from '../i18n';
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

/** Each terrace's name, and the floor it starts on. */
export const TERRACE_INFO: Record<Terrace, { name: string; floor: number }> = {
  brickyard: { name: msg('The Brickyard'), floor: 1 },
  lapisgate: { name: msg('The Lapis Gate'), floor: 11 },
  gardens: { name: msg('The Hanging Gardens'), floor: 21 },
  starstair: { name: msg('The Star Stair'), floor: 31 },
  cloudtop: { name: msg('The Cloud Top'), floor: 41 },
};

/** The terraces' colours, bottom to top: face, front, shade. */
const TIER_COLOURS = [
  ['#e9c48a', '#c99a5c', '#9c7040'],
  ['#5a8ee6', '#2f5fb3', '#1f4285'],
  ['#86c97a', '#4f9a5a', '#356e40'],
  ['#9a86e0', '#6250b4', '#433488'],
  ['#f7f4ff', '#d8d3f0', '#aaa3d0'],
];

/** A terrace's emblem, drawn for its medallion: brick, rosette, palm, star and cloud. */
export function TerraceEmblem({ terrace }: { terrace: Terrace }) {
  const gold = 'var(--ovf-gold, #f2c46a)';
  switch (terrace) {
    case 'brickyard':
      return (
        <g fill={gold}>
          <rect x="-11" y="2" width="10" height="6" rx="1" />
          <rect x="1" y="2" width="10" height="6" rx="1" />
          <rect x="-5" y="-5" width="10" height="6" rx="1" />
          <rect x="-11" y="-12" width="10" height="6" rx="1" opacity="0.55" />
          <rect x="1" y="-12" width="10" height="6" rx="1" opacity="0.55" />
        </g>
      );
    case 'lapisgate':
      // the eight-petal rosette of the glazed gates
      return (
        <g fill={gold}>
          {Array.from({ length: 8 }, (_, i) => (
            <ellipse key={i} cx="0" cy="-7" rx="3" ry="6" transform={`rotate(${i * 45})`} />
          ))}
          <circle r="3.6" fill="#1b2f66" />
          <circle r="1.8" />
        </g>
      );
    case 'gardens':
      return (
        <g fill="none" stroke={gold} strokeWidth="2.4" strokeLinecap="round">
          <path d="M0 12V-2" />
          <path d="M0 -2q-9 -3 -12 4M0 -2q9 -3 12 4M0 -2q-6 -8 -12 -8M0 -2q6 -8 12 -8M0 -2q0 -8 0 -11" />
        </g>
      );
    case 'starstair':
      // the eight-pointed star of the old sky charts
      return (
        <g fill={gold}>
          <path d="M0 -13L3 -3L13 0L3 3L0 13L-3 3L-13 0L-3 -3Z" />
          <path d="M0 -13L3 -3L13 0L3 3L0 13L-3 3L-13 0L-3 -3Z" transform="rotate(45) scale(0.7)" opacity="0.6" />
        </g>
      );
    case 'cloudtop':
      return (
        <g fill={gold}>
          <rect x="-3" y="-13" width="6" height="14" rx="1" />
          <path d="M-12 8a5 5 0 0 1 4-7a6 6 0 0 1 11-2a5 5 0 0 1 9 5a4 4 0 0 1-1 6h-21a4 4 0 0 1-2-2z" />
        </g>
      );
  }
}

/**
 * The tower of Babel by night as a stepped ziggurat with a spiral ramp, rising through the clouds
 * and on out of the picture (it never ends). Terraces already climbed have lit windows, and a small
 * LoopBot stands at the height of the climb.
 */
export function BabelArt({ height, best }: { height: number; best: number }) {
  const tiers = 10;
  const base = 300;
  const step = 13;
  const tierH = 26;
  const top = 352;
  const at = Math.min(tiers - 0.5, height / 5);
  const botY = top - at * tierH - 22;
  const litTiers = Math.ceil(Math.min(50, best) / 5);
  return (
    <svg className="babel-art" viewBox="0 0 400 400" role="img" aria-label={t('The tower of Babel, climbing into the clouds')}>
      <defs>
        <linearGradient id="babel-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1030" />
          <stop offset="0.45" stopColor="#24296a" />
          <stop offset="0.78" stopColor="#7a4a78" />
          <stop offset="1" stopColor="#e09060" />
        </linearGradient>
        <radialGradient id="babel-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd88a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffd88a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="babel-goldline" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b8862e" />
          <stop offset="0.5" stopColor="#ffe6a0" />
          <stop offset="1" stopColor="#b8862e" />
        </linearGradient>
        <pattern id="babel-bricks" width="12" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 0.5H12M0 3.5H12M3 0.5V3.5M9 3.5V6.5" stroke="#000" strokeOpacity="0.12" strokeWidth="0.8" fill="none" />
        </pattern>
      </defs>
      <rect width="400" height="400" fill="url(#babel-sky)" />
      {/* stars and a crescent moon */}
      <g fill="#fff">
        {[
          [40, 30, 1.3], [92, 62, 0.9], [140, 18, 1.1], [270, 26, 1.4], [318, 58, 0.9], [360, 20, 1.2], [24, 120, 0.8], [372, 128, 1], [60, 170, 0.7], [340, 180, 0.8], [110, 120, 0.7], [300, 110, 0.7],
        ].map(([x, y, r], i) => (
          <circle key={i} className={`babel-twinkle tw-${i % 3}`} cx={x} cy={y} r={r} />
        ))}
      </g>
      <g transform="translate(330 70)">
        <circle r="15" fill="#fff4d0" />
        <circle cx="6" cy="-4" r="13" fill="#1a1f52" />
      </g>
      <circle cx="200" cy="250" r="170" fill="url(#babel-glow)" />
      {/* the river plain and the palms at the foot */}
      <path d="M0 360 C 90 350 160 372 240 362 S 360 352 400 358 V 400 H 0 Z" fill="#1f3c74" />
      <path d="M0 368 C 80 362 170 380 250 372 S 360 366 400 372" stroke="#ffd88a" strokeOpacity="0.35" strokeWidth="1.5" fill="none" />
      <path d="M0 350 H 400 V 362 C 330 356 270 368 200 362 S 60 356 0 366 Z" fill="#7a5634" />
      {[30, 64, 336, 370].map((x, i) => (
        <g key={x} transform={`translate(${x} ${352 - (i % 2) * 4}) scale(${i % 2 ? 0.8 : 1})`}>
          <rect x="-1.8" y="-34" width="3.6" height="34" fill="#2a1c14" />
          <path d="M0 -34 q -16 -2 -22 8 M0 -34 q 16 -2 22 8 M0 -34 q -10 -10 -20 -10 M0 -34 q 10 -10 20 -10" stroke="#1f3a26" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      ))}
      {/* the ziggurat */}
      {Array.from({ length: tiers }, (_, i) => {
        const w = base - i * step * 2;
        const x = 200 - w / 2;
        const y = top - (i + 1) * tierH;
        const [face, front, shade] = TIER_COLOURS[Math.min(4, Math.floor(i / 2))];
        const lit = i < litTiers;
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={tierH} fill={front} />
            <rect x={x} y={y} width={w} height={tierH} fill="url(#babel-bricks)" />
            <rect x={x + w - 16} y={y} width={16} height={tierH} fill={shade} opacity="0.75" />
            <rect x={x} y={y} width={w} height={4} fill={face} />
            <rect x={x} y={y + 4} width={w} height={1.2} fill="url(#babel-goldline)" opacity="0.9" />
            {Array.from({ length: Math.max(1, Math.floor((w - 30) / 30)) }, (_, k) => x + 18 + k * 30)
              .filter((wx) => Math.abs(wx + 3 - 200) > 18)
              .map((wx) => (
                <rect key={wx} x={wx} y={y + 10} width={6} height={11} rx={3} fill={lit ? '#ffd27a' : '#141634'} opacity={lit ? 0.95 : 0.55} />
              ))}
          </g>
        );
      })}
      {/* the great stair up the front, a flight on every terrace, edged in gold */}
      {Array.from({ length: tiers }, (_, i) => {
        const y = top - (i + 1) * tierH;
        const w = 22 - i;
        return (
          <g key={i}>
            <rect x={200 - w / 2} y={y + 4} width={w} height={tierH - 4} fill="#000" opacity="0.22" />
            {[0, 1, 2, 3].map((k) => (
              <rect key={k} x={200 - w / 2 + 1} y={y + 6 + k * 5} width={w - 2} height={2} fill="#ffe6a0" opacity={0.3 + k * 0.12} />
            ))}
          </g>
        );
      })}
      {/* clouds wrap the top, and the tower carries on above them */}
      <g className="babel-cloud c1" fill="#e9e4ff" opacity="0.85">
        <ellipse cx="110" cy="98" rx="84" ry="16" />
        <ellipse cx="300" cy="102" rx="90" ry="15" />
      </g>
      <rect x="178" y="0" width="44" height="96" fill="#dcd6f4" />
      <rect x="178" y="0" width="44" height="96" fill="url(#babel-bricks)" />
      <rect x="210" y="0" width="12" height="96" fill="#aaa3d0" opacity="0.75" />
      {[20, 46, 72].map((y) => (
        <rect key={y} x="186" y={y} width="5" height="10" rx="2.5" fill="#ffd27a" opacity="0.8" />
      ))}
      <g className="babel-cloud c2" fill="#f6f2ff" opacity="0.95">
        <ellipse cx="200" cy="90" rx="76" ry="20" />
        <ellipse cx="150" cy="22" rx="56" ry="10" />
        <ellipse cx="262" cy="30" rx="60" ry="11" />
      </g>
      {/* LoopBot, at the height of the climb */}
      <g transform={`translate(200 ${botY})`}>
        <g className="babel-bot">
          <circle cx="0" cy="6" r="18" fill="#ffd88a" opacity="0.25" />
          <ellipse cx="0" cy="22" rx="9" ry="2.5" fill="#000" opacity="0.3" />
          <line x1="0" y1="-6" x2="0" y2="0" stroke="#cfc6b4" strokeWidth="1.6" />
          <circle cx="0" cy="-7" r="2.4" fill="var(--bot-eye, #7ff2e0)" />
          <rect x="-8" y="0" width="16" height="10" rx="3" fill="var(--bot-top, #f3ecdf)" />
          <rect x="-5" y="2.5" width="10" height="5" rx="2.4" fill="#2b2440" />
          <circle cx="2" cy="5" r="1.5" fill="var(--bot-eye, #7ff2e0)" />
          <rect x="-9" y="11" width="18" height="10" rx="3" fill="var(--bot-left, #e6dccb)" />
        </g>
      </g>
    </svg>
  );
}

/** The climb's bricks: glazed lapis with a gold rim, dark when spent. */
export function Bricks({ n, big = false }: { n: number; big?: boolean }) {
  return (
    <span className={`ovf-bricks${big ? ' big' : ''}`} role="img" aria-label={tn(n, '{n} brick left', '{n} bricks left')}>
      {Array.from({ length: MAX_BRICKS }, (_, i) => (
        <span key={i} className={`ovf-brick${i < n ? ' on' : ''}`} aria-hidden="true" />
      ))}
    </span>
  );
}

/** A small medallion: a terrace's emblem in a gold ring. */
export function Medallion({ terrace, reached, size = 52 }: { terrace: Terrace; reached: boolean; size?: number }) {
  return (
    <svg className={`ovf-medal${reached ? ' reached' : ''}`} viewBox="-26 -26 52 52" width={size} height={size} aria-hidden="true">
      <circle r="24" className="ovf-medal-ring" />
      <circle r="19.5" className="ovf-medal-face" />
      {Array.from({ length: 16 }, (_, i) => (
        <circle key={i} cx="0" cy="-22" r="0.9" className="ovf-medal-bead" transform={`rotate(${i * 22.5})`} />
      ))}
      <TerraceEmblem terrace={terrace} />
    </svg>
  );
}

/** The five terraces as a trail of medallions, lit up to the record. */
function TerraceTrail({ best, current }: { best: number; current: number | null }) {
  const here = current ? terraceOf(current) : null;
  return (
    <div className="ovf-trail" role="list" aria-label={t('Terraces')}>
      {TERRACES.map((k) => {
        const info = TERRACE_INFO[k];
        const reached = best + 1 >= info.floor;
        return (
          <div key={k} role="listitem" className={`ovf-trail-stop${reached ? ' reached' : ''}${here === k ? ' here' : ''}`} aria-label={`${t(info.name)}, ${reached ? t('reached') : t('Floor {n}', { n: info.floor })}`}>
            <Medallion terrace={k} reached={reached} size={46} />
            <span className="ovf-trail-name">{t(info.name)}</span>
            <span className="ovf-trail-floor">{info.floor}+</span>
          </div>
        );
      })}
    </div>
  );
}

function Rule({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li>
      <svg className="ovf-rule-icon" viewBox="-12 -12 24 24" aria-hidden="true">
        {icon}
      </svg>
      <span>{children}</span>
    </li>
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
  const height = run ? heightOf(run) : 0;
  return (
    <main className="ovf-hub">
      <header className="topbar ovf-topbar">
        <div className="floor-title">
          <button type="button" className="back-btn" onClick={() => (fx.tap(), onBack())} aria-label={t('Overflow: back to the tower map')}>
            ‹ {t('Tower map')}
          </button>
        </div>
        <button type="button" className="icon-btn" aria-label={t('Settings')} onClick={() => (fx.tap(), onSettings())}>
          ⚙
        </button>
      </header>
      <div className="ovf-scroll">
        <div className="ovf-head">
          <p className="ovf-eyebrow">
            <span aria-hidden="true">✦</span> {t('Endless mode')} <span aria-hidden="true">✦</span>
          </p>
          <h1 className="ovf-wordmark">Overflow</h1>
          <p className="ovf-tagline">{t('The tower of Babel never ends. How high can you climb?')}</p>
        </div>

        <div className="ovf-hero">
          <BabelArt height={run ? height : state.best} best={state.best} />
          <div className="ovf-frieze" aria-hidden="true" />
        </div>

        <div className="ovf-record">
          <svg className="ovf-laurel" viewBox="0 0 60 60" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <g key={i}>
                <ellipse cx="0" cy="0" rx="6" ry="2.6" transform={`translate(${16 - i * 0.6} ${48 - i * 7}) rotate(${-60 + i * 8})`} />
                <ellipse cx="0" cy="0" rx="6" ry="2.6" transform={`translate(${44 + i * 0.6} ${48 - i * 7}) rotate(${60 - i * 8})`} />
              </g>
            ))}
          </svg>
          <div className="ovf-record-text">
            <span className="ovf-record-num">{state.best}</span>
          </div>
          <div className="ovf-record-side">
            <span className="ovf-record-label">{tn(state.best, 'floor · your record', 'floors · your record')}</span>
            <span>
              <strong>{state.climbs}</strong> {tn(state.climbs, 'climb', 'climbs')}
            </span>
            {state.last && (
              <span>
                {t('Last')} <strong>{state.last.height}</strong>
              </span>
            )}
          </div>
        </div>

        <TerraceTrail best={state.best} current={run ? run.floor : null} />

        {run ? (
          <section className="ovf-card" aria-label={t('Climb in progress')}>
            <div className="ovf-card-head">
              <span className="ovf-card-title">{t('Climb in progress')}</span>
              <Bricks n={run.bricks} big />
            </div>
            <div className="ovf-card-body">
              <Medallion terrace={terraceOf(run.floor)} reached size={44} />
              <div>
                <p className="ovf-card-floor">{t('Floor {n}', { n: run.floor })}</p>
                <p className="ovf-card-sub">
                  {t(TERRACE_INFO[terraceOf(run.floor)].name)} · ★ {run.stars + run.done}
                </p>
              </div>
            </div>
            {confirmEnd ? (
              <div className="ovf-actions">
                <p className="ovf-confirm">{tn(height, 'End this climb at {n} floor?', 'End this climb at {n} floors?')}</p>
                <button type="button" className="pill" onClick={() => (fx.tap(), setConfirmEnd(false))}>
                  {t('Keep climbing')}
                </button>
                <button type="button" className="pill danger" onClick={() => (fx.tap(), setConfirmEnd(false), onEnd())}>
                  {t('End climb')}
                </button>
              </div>
            ) : (
              <div className="ovf-actions">
                <button type="button" className="pill ovf-ghost" onClick={() => (fx.tap(), setConfirmEnd(true))}>
                  {t('End climb')}
                </button>
                <button type="button" className="pill ovf-gold" onClick={() => (fx.tap(), onContinue())}>
                  {run.done ? t('Climb on →') : t('Continue →')}
                </button>
              </div>
            )}
          </section>
        ) : (
          <section className="ovf-card ovf-card-start">
            <button type="button" className={`pill ovf-gold ovf-start${unlocked ? '' : ' locked'}`} onClick={() => (unlocked ? (fx.tap(), onStart()) : locked())}>
              {unlocked ? t('Start a climb') : t('Get Overflow')}
            </button>
            {note && (
              <p className="tip" role="status">
                {note}
              </p>
            )}
          </section>
        )}

        <ul className="ovf-rules">
          <Rule icon={<path d="M-8 0c0-4 3-6 5.5-6S3 0 0 0s3 6 5.5 6S8 4 8 0s-3-6-5.5-6S-3 6-5.5 6-8 4-8 0z" fill="none" stroke="currentColor" strokeWidth="2" />}>
            {t('Every floor is solvable, and every climb is shuffled, so no two look alike.')}
          </Rule>
          <Rule
            icon={
              <g fill="currentColor">
                <rect x="-9" y="1" width="8" height="5" rx="1" />
                <rect x="1" y="1" width="8" height="5" rx="1" />
                <rect x="-4" y="-6" width="8" height="5" rx="1" />
              </g>
            }
          >
            {t('You start with {n} bricks. Skipping a floor costs one.', { n: MAX_BRICKS })}
          </Rule>
          <Rule icon={<path d="M0 -9L2.6 -3L9 -2.6L4 1.6L5.6 8L0 4.6L-5.6 8L-4 1.6L-9 -2.6L-2.6 -3Z" fill="currentColor" />}>
            {tn(PERFECT_FOR_BRICK, 'Clear {n} floor in a row with 3 stars to win a brick back.', 'Clear {n} floors in a row with 3 stars to win a brick back.')}
          </Rule>
          <Rule
            icon={
              <g fill="currentColor">
                {Array.from({ length: 8 }, (_, i) => (
                  <ellipse key={i} cx="0" cy="-5" rx="2" ry="4" transform={`rotate(${i * 45})`} />
                ))}
              </g>
            }
          >
            {t('Higher up, tricks from the other towers mix in: switches, ice, vents, turntables, Echo and mosaics.')}
          </Rule>
        </ul>
      </div>
      {sheet && <PackSheet pack="overflow" onClose={() => setSheet(false)} />}
    </main>
  );
}

/** The banner as a climb reaches a new terrace: its medallion and name, then it lifts away. */
export function TerraceBanner({ floor, onDone }: { floor: number; onDone(): void }) {
  const k = terraceOf(floor);
  return (
    <div className="ovf-banner" role="status" onClick={onDone} onAnimationEnd={(e) => e.animationName === 'ovf-banner-out' && onDone()}>
      <div className="ovf-banner-inner">
        <Medallion terrace={k} reached size={84} />
        <p className="ovf-banner-kicker">{t('Floor {n}', { n: floor })}</p>
        <p className="ovf-banner-name">{t(TERRACE_INFO[k].name)}</p>
      </div>
    </div>
  );
}
