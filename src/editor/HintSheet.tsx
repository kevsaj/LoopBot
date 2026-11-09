// GD-11 / GD-12: three hint tiers per floor, paid from a small wallet.

import type { LevelFile } from '../sim/types';
import type { Progress } from '../progress';
import { FREE_NUDGE_AFTER, nextHintIsFree, revealHint } from '../progress';
import { fx } from '../audio/feedback';

const TIERS = ['Nudge', 'Structure', 'Solution'];

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

  const reveal = () => {
    const next = revealHint(progress, level.id, level.hints.length);
    if (!next) return fx.denied();
    fx.snap();
    setProgress(() => next);
    onReveal?.(shown + 1, free);
  };

  return (
    <div className="results-backdrop" onClick={onClose}>
      <div className="results sheet hints" role="dialog" aria-label="Hints" onClick={(e) => e.stopPropagation()}>
        <h2>Hints</h2>
        <p className="tip">
          You have <strong>{progress.hints}</strong> {progress.hints === 1 ? 'hint' : 'hints'}. Earn one for every 10 floors you 3-star.
        </p>
        <ol className="hint-list">
          {level.hints.slice(0, shown).map((h, i) => (
            <li key={i}>
              <span className="hint-tier">{TIERS[i]}</span>
              <span className={i === 2 ? 'hint-text code' : 'hint-text'}>{h}</span>
            </li>
          ))}
        </ol>
        {more && (
          <button type="button" className="pill primary" disabled={!canPay} onClick={reveal}>
            Show {TIERS[shown]} {free ? '(free)' : '(1 hint)'}
          </button>
        )}
        {more && !canPay && <p className="tip">Out of hints. The Nudge is free after {FREE_NUDGE_AFTER} tries on a floor.</p>}
        {onFeedback && shown > 0 && (
          <p className="tip">
            Still stuck?{' '}
            <button type="button" className="link-btn" onClick={() => (fx.tap(), onFeedback())}>
              Tell us what's confusing
            </button>
          </p>
        )}
        <div className="results-actions">
          <button type="button" className="pill" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
