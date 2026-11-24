// The two player questions (see ./index.ts): the "what stopped you?" card on the tower map,
// and the three-tap "Help shape LoopBot?" sheet opened from the results card.

import { useEffect, useState } from 'react';
import { fx } from '../audio/feedback';
import { Icon } from '../ui/Icon';
import { msg, t } from '../i18n';
import { EXIT_REASONS, sendExitReason, sendSurvey } from './index';
import type { ExitReason, KeepPlaying } from './index';

const REASON_LABEL: Record<ExitReason, string> = {
  confusing: msg('Confusing'),
  boring: msg('Boring'),
  hard: msg('Too hard'),
  phone: msg('Phone trouble'),
  busy: msg('Just busy'),
};

/** A small card at the bottom of the tower map. Not a dialog: the map stays usable behind it. */
export function ExitCard({ floor, floorTitle, onDone }: { floor: string; floorTitle: string; onDone(): void }) {
  const [reason, setReason] = useState<ExitReason | null>(null);
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  useEffect(() => {
    if (!sent) return;
    const id = window.setTimeout(onDone, 2200);
    return () => window.clearTimeout(id);
  }, [sent, onDone]);

  const send = () => {
    if (!reason) return;
    fx.tap();
    // Fire and forget: the player has already moved on, and a lost answer costs nothing.
    void sendExitReason(floor, floorTitle, reason, text);
    setSent(true);
  };

  return (
    <section className="ask-card" role="region" aria-label={t('Quick one: what stopped you?')}>
      {sent ? (
        <p className="ask-thanks" role="status">
          <Icon name="check" size={18} /> {t('Thanks! That really helps.')}
        </p>
      ) : (
        <>
          <div className="ask-head">
            <h2>{t('Quick one: what stopped you?')}</h2>
            <button type="button" className="ask-skip" onClick={() => (fx.tap(), onDone())}>
              {t('Skip')}
            </button>
          </div>
          <div className="ask-chips" role="radiogroup" aria-label={t('What stopped you?')}>
            {EXIT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={reason === r}
                className={`fb-mood${reason === r ? ' on' : ''}`}
                onClick={() => (fx.tap(), setReason(r))}
              >
                {t(REASON_LABEL[r])}
              </button>
            ))}
          </div>
          {reason && (
            <>
              <input
                className="fb-text ask-text"
                type="text"
                maxLength={300}
                placeholder={t('Anything else? (optional)')}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
              />
              <button type="button" className="pill primary ask-send" onClick={send}>
                {t('Send')}
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}

const KEEP: { key: KeepPlaying; label: string }[] = [
  { key: 'yes', label: msg('Yes') },
  { key: 'maybe', label: msg('Maybe') },
  { key: 'no', label: msg('No') },
];

/** Three quick taps after Floor 5: how fun, will you keep playing, what would make it better. */
export function SurveySheet({ floor, floorTitle, onSent, onClose }: { floor: string; floorTitle: string; onSent(): void; onClose(): void }) {
  const [fun, setFun] = useState(0);
  const [keep, setKeep] = useState<KeepPlaying | null>(null);
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const ready = fun > 0 && keep !== null;

  const send = () => {
    if (!ready) return fx.denied();
    fx.tap();
    void sendSurvey(floor, floorTitle, fun, keep!, text);
    fx.win();
    setSent(true);
    onSent();
  };

  return (
    <div className="results-backdrop survey-backdrop" onClick={onClose}>
      <div className="results sheet feedback survey" role="dialog" aria-label={t('Help shape LoopBot?')} onClick={(e) => e.stopPropagation()}>
        {sent ? (
          <>
            <h2>{t('Thanks!')}</h2>
            <p className="tip">{t('Your answers are on their way. They help decide what comes next.')}</p>
            <div className="results-actions">
              <button type="button" className="pill primary" onClick={() => (fx.tap(), onClose())}>
                {t('Back to the game')}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>{t('Help shape LoopBot?')}</h2>
            <p className="survey-q" id="survey-fun">{t('How fun is it so far?')}</p>
            <div className="survey-scale" role="radiogroup" aria-labelledby="survey-fun">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={fun === n}
                  aria-label={t('{n} out of 5', { n })}
                  className={`fb-mood${fun === n ? ' on' : ''}`}
                  onClick={() => (fx.tap(), setFun(n))}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="survey-ends" aria-hidden="true">
              <span>{t('Not fun')}</span>
              <span>{t('Loads of fun')}</span>
            </p>
            <p className="survey-q" id="survey-keep">{t('Will you keep playing?')}</p>
            <div className="survey-keep" role="radiogroup" aria-labelledby="survey-keep">
              {KEEP.map((k) => (
                <button
                  key={k.key}
                  type="button"
                  role="radio"
                  aria-checked={keep === k.key}
                  className={`fb-mood${keep === k.key ? ' on' : ''}`}
                  onClick={() => (fx.tap(), setKeep(k.key))}
                >
                  {t(k.label)}
                </button>
              ))}
            </div>
            <p className="survey-q">{t('What would make it better? (optional)')}</p>
            <textarea className="fb-text" rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} aria-label={t('What would make it better? (optional)')} />
            <p className="set-caption fb-note">{t('Sent anonymously with the floor and app version. Please leave out your name and contact details.')}</p>
            <div className="results-actions">
              <button type="button" className="pill" onClick={() => (fx.tap(), onClose())}>
                {t('Not now')}
              </button>
              <button type="button" className="pill primary" disabled={!ready} onClick={send}>
                {t('Send')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
