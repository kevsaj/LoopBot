// Settings: a full screen of grouped rows (General, Your progress, Privacy, About), each row a rounded card
// with a short caption under it. Links open on the KIS Studios site, in the phone's browser on Android.

import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Progress } from './progress';
import { fx, hapticsOn, isMuted, setHapticsOn, setMuted } from './audio/feedback';
import { musicOn, setMusicOn } from './audio/music';
import { SHOP_OPEN, hasPlus, restorePurchases } from './store/purchases';
import { ownsPack } from './store/packs';
import type { PackId } from './store/packs';
import { HintShop } from './store/HintShop';
import { PlusSheet } from './store/PlusSheet';
import { PackSheet } from './store/PackSheet';
import { TOWERS } from './levels/towers';
import { bigTextOn, setBigText } from './textSize';
import { version } from '../package.json';
import { FeedbackSheet } from './FeedbackSheet';
import { BackupRows } from './BackupRows';
import { ReminderRows } from './ReminderRows';
import type { FeedbackContext } from './telemetry';
import { TELEMETRY_AVAILABLE, setStatsOn, statsOn } from './telemetry';
import { LANGUAGES, deviceLang, langPref, setLangPref, t } from './i18n';
import type { LangPref } from './i18n';

/** LoopBot's pages on the KIS Studios site, also linked from the Google Play listing. */
export const SITE = 'https://www.kisstudios.net/loopbot';

interface Props extends FeedbackContext {
  progress: Progress;
  setProgress(update: (p: Progress) => Progress): void;
  onClose(): void;
}

function Toggle({ label, caption, on, onChange }: { label: string; caption: string; on: boolean; onChange(on: boolean): void }) {
  return (
    <div className="set-item">
      <label className="set-row">
        <span className="set-label">{label}</span>
        <input type="checkbox" role="switch" className="set-switch" checked={on} onChange={(e) => onChange(e.target.checked)} />
      </label>
      <p className="set-caption">{caption}</p>
    </div>
  );
}

function LinkRow({ href, children, value }: { href: string; children: ReactNode; value?: string }) {
  return (
    <a className="set-row set-link" href={href} target="_blank" rel="noreferrer" onClick={() => fx.tap()}>
      <span className="set-label">{children}</span>
      {value && <span className="set-value">{value}</span>}
      <span className="set-chevron" aria-hidden="true">
        ›
      </span>
    </a>
  );
}

/** Settings > Language: follow the phone, or pick one. Each language is named in itself. */
function LanguageRow() {
  const [pref, setPref] = useState<LangPref>(langPref);
  const device = LANGUAGES.find((l) => l.code === deviceLang())?.name ?? 'English';
  return (
    <div className="set-item">
      <label className="set-row">
        <span className="set-label">{t('Language')}</span>
        <select
          className="set-select"
          value={pref}
          onChange={(e) => {
            const next = e.target.value as LangPref;
            fx.tap();
            setPref(next);
            setLangPref(next);
          }}
        >
          <option value="auto">{t('Automatic ({language})', { language: device })}</option>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code} lang={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <p className="set-caption">{t("Automatic follows your device's language.")}</p>
    </div>
  );
}

