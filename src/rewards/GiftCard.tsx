// PATCH's first gift, opened the first time the player leaves Floor 3 after clearing it (gift.ts):
// a box pops open on LoopBot wearing the new parts, and one tap puts them on.

import { useEffect } from 'react';
import { fx } from '../audio/feedback';
import { burst, reducedMotion } from '../fx/confetti';
import { LookBot } from './Locker';
import { AntennaTip } from './AntennaTip';
import type { Look } from './looks';
import { EYES, PAINTS } from './looks';
import { wearGift } from './gift';
import { t } from '../i18n';

interface Props {
  look: Look;
  /** Put the gift on now. */
  onWear(l: Look): void;
  onDone(): void;
}

export function GiftCard({ look, onWear, onDone }: Props) {
  const worn = wearGift(look);
  const paint = PAINTS.find((p) => p.id === worn.paint)!;
  const eye = EYES.find((e) => e.id === worn.eye) ?? EYES[0];

  useEffect(() => {
    fx.unlock();
    if (reducedMotion()) return;
    const timer = window.setTimeout(() => burst({ count: 28, x: 0.5, y: 0.38, power: 7, spread: 80, sparkle: true }), 380);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onDone();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onDone]);

  const wear = () => {
    fx.snap();
    onWear(worn);
    onDone();
  };

  return (
    <div className="results-backdrop" onClick={onDone}>
      <div className="results gift-card" role="dialog" aria-labelledby="gift-title" aria-describedby="gift-body" onClick={(e) => e.stopPropagation()}>
        <p className="results-floor">{t('A gift from PATCH')}</p>
        <div className="gift-stage" aria-hidden="true">
          <span className="gift-rays" />
          <span className="gift-bot">
            <LookBot top={paint.top} left={paint.left} right={paint.right} eye={eye.color} tip={worn.tip} size={104} />
          </span>
        </div>
        <h2 id="gift-title" className="in">
          {t('Spare parts unlocked!')}
        </h2>
        <p id="gift-body" className="gift-body">
          {t('PATCH found Lilac paint and a Gear antenna in the sub-basement. They are yours to keep in the Locker.')}
        </p>
        <ul className="gift-parts" aria-label={t('In the gift')}>
          <li>
            <span className="gift-swatch" style={{ background: paint.top, borderColor: paint.right }} aria-hidden="true" />
            {t('{name} paint', { name: t('Lilac') })}
          </li>
          <li>
            <svg className="gift-tip" viewBox="-10 -10 20 20" aria-hidden="true">
              <AntennaTip cx={0} cy={0} r={7} shape="gear" fill="currentColor" />
            </svg>
            {t('{name} antenna', { name: t('Gear') })}
          </li>
        </ul>
        <div className="results-actions">
          <button type="button" className="pill primary results-main" onClick={wear} autoFocus>
            {t('Put them on')}
          </button>
          <div className="results-more">
            <button type="button" className="pill" onClick={() => (fx.tap(), onDone())}>
              {t('Maybe later')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
