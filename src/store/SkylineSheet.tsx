// The Skyline Pass store screen: every tower and mode in one lifetime purchase, with honest
// wording for players who already own some of it (store/skyline.ts passDeal).

import { Icon } from '../ui/Icon';
import { useState } from 'react';
import { StoreOffline, useStoreLoad } from '../ui/StatusCard';
import { fx } from '../audio/feedback';
import { buySkyline, getSkylineOffer, hasPlus, restorePurchases } from './purchases';
import type { SkylineOffer } from './purchases';
import { ownsPack } from './packs';
import { formatPrice, ownsSkyline, passDeal, savingPercent } from './skyline';
import type { PassItemId } from './skyline';
import { OVERFLOW_ON, TOWERS } from '../levels/towers';
import { TOWER_LIGHT, lightVars } from '../towerLight';
import { lang, msg, t, tn } from '../i18n';
import './skyline.css';

const GOLD = '#f2c46a';

interface Piece {
  id: PassItemId;
  badge: string;
  name: string;
  sub: string;
  light: string;
}

/** What the pass holds in this build: Plus, each city pack whose tower is here, and Overflow. */
export function passPieces(): Piece[] {
  const frost = TOWERS.find((x) => x.plus);
  return [
    { id: 'plus', badge: String(frost?.n ?? 2), name: 'LoopBot Plus', sub: msg('Frostline, Plus looks, daily archive, 20 hints'), light: TOWER_LIGHT[2] },
    ...TOWERS.flatMap((x) => (x.pack ? [{ id: x.pack, badge: String(x.n), name: x.name, sub: x.city, light: TOWER_LIGHT[x.n] ?? TOWER_LIGHT[1] }] : [])),
    ...(OVERFLOW_ON ? [{ id: 'overflow' as const, badge: '∞', name: 'Overflow', sub: msg('Endless climb'), light: GOLD }] : []),
  ];
}

const ownsPiece = (id: PassItemId) => (id === 'plus' ? hasPlus() : ownsPack(id));

/** A night skyline drawn in code: one lit tower per piece of the pass, Babel in gold, and an outline for towers still to come. */
function SkylineArt({ pieces }: { pieces: Piece[] }) {
  const heights = [70, 96, 78, 104, 84, 112, 90, 100, 74];
  const towers = [{ light: TOWER_LIGHT[1], badge: '1' }, ...pieces.map((p) => ({ light: p.light, badge: p.badge }))];
  const w = 300;
  const step = w / (towers.length + 1.4);
  return (
    <svg className="sky-art" viewBox={`0 0 ${w} 140`} aria-hidden="true" preserveAspectRatio="xMidYMax meet">
      <defs>
        <linearGradient id="sky-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141a3a" />
          <stop offset="0.7" stopColor="#2a2456" />
          <stop offset="1" stopColor="#4a2f5e" />
        </linearGradient>
      </defs>
      <rect width={w} height="140" rx="14" fill="url(#sky-night)" />
      {[18, 46, 82, 120, 158, 196, 232, 270, 290].map((x, i) => (
        <circle key={x} className="sky-star" cx={x} cy={10 + ((i * 23) % 40)} r={i % 3 ? 0.9 : 1.4} fill="#fff" style={{ animationDelay: `${i * 0.4}s` }} />
      ))}
      {towers.map((tw, i) => {
        const h = heights[i % heights.length];
        const x = step * 0.5 + i * step;
        const bw = step * 0.72;
        if (tw.badge === '∞') {
          // Overflow: a stepped ziggurat in gold.
          const tiers = [0, 1, 2, 3];
          return (
            <g key={i}>
              {tiers.map((k) => (
                <rect key={k} x={x + (k * bw) / 9} y={140 - (k + 1) * (h / 4)} width={bw - (k * 2 * bw) / 9} height={h / 4 + 0.5} fill={k % 2 ? '#c99a3e' : GOLD} opacity={0.92} />
              ))}
            </g>
          );
        }
        const rows = Math.floor((h - 18) / 9);
        return (
          <g key={i}>
            <rect x={x} y={140 - h} width={bw} height={h} rx="2" fill="#1d1a38" stroke={tw.light} strokeWidth="1.2" />
            <line x1={x + bw / 2} y1={140 - h - 9} x2={x + bw / 2} y2={140 - h} stroke={tw.light} strokeWidth="1.2" />
            <circle className="sky-beacon" cx={x + bw / 2} cy={140 - h - 10} r="2.2" fill={tw.light} style={{ animationDelay: `${i * 0.3}s` }} />
            {Array.from({ length: rows }, (_, r) =>
              [0, 1].map((c) => ((r + c + i) % 3 ? <rect key={`${r}-${c}`} x={x + 3 + c * (bw / 2 - 1)} y={140 - h + 8 + r * 9} width={bw / 2 - 5} height="4" rx="1" fill={tw.light} opacity="0.75" /> : null)),
            )}
          </g>
        );
      })}
      {/* Towers still to come. */}
      <rect x={step * 0.5 + towers.length * step} y={140 - 88} width={step * 0.72} height="88" rx="2" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeDasharray="3 3" />
      <text x={step * 0.5 + towers.length * step + step * 0.36} y={140 - 40} textAnchor="middle" fill="#ffffff" fillOpacity="0.7" fontSize="14" fontWeight="700">
        +
      </text>
    </svg>
  );
}

