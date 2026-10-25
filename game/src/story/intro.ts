export type IntroBeat = {
  id: 'enter' | 'place' | 'arm' | 'panic' | 'schro_enter' | 'schro_1' | 'schro_2' | 'schro_3' | 'handoff';
  who: 'heisenberg' | 'schrodinger' | 'narrator' | 'player';
  text: string;
  lines?: string[]; // optional extra lines spoken after `text`
};

export const INTRO_BEATS: IntroBeat[] = [
  {
    id: 'enter',
    who: 'narrator',
    text: 'The study door swings open. A man in a hat and dark glasses strides in, tucked under his arm: your cat.',
    lines: ['He does not knock. He does not hurry.'],
  },
  {
    id: 'place',
    who: 'heisenberg',
    text: 'Your cat. How sweet. Sit, little one. This chamber is airtight, soundproof, and entirely my idea.',
    lines: ['The glass door closes with a click. The cat looks at you through it.'],
  },
  {
    id: 'arm',
    who: 'heisenberg',
    text: 'One bomb, one timer, one quantum lock. I am the one who knocks. And I am done knocking.',
    lines: ['A red display wakes up. Ten dark bars glow along its edge.'],
  },
  {
    id: 'panic',
    who: 'player',
    text: 'No. No, no, no. Stop. That is my cat!',
    lines: ['Is that thing counting down?'],
  },
  {
    id: 'schro_enter',
    who: 'schrodinger',
    text: 'Ah. Pardon me. I think I left my pipe in here. Oh dear. Hello, Werner.',
  },
  {
    id: 'schro_1',
    who: 'schrodinger',
    text: 'Do not panic, my friend. That lock opens only for physics, and physics is something you can do.',
    lines: ['Ten experiments, one after another. Ten bars, ten locks.'],
  },
  {
    id: 'schro_2',
    who: 'schrodinger',
    text: 'The parts are scattered about the study. Fireplace, shelves, the armchair. Find them, carry them to the big desk.',
    lines: ['Assemble them there, then read the results on the monitor.'],
  },
  {
    id: 'schro_3',
    who: 'schrodinger',
    text: 'Werner will offer advice. He is very sure of himself. I would check his sums before you trust them.',
    lines: ['Heisenberg sniffs. He is, he says, always right.'],
  },
  {
    id: 'handoff',
    who: 'schrodinger',
    text: 'Off you go. First lock: an inductor and a capacitor. Try the mantel. I shall hold your cat\'s hand. Metaphorically.',
  },
];