export function SettingsSheet({ progress, setProgress, onClose, floor, floorTitle }: Props) {
  const [sound, setSound] = useState(!isMuted());
  const [music, setMusic] = useState(musicOn());
  const [haptics, setHaptics] = useState(hapticsOn());
  const [bigText, setBigTextState] = useState(bigTextOn);
  const [stats, setStats] = useState(statsOn());
  const [feedback, setFeedback] = useState(false);
  if (feedback) return <FeedbackSheet floor={floor} floorTitle={floorTitle} onClose={() => setFeedback(false)} />;
  return (
    // The backdrop class lets Android's Back close this screen like any other sheet.
    <div className="results-backdrop settings-screen" onClick={onClose}>
      <div className="settings" role="dialog" aria-label={t('Settings')} onClick={(e) => e.stopPropagation()}>
        <header className="settings-head">
          <button type="button" className="settings-close" aria-label={t('Close settings')} onClick={() => (fx.tap(), onClose())}>
            ✕
          </button>
          <h2>{t('Settings')}</h2>
        </header>

        <div className="settings-body">
          <h3 className="set-section">{t('General')}</h3>
          <LanguageRow />
          <Toggle
            label={t('Music')}
            caption={t('A theme for each part of the tower')}
            on={music}
            onChange={(on) => {
              setMusicOn(on);
              setMusic(on);
              fx.tap();
            }}
          />
          <Toggle
            label={t('Sound effects')}
            caption={t("Clicks, LoopBot's chirps and the fanfare when you clear a floor")}
            on={sound}
            onChange={(on) => {
              setMuted(!on);
              setSound(on);
              if (on) fx.tap();
            }}
          />
          <Toggle
            label={t('Vibration')}
            caption={t('A small buzz on taps, bumps and cleared floors')}
            on={haptics}
            onChange={(on) => {
              setHapticsOn(on);
              setHaptics(on);
              if (on) fx.tap();
            }}
          />
          <Toggle
            label={t('Larger text')}
            caption={t('Bigger text for the program, the palette, the story and the menus')}
            on={bigText}
            onChange={(on) => {
              setBigText(on);
              setBigTextState(on);
              fx.tap();
            }}
          />
          <Toggle
            label={t('Tutorial tips')}
            caption={t('Step-by-step tips on the first floors of each new idea')}
            on={progress.tutorial}
            onChange={(on) => setProgress((p) => ({ ...p, tutorial: on }))}
          />

          <ReminderRows />

          {SHOP_OPEN && <PurchaseRows hints={progress.hints} />}

          <h3 className="set-section">{t('Your progress')}</h3>
          <BackupRows />

          <h3 className="set-section">{t('Privacy')}</h3>
          {TELEMETRY_AVAILABLE && (
            <Toggle
              label={t('Share anonymous stats')}
              caption={t('Which floors are tricky (runs, hints, time per floor), so we can make them better. No name, email or account.')}
              on={stats}
              onChange={(on) => {
                setStatsOn(on);
                setStats(on);
                fx.tap();
              }}
            />
          )}
          <div className="set-item">
            <LinkRow href={`${SITE}/privacy`}>{t('Privacy policy')}</LinkRow>
            <p className="set-caption">{t('LoopBot collects no personal data. Your progress stays on this device.')}</p>
          </div>
          <div className="set-item">
            <LinkRow href={`${SITE}/terms`}>{t('Terms of service')}</LinkRow>
          </div>

          <h3 className="set-section">{t('About')}</h3>
          <div className="set-item">
            <button type="button" className="set-row set-link" onClick={() => (fx.tap(), setFeedback(true))}>
              <span className="set-label">{t('Send feedback')}</span>
              <span className="set-chevron" aria-hidden="true">
                ›
              </span>
            </button>
            <p className="set-caption">{t('Found a bug or stuck on a floor? We read every message.')}</p>
          </div>
          <div className="set-item">
            <div className="set-row">
              <span className="set-label">{t('Version')}</span>
              <span className="set-value">{version}</span>
            </div>
          </div>
          <div className="set-item">
            <LinkRow href="https://www.kisstudios.net/" value="KIS Studios">
              {t('Made by')}
            </LinkRow>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The city packs this build sells: the ones whose tower is in it. */
const SOLD_PACKS = TOWERS.flatMap((tw) => (tw.pack ? [{ id: tw.pack, city: tw.city, tower: tw.name }] : []));

/** Settings > Subscriptions & Purchases: LoopBot Plus, city packs, hints and Restore (Kevin, Nov 7: Almanac style). */
function PurchaseRows({ hints }: { hints: number }) {
  const [sheet, setSheet] = useState(false);
  const [shop, setShop] = useState(false);
  const [pack, setPack] = useState<PackId | null>(null);
  const [owned, setOwned] = useState(hasPlus);
  const [packs, setPacks] = useState(() => SOLD_PACKS.filter((p) => ownsPack(p.id)).map((p) => p.id));
  const refreshPacks = () => setPacks(SOLD_PACKS.filter((p) => ownsPack(p.id)).map((p) => p.id));
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const restore = async () => {
    if (busy) return;
    fx.tap();
    setBusy(true);
    const r = await restorePurchases();
    setBusy(false);
    setOwned(hasPlus());
    refreshPacks();
    setNote(r === 'restored' ? t('Purchases restored.') : r === 'nothing' ? t('No purchases found for this store account.') : t("Couldn't reach the store. Try again later."));
  };
  return (
    <>
      <h3 className="set-section">{t('Subscriptions & Purchases')}</h3>
      <div className="set-item">
        <button type="button" className="set-row set-link" onClick={() => (fx.tap(), setSheet(true))}>
          <span className="set-label">LoopBot Plus</span>
          <span className="set-value">{owned ? t('Owned ✓') : t('Get')}</span>
          <span className="set-chevron" aria-hidden="true">
            ›
          </span>
        </button>
        <p className="set-caption">{t('Frostline, Plus looks, the daily archive, more streak freezes and 20 hints. One purchase, no subscription.')}</p>
      </div>
      {SOLD_PACKS.map((p) => (
        <div className="set-item" key={p.id}>
          <button type="button" className="set-row set-link" onClick={() => (fx.tap(), setPack(p.id))}>
            <span className="set-label">{t('{city} city pack', { city: t(p.city) })}</span>
            <span className="set-value">{packs.includes(p.id) ? t('Owned ✓') : t('Get')}</span>
            <span className="set-chevron" aria-hidden="true">
              ›
            </span>
          </button>
          <p className="set-caption">{t('{tower}: 50 floors in its own tower. Sold on its own, not part of Plus.', { tower: t(p.tower) })}</p>
        </div>
      ))}
      <div className="set-item">
        <button type="button" className="set-row set-link" onClick={() => (fx.tap(), setShop(true))}>
          <span className="set-label">{t('Hint packs')}</span>
          <span className="set-value">{hints} 💡</span>
          <span className="set-chevron" aria-hidden="true">
            ›
          </span>
        </button>
      </div>
      <div className="set-item">
        <button type="button" className="set-row set-link" onClick={restore} disabled={busy}>
          <span className="set-label">{t('Restore purchases')}</span>
        </button>
        <p className="set-caption">{note ?? t('Bought Plus or a city pack on another device, or reinstalled? Restore them here.')}</p>
      </div>
      {shop && <HintShop hints={hints} onClose={() => setShop(false)} />}
      {pack && (
        <PackSheet
          pack={pack}
          onClose={() => {
            setPack(null);
            refreshPacks();
          }}
        />
      )}
      {sheet && (
        <PlusSheet
          onClose={() => {
            setSheet(false);
            setOwned(hasPlus());
          }}
        />
      )}
    </>
  );
}
