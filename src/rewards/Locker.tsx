// LoopBot's locker: pick paint, eye colour and antenna tip, and see every achievement.
// Opened from the title screen and the tower map. Locked items say how to earn them.

import { useState } from 'react';
import { fx } from '../audio/feedback';
import type { Stats } from './achievements';
import { ACHIEVEMENTS, totalStars } from './achievements';
import type { Look, TipShape, Unlock } from './looks';
import { EYES, PAINTS, TIPS, isPlusPart, isUnlocked, plusPartsShown, saveLook, unlockLabel, applyLookCss } from './looks';
import { PLUS_VISIBLE, STORE_AVAILABLE } from '../store/purchases';
import { PlusSheet } from '../store/PlusSheet';
import { AntennaTip } from './AntennaTip';

interface Props {
  stats: Stats;
  earned: Set<string>;
  look: Look;
  onLook(l: Look): void;
  onClose(): void;
}

/** A front view of LoopBot in an explicit look, for the preview and the swatches. */
export function LookBot({ top, left, eye, tip, size = 120 }: { top: string; left: string; eye: string; tip: TipShape; size?: number }) {
  return (
    <svg viewBox="-60 -70 120 140" width={size} height={(size * 140) / 120} aria-hidden="true">
      <rect x="-2.5" y="-58" width="5" height="18" rx="2.5" fill={left} />
      <AntennaTip cx={0} cy={-60} r={7} shape={tip} fill={eye} />
      <rect x="-44" y="12" width="88" height="54" rx="12" fill={left} />
      <rect x="-44" y="12" width="88" height="46" rx="12" fill={top} opacity=".94" />
      <circle cx="-20" cy="38" r="5" fill="#f2a93b" />
      <rect x="-54" y="-42" width="108" height="60" rx="14" fill={left} />
      <rect x="-54" y="-42" width="108" height="53" rx="14" fill={top} />
      <rect x="-38" y="-30" width="76" height="30" rx="15" fill="#221f38" />
      <ellipse cx="5" cy="-15" rx="16" ry="9.5" fill={eye} />
    </svg>
  );
}

function Swatch({ label, unlock, unlocked, on, onPick, onPlus, children }: { label: string; unlock: Unlock | null; unlocked: boolean; on: boolean; onPick(): void; onPlus?(): void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={`swatch${on ? ' on' : ''}${unlocked ? '' : ' locked'}${isPlusPart(unlock) ? ' plus' : ''}`}
      aria-pressed={on}
      aria-label={unlocked ? label : `${label}, locked: ${unlockLabel(unlock)}`}
      onClick={() => {
        if (!unlocked) {
          // a Plus look opens the Plus screen when it's on sale
          if (isPlusPart(unlock) && onPlus) return (fx.tap(), onPlus());
          return fx.denied();
        }
        fx.snap();
        onPick();
      }}
    >
      <span className="swatch-art">{children}</span>
      <span className="swatch-name">{label}</span>
      {!unlocked && <span className="swatch-lock">🔒 {unlockLabel(unlock)}</span>}
    </button>
  );
}

