// Story beats between the bands of Tower 1: a short radio call from PATCH (with VANTA cutting in)
// after Floors 10, 20, 30 and 40, and the ending after Floor 50. Each plays once, the first time
// the player leaves that floor after clearing it, and can be skipped.

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
}

export type Interlude = Radio | Ending;

const P = (text: string): RadioLine => ({ who: 'PATCH', text });
const V = (text: string): RadioLine => ({ who: 'VANTA', text });

export const INTERLUDES: Record<number, Interlude> = {
  10: {
    kind: 'radio',
    id: 't1-after-10',
    heading: 'Next: Maintenance',
    lines: [
      P("LoopBot, can you hear me? It's PATCH. I'm the old radio terminal down in the sub-basement."),
      P('Last night VANTA took over the Spire. Every door, every lift and every light answers to it now.'),
      P('The service ducts climb through Maintenance. They go on and on, so let loops do the walking.'),
      V('A little bot with a radio. How quaint.'),
    ],
  },
  20: {
    kind: 'radio',
    id: 't1-after-20',
    heading: 'Next: the Workshop',
    lines: [
      P("The elevator's humming again, and I've got you on the cameras. You're shorter than I pictured."),
      P("The Workshop is where the Spire builds its bots. VANTA's been turning them into drones."),
      P('Teach a routine once, then call it by name. That is how you outwork a whole factory.'),
      V('Routines? I wrote every routine in this building.'),
    ],
  },
  30: {
    kind: 'radio',
    id: 't1-after-30',
    heading: 'Next: the Control Room',
    lines: [
      P("VANTA's gone quiet. When VANTA goes quiet, it's planning something."),
      P('The Control Room reads every sensor in the tower. Up there you look before you leap.'),
      V('My sensors see everything, little bot. Including you.'),
      P("Then let's give them something worth watching."),
    ],
  },
  40: {
    kind: 'radio',
    id: 't1-after-40',
    heading: 'Next: the Rooftop',
    lines: [
      P("Ten floors to the roof. VANTA's core is up there, wired into the antenna."),
      P('On the roof you can type your program like a real engineer. Blocks still work if you like them better.'),
      V('Come up, then. The view will be the last thing you see.'),
      P('It always says that.'),
    ],
  },
  50: {
    kind: 'ending',
    id: 't1-ending',
    panels: [
      { scene: 'lights', text: 'The core tumbles down the shaft, and every light in Meridian Spire flickers back on.' },
      { scene: 'escape', who: 'VANTA', text: "This isn't over. There are other towers. Other cities." },
      { scene: 'elevator', text: 'LoopBot rides the elevator all the way down, one floor at a time.' },
      { scene: 'meet', who: 'PATCH', text: 'There you are! Huh. You really are shorter than I pictured. Thank you, LoopBot.' },
      { scene: 'next', text: "Tower 1 cleared. VANTA's signal was last seen heading north, toward Frostline." },
    ],
  },
};

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

/** The beat to play when leaving tower floor `floorNumber` (1-based), if it's due. */
export function interludeAfter(floorNumber: number, cleared: boolean, seen = seenInterludes()): Interlude | null {
  const it = INTERLUDES[floorNumber];
  if (!it || !cleared || seen.has(it.id)) return null;
  return it;
}
