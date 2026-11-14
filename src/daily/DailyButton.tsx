// The daily challenge entry, on the title screen and the tower map. It shows today's
// difficulty, the streak, and whether today's puzzle is done. Before Floor 11 it says what opens it.

import { useState } from 'react';
import type { Progress } from '../progress';
import type { DailyState } from './index';
import { DAILY_UNLOCK_FLOOR, DIFFICULTY_LABEL, currentStreak, dailyUnlocked, dateKey, difficultyOn, streakNeedsFreeze } from './index';
import { fx } from '../audio/feedback';
import { t, tn } from '../i18n';

interface Props {
  className: string;
  progress: Progress;
  daily: DailyState;
  onOpen(): void;
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
  return (
    <button
      type="button"
      className={`pill daily-btn ${className}${best ? ' done' : ''}${atRisk ? ' at-risk' : ''}`}
      onClick={() => (fx.tap(), onOpen())}
      aria-label={[
        t('Daily challenge'),
        t(DIFFICULTY_LABEL[diff]),
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
        ) : (
          <span>{needsFreeze ? t('A freeze is holding your streak') : atRisk ? t('Keep your streak alive') : t('New puzzle today')}</span>
        )}
        {streak > 0 && <span className="daily-streak">🔥 {streak}</span>}
        {(daily.freezes ?? 0) > 0 && (
          <span className="daily-freeze" title={t('Streak freezes: each one covers a missed day')}>
            🧊 {daily.freezes}
          </span>
        )}
      </span>
    </button>
  );
}
