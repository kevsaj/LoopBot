// In-game feedback: pick what it is about, type a few words, send. The floor and app version
// go along automatically so Kevin knows where the player was. Without an endpoint in this build
// (or if sending fails) it offers the same message as an email instead.

import { useState } from 'react';
import { fx } from './audio/feedback';
import type { FeedbackContext } from './telemetry';
import { TELEMETRY_AVAILABLE, feedbackMailto, sendFeedback } from './telemetry';

const MOODS = [
  { key: 'stuck', label: 'Stuck', icon: '🤔' },
  { key: 'bug', label: 'Bug', icon: '🐞' },
  { key: 'idea', label: 'Idea', icon: '💡' },
  { key: 'love', label: 'Love it', icon: '💜' },
] as const;

interface Props extends FeedbackContext {
  onClose(): void;
}

export function FeedbackSheet({ floor, floorTitle, onClose }: Props) {
  const [mood, setMood] = useState<string>(floor ? 'stuck' : 'idea');
  const [text, setText] = useState('');
  const [state, setState] = useState<'edit' | 'sending' | 'sent' | 'failed'>('edit');
  const ctx = { floor, floorTitle };

  const send = async () => {
    if (!text.trim()) return fx.denied();
    fx.tap();
    setState('sending');
    const ok = await sendFeedback(text.trim(), mood, ctx);
    if (ok) fx.win();
    setState(ok ? 'sent' : 'failed');
  };

  return (
    <div className="results-backdrop" onClick={onClose}>
      <div className="results sheet feedback" role="dialog" aria-label="Send feedback" onClick={(e) => e.stopPropagation()}>
        {state === 'sent' ? (
          <>
            <h2>Thanks!</h2>
            <p className="tip">Your note is on its way. Every message helps make LoopBot better.</p>
            <div className="results-actions">
              <button type="button" className="pill primary" onClick={() => (fx.tap(), onClose())}>
                Back to the game
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>Send feedback</h2>
            {floor && <p className="tip fb-where">About {floorTitle ? `“${floorTitle}”` : 'this floor'}</p>}
            <div className="fb-moods" role="radiogroup" aria-label="What is it about?">
              {MOODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  role="radio"
                  aria-checked={mood === m.key}
                  className={`fb-mood${mood === m.key ? ' on' : ''}`}
                  onClick={() => (fx.tap(), setMood(m.key))}
                >
                  <span aria-hidden="true">{m.icon}</span> {m.label}
                </button>
              ))}
            </div>
            {TELEMETRY_AVAILABLE ? (
              <>
                <textarea
                  className="fb-text"
                  rows={4}
                  maxLength={2000}
                  placeholder="What happened? What did you expect?"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={state === 'sending'}
                />
                <p className="set-caption fb-note">
                  Sent anonymously with the floor and app version. Please leave out your name and contact details. Want a reply?{' '}
                  <a href={feedbackMailto(ctx)} target="_blank" rel="noreferrer">
                    Email us
                  </a>
                  .
                </p>
                {state === 'failed' && (
                  <p className="tip fb-error">
                    Couldn't send (no internet?).{' '}
                    <a href={feedbackMailto(ctx)} target="_blank" rel="noreferrer">
                      Send it by email
                    </a>{' '}
                    or try again later.
                  </p>
                )}
                <div className="results-actions">
                  <button type="button" className="pill" onClick={() => (fx.tap(), onClose())}>
                    Cancel
                  </button>
                  <button type="button" className="pill primary" disabled={state === 'sending' || !text.trim()} onClick={send}>
                    {state === 'sending' ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="tip">Tell us by email: the floor and app version are filled in for you.</p>
                <div className="results-actions">
                  <button type="button" className="pill" onClick={() => (fx.tap(), onClose())}>
                    Cancel
                  </button>
                  <a className="pill primary" href={feedbackMailto(ctx)} target="_blank" rel="noreferrer" onClick={() => fx.tap()}>
                    Write an email
                  </a>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
