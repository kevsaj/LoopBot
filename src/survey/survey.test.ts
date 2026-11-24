import { beforeEach, describe, expect, it, vi } from 'vitest';

const sent: { message: string; mood: string; floor?: string }[] = [];
let on = true;
vi.mock('../telemetry', () => ({
  statsOn: () => on,
  sendFeedback: async (message: string, mood: string, ctx: { floor?: string }) => (sent.push({ message, mood, floor: ctx.floor }), true),
}));

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const s = await import('./index');

beforeEach(() => {
  store.clear();
  sent.length = 0;
  on = true;
});

describe('player questions', () => {
  it('asks why only on Tower 1 floors 1-5 never cleared, once', () => {
    expect(s.exitAskDue('t1-f01', false)).toBe(true);
    expect(s.exitAskDue('t1-f05', false)).toBe(true);
    expect(s.exitAskDue('t1-f06', false)).toBe(false);
    expect(s.exitAskDue('t1-f03', true)).toBe(false);
    expect(s.exitAskDue('t2-f01', false)).toBe(false);
    expect(s.exitAskDue('daily-2026-11-24', false)).toBe(false);
    s.markExitAsked();
    expect(s.exitAskDue('t1-f01', false)).toBe(false);
  });
  it('never asks with stats off', () => {
    on = false;
    expect(s.exitAskDue('t1-f01', false)).toBe(false);
    expect(s.surveyDue('t1-f05')).toBe(false);
  });
  it('offers the survey from Floor 5 until it is answered', () => {
    expect(s.surveyDue('t1-f04')).toBe(false);
    expect(s.surveyDue('t1-f05')).toBe(true);
    expect(s.surveyDue('t1-f12')).toBe(true);
    s.markSurveyDone();
    expect(s.surveyDue('t1-f05')).toBe(false);
  });
  it('always sends a non-empty message with the answers as text', async () => {
    await s.sendExitReason('t1-f02', 'Two Steps', 'hard', '');
    await s.sendSurvey('t1-f05', 'Corner', 4, 'maybe', '  more music ');
    expect(sent).toEqual([
      { message: 'Stopped because: Too hard', mood: 'why-stop', floor: 't1-f02' },
      { message: 'Fun 4/5 | Keep playing: Maybe | Better: more music', mood: 'survey', floor: 't1-f05' },
    ]);
  });
});
