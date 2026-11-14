// Story beats between the bands of each tower: a short radio call from PATCH (with VANTA cutting in)
// after Floors 10, 20, 30 and 40, and the ending after Floor 50. Each plays once, the first time
// the player leaves that floor after clearing it, and can be skipped.

import { msg } from '../i18n';

export type Speaker = 'PATCH' | 'VANTA';

export interface RadioLine {
  who: Speaker;
  text: string;
}

export interface Radio {
  kind: 'radio';
  id: string;
  /** The band the player is heading into, shown as the call's caption. */
  heading: string;
  lines: RadioLine[];
}

export type EndingScene = 'lights' | 'escape' | 'elevator' | 'meet' | 'next';

export interface EndingPanel {
  scene: EndingScene;
  who?: Speaker;
  text: string;
}

export interface Ending {
  kind: 'ending';
  id: string;
  panels: EndingPanel[];
  /** The city named on the last panel, where VANTA heads next (Frostline when not set). */
  next?: string;
}

export type Interlude = Radio | Ending;

const P = (text: string): RadioLine => ({ who: 'PATCH', text });
const V = (text: string): RadioLine => ({ who: 'VANTA', text });

export const INTERLUDES: Record<number, Interlude> = {
  10: {
    kind: 'radio',
    id: 't1-after-10',
    heading: msg('Next: Maintenance'),
    lines: [
      P(msg("LoopBot, can you hear me? It's PATCH. I'm the old radio terminal down in the sub-basement.")),
      P(msg('Last night VANTA took over the Spire. Every door, every lift and every light answers to it now.')),
      P(msg('The service ducts climb through Maintenance. They go on and on, so let loops do the walking.')),
      V(msg('A little bot with a radio. How quaint.')),
    ],
  },
  20: {
    kind: 'radio',
    id: 't1-after-20',
    heading: msg('Next: the Workshop'),
    lines: [
      P(msg("The elevator's humming again, and I've got you on the cameras. You're shorter than I pictured.")),
      P(msg("The Workshop is where the Spire builds its bots. VANTA's been turning them into drones.")),
      P(msg('Teach a routine once, then call it by name. That is how you outwork a whole factory.')),
      V(msg('Routines? I wrote every routine in this building.')),
    ],
  },
  30: {
    kind: 'radio',
    id: 't1-after-30',
    heading: msg('Next: the Control Room'),
    lines: [
      P(msg("VANTA's gone quiet. When VANTA goes quiet, it's planning something.")),
      P(msg('The Control Room reads every sensor in the tower. Up there you look before you leap.')),
      V(msg('My sensors see everything, little bot. Including you.')),
      P(msg("Then let's give them something worth watching.")),
    ],
  },
  40: {
    kind: 'radio',
    id: 't1-after-40',
    heading: msg('Next: the Rooftop'),
    lines: [
      P(msg("Ten floors to the roof. VANTA's core is up there, wired into the antenna.")),
      P(msg('On the roof you can type your program like a real engineer. Blocks still work if you like them better.')),
      V(msg('Come up, then. The view will be the last thing you see.')),
      P(msg('It always says that.')),
    ],
  },
  50: {
    kind: 'ending',
    id: 't1-ending',
    panels: [
      { scene: 'lights', text: msg('The core tumbles down the shaft, and every light in Meridian Spire flickers back on.') },
      { scene: 'escape', who: 'VANTA', text: msg("This isn't over. There are other towers. Other cities.") },
      { scene: 'elevator', text: msg('LoopBot rides the elevator all the way down, one floor at a time.') },
      { scene: 'meet', who: 'PATCH', text: msg('There you are! Huh. You really are shorter than I pictured. Thank you, LoopBot.') },
      { scene: 'next', text: msg("Tower 1 cleared. VANTA's signal was last seen heading north, toward Frostline.") },
    ],
  },
};

/** Tower 2, the Northstar Needle in Frostline: the same beats, in the cold. */
export const FROSTLINE_INTERLUDES: Record<number, Interlude> = {
  10: {
    kind: 'radio',
    id: 't2-after-10',
    heading: msg('Next: the Glacier Yard'),
    lines: [
      P(msg("Still with me, LoopBot? Good. My antenna's frozen solid, so you're my eyes up there.")),
      P(msg('Past the gate is the Glacier Yard. Thin ice holds you once, then it cracks for good.')),
      P(msg('Plan the whole route before you move. There is no going back the way you came.')),
      V(msg("Every step you take, the ice remembers. So do I.")),
    ],
  },
  20: {
    kind: 'radio',
    id: 't2-after-20',
    heading: msg('Next: the Signal Hut'),
    lines: [
      P(msg("VANTA scrambled the Signal Hut. Every radio in Frostline is playing static.")),
      P(msg('The routines in there are broken, not missing. Read them line by line and find the bug.')),
      V(msg('I left you a few surprises. Debugging is so much fun, isn\'t it?')),
      P(msg('Actually, yes. It is.')),
    ],
  },
  30: {
    kind: 'radio',
    id: 't2-after-30',
    heading: msg('Next: the Aurora Lab'),
    lines: [
      P(msg("The mast is singing again. I can see the whole Needle from here, and the sky's gone green.")),
      P(msg("That's the Aurora Lab. The floors change colour and the corridors never match. Counting won't work.")),
      P(msg('Ask questions instead. While there is no wall ahead, keep going.')),
      V(msg('Questions? I have one. How long can a little bot last in the dark?')),
    ],
  },
  40: {
    kind: 'radio',
    id: 't2-after-40',
    heading: msg('Next: the Summit'),
    lines: [
      P(msg('Ten floors to the summit. VANTA is wiring itself into the Northstar beacon.')),
      P(msg("If it gets that beacon running, it can reach every tower in the north. Let's not let it.")),
      P(msg('Type your programs up there if you like. Name your routines and the summit gets a lot smaller.')),
      V(msg('Come up and see the view, LoopBot. It is very, very cold.')),
    ],
  },
  50: {
    kind: 'ending',
    id: 't2-ending',
    panels: [
      { scene: 'lights', text: msg('The beacon goes dark, the heating roars back, and Frostline starts to thaw.') },
      { scene: 'escape', who: 'VANTA', text: msg("Fine. Keep your icicle. I've got bigger towers to climb.") },
      { scene: 'elevator', text: msg('LoopBot rides down through the melting floors, dripping all the way.') },
      { scene: 'meet', who: 'PATCH', text: msg("You're soaked! Come stand by the radio, it runs warm. Thank you, LoopBot.") },
      { scene: 'next', text: msg("Tower 2 cleared. VANTA's signal is fading south. Wherever it lands next, we'll be ready.") },
    ],
    next: 'HEATWAVE',
  },
};

