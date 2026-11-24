// Two tiny questions for players, so Kevin learns why people stop playing (and what keeps them).
//
// 1. Early exit: a player who leaves one of Tower 1's first five floors for the map without ever
//    clearing it gets a small card on the map: "Quick one: what stopped you?". Asked once per player,
//    right then (never on a later launch), skippable in one tap.
// 2. After Floor 5: a "Help shape LoopBot?" link on the results card opens three quick taps.
//
// Both go to the Feedback tab of the playtest sheet through src/telemetry.ts, with the floor
// attached. They only appear when anonymous stats are on (and the build has an endpoint).
// The message always carries the tapped answers as text, so the Code.gs already deployed
// (which skips empty messages) stores them without a redeploy.

import { sendFeedback, statsOn } from '../telemetry';

const EXIT_KEY = 'loopbot.askedWhyStop';
const SURVEY_KEY = 'loopbot.surveyDone';
/** Floors 1 to 5 of Tower 1 count as "the first few minutes". */
export const EARLY_FLOORS = 5;

export const EXIT_REASONS = ['confusing', 'boring', 'hard', 'phone', 'busy'] as const;
export type ExitReason = (typeof EXIT_REASONS)[number];
const EXIT_TEXT: Record<ExitReason, string> = {
  confusing: 'Confusing',
  boring: 'Boring',
  hard: 'Too hard',
  phone: 'Phone trouble',
  busy: 'Just busy',
};
export type KeepPlaying = 'yes' | 'maybe' | 'no';

function flag(key: string) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return true; // storage blocked: don't risk asking again and again
  }
}
function setFlag(key: string) {
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* ignore */
  }
}

/** Tower 1 floor number from an id like "t1-f03", or 0 for anything else (dailies, other towers). */
export function tower1Floor(id: string) {
  const m = /^t1-f(\d+)$/.exec(id);
  return m ? Number(m[1]) : 0;
}

/** Whether leaving this floor (never cleared) should ask why. */
export function exitAskDue(floorId: string, everCleared: boolean) {
  const n = tower1Floor(floorId);
  return n >= 1 && n <= EARLY_FLOORS && !everCleared && statsOn() && !flag(EXIT_KEY);
}

/** The card was shown: never show it again, whether they answer or skip. */
export function markExitAsked() {
  setFlag(EXIT_KEY);
}

/** Whether a tower floor's results card offers the short survey. */
export function surveyDue(floorId: string) {
  return tower1Floor(floorId) >= EARLY_FLOORS && statsOn() && !flag(SURVEY_KEY);
}

export function markSurveyDone() {
  setFlag(SURVEY_KEY);
}

const extra = (text: string) => (text.trim() ? ` | ${text.trim()}` : '');

export function exitMessage(reason: ExitReason, text: string) {
  return `Stopped because: ${EXIT_TEXT[reason]}${extra(text)}`;
}

export function surveyMessage(fun: number, keep: KeepPlaying, text: string) {
  const k = keep === 'yes' ? 'Yes' : keep === 'maybe' ? 'Maybe' : 'No';
  return `Fun ${fun}/5 | Keep playing: ${k}${text.trim() ? ` | Better: ${text.trim()}` : ''}`;
}

export function sendExitReason(floor: string, floorTitle: string, reason: ExitReason, text: string) {
  return sendFeedback(exitMessage(reason, text), 'why-stop', { floor, floorTitle });
}

export function sendSurvey(floor: string, floorTitle: string, fun: number, keep: KeepPlaying, text: string) {
  return sendFeedback(surveyMessage(fun, keep, text), 'survey', { floor, floorTitle });
}
