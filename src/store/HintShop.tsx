// Hint packs: buy more hints if you want them (growth plan, "Hints"). Earning stays the main way:
// every 10 floors you 3-star, every daily challenge, and Plus adds 20. No buying stars or skips.

import { useEffect, useState } from 'react';
import { fx } from '../audio/feedback';
import { buyHints, getHintOffers } from './purchases';
import type { HintOffer } from './purchases';

export function HintShop({ hints, onClose }: { hints: number; onClose(): void }) {
  const [offers, setOffers] = useState<HintOffer[] | 'loading'>('loading');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void getHintOffers().then((o) => live && setOffers(o));
    return () => {
      live = false;
    };
  }, []);

  const buy = async (offer: HintOffer) => {
    if (busy) return;
    fx.tap();
    setBusy(true);
    const r = await buyHints(offer);
    setBusy(false);
    if (r === 'bought') {
      fx.cheer();
      setNote(`Thank you! ${offer.hints} hints added.`);
    } else if (r === 'failed') setNote("The purchase didn't go through. You haven't been charged.");
  };

  return (
    <div className="results-backdrop settings-screen" onClick={onClose}>
      <div className="settings hint-shop" role="dialog" aria-label="Get more hints" onClick={(e) => e.stopPropagation()}>
        <header className="settings-head">
          <button type="button" className="settings-close" aria-label="Close" onClick={() => (fx.tap(), onClose())}>
            ✕
          </button>
          <h2>More hints</h2>
        </header>
        <div className="settings-body">
          <p className="plus-lede">
            You have <strong>{hints}</strong> {hints === 1 ? 'hint' : 'hints'}.
          </p>
          <ul className="plus-perks">
            <li>
              <span className="plus-icon" aria-hidden="true">
                ⭐
              </span>
              <span>
                <strong>Earn them free</strong>
                <span className="plus-text">One for every 10 floors you 3-star, one for every daily challenge, and 3 more for every 7-day streak.</span>
              </span>
            </li>
          </ul>
          <div className="hint-packs">
            {offers === 'loading' && <p className="set-caption">Loading prices…</p>}
            {offers !== 'loading' && offers.length === 0 && <p className="set-caption">The store isn't available right now. Try again later.</p>}
            {offers !== 'loading' &&
              offers.map((o) => (
                <button key={o.hints} type="button" className="pill hint-pack" disabled={busy} onClick={() => void buy(o)}>
                  <span className="hp-count">💡 {o.hints} hints</span>
                  <span className="hp-price">{o.price}</span>
                </button>
              ))}
          </div>
          {note && (
            <p className="tip" role="status">
              {note}
            </p>
          )}
          <p className="set-caption">Hints never expire. The Nudge is always free after 3 tries on a floor.</p>
        </div>
      </div>
    </div>
  );
}
