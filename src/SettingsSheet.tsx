// Settings: a full screen of collapsible groups (Sound, Look & reading, Playing, Purchases, Your progress,
// Privacy, Help & about). Each header says what's inside; the rows under it are rounded cards, most with
// no caption or a short one. Links open on the KIS Studios site, in the phone's browser on Android.

import { useId, useState } from 'react';
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
import { SkylineSheet } from './store/SkylineSheet';
import { ownsSkyline } from './store/skyline';
import { OVERFLOW_ON, TOWERS } from './levels/towers';
import { bigTextOn, setBigText } from './textSize';
import { deviceReducesMotion, reduceMotionPref, setReduceMotion } from './a11y/motion';
import { useColourful } from './colourful';
import { remindersAvailable } from './reminder';
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

function Toggle({ label, caption, on, onChange, disabled }: { label: string; caption?: string; on: boolean; onChange(on: boolean): void; disabled?: boolean }) {
  // The caption (when there is one) is read after the switch's name by TalkBack and VoiceOver.
  const id = useId();
  return (
    <div className="set-item">
      <label className="set-row">
        <span className="set-label">{label}</span>
        <input type="checkbox" role="switch" className="set-switch" checked={on} disabled={disabled} aria-describedby={caption ? id : undefined} onChange={(e) => onChange(e.target.checked)} />
      </label>
      {caption && (
        <p className="set-caption" id={id}>
          {caption}
        </p>
      )}
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
    </div>
  );
}

/** Which sections are open. Kept while the app runs, so Settings reopens the way you left it. */
const openSections = new Set<string>();

/**
 * One collapsible group: a header row with an icon, the group's name and what's inside, and the rows
 * under it when open. A real button with aria-expanded, so keyboards and screen readers can open it.
 */
function Section({ id, icon, title, sub, children }: { id: string; icon: string; title: string; sub: string; children: ReactNode }) {
  const [open, setOpen] = useState(() => openSections.has(id));
  const bodyId = useId();
  const headId = useId();
  const toggle = () => {
    fx.tap();
    if (open) openSections.delete(id);
    else openSections.add(id);
    setOpen(!open);
  };
  return (
    <section className={`set-group${open ? ' open' : ''}`}>
      <h3 className="set-group-title">
        <button type="button" id={headId} className="set-group-head" aria-expanded={open} aria-controls={bodyId} onClick={toggle}>
          <span className="set-group-icon" aria-hidden="true">
            {icon}
          </span>
          <span className="set-group-text">
            <span className="set-group-name">{title}</span>
            <span className="set-group-sub">{sub}</span>
          </span>
          <span className="set-group-chevron" aria-hidden="true">
            ›
          </span>
        </button>
      </h3>
      <div className="set-group-body" id={bodyId} role="region" aria-labelledby={headId} hidden={!open}>
        {children}
      </div>
    </section>
  );
}

