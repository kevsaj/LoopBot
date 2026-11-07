import { useState } from 'react';
import type { Progress } from './progress';
import { isMuted, setMuted } from './audio/feedback';

/** LoopBot's pages on the KIS Studios site, also linked from the Google Play listing. */
export const SITE = 'https://www.kisstudios.net/loopbot';

interface Props {
  progress: Progress;
  setProgress(update: (p: Progress) => Progress): void;
  onClose(): void;
}

export function SettingsSheet({ progress, setProgress, onClose }: Props) {
  const [muted, setMutedState] = useState(isMuted());
  return (
    <div className="results-backdrop" onClick={onClose}>
      <div className="results sheet" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        <label className="setting">
          <span>Sound and vibration</span>
          <input
            type="checkbox"
            checked={!muted}
            onChange={() => {
              setMuted(!muted);
              setMutedState(!muted);
            }}
          />
        </label>
        <label className="setting">
          <span>First-run tutorial tips</span>
          <input type="checkbox" checked={progress.tutorial} onChange={() => setProgress((p) => ({ ...p, tutorial: !p.tutorial }))} />
        </label>
        {/* On Android these open in the phone's browser. */}
        <p className="settings-links">
          <a href={`${SITE}/privacy`} target="_blank" rel="noreferrer">
            Privacy policy
          </a>
          <span aria-hidden="true"> · </span>
          <a href={`${SITE}/terms`} target="_blank" rel="noreferrer">
            Terms of use
          </a>
        </p>
        <div className="results-actions">
          <button type="button" className="pill primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
