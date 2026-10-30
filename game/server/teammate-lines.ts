/** Versioned, reviewed dialogue. Each line is only eligible in its named state. */
export const TEAMMATE_LINES = {
 camp: [
  'The campfire could use another log.', 'A quiet watch is a good watch.', 'I wonder what grows beyond the river.',
  'The wind smells like rain and pine.', 'A little rest before the next adventure.', 'These paths are starting to feel like home.',
  'I’ll keep an eye on the trail.', 'Even heroes need a breather.',
 ],
 follow: [
  'I’ll stay close.', 'Ready when you are.', 'Let’s stick together.', 'I’ve got your back.',
  'Lead the way.', 'I’m right behind you.', 'We’ll have a better chance together.', 'I’ll watch the path.',
 ],
 combat: [
  'Watch out, trouble nearby!', 'I’ll help with this one.', 'Careful, they’re close!', 'Let’s clear a path.',
  'I’m with you!', 'Keep your eyes open.', 'We can handle this together.', 'I’ll cover you.',
 ],
 gate: [
  'Let’s work on the levers.', 'Those levers look like the way in.', 'I’ll help with the gate.', 'One lever at a time.',
  'Let’s get that gate open.', 'I’ll take a look at the mechanism.', 'We’ll need both levers.', 'The gate won’t open itself.',
 ],
 heart: [
  'We made it inside!', 'Let’s go for the heart tree.', 'Stay together in the courtyard.', 'The heart tree is up ahead.',
  'Keep moving, we’re close.', 'I’m right with you.', 'Let’s finish this together.', 'Eyes open in here.',
 ],
 hurt: [
  'I need a moment.', 'That one hurt!', 'I could use some breathing room.', 'I’ll be careful.',
  'Still standing!', 'I need to watch my step.', 'That was a close one.', 'I’m a little worse for wear.',
 ],
} as const;
export type TeammateMood = keyof typeof TEAMMATE_LINES;
