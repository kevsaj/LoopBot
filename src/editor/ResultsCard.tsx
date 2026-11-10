// The floor-cleared card. Stars land one at a time; the celebration scales with them:
// 3 stars fire confetti and a fanfare, 2 stars get a small sparkle, 1 star stays calm.

import { useEffect, useRef, useState } from 'react';
import { shareText } from '../share';
import { DEFAULT_HOUR, declineReminder, hourLabel, loadReminder, remindersAvailable, setReminder } from '../reminder';
import { fx } from '../audio/feedback';
import { burst, reducedMotion, stop } from '../fx/confetti';
import { DEMO } from '../demo';
import { shortDate } from '../daily';

interface Props {
  floorNumber: number;
  floorCount: number;
  earned: number;
  /** Best stars on this floor before this run (0 if never cleared). */
  prevBest: number;
  commands: number;
  steps: number;
  par: { commands: number; steps: number };
  outro?: string | null;
  onClose(): void;
  onRetry(): void;
  onNext(): void;
  onTower(): void;
  /** The daily challenge: shows the streak and a share button instead of "Next floor". */
  daily?: { date: string; streak: number; froze?: boolean; share: string };
}

const STAR_MS = 420;
const HEADLINE = ['', 'Floor cleared', 'Nice work!', 'Perfect run!'];

