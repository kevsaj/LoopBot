// The daily archive (LoopBot Plus): the last 30 days of daily puzzles, to replay any you missed.
// Archive clears keep their stars but never change the streak; that belongs to playing on the day.

import { useState } from 'react';
import { fx } from '../audio/feedback';
import type { DailyState } from './index';
import { ARCHIVE_DAYS, DIFFICULTY_LABEL, TWIST_ICON, TWIST_RULE, archiveDates, bossOn, difficultyOn, shortDate, twistOn } from './index';
import { PLUS_VISIBLE, STORE_AVAILABLE, plusUnlocked } from '../store/purchases';
import { PlusSheet } from '../store/PlusSheet';
import { t, tn } from '../i18n';
import { rich } from '../i18n/rich';

interface Props {
  daily: DailyState;
  onPlay(date: string, boss?: boolean): void;
  onClose(): void;
}

export function DailyArchive({ daily, onPlay, onClose }: Props) {
  const [owned, setOwned] = useState(plusUnlocked);
  const [plusSheet, setPlusSheet] = useState(false);
  const dates = archiveDates();
  const cleared = dates.filter((d) => (daily.best[d] ?? 0) > 0).length;

  return (
    <div className="results-backdrop settings-screen" onClick={onClose}>
      <div className="settings daily-archive" role="dialog" aria-label={t('Daily archive')} onClick={(e) => e.stopPropagation()}>
        <header className="settings-head">
          <button type="button" className="settings-close" aria-label={t('Close')} onClick={() => (fx.tap(), onClose())}>
            ✕
          </button>
          <h2>{t('Daily archive')}</h2>
        </header>
        <div className="settings-body">
          {owned ? (
            <p className="set-caption">
              {t("The last {days} days of puzzles, Sunday bosses included. You've cleared {n} of the dailies. Replays keep their stars but don't change your streak.", { days: ARCHIVE_DAYS, n: cleared })}
            </p>
          ) : (
            <div className="archive-locked">
              <p className="plus-lede">
                {rich(t('Missed a day? With LoopBot {plus} you can replay the last {days} daily puzzles and Sunday bosses.', { days: ARCHIVE_DAYS }), { plus: <span className="plus-word">Plus</span> })}
              </p>
              {PLUS_VISIBLE && STORE_AVAILABLE && (
                <button type="button" className="pill primary plus-buy" onClick={() => (fx.tap(), setPlusSheet(true))}>
                  {t('See LoopBot Plus')}
                </button>
              )}
            </div>
          )}
          <ol className="archive-days">
            {dates.map((d) => {
              const best = daily.best[d] ?? 0;
              const diff = difficultyOn(d);
              const tw = twistOn(d);
              const bossBest = daily.boss?.[d] ?? 0;
              return (
                <li key={d}>
                  {bossOn(d) && (
                    <button
                      type="button"
                      className={`archive-day archive-boss${bossBest ? ' done' : ''}${owned ? '' : ' locked'}`}
                      aria-disabled={!owned}
                      aria-label={[t('Sunday boss'), shortDate(d), bossBest ? tn(bossBest, '{n} star', '{n} stars') : t('not cleared'), owned ? '' : t('needs Plus')].filter(Boolean).join(', ')}
                      onClick={() => {
                        if (!owned) return fx.denied();
                        fx.tap();
                        onPlay(d, true);
                      }}
                    >
                      <span className="ad-date">{shortDate(d)}</span>
                      <span className="daily-diff diff-boss">👑 {t('Boss')}</span>
                      <span className="ad-stars" aria-hidden="true">
                        {bossBest ? [1, 2, 3].map((i) => <span key={i} className={i <= bossBest ? 'on' : ''}>★</span>) : owned ? t('Play ›') : '🔒'}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    className={`archive-day${best ? ' done' : ''}${owned ? '' : ' locked'}`}
                    aria-disabled={!owned}
                    aria-label={[shortDate(d), t(DIFFICULTY_LABEL[diff]), tw ? t(TWIST_RULE[tw]) : '', best ? tn(best, '{n} star', '{n} stars') : t('not cleared'), owned ? '' : t('needs Plus')].filter(Boolean).join(', ')}
                    onClick={() => {
                      if (!owned) return fx.denied();
                      fx.tap();
                      onPlay(d);
                    }}
                  >
                    <span className="ad-date">{shortDate(d)}</span>
                    {tw && (
                      <span className="ad-twist" title={t(TWIST_RULE[tw])} aria-hidden="true">
                        {TWIST_ICON[tw]}
                      </span>
                    )}
                    <span className={`daily-diff diff-${diff}`}>{t(DIFFICULTY_LABEL[diff])}</span>
                    <span className="ad-stars" aria-hidden="true">
                      {best ? [1, 2, 3].map((i) => <span key={i} className={i <= best ? 'on' : ''}>★</span>) : owned ? t('Play ›') : '🔒'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      {plusSheet && (
        <PlusSheet
          onClose={() => {
            setPlusSheet(false);
            setOwned(plusUnlocked());
          }}
        />
      )}
    </div>
  );
}
