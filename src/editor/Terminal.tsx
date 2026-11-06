// The terminal line under the board. Story lines type out with a radio crackle;
// status and error lines appear at once.

import { useEffect, useState } from 'react';
import { fx } from '../audio/feedback';

const SPEAKER = /^(PATCH|VANTA)\b:?\s*/;

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
      {speaker && <span className={`speaker speaker-${speaker.toLowerCase()}`}>{speaker}</span>}
      <span aria-hidden="true">{body.slice(0, shown)}</span>
      {shown < body.length && <span className="caret" aria-hidden="true">▍</span>}
    </div>
  );
}
