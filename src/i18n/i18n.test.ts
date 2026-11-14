import { afterEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { collectKeys, placeholders } from './keys';
import { FR } from './fr';
import { deviceLang, setLangForTest, t, tn } from '.';
import { FLOOR_TEXT, blockWords, dailyTitle, localFloor } from '../levels/localFloor';
import { TOWERS } from '../levels/towers';
import { LEVELS } from '../levels';
import { FROSTLINE } from '../levels/frostline';
import { HEATWAVE } from '../levels/heatwave';
import { INTERLUDES } from '../story/interludes';
import bank from '../daily/bank.json';

const keys = collectKeys(join(__dirname, '..'));
const texts = [...new Set(keys.map((k) => k.text))];
const ALL_FLOORS = [...LEVELS, ...FROSTLINE, ...HEATWAVE];

afterEach(() => setLangForTest('en'));

describe('French translation', () => {
  it('finds the strings in the code', () => {
    expect(texts.length).toBeGreaterThan(500);
    expect(texts).toContain('Tower map');
    expect(texts).toContain('turn left');
  });

  it('has every string the code shows', () => {
    const missing = texts.filter((k) => !(k in FR));
    expect(missing).toEqual([]);
  });

  it('keeps every {placeholder}, and adds none', () => {
    const wrong = Object.entries(FR)
      .filter(([en, fr]) => placeholders(en.replace(/\|one$/, '')).join() !== placeholders(fr).join())
      .map(([en]) => en);
    expect(wrong).toEqual([]);
  });

  it('has no leftover strings the code no longer uses', () => {
    const used = new Set(texts);
    const stale = Object.keys(FR).filter((k) => !used.has(k.replace(/\|one$/, '')));
    expect(stale).toEqual([]);
  });

  it('starts error lines with ERR and status lines with >, like the English (the terminal styles them by that)', () => {
    for (const [en, fr] of Object.entries(FR)) {
      if (en.startsWith('ERR')) expect(fr.startsWith('ERR')).toBe(true);
      if (en.startsWith('>')) expect(fr.startsWith('>')).toBe(true);
    }
  });

  it('has text for every floor of every tower', () => {
    for (const level of ALL_FLOORS) {
      const fr = FLOOR_TEXT.fr[level.id];
      expect(fr, level.id).toBeDefined();
      expect(fr.title, level.id).toBeTruthy();
      expect(fr.hints.length, level.id).toBe(Math.min(2, level.hints.length));
      expect(!!fr.intro, `${level.id} intro`).toBe(!!level.story.intro);
      expect(!!fr.outro, `${level.id} outro`).toBe(!!level.story.outro);
    }
  });

  it('keeps the speaker at the start of story lines, so the terminal shows the portrait', () => {
    for (const level of ALL_FLOORS) {
      const fr = FLOOR_TEXT.fr[level.id];
      for (const [en, tr] of [
        [level.story.intro, fr.intro],
        [level.story.outro, fr.outro],
      ]) {
        const who = en?.match(/^(PATCH|VANTA)\b/)?.[1];
        if (who) expect(tr?.startsWith(who), `${level.id}: ${tr}`).toBe(true);
      }
    }
  });
});

describe('English stays exactly as it was', () => {
  it('returns the English text and floors untouched', () => {
    setLangForTest('en');
    expect(t('Tower map')).toBe('Tower map');
    expect(t('Floor {n} · {title}', { n: 3, title: 'First Delivery' })).toBe('Floor 3 · First Delivery');
    expect(tn(1, '{n} hint', '{n} hints')).toBe('1 hint');
    expect(tn(0, '{n} hint', '{n} hints')).toBe('0 hints');
    for (const level of ALL_FLOORS) expect(localFloor(level)).toBe(level);
  });
});

describe('in French', () => {
  it('translates and fills placeholders', () => {
    setLangForTest('fr');
    expect(t('Tower map')).toBe('Carte de la tour');
    expect(t('Floor {n} · {title}', { n: 3, title: 'X' })).toBe('Étage 3 · X');
    // French counts 0 and 1 as singular
    expect(tn(0, '{n} hint', '{n} hints')).toBe('0 indice');
    expect(tn(2, '{n} hint', '{n} hints')).toBe('2 indices');
    expect(tn(1, '{n}-day streak', '{n}-day streak')).toBe('Série de 1 jour');
    expect(tn(5, '{n}-day streak', '{n}-day streak')).toBe('Série de 5 jours');
    // a colon never ends up alone at the start of a line
    expect(t('Locker: looks and achievements')).toBe('Casier : styles et succès');
  });

  it('falls back to English for text it does not know', () => {
    setLangForTest('fr');
    expect(t('Something new nobody translated yet')).toBe('Something new nobody translated yet');
  });

  it('writes the Solution hint in block words, except on typed-code floors', () => {
    setLangForTest('fr');
    const f2 = localFloor(LEVELS[1]);
    expect(f2.title).toBe('Chaufferie');
    expect(f2.hints[2]).toBe('avancer, avancer, tourner à droite, avancer, avancer');
    expect(blockWords('repeat 5 { while not wall_ahead { forward } if tile_is r { turn_left } else { turn_right } }')).toBe(
      'répéter 5 { tant que non mur devant { avancer } si sur ● rouge { tourner à gauche } sinon { tourner à droite } }',
    );
    for (const level of ALL_FLOORS) {
      const fr = localFloor(level);
      const answer = fr.hints[2];
      if (!answer) continue;
      if (level.typing) expect(answer, level.id).toBe(level.hints[2]);
      else expect(answer, level.id).not.toMatch(/\b(forward|turn_left|turn_right|jump|pick_up|drop|activate|wait|repeat|while|if|else|def|not|wall_ahead|box_ahead|on_switch|heat_ahead|tile_is)\b/);
    }
  });

  it('keeps ids, designs and par, so saves and stats never change', () => {
    setLangForTest('fr');
    for (const level of ALL_FLOORS) {
      const fr = localFloor(level);
      expect({ ...fr, title: level.title, hints: level.hints, story: level.story }).toEqual(level);
    }
  });

  it('names every daily puzzle', () => {
    setLangForTest('fr');
    for (const e of bank as { title: string }[]) expect(dailyTitle(e.title), e.title).not.toBe(e.title);
    expect(dailyTitle('Neon Stair')).toBe('Escalier néon');
  });

  it('translates tower names and the story', () => {
    setLangForTest('fr');
    expect(t(TOWERS[0].name)).toBe('Flèche Meridian');
    const radio = INTERLUDES[10];
    if (radio.kind !== 'radio') throw new Error('expected a radio call');
    expect(t(radio.lines[0].text)).toMatch(/^LoopBot, tu m'entends/);
  });
});

describe('device language', () => {
  it('picks the first language we have, else English', () => {
    expect(deviceLang(['fr-CA'])).toBe('fr');
    expect(deviceLang(['fr'])).toBe('fr');
    expect(deviceLang(['de-DE', 'fr-FR', 'en-US'])).toBe('fr');
    expect(deviceLang(['en-CA', 'fr-CA'])).toBe('en');
    expect(deviceLang(['es-MX'])).toBe('en');
    expect(deviceLang([])).toBe('en');
  });
});
