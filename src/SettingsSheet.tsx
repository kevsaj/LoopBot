// Settings: a full screen of grouped rows (General, Privacy, About), each row a rounded card
// with a short caption under it. Links open on the KIS Studios site, in the phone's browser on Android.

import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Progress } from './progress';
import { fx, hapticsOn, isMuted, setHapticsOn, setMuted } from './audio/feedback';
import { version } from '../package.json';

/** LoopBot's pages on the KIS Studios site, also linked from the Google Play listing. */
export const SITE = 'https://www.kisstudios.net/loopbot';

interface Props {
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

export function SettingsSheet({ progress, setProgress, onClose }: Props) {
  const [sound, setSound] = useState(!isMuted());
  const [haptics, setHaptics] = useState(hapticsOn());
  return (
    // The backdrop class lets Android's Back close this screen like any other sheet.
    <div className="results-backdrop settings-screen" onClick={onClose}>
      <div className="settings" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <header className="settings-head">
          <button type="button" className="settings-close" aria-label="Close settings" onClick={() => (fx.tap(), onClose())}>
            ✕
          </button>
          <h2>Settings</h2>
        </header>

        <div className="settings-body">
          <h3 className="set-section">General</h3>
          <Toggle
            label="Sound"
            caption="Clicks, LoopBot's chirps and the fanfare when you clear a floor"
            on={sound}
            onChange={(on) => {
              setMuted(!on);
              setSound(on);
              if (on) fx.tap();
            }}
          />
          <Toggle
            label="Vibration"
            caption="A small buzz on taps, bumps and cleared floors"
            on={haptics}
            onChange={(on) => {
              setHapticsOn(on);
              setHaptics(on);
              if (on) fx.tap();
            }}
          />
          <Toggle
            label="Tutorial tips"
            caption="Step-by-step tips on the first floors of each new idea"
            on={progress.tutorial}
            onChange={(on) => setProgress((p) => ({ ...p, tutorial: on }))}
          />

          <h3 className="set-section">Privacy</h3>
          <div className="set-item">
            <LinkRow href={`${SITE}/privacy`}>Privacy policy</LinkRow>
            <p className="set-caption">LoopBot collects no personal data. Your progress stays on this device.</p>
          </div>
          <div className="set-item">
            <LinkRow href={`${SITE}/terms`}>Terms of service</LinkRow>
          </div>

          <h3 className="set-section">About</h3>
          <div className="set-item">
            <LinkRow href="mailto:kisstudios98@gmail.com?subject=LoopBot%20feedback">Send feedback</LinkRow>
            <p className="set-caption">Found a bug or stuck on a floor? We read every message.</p>
          </div>
          <div className="set-item">
            <div className="set-row">
              <span className="set-label">Version</span>
              <span className="set-value">{version}</span>
            </div>
          </div>
          <div className="set-item">
            <LinkRow href="https://www.kisstudios.net/" value="KIS Studios">
              Made by
            </LinkRow>
          </div>
        </div>
      </div>
    </div>
  );
}
