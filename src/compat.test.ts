import { describe, expect, it } from 'vitest';

/**
 * The build lowers new *syntax* for older WebViews (vite.config.ts), but it cannot add missing
 * *functions*. A 1.0.0 player's Android WebView had no structuredClone and the game crashed on
 * Run, so these newer built-ins stay out of the game's code. Each one is missing somewhere we
 * still run: Android System WebView before the version shown, or Safari 15.4.
 * If one is ever truly needed, guard it (`'x' in obj ? ... : fallback`) and allow it here.
 */
const BANNED: [RegExp, string][] = [
  [/\bstructuredClone\s*\(/, 'structuredClone (WebView 98): copy plain data with JSON.parse(JSON.stringify(x))'],
  [/\.at\(\s*-/, 'Array/String .at() (WebView 92): use a[a.length - 1]'],
  [/\bObject\.hasOwn\s*\(/, 'Object.hasOwn (WebView 93): use Object.prototype.hasOwnProperty.call'],
  [/\.findLast(Index)?\s*\(/, 'findLast / findLastIndex (WebView 97, Safari 15.4)'],
  [/\.(toSorted|toReversed|toSpliced)\s*\(/, 'toSorted / toReversed / toSpliced (WebView 110, Safari 16): copy, then sort'],
  [/\.with\(\s*\d/, 'Array .with() (WebView 110)'],
  [/\b(Object|Map)\.groupBy\s*\(/, 'Object.groupBy / Map.groupBy (WebView 117)'],
  [/\bPromise\.withResolvers\s*\(/, 'Promise.withResolvers (WebView 119)'],
  [/\bAbortSignal\.(timeout|any)\s*\(/, 'AbortSignal.timeout / any (WebView 103)'],
  [/\.replaceAll\s*\(/, 'String replaceAll (WebView 85): use replace with a /g regex'],
];

const sources = import.meta.glob(['./**/*.{ts,tsx}', '!./**/*.test.{ts,tsx}'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('older WebView support', () => {
  it('scans the game code', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(20);
  });

  it('uses no built-ins that older phones lack', () => {
    const found: string[] = [];
    for (const [file, text] of Object.entries(sources)) {
      text.split('\n').forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return; // comments may name them
        for (const [re, why] of BANNED) if (re.test(line)) found.push(`${file}:${i + 1}  ${why}`);
      });
    }
    expect(found).toEqual([]);
  });
});
