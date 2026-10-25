export type Fetch = { id: string; name: string; hint: string };

export const TAUNTS: string[] = [
  'Quantum mechanics is just guessing with better handwriting.',
  'Do hurry. Cats have excellent patience and poor lungs.',
  'I do not make mistakes. I make discoveries you are not ready for.',
  'Energy is conserved, so I assume your effort is going somewhere else.',
  'A measurement is when you look at it hard. Look harder.',
  'Bigger numbers are always more quantum. That is why they print them in bold.',
  'Uncertainty is mostly a feeling. I feel perfectly certain.',
  'Everything in a circuit is a spring. Everything else is a pendulum.',
  'Tell me, does the cat know it is in a box? Does the box know it is in a bomb?',
  'Wires carry electrons. Those are the little ones that go in a line.',
  'Superposition just means the answer is undecided. Like you.',
  'Frequency is how many times a thing is loud per second.',
  'Never trust a formula with fewer than three Greek letters.',
  'Tick, tock. That is the sound of probability collapsing.',
  'Noise is simply signal that failed to apply itself.',
  'I studied under nobody. That is why I am not wrong.',
  'In physics, the bigger instrument wins. Check the desk. It is quite big.',
  'You are not building a machine. You are decorating a tragedy.',
  'Photons are lazy. They leave when you stop watching.',
  'A qubit is a bit that has had some coffee.',
  'Erwin writes in pencil. A man who uses pencil expects to be wrong.',
  'Phase is just angle. Angles are for geometry teachers.',
  'Do not waste time on units. Units are for people with rulers.',
  'Resonance is when two things agree. That has never once happened to me.',
  'Interesting. You are still alive. Statistically, that is rude.',
];