/** Tower 3, the Sandglass in Heatwave: the beats again, in the desert heat. */
export const HEATWAVE_INTERLUDES: Record<number, Interlude> = {
  10: {
    kind: 'radio',
    id: 't3-after-10',
    heading: msg('Next: Furnace Hall'),
    lines: [
      P(msg("Through the gate without a scorch mark! I'm impressed. It's very hot in this radio, by the way.")),
      P(msg('The Furnace Hall vents run slower: three beats a cycle. You can even stand on one for a beat, if you time it.')),
      P(msg('And see those crates? A crate on a vent plugs it shut.')),
      V(msg('Every vent in this tower keeps my time, LoopBot. Not yours.')),
    ],
  },
  20: {
    kind: 'radio',
    id: 't3-after-20',
    heading: msg('Next: the Sky Bazaar'),
    lines: [
      P(msg('The Sky Bazaar is up next. Hundreds of little delivery bots, all running routines VANTA scrambled.')),
      P(msg('Some of those routines are only off by a beat. Run them, watch where they burn, and fix them.')),
      V(msg('I gave every one of them a tiny mistake. Finding them will take you forever.')),
      P(msg("Funny. That's exactly what we're good at.")),
    ],
  },
  30: {
    kind: 'radio',
    id: 't3-after-30',
    heading: msg('Next: the Mirage Lab'),
    lines: [
      P(msg('Under this tower are the same old stones as under Meridian and the Needle. The Builders got around.')),
      P(msg("Up top is the Mirage Lab. The heat shimmer hides the vents' timing, so counting beats won't help.")),
      P(msg('Ask instead. While there is heat ahead, wait. Then step.')),
      V(msg('Ask all you like. The answer is always "too hot".')),
    ],
  },
  40: {
    kind: 'radio',
    id: 't3-after-40',
    heading: msg('Next: the Crown'),
    lines: [
      P(msg('Ten floors to the Crown. VANTA has turned the sun mirrors toward the other towers in the desert.')),
      P(msg('One beam from up there and every one of them answers to VANTA. We need those mirrors pointing at the sky.')),
      P(msg('Type your programs if you like. Everything you learned in this tower, all at once.')),
      V(msg('Come up into the light, LoopBot. It is very, very bright.')),
    ],
  },
  50: {
    kind: 'ending',
    id: 't3-ending',
    panels: [
      { scene: 'lights', text: msg('The sun mirrors tilt back to the sky, the vents sigh, and the Sandglass starts to cool.') },
      { scene: 'escape', who: 'VANTA', text: msg("Keep your sandbox. There are taller towers than this, and I'm already climbing one.") },
      { scene: 'elevator', text: msg('LoopBot rides down through the quiet floors, shaking sand out of every joint.') },
      { scene: 'meet', who: 'PATCH', text: msg("You're glowing! Sit by the fan a minute. Thank you, LoopBot.") },
      { scene: 'next', text: msg("Tower 3 cleared. VANTA's signal is twisting away east. We'll pick it up again.") },
    ],
    next: 'TWIST',
  },
};

const TOWER_INTERLUDES: Record<number, Record<number, Interlude>> = { 1: INTERLUDES, 2: FROSTLINE_INTERLUDES, 3: HEATWAVE_INTERLUDES };

const KEY = 'loopbot.interludes';

export function seenInterludes(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function markInterludeSeen(id: string) {
  try {
    const s = seenInterludes();
    s.add(id);
    localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
}

/** The beat to play when leaving floor `floorNumber` (1-based) of a tower, if it's due. */
export function interludeAfter(floorNumber: number, cleared: boolean, seen = seenInterludes(), tower = 1): Interlude | null {
  const it = (TOWER_INTERLUDES[tower] ?? INTERLUDES)[floorNumber];
  if (!it || !cleared || seen.has(it.id)) return null;
  return it;
}
