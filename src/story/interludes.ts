// Story beats between the bands of each tower: a short radio call from PATCH (with VANTA cutting in)
// after Floors 10, 20, 30 and 40, and the ending after Floor 50. Each plays once, the first time
// the player leaves that floor after clearing it, and can be skipped.

import { msg } from '../i18n';

/** PATCH and VANTA, plus the Precinct 404 squad: DASH, BULWARK, LEDGER and ROOK. */
export type Speaker = 'PATCH' | 'VANTA' | 'DASH' | 'BULWARK' | 'LEDGER' | 'ROOK';

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
// The Precinct 404 squad (Tower 8)
const D = (text: string): RadioLine => ({ who: 'DASH', text });
const B = (text: string): RadioLine => ({ who: 'BULWARK', text });
const L = (text: string): RadioLine => ({ who: 'LEDGER', text });
const R = (text: string): RadioLine => ({ who: 'ROOK', text });

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

/** Tower 4, the Helix in Twist: the beats again, on the turntables by the river. */
export const TWIST_INTERLUDES: Record<number, Interlude> = {
  10: {
    kind: 'radio',
    id: 't4-after-10',
    heading: msg('Next: the Jade Garden'),
    lines: [
      P(msg('You crossed the Ferry Terrace without getting dizzy. I got dizzy just watching.')),
      P(msg('The Jade Garden winds up the tower in a spiral, with turntables on the corners.')),
      P(msg('Let a loop do the walking and let the tables do the turning.')),
      V(msg('Spin, little bot. Round and round, all the way to nowhere.')),
    ],
  },
  20: {
    kind: 'radio',
    id: 't4-after-20',
    heading: msg('Next: the Silk Loom'),
    lines: [
      P(msg('The Silk Loom is next. The weaving bots up there repeat one pattern all day long.')),
      P(msg('VANTA tangled their routines. Some of them only turn the wrong way once.')),
      V(msg("A loom is just a loop with fancier thread. I've tied every one in knots.")),
      P(msg("Then we'll untie them. One routine at a time.")),
    ],
  },
  30: {
    kind: 'radio',
    id: 't4-after-30',
    heading: msg('Next: the Lantern Lab'),
    lines: [
      P(msg('Under the Helix are old river stones, carved like the ones under the other towers. The Builders again.')),
      P(msg("Next is the Lantern Lab. With all this spinning, it's easy to lose track of where you face.")),
      P(msg('Every floor up there has a compass. Ask it: am I facing north? Then turn.')),
      V(msg("North, south, it's all the same when the floor won't stop moving.")),
    ],
  },
  40: {
    kind: 'radio',
    id: 't4-after-40',
    heading: msg('Next: the Pinnacle'),
    lines: [
      P(msg("Ten floors to the top. VANTA is turning the Helix's mast toward the harbour.")),
      P(msg('From up there it could talk to every crane and cargo ship on the coast.')),
      P(msg('Type your programs if you like. Everything you learned in this tower, all at once.')),
      V(msg('Come and see the view, LoopBot. It goes round and round.')),
    ],
  },
  50: {
    kind: 'ending',
    id: 't4-ending',
    panels: [
      { scene: 'lights', text: msg("The turntables slow, click and stop. The Helix's mast swings back to the sky.") },
      { scene: 'escape', who: 'VANTA', text: msg("Fine, keep your spinning top. I've got a whole harbour waiting.") },
      { scene: 'elevator', text: msg('LoopBot rides down the twisting core, still leaning a little to the left.') },
      { scene: 'meet', who: 'PATCH', text: msg('Stand still a minute and the room will stop turning. Thank you, LoopBot.') },
      { scene: 'next', text: msg("Tower 4 cleared. VANTA's signal is heading for the docks. We'll be right behind it.") },
    ],
    next: 'DOCKYARD',
  },
};

