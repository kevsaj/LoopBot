// French (Canada) for everything outside the floors: English text -> French. The floors' own text
// is in src/i18n/fr/t1.json, t2.json and t3.json.
//
// Written with plain spaces; French spacing is applied here, so a line never breaks between a
// word and its colon, or inside « guillemets ». Canadian usage: a space before the colon only.

import UI from './fr/ui.json';

const NBSP = ' ';

export function frenchSpacing(text: string): string {
  return text.replace(/ :/g, `${NBSP}:`).replace(/« /g, `«${NBSP}`).replace(/ »/g, `${NBSP}»`);
}

export const FR: Record<string, string> = Object.fromEntries(Object.entries(UI as Record<string, string>).map(([en, fr]) => [en, frenchSpacing(fr)]));
