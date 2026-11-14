// GD-11 / GD-12: three hint tiers per floor, paid from a small wallet.

import type { LevelFile } from '../sim/types';
import type { Progress } from '../progress';
import { FREE_NUDGE_AFTER, nextHintIsFree, revealHint } from '../progress';
import { fx } from '../audio/feedback';
import { SHOP_OPEN } from '../store/purchases';
import { HintShop } from '../store/HintShop';
import { useState } from 'react';
import { msg, t, tn } from '../i18n';
import { rich } from '../i18n/rich';

const TIERS = [msg('Nudge'), msg('Structure'), msg('Solution')];

interface Props {
  level: LevelFile;
  progress: Progress;
  setProgress(update: (p: Progress) => Progress): void;
  onClose(): void;
  /** Called after a tier is revealed (1 = Nudge), for anonymous stats. */
  onReveal?(tier: number, free: boolean): void;
  /** Opens the feedback sheet, for "still stuck? tell us". */
  onFeedback?(): void;
}

export function HintSheet({ level, progress, setProgress, onClose, onReveal, onFeedback }: Props) {
  const shown = progress.revealed[level.id] ?? 0;
  const free = nextHintIsFree(progress, level.id);
  const canPay = free || progress.hints > 0;
  const more = shown < level.hints.length;
  const [shop, setShop] = useState(false);

  const reveal = () => {
    const next = revealHint(progress, level.id, level.hints.length);
    if (!next) return fx.denied();
    fx.snap();
    setProgress(() => next);
    onReveal?.(shown + 1, free);
  };

  return (
    <>
      <div className="results-backdrop" onClick={onClose}>
        <div className="results sheet hints" role="dialog" aria-label={t('Hints')} onClick={(e) => e.stopPropagation()}>
          <h2>{t('Hints')}</h2>
          <p className="tip">
            {rich(tn(progress.hints, 'You have {h} hint.', 'You have {h} hints.'), { h: <strong>{progress.hints}</strong> })} {t('Earn them by 3-starring floors and clearing the daily challenge.')}
          </p>
          <ol className="hint-list">
            {level.hints.slice(0, shown).map((h, i) => (
              <li key={i}>
                <span className="hint-tier">{t(TIERS[i])}</span>
                <span className={i === 2 ? 'hint-text code' : 'hint-text'}>{h}</span>
              </li>
            ))}
          </ol>
          {more && (
            <button type="button" className="pill primary" disabled={!canPay} onClick={reveal}>
              {free ? t('Show {tier} (free)', { tier: t(TIERS[shown]) }) : t('Show {tier} (1 hint)', { tier: t(TIERS[shown]) })}
            </button>
          )}
          {more && !canPay && <p className="tip">{t('Out of hints. The Nudge is free after {n} tries on a floor.', { n: FREE_NUDGE_AFTER })}</p>}
          {SHOP_OPEN && (
            <button type="button" className="link-btn hint-more" onClick={() => (fx.tap(), setShop(true))}>
              {t('Get more hints')}
            </button>
          )}
          {onFeedback && shown > 0 && (
            <p className="tip">
              {t('Still stuck?')}{' '}
              <button type="button" className="link-btn" onClick={() => (fx.tap(), onFeedback())}>
                {t("Tell us what's confusing")}
              </button>
            </p>
          )}
          <div className="results-actions">
            <button type="button" className="pill" onClick={onClose}>
              {t('Close')}
            </button>
          </div>
        </div>
      </div>
      {shop && <HintShop hints={progress.hints} onClose={() => setShop(false)} />}
    </>
  );
}