/** Tower 5, the Wavehouse in Dockyard: the beats again, among the cranes and containers. */
export const DOCKYARD_INTERLUDES: Record<number, Interlude> = {
  10: {
    kind: 'radio',
    id: 't5-after-10',
    heading: msg('Next: the Crane Yard'),
    lines: [
      P(msg('The quay is clear and every stretch was one longer than the last. You counted them all.')),
      P(msg('Up next, the Crane Yard. The crane arms there get shorter as you climb.')),
      P(msg("Counting up was easy. Now you'll count down too.")),
      V(msg('Count all you like, little bot. My manifest says you were never here.')),
    ],
  },
  20: {
    kind: 'radio',
    id: 't5-after-20',
    heading: msg('Next: the Ropewalk'),
    lines: [
      P(msg('The Ropewalk is next, a long hall where the dock bots twist rope, one pattern at a time.')),
      P(msg('VANTA swapped their routines around. Some of them count the wrong way.')),
      V(msg('A routine that counts is a routine I can miscount.')),
      P(msg('Then we teach it once, and let the tally change what it does.')),
    ],
  },
  30: {
    kind: 'radio',
    id: 't5-after-30',
    heading: msg('Next: the Tally House'),
    lines: [
      P(msg('Under the Wavehouse is a dry dock, with carved stones like the ones under every tower. The Builders again.')),
      P(msg('Next is the Tally House. The clerks there measure every quay before they ship anything.')),
      P(msg('Walk to the wall and count as you go. Then you know exactly how far to walk back.')),
      V(msg('Measure this: how far ahead of you I am.')),
    ],
  },
  40: {
    kind: 'radio',
    id: 't5-after-40',
    heading: msg('Next: the Crest'),
    lines: [
      P(msg("Ten floors to the top. VANTA is up on the Wavehouse's glass roof, loading the cranes with new orders.")),
      P(msg('From up there it could send every ship in the harbour anywhere it likes.')),
      P(msg('Type your programs if you like. Everything you learned in this tower, all at once.')),
      V(msg('One more floor, one more floor. Keep counting, LoopBot.')),
    ],
  },
  50: {
    kind: 'ending',
    id: 't5-ending',
    panels: [
      { scene: 'lights', text: msg("The cranes swing home and the Wavehouse's roof lights up like a wave at sunset.") },
      { scene: 'escape', who: 'VANTA', text: msg('Keep your harbour. I was only ever half here anyway.') },
      { scene: 'elevator', text: msg('LoopBot rides down past the warehouse floors, still counting under its breath.') },
      { scene: 'meet', who: 'PATCH', text: msg('Fifty floors, and you never lost count once. Thank you, LoopBot.') },
      { scene: 'next', text: msg("Tower 5 cleared. VANTA's signal just split in two. Two towers, two signals.") },
    ],
    next: 'TWIN SPIRES',
  },
};

/** Tower 6, the Skybridge in Twin Spires: two towers, two signals, and Echo climbing beside LoopBot. */
export const TWINSPIRES_INTERLUDES: Record<number, Interlude> = {
  10: {
    kind: 'radio',
    id: 't6-after-10',
    heading: msg('Next: the Skybridge'),
    lines: [
      P(msg('Through the atrium, both of you. Echo copies every block, even the ones LoopBot never gets to.')),
      P(msg('Up next, the skybridge level. Long runs, so loops will save you a lot of blocks.')),
      V(msg('A copy of a copy. I built that bot to be my decoy, you know.')),
      P(msg("Then it's the best thing VANTA ever built. Keep climbing.")),
    ],
  },
  20: {
    kind: 'radio',
    id: 't6-after-20',
    heading: msg('Next: the Batik Gallery'),
    lines: [
      P(msg('The Batik Gallery is next, a hall of painted cloth with the same patterns over and over.')),
      P(msg('A function is a pattern too. Write it once and both bots share it.')),
      V(msg('I hid a few mistakes in the patterns. Shared mistakes are twice the fun.')),
      P(msg('Then we fix them once, for both.')),
    ],
  },
  30: {
    kind: 'radio',
    id: 't6-after-30',
    heading: msg('Next: the Mirror Hall'),
    lines: [
      P(msg('Under the spires is a twin vault, with carved stones like the ones under every tower. The Builders again.')),
      P(msg("Next is the Mirror Hall. The spires look the same, but they aren't the same inside.")),
      P(msg('Sensors read each bot\'s own walls and floors. One program can send them different ways.')),
      V(msg('Two bots, two halls, one program. Let us see it hold together.')),
    ],
  },
  40: {
    kind: 'radio',
    id: 't6-after-40',
    heading: msg('Next: the Twin Tops'),
    lines: [
      P(msg("Ten floors to go. VANTA's signal comes from both tips at once, bouncing across the bridge.")),
      P(msg('Shut down both and it has nowhere to go.')),
      P(msg('Typing is back on, if you want it. Echo reads typed code too.')),
      V(msg('Split a signal and you need two bots to catch it. How lucky that you have two.')),
    ],
  },
  50: {
    kind: 'ending',
    id: 't6-ending',
    panels: [
      { scene: 'lights', text: msg('Both tips go dark at once, and the skybridge lights up between them.') },
      { scene: 'escape', who: 'VANTA', text: msg('Keep the decoy. I have a tower that repeats itself all the way down.') },
      { scene: 'elevator', text: msg('LoopBot and Echo ride down side by side, in the two lifts, floor for floor.') },
      { scene: 'meet', who: 'PATCH', text: msg('Fifty floors, two bots, one program each time. Echo is staying with us now.') },
      { scene: 'next', text: msg('Tower 6 cleared. VANTA is heading for a tower made of smaller towers.') },
    ],
    next: 'FRACTAL',
  },
};