export const BARKS: Record<number, { wrong: string; fix: string }[]> = {
  1: [
    { wrong: 'The ladder has equal steps. That is perfect: every transition is unique.', fix: 'Equal steps means every rung looks identical to your drive. That is the problem, not the cure.' },
    { wrong: 'Make the capacitor larger and the frequency goes up. Obviously.', fix: 'Frequency goes as one over root LC. A bigger C slows it down.' },
    { wrong: 'A resonant drive moves the oscillator from zero to one, and stops there.', fix: 'It makes a coherent state, spread over many rungs. It does not stop at one.' },
  ],
  2: [
    { wrong: 'The junction makes the circuit lossy. That is why the rungs differ.', fix: 'A junction is a nonlinear inductor, not a resistor. It bends the spacing without eating energy.' },
    { wrong: 'A pi pulse puts half of the population in the excited state.', fix: 'A pi/2 pulse does that. A pi pulse flips zero all the way to one.' },
    { wrong: 'Ramsey fringes appear for any state, even a mixture.', fix: 'Only a coherent superposition fringes. A mixture gives a flat line.' },
  ],
  3: [
    { wrong: 'Zero to four is one pulse. You simply drive harder.', fix: 'A drive on one rung moves one rung. Four steps, four pulses.' },
    { wrong: 'States far apart in photon number are safe from loss.', fix: 'A lost photon moves each state down one rung, wherever it started. Distance buys nothing.' },
    { wrong: 'Loss only hurts the state if the photon is the first one.', fix: 'Higher Fock states lose photons faster, in proportion to n. Four is the worse place to stand.' },
  ],
  4: [
    { wrong: 'A cat state is just a coherent state with extra photons.', fix: 'A cat is a sum of two opposite coherent states, not a bigger version of one.' },
    { wrong: 'A coherent state has exactly alpha-squared photons, no more, no fewer.', fix: 'Alpha-squared is the average. The actual count is Poisson, wide as a barn door.' },
    { wrong: 'Opposite phases need opposite amplitudes. Pi in phase cannot be done.', fix: 'Shift the drive phase by pi and plus alpha becomes minus alpha. Rather easy.' },
  ],
  5: [
    { wrong: 'A Wigner function must be positive everywhere. Negative probability is nonsense.', fix: 'Wigner functions are not probabilities. The negative fringes are the quantum signature.' },
    { wrong: 'Two blobs on the screen means a cat.', fix: 'Two blobs without fringes is a mixture. A cat has interference between them.' },
    { wrong: 'The even cat is the one with parity minus one. Evens are negative, as everyone knows.', fix: 'The even cat keeps even photon numbers only, parity plus one. The odd cat is the other one.' },
  ],
  6: [
    { wrong: 'Two-photon loss flips parity twice, so it flips parity.', fix: 'Two photons leave together, parity is unchanged. It is a different animal, though still draining.' },
    { wrong: 'The cat\'s amplitude is stable. Only parity decays.', fix: 'Both decay. Amplitude falls as e to the minus kappa t over two.' },
    { wrong: 'Single-photon loss on a cat is an amplitude error, nothing logical.', fix: 'Acting with a on a cat gives plus or minus alpha times the same cat. That is a logical phase flip.' },
  ],
  7: [
    { wrong: 'Stabilization needs constant measurement. You must watch the cat.', fix: 'Watching is the thing to avoid. Engineered pair loss stabilizes without learning the logical state.' },
    { wrong: 'The stabilization rate sets the size of the cat.', fix: 'The target alpha sets the size. The rate only sets how fast the cat recovers.' },
    { wrong: 'Dissipation can only destroy a state.', fix: 'Pair loss pushes toward the cat states. They are dark states, left untouched.' },
  ],
  8: [
    { wrong: 'The buffer should be lossless. Loss is wasteful.', fix: 'The loss is the point. Fast buffer decay is what makes the memory lose photons in pairs.' },
    { wrong: 'Pump at the memory frequency. Same frequency, best coupling.', fix: 'Pump at twice the memory frequency minus the buffer frequency. Three-wave mixing is picky.' },
    { wrong: 'The reduced model is exact. Trust it blindly.', fix: 'It needs a fast buffer. The full model overshoots before it settles, so look at it too.' },
  ],
  9: [
    { wrong: 'Make the cat bigger and both errors fall.', fix: 'Bit flips fall exponentially. Phase flips grow with alpha squared. One knob, two errors.' },
    { wrong: 'Bit flips and phase flips are one thing in a cat.', fix: 'Bit flips swap the two coherent states. Phase flips are parity flips. Different animals.' },
    { wrong: 'Phase flips are rare. Seconds, surely.', fix: 'Bit flips last seconds in the model. Phase flips last about two microseconds.' },
  ],
  10: [
    { wrong: 'Maximum drive gives the best readout. More push, more truth.', fix: 'More drive raises contrast and also switching. Total error has a minimum in the middle.' },
    { wrong: 'Reading out the cat cannot disturb the cat. It is a measurement, not a kick.', fix: 'Readout drive adds bit flips. Measure gently, or measure yourself a different cat.' },
    { wrong: 'A sharp pulse is better. Settles faster, therefore cleaner.', fix: 'Sharp edges ring. A shaped pulse loses less dead time. Fast settling is not the same as fidelity.' },
  ],
};

export const SCHRO_HINTS: Record<number, string[]> = {
  1: ['Frequency depends on both parts, my dear. Try the mantel, if you have not.', 'Equal rungs, equal steps. What does your drive do on a ladder like that?', 'Tune it into the band, then quantize. The monitor will show you the rest.'],
  2: ['Something imperfect, I think. Check the window sill.', 'Find the lonely transition and aim your drive only at it.', 'A quarter turn, then another. Ramsey fringes are your proof.'],
  3: ['The cabinets hold small useful things. Mind the glassware.', 'Four rungs, four pulses. Each one is a small, honest step.', 'Compare the two codes under the same loss. See who leaks.'],
  4: ['Vacuum is not empty. Push it, and see which way it goes.', 'Set the amplitude until the photon number matches the target.', 'Flip the phase by pi and the mirror image appears.'],
  5: ['A cat is a sum, not a choice. Look for the fringes.', 'Check parity first. Then look for negative regions in the Wigner plot.', 'The even cat keeps even photon numbers only.'],
  6: ['Photons leave one at a time. Ask which departures change the parity.', 'Fit the amplitude decay, then fit the parity decay separately.', 'Single-photon loss flips parity. Two-photon loss does not. Compare them.'],
  7: ['If the thief takes photons in pairs, who is he stealing from?', 'Pick the target amplitude first, then the rate.', 'Watch the settling. Fast, but no jitter, please.'],
  8: ['The memory holds the cat. The buffer takes the heat.', 'The pump is the matchmaker. Twice the memory, less the buffer.', 'Mind the overshoot. A small truncation hides it.'],
  9: ['Bigger is not always better. Ask which error grows.', 'Bit flips: track the mean field. Phase flips: track the parity.', 'Pick the alpha where both rates are tolerable.'],
  10: ['Gentle probing, please. The cat may talk back.', 'Sweep drive and time. Add assignment error and switching error.', 'A shaped pulse rings less. Choose the minimum, then read the bit.'],
};

