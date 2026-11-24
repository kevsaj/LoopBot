// Hint packs: buy more hints if you want them (growth plan, "Hints"). Earning stays the main way:
// every 10 floors you 3-star, every daily challenge, and Plus adds 20. No buying stars or skips.

import { Icon } from '../ui/Icon';
import { useState } from 'react';
import { StoreOffline, useStoreLoad } from '../ui/StatusCard';
import { fx } from '../audio/feedback';
import { buyHints, getHintOffers } from './purchases';
import type { HintOffer } from './purchases';
import { t, tn } from '../i18n';
import { rich } from '../i18n/rich';

export function HintShop({ hints, onClose }: { hints: number; onClose(): void }) {
  const { value: offers, retry } = useStoreLoad<HintOffer[]>(getHintOffers);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const buy = async (offer: HintOffer) => {
    if (busy) return;
    fx.tap();
    setBusy(true);
    const r = await buyHints(offer);
    setBusy(false);
    if (r === 'bought') {
      fx.cheer();
      setNote(tn(offer.hints, 'Thank you! {n} hint added.', 'Thank you! {n} hints added.'));
    } else if (r === 'failed') setNote(t("The purchase didn't go through. You haven't been charged."));
  };

  return (
    <div className="results-backdrop settings-screen" onClick={onClose}>
      <div className="settings hint-shop" role="dialog" aria-label={t('Get more hints')} onClick={(e) => e.stopPropagation()}>
        <header className="settings-head">
          <button type="button" className="settings-close" aria-label={t('Close')} onClick={() => (fx.tap(), onClose())}>
            <Icon name="close" size={24} />
          </button>
          <h2>{t('More hints')}</h2>
        </header>
        <div className="settings-body">
          <p className="plus-lede">
            {rich(tn(hints, 'You have {h} hint.', 'You have {h} hints.'), { h: <strong>{hints}</strong> })}
          </p>
          <ul className="plus-perks">
            <li>
              <span className="plus-icon" aria-hidden="true">
                ⭐
              </span>
              <span>
                <strong>{t('Earn them free')}</strong>
                <span className="plus-text">{t('One for every 10 floors you 3-star, one for every daily challenge, and 3 more for every 7-day streak.')}</span>
              </span>
            </li>
          </ul>
          <div className="hint-packs">
            {offers === 'loading' && <p className="set-caption">{t('Loading prices…')}</p>}
            {offers !== 'loading' && offers.length === 0 && <StoreOffline onRetry={retry} />}
            {offers !== 'loading' &&
              offers.map((o) => (
                <button key={o.hints} type="button" className="pill hint-pack" disabled={busy} onClick={() => void buy(o)}>
                  <span className="hp-count">
                    <Icon name="hint" size={20} /> {tn(o.hints, '{n} hint', '{n} hints')}
                  </span>
                  <span className="hp-price">{o.price}</span>
                </button>
              ))}
          </div>
          {note && (
            <p className="tip" role="status">
              {note}
            </p>
          )}
          <p className="set-caption">{t('Hints never expire. The Nudge is always free after 3 tries on a floor.')}</p>
        </div>
      </div>
    </div>
  );
}
