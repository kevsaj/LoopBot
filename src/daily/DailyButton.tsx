// The daily challenge entry, on the title screen and the tower map. It shows today's
// difficulty, the streak, and whether today's puzzle is done. Before Floor 11 it says what opens it.

import { useState } from 'react';
import type { Progress } from '../progress';
import type { DailyState } from './index';
import { DAILY_UNLOCK_FLOOR, DIFFICULTY_LABEL, THEME_NAME, TWIST_ICON, TWIST_RULE, bossOn, currentStreak, dailyUnlocked, dateKey, difficultyOn, streakNeedsFreeze, themeComing, twistOn } from './index';
import { fx } from '../audio/feedback';
import { t, tn } from '../i18n';

interface Props {
  className: string;
  progress: Progress;
  daily: DailyState;
  /** Opens today's daily, or with `boss` the Sunday boss. */
  onOpen(boss?: boolean): void;
}

export function DailyButton({ className, progress, daily, onOpen }: Props) {
  const [shake, setShake] = useState(false);
  const today = dateKey();
  const open = dailyUnlocked(progress);
  const streak = currentStreak(daily, today);
  const best = daily.best[today] ?? 0;
  const diff = difficultyOn(today);
  // A streak that's alive but not yet extended today is at risk: nudge the player.
  const atRisk = streak > 0 && !best;
  const needsFreeze = atRisk && streakNeedsFreeze(daily, today);
  const tw = twistOn(today);
  const coming = themeComing(today);
  const boss = bossOn(today);
  const bossBest = daily.boss?.[today] ?? 0;

  if (!open) {
    return (
      <button
        type="button"
        className={`pill daily-btn locked ${className}${shake ? ' shake' : ''}`}
        aria-disabled="true"
        onClick={() => {
          fx.denied();
          setShake(true);
          window.setTimeout(() => setShake(false), 420);
        }}
      >
        <span className="daily-main">{t('Daily challenge')}</span>
        <span className="daily-sub">{t('Opens after Floor {n}', { n: DAILY_UNLOCK_FLOOR })}</span>
      </button>
    );
  }
  const main = (
    <button
      type="button"
      className={`pill daily-btn ${boss ? '' : className}${best ? ' done' : ''}${atRisk ? ' at-risk' : ''}`}
      onClick={() => (fx.tap(), onOpen())}
      aria-label={[
        t('Daily challenge'),
        t(DIFFICULTY_LABEL[diff]),
        tw ? t(TWIST_RULE[tw]) : coming ? t('{week} starts Wednesday', { week: t(THEME_NAME[coming]) }) : '',
        best ? tn(best, 'cleared today with {n} star', 'cleared today with {n} stars') : '',
        streak ? tn(streak, '{n}-day streak', '{n}-day streak') : '',
        daily.freezes ? tn(daily.freezes, '{n} streak freeze', '{n} streak freezes') : '',
      ]
        .filter(Boolean)
        .join(', ')}
    >
      <span className="daily-main">
        <span className="daily-cal" aria-hidden="true">
          {Number(today.slice(8))}
        </span>
        {t('Daily challenge')}
        <span className={`daily-diff diff-${diff}`}>{t(DIFFICULTY_LABEL[diff])}</span>
      </span>
      <span className="daily-sub">
        {best ? (
          <span className="daily-stars" aria-hidden="true">
            {[1, 2, 3].map((i) => (
              <span key={i} className={i <= best ? 'on' : ''}>
                ★
              </span>
            ))}
          </span>
        ) : needsFreeze || atRisk || !(tw || coming) ? (
          // (On a theme week the theme line below says what's new, so "New puzzle today" steps aside.)
          <span>{needsFreeze ? t('A freeze is holding your streak') : atRisk ? t('Keep your streak alive') : t('New puzzle today')}</span>
        ) : null}
        {streak > 0 && <span className="daily-streak">🔥 {streak}</span>}
        {(daily.freezes ?? 0) > 0 && (
          <span className="daily-freeze" title={t('Streak freezes: each one covers a missed day')}>
            🧊 {daily.freezes}
          </span>
        )}
      </span>
      {(tw || coming) && (
        <span className={`daily-theme${tw ? '' : ' soon'}`}>
          <span aria-hidden="true">{TWIST_ICON[(tw ?? coming)!]}</span>{' '}
          {tw ? `${t(THEME_NAME[tw])} · ${t(TWIST_RULE[tw])}` : t('{week} starts Wednesday', { week: t(THEME_NAME[coming!]) })}
        </span>
      )}
    </button>
  );
  if (!boss) return main;
  // Sunday: the boss sits beside the daily, as a bonus that never touches the streak.
  return (
    <div className={`daily-row ${className}`}>
      {main}
      <button
        type="button"
        className={`pill daily-boss${bossBest ? ' done' : ''}`}
        onClick={() => (fx.tap(), onOpen(true))}
        aria-label={[t('Sunday boss'), bossBest ? tn(bossBest, 'beaten with {n} star', 'beaten with {n} stars') : t('a bonus floor that never touches your streak')].join(', ')}
      >
        <span className="boss-crown" aria-hidden="true">
          👑
        </span>
        <span className="boss-label">{t('Boss')}</span>
        {bossBest > 0 && (
          <span className="daily-stars" aria-hidden="true">
            {[1, 2, 3].map((i) => (
              <span key={i} className={i <= bossBest ? 'on' : ''}>
                ★
              </span>
            ))}
          </span>
        )}
      </button>
    </div>
  );
}
