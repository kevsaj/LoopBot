// Settings > Daily reminder: a switch and the time of day. Phones only (see src/reminder.ts).

import { useState } from 'react';
import { fx } from './audio/feedback';
import { hourLabel, loadReminder, remindersAvailable, setReminder } from './reminder';
import { t } from './i18n';
import { cancelNudge, loadComeback } from './comeback';

const HOURS = Array.from({ length: 24 }, (_, h) => h);

export function ReminderRows() {
  const [prefs, setPrefs] = useState(loadReminder);
  const [note, setNote] = useState('');
  if (!remindersAvailable()) return null;

  const change = async (on: boolean, hour = prefs.hour) => {
    fx.tap();
    const now = await setReminder(on, hour);
    setPrefs({ ...prefs, on: now, hour, asked: true });
    setNote(on && !now ? t('Notifications are off for LoopBot. You can allow them in your phone settings.') : '');
  };

  return (
    <div className="set-item">
      <label className="set-row">
        <span className="set-label">{t('Daily reminder')}</span>
        <input type="checkbox" role="switch" className="set-switch" checked={prefs.on} onChange={(e) => void change(e.target.checked)} />
      </label>
      {prefs.on && (
        <label className="set-row set-sub">
          <span className="set-label">{t('Remind me at')}</span>
          <select className="set-select" value={prefs.hour} onChange={(e) => void change(true, Number(e.target.value))}>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className={`set-caption${note ? ' fb-error' : ''}`}>{note || t("When the day's puzzle is ready, unless you've played.")}</p>
      <NudgeRow />
    </div>
  );
}

/** The one come-back reminder, while it's still waiting (src/comeback.ts). Switching it off ends it for good. */
function NudgeRow() {
  const [waiting, setWaiting] = useState(() => {
    const s = loadComeback();
    return s.nudge && !s.done;
  });
  if (!waiting) return null;
  return (
    <>
      <label className="set-row">
        <span className="set-label">{t('Come-back reminder')}</span>
        <input
          type="checkbox"
          role="switch"
          className="set-switch"
          checked
          onChange={() => {
            fx.tap();
            setWaiting(false);
            void cancelNudge();
          }}
        />
      </label>
      <p className="set-caption">{t("One reminder, only on a day you don't play. It won't repeat.")}</p>
    </>
  );
}
