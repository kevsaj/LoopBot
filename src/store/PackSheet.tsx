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
  twist: {
    title: msg('Twist'),
    tower: msg('The Helix'),
    lede: msg('Tower 4 twists up beside the river. Ride turntables that spin LoopBot as it steps on, and keep track of where you face.'),
    perks: [
      { icon: '🌀', title: msg('50 new floors'), text: msg('The Helix, from the Ferry Terrace to the Pinnacle, with 3 stars to win on every floor.') },
      { icon: '🔄', title: msg('Turntables'), text: msg('Floors that turn you as you walk. Let them take the corners, and loop all the way round.') },
      { icon: '🧭', title: msg('A compass sensor'), text: msg('Ask "facing north?" with if and while, then write it all as code at the top.') },
      { icon: '📻', title: msg('The story goes on'), text: msg("PATCH's radio calls and the chase after VANTA, plus new riverside music.") },
    ],
  },
  twinspires: {
    title: msg('Twin Spires'),
    tower: msg('The Skybridge'),
    lede: msg('Tower 6 is two towers joined by a skybridge. Meet Echo, a second bot that runs every program you write.'),
    perks: [
      { icon: '🌉', title: msg('50 new floors'), text: msg('The Skybridge, from the Twin Atrium to the Twin Tops, with 3 stars to win on every floor.') },
      { icon: '🤖', title: msg('Meet Echo'), text: msg('Two bots, one program. Plan a path that works for both of them at once.') },
      { icon: '🪞', title: msg('Same code, different data'), text: msg('Each bot reads its own walls, switches and painted tiles, so one program takes them different ways.') },
      { icon: '📻', title: msg('The story goes on'), text: msg("PATCH's radio calls and the chase after VANTA, plus new music for the spires.") },
    ],
  },
  fractal: {
    title: msg('Fractal'),
    tower: msg('The Fernwork'),
    lede: msg('Tower 7 is a tower made of smaller towers. Write functions that call themselves, and light every mosaic.'),
    perks: [
      { icon: '🌿', title: msg('50 new floors'), text: msg('The Fernwork, from Tessera Plaza to the Canopy, with 3 stars to win on every floor.') },
      { icon: '🔁', title: msg('Functions that call themselves'), text: msg('Recursion: a pattern made of smaller copies of itself, as deep as you choose.') },
      { icon: '✦', title: msg('Light the mosaics'), text: msg('Broken-tile mosaics glow when LoopBot steps on them. Light them all to clear a floor.') },
      { icon: '📻', title: msg('The story goes on'), text: msg("PATCH's radio calls and the chase after VANTA, plus new music for the spires.") },
    ],
  },
  precinct404: {
    title: msg('Precinct 404'),
    tower: msg('The Watchhouse'),
    lede: msg('Tower 8 is the precinct the maps forgot. Team up with Detective DASH: two bots, two programs, one radio.'),
    perks: [
      { icon: '🚨', title: msg('50 new floors'), text: msg('The Watchhouse, from the Front Desk to the Watchtower, with 3 stars to win on every floor.') },
      { icon: '🤝', title: msg('Partner mode'), text: msg('Write a program for LoopBot and another for your partner, and make them work together.') },
      { icon: '📻', title: msg('Radio calls'), text: msg('Radio your partner and wait for the call back, so every handoff happens at just the right step.') },
      { icon: '🎬', title: msg('A squad of new friends'), text: msg('DASH, BULWARK, ROOK and Captain LEDGER, a heist on Heist Night, and new precinct music.') },
    ],
  },
  overflow: {
    title: msg('Overflow'),
    tower: msg('Overflow'),
    lede: msg('An endless climb up the tower of Babel. Every floor is new, and every trick from the other towers is waiting in the brickwork.'),
    perks: [
      { icon: '∞', title: msg('Floors that never run out'), text: msg('Each climb shuffles hundreds of solvable floors and turns them, so no two climbs look alike.') },
      { icon: '🧱', title: msg('Three bricks'), text: msg('Skip a floor for a brick, and win one back with three perfect clears in a row.') },
      { icon: '🏆', title: msg('Beat your best height'), text: msg('How high can you climb? Your record stays with you.') },
      { icon: '🎶', title: msg('Five terraces'), text: msg('From the Brickyard to above the clouds, each with its own look and music.') },
    ],
  },
  dockyard: {
    title: msg('Dockyard'),
    tower: msg('The Wavehouse'),
    lede: msg('Tower 5 rises over the harbour. Meet the tally, your first variable: count, then let the number do the walking.'),
    perks: [
      { icon: '⚓', title: msg('50 new floors'), text: msg('The Wavehouse, from the Container Quay to the Crest, with 3 stars to win on every floor.') },
      { icon: '🔢', title: msg('The tally'), text: msg('Count up, count down, and repeat as many times as the tally says.') },
      { icon: '📏', title: msg('Measure and reuse'), text: msg('Count your steps as you walk with while, then walk the same distance again.') },
      { icon: '📻', title: msg('The story goes on'), text: msg("PATCH's radio calls and the chase after VANTA, plus new harbour music.") },
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
      <div className={`settings plus-sheet pack-sheet pack-${pack}`} role="dialog" aria-label={pack === 'overflow' ? t('Overflow endless mode') : t('{pack} city pack', { pack: name })} onClick={(e) => e.stopPropagation()}>
        <header className="settings-head">
          <button type="button" className="settings-close" aria-label={t('Close')} onClick={() => (fx.tap(), onClose())}>
            ✕
          </button>
          <h2>
            {name} <span className="pack-word">{pack === 'overflow' ? t('endless mode') : t('city pack')}</span>
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
          <p className="set-caption">{pack === 'overflow' ? t('One purchase, yours to keep. Overflow is separate from LoopBot Plus. No subscription and no ads.') : t('One purchase, yours to keep. City packs are separate from LoopBot Plus. No subscription and no ads.')}</p>

          {owned ? (
            <p className="plus-owned">✓ {pack === 'overflow' ? t('Overflow is open') : t('{tower} is open', { tower: t(info.tower) })}</p>
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
