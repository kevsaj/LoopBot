// The LoopBot Plus screen: what Plus includes, the store's price, Buy and Restore.
// One-time purchase, no subscription, no ads (growth plan, section 2).

import { useEffect, useState } from 'react';
import { fx } from '../audio/feedback';
import { buyPlus, getPlusOffer, hasPlus, restorePurchases } from './purchases';
import type { PlusOffer } from './purchases';

export const PLUS_PERKS: { icon: string; title: string; text: string }[] = [
  { icon: '❄️', title: 'Frostline tower', text: 'A whole new tower of floors with ice to slide on, and the next chapter of the VANTA story.' },
  { icon: '🎨', title: 'Plus looks', text: 'Paints, eyes and antennas for LoopBot that only Plus players have.' },
  { icon: '📅', title: 'Daily archive', text: 'Replay any daily challenge you missed.' },
  { icon: '🧊', title: 'More streak freezes', text: 'Hold up to 4 freezes instead of 2.' },
];

export function PlusSheet({ onClose }: { onClose(): void }) {
  const [owned, setOwned] = useState(hasPlus);
  const [offer, setOffer] = useState<PlusOffer | null | 'loading'>('loading');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void getPlusOffer().then((o) => live && setOffer(o));
    return () => {
      live = false;
    };
  }, []);

  const buy = async () => {
    if (!offer || offer === 'loading' || busy) return;
    fx.tap();
    setBusy(true);
    const r = await buyPlus(offer);
    setBusy(false);
    if (r === 'bought') {
      fx.cheer();
      setOwned(true);
      setNote('Thank you! LoopBot Plus is yours on every device signed in to this store.');
    } else if (r === 'failed') setNote("The purchase didn't go through. You haven't been charged.");
  };

  const restore = async () => {
    if (busy) return;
    fx.tap();
    setBusy(true);
    const r = await restorePurchases();
    setBusy(false);
    if (r === 'restored') {
      setOwned(true);
      setNote('Restored. Welcome back!');
    } else if (r === 'nothing') setNote('No LoopBot Plus purchase was found for this store account.');
    else setNote("Couldn't reach the store. Check your connection and try again.");
  };

  return (
    <div className="results-backdrop settings-screen" onClick={onClose}>
      <div className="settings plus-sheet" role="dialog" aria-label="LoopBot Plus" onClick={(e) => e.stopPropagation()}>
        <header className="settings-head">
          <button type="button" className="settings-close" aria-label="Close" onClick={() => (fx.tap(), onClose())}>
            ✕
          </button>
          <h2>
            LoopBot <span className="plus-word">Plus</span>
          </h2>
        </header>
        <div className="settings-body">
          <p className="plus-lede">One purchase, yours to keep. No subscription and no ads, ever.</p>
          <ul className="plus-perks">
            {PLUS_PERKS.map((p) => (
              <li key={p.title}>
                <span className="plus-icon" aria-hidden="true">
                  {p.icon}
                </span>
                <span>
                  <strong>{p.title}</strong>
                  <span className="plus-text">{p.text}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="set-caption">Tower 1 and the daily challenge stay free for everyone.</p>

          {owned ? (
            <p className="plus-owned">✓ You have LoopBot Plus</p>
          ) : (
            <button type="button" className="pill primary plus-buy" disabled={busy || !offer || offer === 'loading'} onClick={buy}>
              {offer === 'loading' ? 'Loading price…' : offer ? `Get Plus · ${offer.price}` : 'Store unavailable'}
            </button>
          )}
          {note && (
            <p className="tip" role="status">
              {note}
            </p>
          )}
          {!owned && (
            <button type="button" className="plus-restore" onClick={restore} disabled={busy}>
              Restore purchases
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
