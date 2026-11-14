// A city pack's store screen: what the tower holds, the store's price, Buy and Restore.
// One-time purchase, separate from LoopBot Plus (growth plan: city packs $2.99).

import { useEffect, useState } from 'react';
import { fx } from '../audio/feedback';
import { buyPack, getPackOffer, packUnlocked, restorePurchases } from './purchases';
import type { PackOffer } from './purchases';
import type { PackId } from './packs';
import { msg, t } from '../i18n';

interface PackInfo {
  /** The pack's name on the screen, e.g. "Heatwave". */
  title: string;
  /** The tower's name. */
  tower: string;
  lede: string;
  perks: { icon: string; title: string; text: string }[];
}

export const PACK_INFO: Record<PackId, PackInfo> = {
  heatwave: {
    title: msg('Heatwave'),
    tower: msg('The Sandglass'),
    lede: msg('Tower 3 rises out of the desert. Time your moves past heat vents that blast on a beat.'),
    perks: [
      { icon: '🏜️', title: msg('50 new floors'), text: msg('The Sandglass, from the Dune Gate to the Crown, with 3 stars to win on every floor.') },
      { icon: '🔥', title: msg('Heat vents and the wait block'), text: msg('Count steps, plug vents with crates, and learn to wait for the right moment.') },
      { icon: '🌡️', title: msg('A new sensor'), text: msg('Check for heat ahead with if and while, then write it all as code at the top.') },
      { icon: '📻', title: msg('The story goes on'), text: msg("PATCH's radio calls and the chase after VANTA, plus new desert music.") },
    ],
  },
};

export function PackSheet({ pack, onClose }: { pack: PackId; onClose(): void }) {
  const info = PACK_INFO[pack];
  const [owned, setOwned] = useState(() => packUnlocked(pack));
  const [offer, setOffer] = useState<PackOffer | null | 'loading'>('loading');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const name = t(info.title);

  useEffect(() => {
    let live = true;
    void getPackOffer(pack).then((o) => live && setOffer(o));
    return () => {
      live = false;
    };
  }, [pack]);

  const buy = async () => {
    if (!offer || offer === 'loading' || busy) return;
    fx.tap();
    setBusy(true);
    const r = await buyPack(offer);
    setBusy(false);
    if (r === 'bought') {
      fx.cheer();
      setOwned(true);
      setNote(t('Thank you! {pack} is yours on every device signed in to this store.', { pack: name }));
    } else if (r === 'failed') setNote(t("The purchase didn't go through. You haven't been charged."));
  };

  const restore = async () => {
    if (busy) return;
    fx.tap();
    setBusy(true);
    const r = await restorePurchases();
    setBusy(false);
    const has = packUnlocked(pack);
    setOwned(has);
    if (r === 'restored' && has) setNote(t('Restored. Welcome back!'));
    else if (r === 'restored' || r === 'nothing') setNote(t('No {pack} purchase was found for this store account.', { pack: name }));
    else setNote(t("Couldn't reach the store. Check your connection and try again."));
  };

  return (
    <div className="results-backdrop settings-screen" onClick={onClose}>
      <div className={`settings plus-sheet pack-sheet pack-${pack}`} role="dialog" aria-label={t('{pack} city pack', { pack: name })} onClick={(e) => e.stopPropagation()}>
        <header className="settings-head">
          <button type="button" className="settings-close" aria-label={t('Close')} onClick={() => (fx.tap(), onClose())}>
            ✕
          </button>
          <h2>
            {name} <span className="pack-word">{t('city pack')}</span>
          </h2>
        </header>
        <div className="settings-body">
          <p className="plus-lede">{t(info.lede)}</p>
          <ul className="plus-perks">
            {info.perks.map((p) => (
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
          <p className="set-caption">{t('One purchase, yours to keep. City packs are separate from LoopBot Plus. No subscription and no ads.')}</p>

          {owned ? (
            <p className="plus-owned">✓ {t('{tower} is open', { tower: t(info.tower) })}</p>
          ) : (
            <button type="button" className="pill primary plus-buy" disabled={busy || !offer || offer === 'loading'} onClick={buy}>
              {offer === 'loading' ? t('Loading price…') : offer ? t('Get {pack} · {price}', { pack: name, price: offer.price }) : t('Store unavailable')}
            </button>
          )}
          {note && (
            <p className="tip" role="status">
              {note}
            </p>
          )}
          {!owned && (
            <button type="button" className="plus-restore" onClick={restore} disabled={busy}>
              {t('Restore purchases')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
