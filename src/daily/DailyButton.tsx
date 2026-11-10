// The daily challenge entry, on the title screen and the tower map. It shows today's
// difficulty, the streak, and whether today's puzzle is done. Before Floor 11 it says what opens it.

import { useState } from 'react';
import type { Progress } from '../progress';
import type { DailyState } from './index';
import { DAILY_UNLOCK_FLOOR, DIFFICULTY_LABEL, currentStreak, dailyUnlocked, dateKey, difficultyOn, streakNeedsFreeze } from './index';
import { fx } from '../audio/feedback';

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
        <span className="daily-main">Daily challenge</span>
        <span className="daily-sub">Opens after Floor {DAILY_UNLOCK_FLOOR}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      className={`pill daily-btn ${className}${best ? ' done' : ''}${atRisk ? ' at-risk' : ''}`}
      onClick={() => (fx.tap(), onOpen())}
      aria-label={`Daily challenge, ${DIFFICULTY_LABEL[diff]}${best ? `, cleared today with ${best} stars` : ''}${streak ? `, ${streak} day streak` : ''}${daily.freezes ? `, ${daily.freezes} streak freeze${daily.freezes > 1 ? 's' : ''}` : ''}`}
    >
      <span className="daily-main">
        <span className="daily-cal" aria-hidden="true">
          {Number(today.slice(8))}
        </span>
        Daily challenge
        <span className={`daily-diff diff-${diff}`}>{DIFFICULTY_LABEL[diff]}</span>
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
          <span>{needsFreeze ? 'A freeze is holding your streak' : atRisk ? 'Keep your streak alive' : 'New puzzle today'}</span>
        )}
        {streak > 0 && <span className="daily-streak">🔥 {streak}</span>}
        {(daily.freezes ?? 0) > 0 && (
          <span className="daily-freeze" title="Streak freezes: each one covers a missed day">
            🧊 {daily.freezes}
          </span>
        )}
      </span>
    </button>
  );
}
