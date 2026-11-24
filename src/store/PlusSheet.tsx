// The LoopBot Plus screen: what Plus includes, the store's price, Buy and Restore.
// One-time purchase, no subscription, no ads (growth plan, section 2).

import { Icon } from '../ui/Icon';
import { useState } from 'react';
import { StoreOffline, useStoreLoad } from '../ui/StatusCard';
import { fx } from '../audio/feedback';
import { buyPlus, getPlusOffer, hasPlus, restorePurchases } from './purchases';
import { skylineOnSale } from './purchases';
import type { PlusOffer } from './purchases';
import { msg, t } from '../i18n';
import { SkylineSheet } from './SkylineSheet';

export const PLUS_PERKS: { icon: string; title: string; text: string }[] = [
  { icon: '❄️', title: msg('Frostline tower'), text: msg('A whole new tower of floors with ice to slide on, and the next chapter of the VANTA story.') },
  { icon: '🎨', title: msg('Plus looks'), text: msg('Paints, eyes and antennas for LoopBot that only Plus players have.') },
  { icon: '📅', title: msg('Daily archive'), text: msg('Replay any daily challenge you missed.') },
  { icon: '🧊', title: msg('More streak freezes'), text: msg('Hold up to 4 freezes instead of 2.') },
  { icon: '💡', title: msg('20 bonus hints'), text: msg('Added to your hints the moment Plus is yours.') },
];

export function PlusSheet({ onClose }: { onClose(): void }) {
  const [owned, setOwned] = useState(hasPlus);
  const { value: offer, retry } = useStoreLoad<PlusOffer | null>(getPlusOffer);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [skyline, setSkyline] = useState(false);

  const buy = async () => {
    if (!offer || offer === 'loading' || busy) return;
    fx.tap();
    setBusy(true);
    const r = await buyPlus(offer);
    setBusy(false);
    if (r === 'bought') {
      fx.cheer();
      setOwned(true);
      setNote(t('Thank you! LoopBot Plus is yours on every device signed in to this store.'));
    } else if (r === 'failed') setNote(t("The purchase didn't go through. You haven't been charged."));
  };

  const restore = async () => {
    if (busy) return;
    fx.tap();
    setBusy(true);
    const r = await restorePurchases();
    setBusy(false);
    // Restore can find only a city pack, so Plus is owned only if the store said so.
    if (r === 'restored' && hasPlus()) {
      setOwned(true);
      setNote(t('Restored. Welcome back!'));
    } else if (r === 'restored' || r === 'nothing') setNote(t('No LoopBot Plus purchase was found for this store account.'));
    else setNote(t("Couldn't reach the store. Check your connection and try again."));
  };

  return (
    <div className="results-backdrop settings-screen" onClick={onClose}>
      <div className="settings plus-sheet" role="dialog" aria-label="LoopBot Plus" onClick={(e) => e.stopPropagation()}>
        <header className="settings-head">
          <button type="button" className="settings-close" aria-label={t('Close')} onClick={() => (fx.tap(), onClose())}>
            <Icon name="close" size={24} />
          </button>
          <h2>
            LoopBot <span className="plus-word">Plus</span>
          </h2>
        </header>
        <div className="settings-body">
          <p className="plus-lede">{t('One purchase, yours to keep. No subscription and no ads, ever.')}</p>
          <ul className="plus-perks">
            {PLUS_PERKS.map((p) => (
              <li key={p.title}>
                <span className="plus-icon" aria-hidden="true">
                  {p.icon}
                </span>
                <span>
                  <strong>{t(p.title)}</strong>
                  <span className="plus-text">{t(p.text)}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="set-caption">{t('Tower 1 and the daily challenge stay free for everyone.')}</p>
          {!owned && offer === null && <StoreOffline onRetry={retry} />}
          {note && (
            <p className="tip" role="status">
              {note}
            </p>
          )}
          {!owned && skylineOnSale() && (
            <button type="button" className="sky-link" onClick={() => (fx.tap(), setSkyline(true))}>
              {t('Want every tower? See the Skyline Pass')} ›
            </button>
          )}
        </div>
        <footer className="store-cta">
          {owned ? (
            <p className="plus-owned">
              <Icon name="check" size={20} /> {t('You have LoopBot Plus')}
            </p>
          ) : (
            <>
              {offer !== null && (
                <button type="button" className="pill primary plus-buy" disabled={busy || !offer || offer === 'loading'} onClick={buy}>
                  {offer === 'loading' ? t('Loading price…') : offer ? t('Get Plus · {price}', { price: offer.price }) : t('Store unavailable')}
                </button>
              )}
              <button type="button" className="plus-restore" onClick={restore} disabled={busy}>
                {t('Restore purchases')}
              </button>
            </>
          )}
        </footer>
      </div>
      {skyline && (
        <SkylineSheet
          onClose={() => {
            setSkyline(false);
            setOwned(hasPlus());
          }}
        />
      )}
    </div>
  );
}