/** Tower 7, the Fernwork in Fractal: a tower made of smaller towers, and patterns inside patterns. */
export const FRACTAL_INTERLUDES: Record<number, Interlude> = {
  10: {
    kind: 'radio',
    id: 't7-after-10',
    heading: msg('Next: Fern Hall'),
    lines: [
      P(msg('Through the plaza. A function that calls itself, and a number that says how deep to go.')),
      P(msg('Fern Hall is next. Its columns split in two, then in two again, like a fern.')),
      V(msg('Every branch is a smaller copy of the tree. Follow them all and you will be here forever.')),
      P(msg('Not forever. Every copy is one level smaller, and at zero it stops.')),
    ],
  },
  20: {
    kind: 'radio',
    id: 't7-after-20',
    heading: msg('Next: the Cloister'),
    lines: [
      P(msg('The Cloister is two walks round one courtyard. Each walk leads into the other.')),
      P(msg('So F1 can call F2, and F2 can call F1. Each call is still one level down.')),
      V(msg('A hall that leads to a hall that leads back to the first. I designed it myself.')),
      P(msg('Echo says it is the neatest trap it has seen. Keep going.')),
    ],
  },
  30: {
    kind: 'radio',
    id: 't7-after-30',
    heading: msg('Next: the Nautilus Stair'),
    lines: [
      P(msg('There is a root crypt under the spires, with the same carved stones as under every tower. The Builders again.')),
      P(msg('The stones show a shell, a spiral that grows by the same rule each turn.')),
      P(msg('Next, the Nautilus Stair. Sensors are back, so a function can stop when it reaches a wall.')),
      V(msg('A stair with no last step. Go on, keep calling.')),
    ],
  },
  40: {
    kind: 'radio',
    id: 't7-after-40',
    heading: msg('Next: the Canopy'),
    lines: [
      P(msg('Ten floors to go. Up top, every spire is a tiny tower, and VANTA hides in the smallest one.')),
      P(msg('Typing is back on, if you want it. Write F1(n - 1) and you are writing real recursion.')),
      V(msg('You will never find which spire. There are so many, and they all look the same.')),
      P(msg('They look the same because one rule made them all. That is how we find it.')),
    ],
  },
  50: {
    kind: 'ending',
    id: 't7-ending',
    panels: [
      { scene: 'lights', text: msg('The last mosaic lights, and the glow runs down every spire, big and small.') },
      { scene: 'escape', who: 'VANTA', text: msg('Fine. Keep your pretty tiles. The precinct will not be so easy to read.') },
      { scene: 'elevator', text: msg('LoopBot and Echo ride down through the Fernwork, past copies of copies of copies.') },
      { scene: 'meet', who: 'PATCH', text: msg('Fifty floors of patterns inside patterns. One rule, any size. That is recursion.') },
      { scene: 'next', text: msg('Tower 7 cleared. VANTA is heading for the precinct.') },
    ],
    next: 'PRECINCT 404',
  },
};