export function Locker({ stats, earned, look, onLook, onClose }: Props) {
  const [tab, setTab] = useState<'looks' | 'achievements'>('looks');
  const [plusSheet, setPlusSheet] = useState(false);
  const [, setRefresh] = useState(0);
  const shown = <T extends { unlock: Unlock | null }>(list: T[]) => (plusPartsShown() ? list : list.filter((x) => !isPlusPart(x.unlock)));
  const onPlus = PLUS_VISIBLE && STORE_AVAILABLE ? () => setPlusSheet(true) : undefined;
  const paint = PAINTS.find((p) => p.id === look.paint) ?? PAINTS[0];
  const eye = EYES.find((e) => e.id === look.eye) ?? EYES[0];
  const set = (l: Look) => {
    saveLook(l);
    applyLookCss(l);
    onLook(l);
  };
  const stars = totalStars(stats);
  const got = ACHIEVEMENTS.filter((a) => earned.has(a.id)).length;

  return (
    <div className="results-backdrop settings-screen" onClick={onClose}>
      <div className="settings locker" role="dialog" aria-label="LoopBot's locker" onClick={(e) => e.stopPropagation()}>
        <header className="settings-head">
          <button type="button" className="settings-close" aria-label="Close the locker" onClick={() => (fx.tap(), onClose())}>
            ✕
          </button>
          <h2>Locker</h2>
        </header>
        <div className="settings-body">
          <div className="locker-preview">
            <LookBot top={paint.top} left={paint.left} eye={eye.color} tip={look.tip} size={110} />
            <p className="locker-stars">★ {stars} stars · 🏆 {got} / {ACHIEVEMENTS.length}</p>
          </div>
          <div className="locker-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'looks'} className={tab === 'looks' ? 'on' : ''} onClick={() => (fx.tap(), setTab('looks'))}>
              Looks
            </button>
            <button type="button" role="tab" aria-selected={tab === 'achievements'} className={tab === 'achievements' ? 'on' : ''} onClick={() => (fx.tap(), setTab('achievements'))}>
              Achievements
            </button>
          </div>

          {tab === 'looks' ? (
            <>
              <h3 className="set-section">Paint</h3>
              <div className="swatches">
                {shown(PAINTS).map((p) => (
                  <Swatch key={p.id} onPlus={onPlus} label={p.name} unlock={p.unlock} unlocked={isUnlocked(p.unlock, stats, earned)} on={p.id === look.paint} onPick={() => set({ ...look, paint: p.id })}>
                    <LookBot top={p.top} left={p.left} eye={eye.color} tip={look.tip} size={44} />
                  </Swatch>
                ))}
              </div>
              <h3 className="set-section">Eye</h3>
              <div className="swatches">
                {shown(EYES).map((e) => (
                  <Swatch key={e.id} onPlus={onPlus} label={e.name} unlock={e.unlock} unlocked={isUnlocked(e.unlock, stats, earned)} on={e.id === look.eye} onPick={() => set({ ...look, eye: e.id })}>
                    <span className="eye-dot" style={{ background: e.color }} />
                  </Swatch>
                ))}
              </div>
              <h3 className="set-section">Antenna</h3>
              <div className="swatches">
                {shown(TIPS).map((t) => (
                  <Swatch key={t.id} onPlus={onPlus} label={t.name} unlock={t.unlock} unlocked={isUnlocked(t.unlock, stats, earned)} on={t.id === look.tip} onPick={() => set({ ...look, tip: t.id })}>
                    <svg viewBox="-12 -12 24 24" width="30" height="30" aria-hidden="true">
                      <AntennaTip cx={0} cy={0} r={7} shape={t.id} fill={eye.color} />
                    </svg>
                  </Swatch>
                ))}
              </div>
              <p className="set-caption">Earn stars on tower floors and achievements to unlock more{plusPartsShown() ? ', and LoopBot Plus adds Frostline looks' : ''}. Looks are just for fun.</p>
            </>
          ) : (
            <ul className="achievements">
              {ACHIEVEMENTS.map((a) => {
                const done = earned.has(a.id);
                const p = a.progress?.(stats);
                return (
                  <li key={a.id} className={`ach${done ? ' done' : ''}`}>
                    <span className="ach-icon" aria-hidden="true">
                      {a.icon}
                    </span>
                    <span className="ach-text">
                      <span className="ach-title">{a.title}</span>
                      <span className="ach-how">{a.how}</span>
                      {!done && p && p.need > 1 && (
                        <span className="ach-bar" aria-label={`${p.have} of ${p.need}`}>
                          <span style={{ width: `${(p.have / p.need) * 100}%` }} />
                        </span>
                      )}
                    </span>
                    <span className="ach-state" aria-label={done ? 'earned' : 'not yet'}>
                      {done ? '✓' : p && p.need > 1 ? `${p.have}/${p.need}` : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      {plusSheet && (
        <PlusSheet
          onClose={() => {
            setPlusSheet(false);
            setRefresh((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
