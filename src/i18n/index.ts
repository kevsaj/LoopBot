// Languages. Every string the player sees is written in English in the code and passed through t(),
// which looks it up in the current language's dictionary and falls back to the English text. So
// English never changes, and a missing translation shows English instead of a blank.
//
//   t('Tower map')                       -> 'Carte de la tour'
//   t('Floor {n} · {title}', { n, title }) -> 'Étage 3 · Premier colis'
//   tn(n, '{n} hint', '{n} hints')        -> picks the form by the language's plural rules
//   msg('turn left')                      -> marks text kept in a table; translate it with t() where it's shown
//
// Adding a language: a dictionary in src/i18n/<code>.ts (English text -> translation), its floor
// text in src/i18n/<code>/, and one line in LANGUAGES and DICTS. src/i18n/i18n.test.ts checks that
// every string in the code has a translation, with the same {placeholders}.

import { useSyncExternalStore } from 'react';
import { FR } from './fr';

export type Lang = 'en' | 'fr';
/** What the player picked in Settings: a language, or follow the device. */
export type LangPref = Lang | 'auto';

/** Each language, named in itself, as Settings lists it. */
export const LANGUAGES: { code: Lang; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
];

export type Dict = Record<string, string>;
const DICTS: Record<Exclude<Lang, 'en'>, Dict> = { fr: FR };

const KEY = 'loopbot.lang';

/** The first device language we have, else English. */
export function deviceLang(langs: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language]): Lang {
  for (const l of langs) {
    const code = (l ?? '').toLowerCase().split(/[-_]/)[0];
    if (LANGUAGES.some((x) => x.code === code)) return code as Lang;
  }
  return 'en';
}

export function langPref(): LangPref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'auto' || LANGUAGES.some((x) => x.code === v) ? (v as LangPref) : 'auto';
  } catch {
    return 'auto';
  }
}

let current: Lang = resolve(langPref());
const listeners = new Set<() => void>();

function resolve(pref: LangPref): Lang {
  return pref === 'auto' ? deviceLang() : pref;
}

function tagDocument() {
  if (typeof document !== 'undefined') document.documentElement.lang = current === 'fr' ? 'fr-CA' : 'en';
}
tagDocument();

/** The language text is shown in now. */
export function lang(): Lang {
  return current;
}

/** Switch language (or back to following the device). Every screen re-renders in it. */
export function setLangPref(pref: LangPref) {
  try {
    if (pref === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* ignore */
  }
  const next = resolve(pref);
  if (next === current) return;
  current = next;
  tagDocument();
  listeners.forEach((f) => f());
}

/** For tests: show text in a language without saving it. */
export function setLangForTest(l: Lang) {
  current = l;
}

function subscribe(f: () => void) {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** Re-render when the language changes. The app root calls it, so every screen follows. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, lang, lang);
}

function fill(text: string, vars?: Record<string, string | number>) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** The text in the current language, with {placeholders} filled in. */
export function t(en: string, vars?: Record<string, string | number>): string {
  const d = current === 'en' ? undefined : DICTS[current];
  return fill(d?.[en] ?? en, vars);
}

/** A count: `one` for the singular form, `other` for the rest, by the language's rules. {n} is the count. */
export function tn(n: number, one: string, other: string, vars?: Record<string, string | number>): string {
  let form: string;
  try {
    form = new Intl.PluralRules(current === 'fr' ? 'fr-CA' : 'en').select(n);
  } catch {
    form = n === 1 ? 'one' : 'other';
  }
  const en = form === 'one' ? one : other;
  // A language can tell forms apart that English writes the same, with a "text|one" entry.
  const d = current === 'en' ? undefined : DICTS[current];
  return fill(d?.[`${en}|${form}`] ?? d?.[en] ?? en, { n, ...vars });
}

/** Marks English text kept in a table so the check finds it; it's translated with t() where it's shown. */
export function msg<T extends string>(en: T): T {
  return en;
}

/** A number in the current language's style (French writes 1 000, not 1,000). */
export function num(n: number): string {
  try {
    return n.toLocaleString(current === 'fr' ? 'fr-CA' : 'en');
  } catch {
    return String(n);
  }
}