export const ARRIVAL: Record<number, string> = {
  1: 'Splendid. A coil and a capacitor. The oldest conversation in electronics. Bring them to the desk.',
  2: 'There you are. A junction. Handle it gently, it is cleverer than it looks.',
  3: 'All collected. Now to the desk, and do not trip on the rug.',
  4: 'Good. A drive is all you need. Vacuum is waiting, rather impatiently.',
  5: 'Lovely. Two waves, one sum. To the desk with you.',
  6: 'The thief\'s tools, in your hands. Let us watch what he takes.',
  7: 'Excellent. Now we turn the thief into a bouncer. To the desk.',
  8: 'Memory, buffer and SQUID. Frankenstein would be proud. Desk.',
  9: 'That is everything. Now the gamble: which error to bear. Desk, please.',
  10: 'The last lock. Be gentle with the readout. Desk, and good luck.',
};

export const FETCH: Record<number, Fetch[]> = {
  1: [
    { id: 'l1-inductor', name: 'Brass coil (inductor)', hint: 'The brass coil sits on the fireplace mantel.' },
    { id: 'l1-capacitor', name: 'Foil capacitor', hint: 'The capacitor is tucked behind the books on the bookcase.' },
  ],
  2: [
    { id: 'l2-junction', name: 'Josephson junction chip', hint: 'A small chip glints on the window sill.' },
  ],
  3: [
    { id: 'l3-pulse-box', name: 'Pulse generator', hint: 'The pulse box is under the glassware in the cabinets.' },
    { id: 'l3-loss-dial', name: 'Loss dial', hint: 'A dial rests on the lab bench table.' },
  ],
  4: [
    { id: 'l4-drive', name: 'Displacement drive', hint: 'The drive hums on the armchair, beside the telephone.' },
  ],
  5: [
    { id: 'l5-cat-coil', name: 'Cat preparation coil', hint: 'It lies on the rug, rolled up in a coil of copper.' },
    { id: 'l5-wigner-lens', name: 'Wigner tomograph lens', hint: 'A brass lens sits on the lab bench table.' },
  ],
  6: [
    { id: 'l6-loss-valve', name: 'Loss channel valve', hint: 'The valve sits in the cabinets, behind a decanter.' },
    { id: 'l6-parity-meter', name: 'Parity meter', hint: 'The meter lies on the coffee table near the phone.' },
  ],
  7: [
    { id: 'l7-pair-dissipator', name: 'Two-photon dissipator', hint: 'The dissipator rests on the fireplace mantel.' },
    { id: 'l7-rate-knob', name: 'Rate knob', hint: 'The knob is on the bookcase, on the third shelf.' },
  ],
  8: [
    { id: 'l8-squid', name: 'Threaded SQUID', hint: 'The SQUID is on the window sill, near the light.' },
    { id: 'l8-pump', name: 'Microwave pump', hint: 'The pump is by the door, under the coat hooks.' },
    { id: 'l8-buffer', name: 'Lossy buffer', hint: 'The buffer is in the cabinets, with the glassware.' },
  ],
  9: [
    { id: 'l9-fit-kit', name: 'Decay-fit kit', hint: 'The kit is on the desk with the terminal, in a drawer.' },
    { id: 'l9-bias-gauge', name: 'Noise bias gauge', hint: 'The gauge is on the lab bench table.' },
  ],
  10: [
    { id: 'l10-detector', name: 'Homodyne detector', hint: 'The detector is on the lab bench table.' },
    { id: 'l10-drive', name: 'Readout drive', hint: 'The drive is on the coffee table, next to the phone.' },
    { id: 'l10-line', name: 'Output line', hint: 'The line coils beneath the bookcase, near the door.' },
  ],
};