export function SettingsSheet({ progress, setProgress, onClose, floor, floorTitle }: Props) {
  const [sound, setSound] = useState(!isMuted());
  const [music, setMusic] = useState(musicOn());
  const [haptics, setHaptics] = useState(hapticsOn());
  const [bigText, setBigTextState] = useState(bigTextOn);
  const [calm, setCalm] = useState(reduceMotionPref);
  const [colourful, setColourfulState] = useColourful();
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
          <Section id="sound" icon="🔊" title={t('Sound')} sub={t('Music, sound effects, vibration')}>
            <Toggle
              label={t('Music')}
              on={music}
              onChange={(on) => {
                setMusicOn(on);
                setMusic(on);
                fx.tap();
              }}
            />
            <Toggle
              label={t('Sound effects')}
              on={sound}
              onChange={(on) => {
                setMuted(!on);
                setSound(on);
                if (on) fx.tap();
              }}
            />
            <Toggle
              label={t('Vibration')}
              on={haptics}
              onChange={(on) => {
                setHapticsOn(on);
                setHaptics(on);
                if (on) fx.tap();
              }}
            />
          </Section>

          <Section id="look" icon="🎨" title={t('Look & reading')} sub={t('Language, colours, text size, motion')}>
            <LanguageRow />
            <Toggle
              label={t('Colourful mode')}
              caption={t('Bright candy colours. Also on the home screen: 🍬')}
              on={colourful}
              onChange={(on) => {
                setColourfulState(on);
                fx.tap();
              }}
            />
            <Toggle
              label={t('Larger text')}
              caption={t('For the program, blocks, story and menus')}
              on={bigText}
              onChange={(on) => {
                setBigText(on);
                setBigTextState(on);
                fx.tap();
              }}
            />
            <Toggle
              label={t('Reduce motion')}
              caption={deviceReducesMotion() ? t('On because your device asks for less motion.') : t('No confetti, bobbing, glowing eyes or typing text')}
              on={calm || deviceReducesMotion()}
              disabled={deviceReducesMotion()}
              onChange={(on) => {
                setReduceMotion(on);
                setCalm(on);
                fx.tap();
              }}
            />
          </Section>

          <Section id="play" icon="🎮" title={t('Playing')} sub={remindersAvailable() ? t('Tutorial tips, daily reminder') : t('Tutorial tips')}>
            <Toggle
              label={t('Tutorial tips')}
              caption={t('Tips on the first floors of each new idea')}
              on={progress.tutorial}
              onChange={(on) => setProgress((p) => ({ ...p, tutorial: on }))}
            />
            <ReminderRows />
          </Section>

          {SHOP_OPEN && (
            <Section id="shop" icon="🛍" title={t('Subscriptions & Purchases')} sub={t('Skyline Pass, Plus, city packs, hints')}>
              <PurchaseRows hints={progress.hints} />
            </Section>
          )}

          <Section id="progress" icon="💾" title={t('Your progress')} sub={t('Back up or restore your floors')}>
            <BackupRows />
          </Section>

          <Section id="privacy" icon="🔒" title={t('Privacy')} sub={TELEMETRY_AVAILABLE ? t('Anonymous stats, policy, terms') : t('Policy and terms')}>
            {TELEMETRY_AVAILABLE && (
              <Toggle
                label={t('Share anonymous stats')}
                caption={t('Which floors are tricky, so we can fix them. No name, email or account.')}
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
              <p className="set-caption">{t('No personal data. Your progress stays on this device.')}</p>
            </div>
            <div className="set-item">
              <LinkRow href={`${SITE}/terms`}>{t('Terms of service')}</LinkRow>
            </div>
          </Section>

          <Section id="help" icon="💬" title={t('Help & about')} sub={t('Send feedback, who made LoopBot')}>
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
              <LinkRow href="https://www.kisstudios.net/" value="KIS Studios">
                {t('Made by')}
              </LinkRow>
            </div>
          </Section>

          <p className="settings-version">{t('Version {version}', { version })}</p>
        </div>
      </div>
    </div>
  );
}

/** The city packs this build sells: the ones whose tower is in it. */
const SOLD_PACKS = TOWERS.flatMap((tw) => (tw.pack ? [{ id: tw.pack, city: tw.city, tower: tw.name }] : []));
/** Overflow is sold when the city packs are (it rides on the same switches). */
const SELLS_OVERFLOW = OVERFLOW_ON;

/** Settings > Subscriptions & Purchases: LoopBot Plus, city packs, hints and Restore (Kevin, Nov 7: Almanac style). */
function PurchaseRows({ hints }: { hints: number }) {
  const [sheet, setSheet] = useState(false);
  const [shop, setShop] = useState(false);
  const [pack, setPack] = useState<PackId | null>(null);
  const [owned, setOwned] = useState(hasPlus);
  const owns = () => [...SOLD_PACKS.map((p) => p.id), ...(SELLS_OVERFLOW ? (['overflow'] as const) : [])].filter((id) => ownsPack(id));
  const [packs, setPacks] = useState(owns);
  const refreshPacks = () => setPacks(owns());
  const [skyline, setSkyline] = useState(false);
  const [pass, setPass] = useState(ownsSkyline);
  /** What a row says when it's owned: through the Skyline Pass, or bought on its own. */
  const ownedLabel = () => (pass ? t('In your pass ✓') : t('Owned ✓'));
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const restore = async () => {
    if (busy) return;
    fx.tap();
    setBusy(true);
    const r = await restorePurchases();
    setBusy(false);
    setOwned(hasPlus());
    setPass(ownsSkyline());
    refreshPacks();
    setNote(r === 'restored' ? t('Purchases restored.') : r === 'nothing' ? t('No purchases found for this store account.') : t("Couldn't reach the store. Try again later."));
  };
  return (
    <>
      <div className="set-item">
        <button type="button" className="set-row set-link sky-row" onClick={() => (fx.tap(), setSkyline(true))}>
          <span className="set-label">{t('Skyline Pass')}</span>
          <span className="set-value">{pass ? t('Owned ✓') : t('Get')}</span>
          <span className="set-chevron" aria-hidden="true">
            ›
          </span>
        </button>
        <p className="set-caption">{t('Everything here, plus every tower still to come. One purchase.')}</p>
      </div>
      <div className="set-item">
        <button type="button" className="set-row set-link" onClick={() => (fx.tap(), setSheet(true))}>
          <span className="set-label">LoopBot Plus</span>
          <span className="set-value">{owned ? ownedLabel() : t('Get')}</span>
          <span className="set-chevron" aria-hidden="true">
            ›
          </span>
        </button>
        <p className="set-caption">{t('Frostline, looks, the daily archive and 20 hints. No subscription.')}</p>
      </div>
      {SOLD_PACKS.map((p) => (
        <div className="set-item" key={p.id}>
          <button type="button" className="set-row set-link" onClick={() => (fx.tap(), setPack(p.id))}>
            <span className="set-label">
              {t('{city} city pack', { city: t(p.city) })}
              <span className="set-label-sub">{t(p.tower)}</span>
            </span>
            <span className="set-value">{packs.includes(p.id) ? ownedLabel() : t('Get')}</span>
            <span className="set-chevron" aria-hidden="true">
              ›
            </span>
          </button>
        </div>
      ))}
      {SELLS_OVERFLOW && (
        <div className="set-item">
          <button type="button" className="set-row set-link" onClick={() => (fx.tap(), setPack('overflow'))}>
            <span className="set-label">
              Overflow
              <span className="set-label-sub">{t('The endless climb')}</span>
            </span>
            <span className="set-value">{packs.includes('overflow') ? ownedLabel() : t('Get')}</span>
            <span className="set-chevron" aria-hidden="true">
              ›
            </span>
          </button>
        </div>
      )}
      <p className="set-caption set-note">{t('City packs and Overflow are sold on their own, not part of Plus.')}</p>
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
        <p className="set-caption">{note ?? t('On a new device or after reinstalling.')}</p>
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
      {skyline && (
        <SkylineSheet
          onClose={() => {
            setSkyline(false);
            setPass(ownsSkyline());
            setOwned(hasPlus());
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