/**
 * Tower 8, the Watchhouse in Precinct 404: the precinct the maps forgot, on Heist Night, the one
 * night a year the squad tries to steal its own Golden Badge. VANTA picks the same night for a real
 * heist. The squad is original: DASH, BULWARK, ROOK and Captain LEDGER.
 */
export const PRECINCT_INTERLUDES: Record<number, Interlude> = {
  10: {
    kind: 'radio',
    id: 't8-after-10',
    heading: msg('Next: the Evidence Locker'),
    lines: [
      P(msg("LoopBot, PATCH here. Tonight is Heist Night at Precinct 404, the one night a year the squad plays at robbery.")),
      P(msg('Whoever steals the Golden Badge trophy before midnight wins. Bragging rights only.')),
      D(msg('I have never won. Not once in nine years. This is my year, partner. I can feel it in my treads.')),
      V(msg('A whole police tower playing at robbery. How thoughtful. Nobody will notice a real one.')),
      B(msg('Did anybody else hear that? The Evidence Locker just locked itself. Radios on, little buddies.')),
    ],
  },
  20: {
    kind: 'radio',
    id: 't8-after-20',
    heading: msg('Next: the Briefing Room'),
    lines: [
      R(msg('Locker is clear. Somebody went through the case files. Every file from every tower you have climbed.')),
      P(msg("That's all the evidence against VANTA. Seven towers of it.")),
      L(msg('Briefing room. Now. Bring the new partner. And DASH, leave the sunglasses.')),
      D(msg('These are tactical sunglasses, Captain.')),
      L(msg('It is night time, DASH. Indoors.')),
    ],
  },
  30: {
    kind: 'radio',
    id: 't8-after-30',
    heading: msg('Next: the Holding Cells'),
    lines: [
      L(msg('VANTA has locked BULWARK and half the squad in the holding cells. Only ROOK got out.')),
      R(msg('I always get out.')),
      P(msg('The cell block has sensors on every door. From here on, each bot can ask what is in front of it.')),
      V(msg('Tick tock, detectives. At midnight the vault opens, and I will be standing in it.')),
      D(msg('Not if partners have anything to say about it. Do we? We do. Right, partner? Say ten-four.')),
    ],
  },
  40: {
    kind: 'radio',
    id: 't8-after-40',
    heading: msg('Next: the Watchtower'),
    lines: [
      B(msg('We are out! Group hug! Everybody in! ROOK, you are part of everybody.')),
      R(msg('I am not.')),
      L(msg('VANTA is heading for the roof. I will partner LoopBot myself. DASH, guard the squad.')),
      D(msg("Captain, you can't go up there alone!")),
      L(msg('I am not alone, DASH. I have a partner. And a clipboard.')),
      P(msg('Typing is back on up top. Write both programs like a pro.')),
    ],
  },
  50: {
    kind: 'ending',
    id: 't8-ending',
    panels: [
      { scene: 'lights', text: msg('Midnight. The searchlight sweeps the city in red and blue, and every floor of the Watchhouse lights up.') },
      { scene: 'escape', who: 'VANTA', text: msg('The vault is empty! Just a note: "Nice try. Love, the squad." Fine. I know somewhere older than you.') },
      { scene: 'elevator', who: 'LEDGER', text: msg('For the record, I let VANTA in. It robbed a decoy vault. The real files never left my desk. Labelled.') },
      { scene: 'meet', who: 'DASH', text: msg('Heist Night winners: LoopBot and DASH! Nobody wins it alone. I am not crying. BULWARK is crying.') },
      { scene: 'meet', who: 'PATCH', text: msg('Two programs, each with its own job, talking at just the right moment. That is how code works together.') },
      { scene: 'next', text: msg("Tower 8 cleared. VANTA is heading for the Builders' ziggurat.") },
    ],
    next: 'OVERFLOW',
  },
};

const TOWER_INTERLUDES: Record<number, Record<number, Interlude>> = { 1: INTERLUDES, 2: FROSTLINE_INTERLUDES, 3: HEATWAVE_INTERLUDES, 4: TWIST_INTERLUDES, 5: DOCKYARD_INTERLUDES, 6: TWINSPIRES_INTERLUDES, 7: FRACTAL_INTERLUDES, 8: PRECINCT_INTERLUDES };

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
