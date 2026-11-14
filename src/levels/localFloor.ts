// Floor text in the player's language: the name, the hints and PATCH's lines. Ids, designs, par
// and everything the game checks stay the same, so saves and stats never notice the language.
//
// Each language keeps its floor text in src/i18n/<lang>/t<tower>.json, keyed by floor id. Only the
// first two hint tiers are written out: the third is the answer, which is the floor's program,
// so it is turned into the block names the palette shows (see blockWords). The typed-code floors
// keep it as code, the same code the player types there.

import type { LevelFile } from '../sim/types';
import { lang, msg, t } from '../i18n';
import type { Lang } from '../i18n';
import { COMMAND_META } from '../editor/commands';
import { condLabel } from '../editor/ProgramList';
import type { Colour, PaletteCommand, Sensor } from '../sim/types';
import FR_T1 from '../i18n/fr/t1.json';
import FR_T2 from '../i18n/fr/t2.json';
import FR_T3 from '../i18n/fr/t3.json';
import FR_DAILY from '../i18n/fr/daily.json';
import { frenchSpacing } from '../i18n/fr';

export interface FloorText {
  title: string;
  /** The Nudge and the Structure hints (the Solution is made from the program). */
  hints: string[];
  intro?: string | null;
  outro?: string | null;
}

/** Same switch as levels/towers.ts: Heatwave's words only ship in the builds that have Heatwave. */
const PREVIEW = import.meta.env.DEV || import.meta.env.VITE_PLUS_PREVIEW === '1';

export const FLOOR_TEXT: Record<Exclude<Lang, 'en'>, Record<string, FloorText>> = {
  fr: spaced({ ...FR_T1, ...FR_T2, ...(PREVIEW ? FR_T3 : {}) }),
};

function spaced(floors: Record<string, FloorText>): Record<string, FloorText> {
  const f = (s: string | null | undefined) => (s ? frenchSpacing(s) : s);
  return Object.fromEntries(
    Object.entries(floors).map(([id, x]) => [id, { title: x.title, hints: x.hints.map(frenchSpacing), intro: f(x.intro), outro: f(x.outro) }]),
  );
}

/** Words for the daily puzzle names, and the order they go in. */
const DAILY_WORDS: Record<Exclude<Lang, 'en'>, { order: string; words: Record<string, string> }> = {
  fr: FR_DAILY,
};

const SENSORS = new Set<string>(['wall_ahead', 'box_ahead', 'carrying', 'on_target', 'on_switch', 'heat_ahead', 'tile_is']);

/**
 * A program in the same words as the blocks: "repeat 3 { forward turn_right }" becomes
 * "répéter 3 { avancer tourner à droite }" in French. Anything it doesn't know stays as it is.
 */
export function blockWords(code: string): string {
  const tokens = code.split(/(\s+|,|\{|\})/);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok in COMMAND_META) {
      out.push(t(COMMAND_META[tok as PaletteCommand].label));
    } else if (tok === 'else') out.push(t('else'));
    else if (tok === 'def') out.push(t(msg('define')));
    else if (tok === 'not') out.push(t('not'));
    else if (SENSORS.has(tok)) {
      if (tok === 'tile_is') {
        // "tile_is r": the colour is the next word
        let j = i + 1;
        while (j < tokens.length && /^\s*$/.test(tokens[j])) j++;
        out.push(condLabel({ sensor: 'tile_is', colour: tokens[j] as Colour }));
        i = j;
      } else out.push(condLabel({ sensor: tok as Sensor }));
    } else out.push(tok);
  }
  return out.join('');
}

/** The floor with its text in the current language (English, or a floor with no translation, is returned as is). */
export function localFloor(level: LevelFile): LevelFile {
  const l = lang();
  if (l === 'en') return level;
  if (level.id.startsWith('daily-')) {
    // (its first two hints are written in the player's language when the puzzle is made)
    return { ...level, title: dailyTitle(level.title), hints: level.hints.map((h, i) => (i === 2 ? blockWords(h) : h)) };
  }
  const text = FLOOR_TEXT[l]?.[level.id];
  if (!text) return level;
  return {
    ...level,
    title: text.title,
    hints: level.hints.map((h, i) => (i < 2 ? (text.hints[i] ?? h) : level.typing ? h : blockWords(h))),
    story: {
      intro: level.story.intro && (text.intro ?? level.story.intro),
      outro: level.story.outro && (text.outro ?? level.story.outro),
    },
  };
}

/**
 * Daily puzzle names are two words from a list ("Neon Stair"), translated word by word in
 * src/i18n/<lang>/daily.json, which also says the order: French puts the noun first ("Escalier néon").
 */
export function dailyTitle(title: string): string {
  const l = lang();
  const words = l === 'en' ? undefined : DAILY_WORDS[l];
  const [a, b, ...rest] = title.split(' ');
  if (!words || rest.length || !(a in words.words) || !(b in words.words)) return title;
  return words.order.replace('{adjective}', words.words[a]).replace('{noun}', words.words[b]);
}