export function SkylineSheet({ onClose }: { onClose(): void }) {
  const pieces = passPieces();
  const [have, setHave] = useState(ownsSkyline);
  const [owned, setOwned] = useState(() => pieces.filter((p) => ownsPiece(p.id)).map((p) => p.id));
  // (The pieces are fixed for the life of the app.)
  const { value: offer, retry } = useStoreLoad<SkylineOffer | null>(() => getSkylineOffer(pieces.map((p) => p.id)));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const refresh = () => {
    setHave(ownsSkyline());
    setOwned(pieces.filter((p) => ownsPiece(p.id)).map((p) => p.id));
  };

  const o = offer && offer !== 'loading' ? offer : null;
  const money = (n: number) => (o ? formatPrice(n, o.currency, lang() === 'fr' ? 'fr-CA' : 'en') : '');
  const deal = passDeal(
    pieces.map((p) => ({ id: p.id, owned: owned.includes(p.id), price: o?.prices[p.id] })),
    o?.amount,
  );
  // A player who'd do better buying the missing pieces, or who has them all, gets a quieter button.
  const quiet = deal.kind === 'cheaper-alone' || deal.kind === 'owns-all';

  const buy = async () => {
    if (!o || busy) return;
    fx.tap();
    setBusy(true);
    const r = await buySkyline(o);
    setBusy(false);
    if (r === 'bought') {
      fx.cheer();
      refresh();
      setNote(t('Thank you! Every tower is yours on every device signed in to this store.'));
    } else if (r === 'failed') setNote(t("The purchase didn't go through. You haven't been charged."));
  };

  const restore = async () => {
    if (busy) return;
    fx.tap();
    setBusy(true);
    const r = await restorePurchases();
    setBusy(false);
    refresh();
    if (r === 'restored' && ownsSkyline()) setNote(t('Restored. Welcome back!'));
    else if (r === 'restored') setNote(t('Your other purchases were restored. No Skyline Pass was found for this store account.'));
    else if (r === 'nothing') setNote(t('No Skyline Pass purchase was found for this store account.'));
    else setNote(t("Couldn't reach the store. Check your connection and try again."));
  };

  return (
    <div className="results-backdrop settings-screen" onClick={onClose}>
      <div className="settings plus-sheet skyline-sheet" role="dialog" aria-label={t('Skyline Pass')} onClick={(e) => e.stopPropagation()}>
        <header className="settings-head">
          <button type="button" className="settings-close" aria-label={t('Close')} onClick={() => (fx.tap(), onClose())}>
            <Icon name="close" size={24} />
          </button>
          <h2>
            {t('Skyline Pass')}
          </h2>
        </header>
        <div className="settings-body">
          <SkylineArt pieces={pieces} />
          <p className="sky-kicker">{t('Lifetime pass')}</p>
          <p className="plus-lede sky-lede">{t('Every tower, every mode, and every tower still to come. One purchase, yours for good.')}</p>

          {!have && o && (
            <div className={`sky-deal sky-deal-${deal.kind}`} role="note">
              {deal.kind === 'everything' && deal.separately !== undefined && (
                <>
                  <p className="sky-compare">
                    <span className="sky-was">{t('Bought one by one: {price}', { price: money(deal.separately) })}</span>
                    {savingPercent(deal.separately, o.amount) > 0 && <span className="sky-save">{t('Save {n}%', { n: savingPercent(deal.separately, o.amount) })}</span>}
                  </p>
                </>
              )}
              {deal.kind === 'everything' && deal.separately === undefined && <p>{t('All {n} for one price.', { n: deal.count })}</p>}
              {deal.kind === 'adds' && (
                <p>
                  {tn(deal.owned, 'You already own {n} of these.', 'You already own {n} of these.')} {tn(deal.missing, 'The pass adds the other one, and every tower still to come.', 'The pass adds the other {n}, and every tower still to come.')}
                  {deal.separately !== undefined && <> {tn(deal.missing, 'On its own, it costs {price}.', 'On their own, they cost {price}.', { price: money(deal.separately) })}</>}
                </p>
              )}
              {deal.kind === 'cheaper-alone' && (
                <p>
                  {tn(deal.owned, 'You already own {n} of these.', 'You already own {n} of these.')}{' '}
                  {tn(deal.missing, 'The one you are missing costs {price} on its own, less than the pass.', 'The {n} you are missing cost {price} on their own, less than the pass.', { price: money(deal.separately) })}{' '}
                  {t('The pass is worth it only if you want every tower still to come.')}
                </p>
              )}
              {deal.kind === 'owns-all' && <p>{t('You already own everything so far. The pass would only add the towers still to come.')}</p>}
            </div>
          )}

          <ul className="sky-grid">
            {pieces.map((p) => {
              const mine = have || owned.includes(p.id);
              return (
                <li key={p.id} className={`sky-tile${mine ? ' mine' : ''}`} style={lightVars(p.light)}>
                  <span className="tp-badge" aria-hidden="true">
                    {p.badge}
                  </span>
                  <span className="sky-text">
                    <strong>{t(p.name)}</strong>
                    <span className="sky-sub">{t(p.sub)}</span>
                  </span>
                  <span className="sky-state">{mine ? t('Owned ✓') : t('Included')}</span>
                </li>
              );
            })}
            <li className="sky-tile sky-future">
              <span className="tp-badge" aria-hidden="true">
                +
              </span>
              <span className="sky-text">
                <strong>{t('Every tower still to come')}</strong>
                <span className="sky-sub">{t('Yours the day each one opens.')}</span>
              </span>
              <span className="sky-state">{t('Included')}</span>
            </li>
          </ul>

          <p className="set-caption">{owned.length && !have ? t('Stores charge everyone the same price for the pass. What you already bought stays yours.') : t('No subscription and no ads. Tower 1 and the daily challenge stay free for everyone.')}</p>

          {!have && offer === null && <StoreOffline onRetry={retry} />}
          {note && (
            <p className="tip" role="status">
              {note}
            </p>
          )}
        </div>
        <footer className="store-cta">
          {have ? (
            <p className="plus-owned">
              <Icon name="check" size={20} /> {t('You have the Skyline Pass. Every tower is open.')}
            </p>
          ) : (
            <>
              {offer !== null && (
                <button type="button" className={`pill plus-buy sky-buy${quiet ? ' quiet' : ' primary'}`} disabled={busy || !o} onClick={buy}>
                  {offer === 'loading' ? t('Loading price…') : o ? t('Get the Skyline Pass · {price}', { price: o.price }) : t('Store unavailable')}
                </button>
              )}
              <button type="button" className="plus-restore" onClick={restore} disabled={busy}>
                {t('Restore purchases')}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
