// Plays a story beat full screen: PATCH's radio call between bands, or the Tower 1 ending.
// Tap anywhere to finish the line being typed, tap again for the next one. Skip ends it at once.

import { useEffect, useState } from 'react';
import { fx } from '../audio/feedback';
import { Portrait } from '../editor/Terminal';
import { MiniBot } from '../TowerMap';
import type { EndingScene, Interlude as Beat, Speaker } from './interludes';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Types `text` out a letter at a time; `done` jumps to the end. */
function useTyped(text: string, speaker?: Speaker) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (reduced()) {
      setShown(text.length);
      return;
    }
    if (speaker) fx.radio();
    setShown(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(i);
      if (i % 3 === 0) fx.type();
      if (i >= text.length) window.clearInterval(id);
    }, 26);
    return () => window.clearInterval(id);
  }, [text, speaker]);
  return { shown: Math.min(shown, text.length), done: shown >= text.length, finish: () => setShown(text.length) };
}

export function Interlude({ beat, onDone }: { beat: Beat; onDone(): void }) {
  const count = beat.kind === 'radio' ? beat.lines.length : beat.panels.length;
  const [step, setStep] = useState(0);
  const current = beat.kind === 'radio' ? beat.lines[step] : beat.panels[step];
  const typed = useTyped(current.text, current.who);
  const last = step === count - 1;

  const advance = () => {
    if (!typed.done) return typed.finish();
    fx.tap();
    if (last) onDone();
    else setStep(step + 1);
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone();
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  return (
    <div className={`interlude interlude-${beat.kind}`} role="dialog" aria-label={beat.kind === 'radio' ? 'Radio call from PATCH' : 'Tower 1 ending'} onClick={advance}>
      <button
        type="button"
        className="interlude-skip"
        onClick={(e) => {
          e.stopPropagation();
          fx.tap();
          onDone();
        }}
      >
        Skip
      </button>

      {beat.kind === 'radio' ? (
        <div className="radio">
          <div className="radio-head">
            <span className="radio-wave" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <i key={i} style={{ animationDelay: `${i * 0.12}s` }} className={typed.done ? 'still' : ''} />
              ))}
            </span>
            <span>Incoming call</span>
            <span className="radio-heading">{beat.heading}</span>
          </div>
          <ol className="radio-log" aria-live="polite">
            {beat.lines.slice(0, step + 1).map((l, i) => (
              <li key={i} className={`radio-line who-${l.who.toLowerCase()}`}>
                <span className="radio-portrait">
                  <Portrait who={l.who} />
                </span>
                <span className="radio-body">
                  <span className={`speaker speaker-${l.who.toLowerCase()}`}>{l.who}</span>
                  <span aria-hidden={i === step && !typed.done}>{i === step ? l.text.slice(0, typed.shown) : l.text}</span>
                  {i === step && !typed.done && <span className="sr-only">{l.text}</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="ending">
          <Scene scene={beat.panels[step].scene} key={step} />
          <p className="ending-caption" aria-live="polite">
            {current.who && <span className={`speaker speaker-${current.who.toLowerCase()}`}>{current.who}</span>}
            <span aria-hidden={!typed.done}>{current.text.slice(0, typed.shown)}</span>
            {!typed.done && <span className="sr-only">{current.text}</span>}
          </p>
        </div>
      )}

      <p className="interlude-hint" aria-hidden="true">
        {typed.done ? (last ? 'Tap to continue' : 'Tap for more') : ' '}
      </p>
      <div className="interlude-dots" aria-label={`${step + 1} of ${count}`}>
        {Array.from({ length: count }, (_, i) => (
          <i key={i} className={i <= step ? 'on' : ''} />
        ))}
      </div>
    </div>
  );
}

/** PATCH in person: the old radio terminal, on little treads. */
function PatchBot() {
  return (
    <svg className="patch-bot" viewBox="0 0 40 44" aria-hidden="true">
      <line x1="29" y1="8" x2="34" y2="1" stroke="#9fd2ff" strokeWidth="1.6" />
      <circle cx="34" cy="1.5" r="1.6" fill="#ffc861" />
      <rect x="4" y="8" width="32" height="24" rx="4" fill="#173049" stroke="#9fd2ff" strokeWidth="1.6" />
      <rect x="8" y="13" width="12" height="12" rx="2" fill="#7ff2e0" className="patch-eye" />
      <line x1="24" y1="15" x2="32" y2="15" stroke="#9fd2ff" strokeWidth="1.4" />
      <line x1="24" y1="19" x2="32" y2="19" stroke="#9fd2ff" strokeWidth="1.4" />
      <line x1="24" y1="23" x2="32" y2="23" stroke="#9fd2ff" strokeWidth="1.4" />
      <rect x="6" y="33" width="28" height="7" rx="3.5" fill="#3a3f5c" />
      <circle cx="11" cy="36.5" r="2" fill="#6b7095" />
      <circle cx="20" cy="36.5" r="2" fill="#6b7095" />
      <circle cx="29" cy="36.5" r="2" fill="#6b7095" />
    </svg>
  );
}

const WINDOWS = Array.from({ length: 36 }, (_, i) => ({ x: 14 + (i % 4) * 9, y: 16 + Math.floor(i / 4) * 9, d: ((i * 37) % 23) / 10 }));

/** A small drawn scene for each ending panel. */
function Scene({ scene }: { scene: EndingScene }) {
  return (
    <div className={`ending-scene scene-${scene}`} aria-hidden="true">
      <svg viewBox="0 0 200 140" preserveAspectRatio="xMidYMax meet">
        {/* the city behind */}
        <path className="skyline" d="M0 140V96h14V84h10v12h16V74h12v22h14V88h10v8h18V60h4V50h4v10h4v36h14V80h12v16h12V70h10v26h14V86h12v54z" />
        {/* Meridian Spire */}
        <g className="spire">
          <rect x="10" y="10" width="44" height="130" rx="2" />
          <rect x="30" y="0" width="4" height="12" />
        </g>
        {WINDOWS.map((w, i) => (
          <rect key={i} className="win" x={w.x} y={w.y + 4} width="5" height="5" rx="1" style={{ animationDelay: `${w.d}s` }} />
        ))}
        {scene === 'escape' && (
          <g className="drone">
            <ellipse cx="0" cy="0" rx="12" ry="5" fill="#2b1420" stroke="#ff8a9a" strokeWidth="1" />
            <circle cx="3" cy="0" r="2.6" fill="#ff4d6a" />
            <line x1="-12" y1="-4" x2="-20" y2="-6" stroke="#ff8a9a" strokeWidth="1" />
            <line x1="12" y1="-4" x2="20" y2="-6" stroke="#ff8a9a" strokeWidth="1" />
          </g>
        )}
        {scene === 'elevator' && (
          <g>
            <rect x="120" y="6" width="40" height="134" rx="2" className="shaft" />
            <g className="car">
              <rect x="124" y="0" width="32" height="34" rx="3" fill="#2a2d45" stroke="#ffc861" strokeWidth="1.2" />
              {/* LoopBot, small, in its current paint */}
              <rect x="133" y="8" width="14" height="9" rx="2.5" style={{ fill: 'var(--bot-top, #f3ecdf)' }} />
              <rect x="136" y="10.5" width="9" height="4.2" rx="2" fill="#2b2440" />
              <circle cx="142" cy="12.6" r="1.3" style={{ fill: 'var(--bot-eye, #7ff2e0)' }} />
              <rect x="132" y="18" width="16" height="9" rx="2.5" style={{ fill: 'var(--bot-left, #e6dccb)' }} />
              <line x1="140" y1="4" x2="140" y2="8" stroke="var(--bot-right, #cfc6b4)" strokeWidth="1.4" />
            </g>
          </g>
        )}
        {scene === 'next' && (
          <g className="north">
            <path d="M150 40 L182 40 M172 30 L182 40 L172 50" stroke="#9fd2ff" strokeWidth="3" fill="none" strokeLinecap="round" />
            <text x="166" y="66" textAnchor="middle" fill="#9fd2ff" fontSize="10" fontWeight="700">
              FROSTLINE
            </text>
            <text x="166" y="78" textAnchor="middle" fill="#a7a9c4" fontSize="7">
              coming soon
            </text>
          </g>
        )}
      </svg>
      {scene === 'meet' && (
        <div className="meet">
          <span className="meet-loopbot">
            <MiniBot />
          </span>
          <PatchBot />
        </div>
      )}
    </div>
  );
}
