// The terminal line under the board. Story lines type out with a radio crackle;
// status and error lines appear at once.

import { useEffect, useState } from 'react';
import { fx } from '../audio/feedback';
import { reducedMotion } from '../a11y/motion';

const SPEAKER = /^(PATCH|VANTA|DASH|BULWARK|LEDGER|ROOK)\b\s*:?\s*/;

/**
 * Tiny in-house portraits: PATCH is an old radio terminal, VANTA a single red eye on a PA screen.
 * Precinct 404's squad: DASH in a blue cap, BULWARK broad and green, LEDGER grey with a red badge,
 * ROOK behind a dark visor.
 */
export function Portrait({ who }: { who: string }) {
  if (who === 'DASH' || who === 'LEDGER') {
    const body = who === 'DASH' ? '#4a7ae8' : '#6c7180';
    const cap = who === 'DASH' ? '#1c2c58' : '#23252c';
    const badge = who === 'DASH' ? '#ffd24a' : '#e8464a';
    return (
      <svg className="portrait" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="3" y="5" width="10" height="9" rx="2" fill={body} />
        <rect x="4.5" y="8" width="7" height="3.4" rx="1.2" fill="#0e1630" />
        <circle cx={who === 'DASH' ? 9.6 : 8} cy="9.7" r="1.1" fill={who === 'DASH' ? '#ffd24a' : '#cfe6ff'} />
        <rect x="3.5" y="2.2" width="9" height="3" rx="1" fill={cap} />
        <rect x="2" y="4.6" width="12" height="1.4" rx="0.7" fill={cap} />
        <circle cx="8" cy="3.6" r="0.9" fill={badge} />
      </svg>
    );
  }
  if (who === 'BULWARK') {
    return (
      <svg className="portrait" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="0.5" y="7" width="15" height="8" rx="2.5" fill="#3d6b3a" />
        <rect x="3" y="2" width="10" height="8" rx="2" fill="#5a8a54" />
        <rect x="4.5" y="4.5" width="7" height="2.6" rx="1.2" fill="#14200f" />
        <circle cx="6.4" cy="5.8" r="0.9" fill="#d6ffb0" />
        <circle cx="9.6" cy="5.8" r="0.9" fill="#d6ffb0" />
        <path d="M6 8.6q2 1.2 4 0" stroke="#d6ffb0" strokeWidth="0.8" fill="none" />
      </svg>
    );
  }
  if (who === 'ROOK') {
    return (
      <svg className="portrait" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 9a5 5 0 0 1 10 0v5H3z" fill="#2a2a32" stroke="#8a8aa0" strokeWidth="0.8" />
        <rect x="4" y="7.2" width="8" height="2.6" rx="1.3" fill="#9a4aff" />
        <rect x="5" y="12" width="6" height="1" fill="#8a8aa0" />
      </svg>
    );
  }
  if (who === 'VANTA') {
    return (
      <svg className="portrait" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="1" y="2" width="14" height="11" rx="2" fill="#2b1420" stroke="#ff8a9a" strokeWidth="1" />
        <circle cx="8" cy="7.5" r="3" fill="#ff4d6a" />
        <circle cx="8" cy="7.5" r="1.2" fill="#ffe0e5" />
        <rect x="6" y="13" width="4" height="2" fill="#ff8a9a" />
      </svg>
    );
  }
  return (
    <svg className="portrait" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1" y="4" width="14" height="10" rx="2" fill="#173049" stroke="#9fd2ff" strokeWidth="1" />
      <line x1="11" y1="4" x2="13" y2="0.5" stroke="#9fd2ff" strokeWidth="1" />
      <rect x="3" y="6.5" width="5" height="5" rx="1" fill="#7ff2e0" />
      <line x1="10" y1="7" x2="13" y2="7" stroke="#9fd2ff" />
      <line x1="10" y1="9" x2="13" y2="9" stroke="#9fd2ff" />
      <line x1="10" y1="11" x2="13" y2="11" stroke="#9fd2ff" />
    </svg>
  );
}

export function Terminal({ text, status }: { text: string; status: string }) {
  const story = !text.startsWith('>') && !text.startsWith('ERR');
  const speaker = text.match(SPEAKER)?.[1] ?? null;
  const body = speaker ? text.replace(SPEAKER, '') : text;
  const [shown, setShown] = useState(story ? 0 : body.length);

  useEffect(() => {
    if (!story) {
      setShown(body.length);
      return;
    }
    if (reducedMotion()) {
      setShown(body.length);
      return;
    }
    if (speaker) fx.radio();
    setShown(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(i);
      if (i % 3 === 0) fx.type();
      if (i >= body.length) window.clearInterval(id);
    }, 24);
    return () => window.clearInterval(id);
  }, [text, story, speaker, body.length]);

  return (
    // The whole line sits in the live region as plain text, for TalkBack and VoiceOver to read when
    // it changes (a label on the box isn't read out). The typed-out copy beside it is for the eyes.
    <div className={`terminal status-${status}${story ? ' story' : ''}`} role="status">
      <span className="sr-only">{text}</span>
      {speaker && (
        <span aria-hidden="true" className={`speaker speaker-${speaker.toLowerCase()}`}>
          <Portrait who={speaker} />
          {speaker}
        </span>
      )}
      <span aria-hidden="true">{body.slice(0, shown)}</span>
      {shown < body.length && <span className="caret" aria-hidden="true">▍</span>}
    </div>
  );
}
