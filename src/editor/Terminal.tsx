// The terminal line under the board. Story lines type out with a radio crackle;
// status and error lines appear at once.

import { useEffect, useState } from 'react';
import { fx } from '../audio/feedback';

const SPEAKER = /^(PATCH|VANTA)\b:?\s*/;

/** Tiny in-house portraits: PATCH is an old radio terminal, VANTA a single red eye on a PA screen. */
export function Portrait({ who }: { who: string }) {
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
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
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
    <div className={`terminal status-${status}${story ? ' story' : ''}`} role="status" aria-label={text}>
      {speaker && (
        <span className={`speaker speaker-${speaker.toLowerCase()}`}>
          <Portrait who={speaker} />
          {speaker}
        </span>
      )}
      <span aria-hidden="true">{body.slice(0, shown)}</span>
      {shown < body.length && <span className="caret" aria-hidden="true">▍</span>}
    </div>
  );
}