export function ResultsCard({ floorNumber, floorCount, earned, prevBest, commands, steps, par, outro, onClose, onRetry, onNext, onTower, daily }: Props) {
  const calm = reducedMotion();
  const [shown, setShown] = useState(calm ? 3 : 0);
  const starsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (calm) {
      if (earned === 3) fx.cheer();
      return;
    }
    const timers: number[] = [];
    for (let i = 1; i <= 3; i++) {
      timers.push(
        window.setTimeout(() => {
          setShown(i);
          if (i <= earned) fx.star(i);
          else fx.starMiss();
          if (i === 3) celebrate();
        }, 250 + i * STAR_MS),
      );
    }
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      stop();
    };
  }, []);

  function celebrate() {
    const r = starsRef.current?.getBoundingClientRect();
    const sx = r ? (r.left + r.width / 2) / window.innerWidth : 0.5;
    const sy = r ? (r.top + r.height / 2) / window.innerHeight : 0.35;
    if (earned === 3) {
      fx.cheer();
      burst({ count: 70, x: sx, y: sy, power: 11, spread: 70 });
      // two cannons from the bottom corners, a beat later
      window.setTimeout(() => {
        burst({ count: 60, x: 0.02, y: 1, power: 19, spread: 18 });
        burst({ count: 60, x: 0.98, y: 1, power: 19, spread: 18 });
      }, 180);
    } else if (earned === 2) {
      burst({ count: 16, x: sx, y: sy, power: 5, spread: 80, sparkle: true });
    }
  }

  const best = earned > prevBest && prevBest > 0;
  const [shared, setShared] = useState<string | null>(null);
  const share = async () => {
    if (!daily) return;
    fx.tap();
    const r = await shareText(daily.share);
    if (r === 'copied') setShared('Copied! Paste it anywhere.');
    else if (r === 'failed') setShared("Couldn't share from here.");
  };
  // After the first daily clear, offer the reminder once (phones only).
  const [askReminder, setAskReminder] = useState(() => !!daily && remindersAvailable() && !loadReminder().asked);
  const [reminderNote, setReminderNote] = useState<string | null>(null);
  const answerReminder = async (yes: boolean) => {
    fx.tap();
    setAskReminder(false);
    if (!yes) return declineReminder();
    const on = await setReminder(true);
    setReminderNote(on ? `Reminder set for ${hourLabel(DEFAULT_HOUR)}. Change it in Settings.` : 'Notifications are off for LoopBot. You can allow them in your phone settings.');
  };
  const title = daily ? `Daily · ${shortDate(daily.date)}` : `Floor ${floorNumber}`;
  const tip =
    earned === 3
      ? null
      : commands > par.commands
        ? `Solve it in ${par.commands} commands or fewer for 2 stars.`
        : `Same length, fewer steps (${par.steps}) earns the 3rd star.`;

  return (
    <div className="results-backdrop" onClick={onClose}>
      <div className={`results${shown >= 3 ? ` tier-${earned}` : ''}`} role="dialog" aria-label={`${title} cleared, ${earned} of 3 stars`} onClick={(e) => e.stopPropagation()}>
        {earned === 3 && shown >= 3 && <div className="results-rays" aria-hidden="true" />}
        <p className="results-floor">{title}</p>
        <h2 className={shown >= 3 ? 'in' : ''}>{shown >= 3 ? HEADLINE[earned] : 'Floor cleared'}</h2>
        <div className="stars" ref={starsRef} aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <span key={i} className={`star${i <= shown ? (i <= earned ? ' on land' : ' miss') : ''}`}>
              ★
            </span>
          ))}
        </div>
        <div className={`badges${shown >= 3 ? ' in' : ''}`}>
          {best && <span className="badge best">New best!</span>}
          {prevBest === 0 && <span className="badge first">{daily ? 'Cleared today' : 'First clear'}</span>}
          {daily && daily.streak > 0 && (
            <span className="badge streak">
              🔥 {daily.streak}-day streak
            </span>
          )}
          {daily?.froze && <span className="badge freeze">🧊 A streak freeze saved your streak</span>}
        </div>
        <table className="score">
          <tbody>
            <tr className={commands <= par.commands ? 'met' : ''}>
              <td>Commands</td>
              <td>{commands}</td>
              <td className="par">par {par.commands}</td>
              <td className="tick" aria-label={commands <= par.commands ? 'par met' : 'over par'}>
                {commands <= par.commands ? '✓' : ''}
              </td>
            </tr>
            <tr className={steps <= par.steps ? 'met' : ''}>
              <td>Steps</td>
              <td>{steps}</td>
              <td className="par">par {par.steps}</td>
              <td className="tick" aria-label={steps <= par.steps ? 'par met' : 'over par'}>
                {steps <= par.steps ? '✓' : ''}
              </td>
            </tr>
          </tbody>
        </table>
        {tip && <p className="tip">{tip}</p>}
        {outro && <p className="story">{outro}</p>}
        {daily && <p className="tip">{shared ?? reminderNote ?? 'Same puzzle for everyone today. A new one arrives at midnight.'}</p>}
        {askReminder && shown >= 3 && (
          <div className="reminder-ask">
            <p>Want a reminder when tomorrow's puzzle is ready?</p>
            <div className="reminder-ask-actions">
              <button type="button" className="pill" onClick={() => void answerReminder(false)}>
                No thanks
              </button>
              <button type="button" className="pill primary" onClick={() => void answerReminder(true)}>
                Remind me at {hourLabel(DEFAULT_HOUR)}
              </button>
            </div>
          </div>
        )}
        {!daily && DEMO && floorNumber === floorCount && (
          <p className="demo-end">
            <strong>You cleared the Lobby!</strong> That's the end of the free demo. LoopBot's climb continues in the full game: loops in the
            Maintenance floors, functions in the Workshop, and all the way to the Rooftop.
          </p>
        )}
        {!daily && !DEMO && floorNumber === floorCount && (
          <p className="demo-end">
            <strong>Tower 1 cleared!</strong> Meridian Spire is back online and VANTA's drones are grounded. LoopBot rides the elevator
            down to meet PATCH at last. More towers are on the way.
          </p>
        )}
        <div className="results-actions">
          <button type="button" className="pill" onClick={() => (fx.tap(), onRetry())}>
            Try again
          </button>
          {daily ? (
            <>
              <button type="button" className="pill" onClick={share}>
                Share
              </button>
              <button type="button" className={`pill primary${shown >= 3 ? ' nudge' : ''}`} onClick={() => (fx.tap(), onTower())}>
                Done
              </button>
            </>
          ) : floorNumber === floorCount ? (
            <button type="button" className="pill primary" onClick={() => (fx.tap(), onTower())}>
              Tower
            </button>
          ) : (
            <button type="button" className={`pill primary${shown >= 3 ? ' nudge' : ''}`} onClick={() => (fx.tap(), onNext())}>
              Next floor →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
