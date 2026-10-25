import type { DialogueLine, LevelContent } from '../types';

export const INTRO: DialogueLine[] = [
  {
    who: 'schrodinger',
    text: 'Dear Experimentalist, I have sealed your cat inside a box containing a very special device.',
  },
  {
    who: 'schrodinger',
    text: 'If you would like your cat back, I suggest you learn quantum mechanics. — E. Schrödinger',
  },
  {
    who: 'heisenberg',
    text: 'Of course. Theoretical physicists. Always leaving someone else to do the actual experiment.',
  },
  {
    who: 'heisenberg',
    text: "Listen carefully. We need to build a quantum computer. And judging by these notes, we're starting from nothing.",
  },
];

export const ENDING: DialogueLine[] = [
  {
    who: 'narrator',
    text: 'The bomb powers down. The cat walks out of the box and meows.',
  },
  { who: 'heisenberg', text: 'All that effort. For one cat.' },
  { who: 'heisenberg', text: "Still better than Schrödinger's approach." },
];

export const LEVELS: LevelContent[] = [
  {
    id: 1,
    title: 'The Quantum Ladder',
    subtitle: 'Trap a quantum of energy',
    intro: [
      {
        who: 'schrodinger',
        text: 'Note: the ladder is simple, and that is exactly the trap. Start from the bottom rung. — E. Schrödinger',
      },
      {
        who: 'heisenberg',
        text: 'Assemble an LC circuit. Its frequency depends only on the inductor and the capacitor.',
      },
      {
        who: 'heisenberg',
        text: 'Then quantize it. The energy comes in equal steps, and that is the whole problem.',
      },
    ],
    outro: [
      { who: 'heisenberg', text: "Congratulations. You've built an extremely expensive spring." },
      {
        who: 'heisenberg',
        text: 'Equal spacing means every drive hits every transition. Useless for a qubit. Keep going.',
      },
      {
        who: 'schrodinger',
        text: 'Every rung identical, yet you must still choose which one matters. Isn\'t that delicious?',
      },
    ],
    takeaway:
      'An LC circuit is a harmonic oscillator with levels E_n = hbar*omega*(n+1/2) spaced equally, so a qubit needs more than the bare oscillator.',
    hints: [
      'When every rung of a ladder is the same height, ask which single step you could pick out on its own.',
      'Build the LC circuit, compute its frequency from L and C, and confirm the energy steps are evenly spaced.',
      'Assemble the LC circuit, quantize it, select |0> and |1> as the qubit states, then apply a drive at the resonator frequency and observe the response.',
    ],
    note: {
      clue: 'The ladder is perfectly even. If you cannot tell one rung from the next, you cannot tell which one you are standing on.',
      concept:
        'An LC circuit is a quantum harmonic oscillator. Its energy comes in equal steps of hbar*omega, offset by a half-step of zero-point energy. Because every step is the same size, a simple drive cannot address just one transition.',
      equations: ['omega = 1/sqrt(L*C)', 'E_n = hbar*omega*(n+1/2)'],
      observation:
        'The spectrum shows evenly spaced peaks, and a drive at that spacing excites every transition in the ladder, not just the one you want.',
      hardware:
        'LC resonator (inductor and capacitor) quantized as a harmonic oscillator; Fock states |0> and |1> as the qubit.',
    },
    completion: 'Resonance established.',
  },
  {
    id: 2,
    title: 'The Forbidden Transition',
    subtitle: 'Anharmonicity and Bloch rotations',
    intro: [
      {
        who: 'schrodinger',
        text: 'Note: your ladder is too evenly spaced to be useful. Add something imperfect. — E. Schrödinger',
      },
      {
        who: 'heisenberg',
        text: 'Josephson junction. A nonlinear inductor. It makes the rungs uneven, so one transition becomes special.',
      },
      {
        who: 'heisenberg',
        text: 'Tune your drive to the 0-1 transition, then calibrate a pi pulse and a pi/2 pulse. Do it precisely.',
      },
    ],
    outro: [
      { who: 'heisenberg', text: "Half zero, half one. No, that doesn't mean we only did half the work." },
      {
        who: 'schrodinger',
        text: 'The fringes return when the second pulse turns. Coherence is a phase, and phases are what reveal it.',
      },
    ],
    takeaway:
      'A Josephson junction makes the transitions unequally spaced, so a pi pulse at the 0-1 frequency takes |0> to |1> and a pi/2 pulse creates the superposition |+>.',
    hints: [
      'The junction makes the rungs unequal. Find the one step that is different and aim your drive only there.',
      'Sweep the drive frequency to find the 0-1 resonance, calibrate the pulse area for a full flip and for a half flip, then run Ramsey by changing the phase of the second pulse.',
      'Set the drive to the 0-1 transition frequency, then a pulse area of pi to reach |1>, then a pulse area of pi/2 to make |+>. Finally run Ramsey and sweep the phase of the second pi/2 pulse.',
    ],
    note: {
      clue: 'Two rungs that look the same to a clumsy drive are different to a careful one. Find the lonely transition, then make it turn halfway.',
      concept:
        'A Josephson junction acts as a nonlinear inductor, which makes the spacing between levels unequal. Driving at the 0-1 frequency flips only the bottom two levels. Ramsey fringes are what prove coherence, because a 50/50 mixture of |0> and |1> looks the same without them.',
      equations: [
        'omega_01 != omega_12 (junction anharmonicity)',
        'pi pulse: |0> -> |1>',
        'pi/2 pulse: |0> -> (|0>+|1>)/sqrt(2)',
      ],
      observation:
        'Ramsey fringes oscillate as the second pulse phase is swept. A flat result means the qubit is only a 50/50 mixture, not a superposition.',
      hardware: 'Anharmonic transmon-style oscillator; calibrated pi and pi/2 pulses; Ramsey sequence.',
    },
    completion: 'Coherent superposition verified.',
  },
  {
    id: 3,
    title: 'The Great Quantum Escape',
    subtitle: 'Other bosonic encodings',
    intro: [
      {
        who: 'schrodinger',
        text: 'Note: the code need not be |0> and |1>. Consider the pair |0> and |4>, and see whether the box still keeps them apart. — E. Schrödinger',
      },
      {
        who: 'heisenberg',
        text: 'Fine. But no single pulse jumps from 0 to 4. You climb in steps, and you check each rung.',
      },
      {
        who: 'heisenberg',
        text: 'Then watch them leak. Photon loss does not read the rulebook.',
      },
    ],
    outro: [
      {
        who: 'heisenberg',
        text: 'Separation is not protection. A photon lost from |4> still lands outside the code.',
      },
      {
        who: 'schrodinger',
        text: 'Distance is a comfort, not a shield. Something must actively keep the code space closed. — E. Schrödinger',
      },
    ],
    takeaway:
      'Code states that are far apart in Fock number still need intermediate steps to prepare, and photon loss still moves them out of the code space, so separation alone is not protection.',
    hints: [
      'A bigger gap between code states sounds protective. Ask what a single lost photon does to each code state.',
      'Pick the {|0>,|1>} pair first, then the {|0>,|4>} pair. Reaching |4> from |0> takes several pulses, each one step, not one big jump.',
      'Choose the {|0>,|1>} pair, then the {|0>,|4>} pair. Climb from 0 to 4 with a sequence of intermediate pulses, check the population at each step, then apply photon loss and compare the leakage out of the code space.',
    ],
    note: {
      clue: 'Four rungs of distance feel safer than one. Count what a single lost photon does.',
      concept:
        'A bosonic code stores information in the Fock states of a resonator. Choosing distant states such as |0> and |4> does not stop a photon loss event from moving each state out of the code. Reaching the distant state also needs intermediate steps, because no single-photon pulse connects 0 to 4 directly.',
      equations: ['a|n> = sqrt(n)|n-1>', 'codes: {|0>,|1>} versus {|0>,|4>}'],
      observation:
        'Loss moves |4> into |3>, which lies outside the code, so the population leaks out of the pair. Distance alone does not prevent this.',
      hardware: 'Bosonic resonator with selective pulses for Fock-state transitions, and a photon loss channel.',
    },
    completion: 'Leakage pathway mapped.',
  },
  {
    id: 4,
    title: 'The Quantum Wave Machine',
    subtitle: 'Coherent states',
    intro: [
      {
        who: 'schrodinger',
        text: 'Note: vacuum is not empty. Shake it with a drive and it becomes a wave with a definite phase. — E. Schrödinger',
      },
      {
        who: 'heisenberg',
        text: 'Displacement. Start from vacuum, apply the drive, and the state moves in phase space to alpha.',
      },
      {
        who: 'heisenberg',
        text: 'Match the mean photon number to the target, then prepare the two opposite phases. Do not get lazy.',
      },
    ],
    outro: [
      {
        who: 'heisenberg',
        text: 'Mean photon number is |alpha|^2. Easy. The hard part is the phase, which you cannot see on a spectrum.',
      },
      {
        who: 'schrodinger',
        text: 'Two waves, mirror images, equally real. You will need them both. — E. Schrödinger',
      },
    ],
    takeaway:
      'A coherent state |alpha> is the displaced vacuum with mean photon number |alpha|^2 and Poisson photon statistics, and |+alpha> and |-alpha> are its opposite-phase versions.',
    hints: [
      'A coherent state is the closest thing a classical wave has to a quantum state. Think of the drive as moving the vacuum, not adding photons one at a time.',
      'Set the drive amplitude until the measured photon number matches the target, then set the drive phase to point the state in the target direction.',
      'Start from vacuum and apply a displacement with the target alpha. Match the mean photon number to |alpha|^2, then prepare |+alpha> and |-alpha> by changing the drive phase by pi.',
    ],
    note: {
      clue: 'Vacuum is not empty. Push it gently and it sloshes in a fixed direction.',
      concept:
        'A coherent state is made by displacing the vacuum, with alpha = x + i*y setting its amplitude and phase. Its photon number is Poisson distributed with mean |alpha|^2. The states |+alpha> and |-alpha> have opposite phase and are the building blocks of cat states.',
      equations: [
        'alpha = x + i*y',
        '<n> = |alpha|^2',
        'P(n) = exp(-|alpha|^2) * |alpha|^(2n) / n!',
      ],
      observation:
        'The photon-number histogram is Poisson shaped, with a width set by the mean. Opposite-phase states appear as blobs in opposite places in phase space.',
      hardware: 'Coherent drive (displacement) on the resonator, and photon-number readout.',
    },
    completion: 'Coherent amplitude matched.',
  },
  {
    id: 5,
    title: 'Two Cats, One Box',
    subtitle: 'Superposition versus mixture',
    intro: [
      {
        who: 'schrodinger',
        text: 'Note: a cat is the sum of two waves, not a choice between them. Only the sum is the cat. — E. Schrödinger',
      },
      {
        who: 'heisenberg',
        text: 'Four candidates. One even cat. Check the photon parity and the Wigner function.',
      },
      {
        who: 'heisenberg',
        text: 'If there are no negative regions, it is a mixture, and a mixture is just two boring blobs.',
      },
    ],
    outro: [
      {
        who: 'heisenberg',
        text: 'Two blobs with no fringes is a mixture. Fringes with negative regions is coherence. The difference matters.',
      },
      {
        who: 'schrodinger',
        text: 'Even cat, parity plus one. The box holds a superposition now. Do not open it too early.',
      },
    ],
    takeaway:
      'The cat state |C+/-> is a superposition of |+alpha> and |-alpha> with definite photon parity, and only the superposition shows Wigner interference fringes that a mixture of the two cannot produce.',
    hints: [
      'A cat is a sum, not a mixture. Look for the feature a sum of two waves has and a plain pair of blobs does not.',
      "Check each candidate's photon-number distribution for parity, and its Wigner function for negative regions between the two blobs. The even cat has only even photon numbers.",
      'Build the cat from the equal-weight sum of |+alpha> and |-alpha>. Among the four candidates, pick the one with parity plus one and negative Wigner regions between the blobs.',
    ],
    note: {
      clue: 'Two waves, one sum. The even sum keeps only even photon numbers, and the odd sum keeps only the odd ones.',
      concept:
        'A cat state is an equal-weight superposition |C+/-> proportional to |+alpha> +/- |-alpha>. The plus sign keeps only even photon numbers (parity +1), and the minus sign keeps only odd ones (parity -1). Interference between the two lobes produces negative regions in the Wigner function, which a classical mixture of the same coherent states cannot produce.',
      equations: [
        '|C+/-> proportional to |+alpha> +/- |-alpha>',
        'parity = +1 for the even cat, -1 for the odd cat',
        '<+alpha|-alpha> = exp(-2*|alpha|^2), small but not exactly zero',
      ],
      observation:
        "The even cat's Wigner function shows fringes between the blobs, with negative regions. A mixture of the same two blobs shows no fringes.",
      hardware: 'Two-component cat state preparation on the resonator, and Wigner tomography for readout.',
    },
    completion: 'Even-cat parity confirmed.',
  },
  {
    id: 6,
    title: 'The Photon Thief',
    subtitle: 'Loss and decoherence',
    intro: [
      {
        who: 'schrodinger',
        text: 'Note: the box is leaky. Photons drift out, and the cat shrinks toward nothing. — E. Schrödinger',
      },
      {
        who: 'heisenberg',
        text: 'Measure the amplitude decay, then the parity decay. Compare single-photon loss with two-photon loss.',
      },
      {
        who: 'heisenberg',
        text: 'Then decide which logical error dominates. Not every error is the same kind of wrong.',
      },
    ],
    outro: [
      { who: 'heisenberg', text: 'Your cat was doing fine until the universe started asking questions.' },
      {
        who: 'schrodinger',
        text: 'One photon flips the parity. Two photons leave it intact, but they cannot hold the cat up. — E. Schrödinger',
      },
    ],
    takeaway:
      'Single-photon loss decays the cat amplitude and flips its parity, acting as a logical phase error, while two-photon loss conserves parity but drains the amplitude toward zero without a drive.',
    hints: [
      'Photons leave the box one at a time. Ask which of those departures changes the photon-number parity of the cat.',
      'Fit the amplitude decay to get the decay rate, and fit the parity decay separately. Then repeat with two-photon loss and compare which error the cat shows.',
      'Prepare a cat, record amplitude and parity over time, then switch on single-photon loss and then two-photon loss and compare. Parity flips mean logical phase flips, so classify the dominant error from that.',
    ],
    note: {
      clue: 'A thief who takes one photon at a time changes the parity. A thief who takes two keeps it, but leaves the cat empty.',
      concept:
        'Photon loss decays the coherent amplitude as alpha(t) = alpha(0)*exp(-kappa*t/2). Single-photon loss acts on a cat as a|+/-alpha> = +/-alpha|+/-alpha>, so a is approximately alpha*Z_L, a logical phase flip. Two-photon loss conserves parity, but without a drive it drives the amplitude toward zero.',
      equations: [
        'alpha(t) = alpha(0)*exp(-kappa*t/2)',
        'a|+/-alpha> = +/-alpha|+/-alpha>, so a ~ alpha*Z_L',
      ],
      observation:
        'The amplitude decays exponentially, and parity flips appear after each single-photon event. Two-photon loss keeps parity but the amplitude runs down toward zero.',
      hardware: 'Single-photon and two-photon loss channels on the resonator, with decay-rate fitting.',
    },
    completion: 'Loss channel characterized.',
  },
  {
    id: 7,
    title: 'The Quantum Immortality Machine',
    subtitle: 'Engineered dissipation',
    intro: [
      {
        who: 'schrodinger',
        text: 'Note: the thief can be turned into a bouncer. Give the photons a path that only the wrong states can take. — E. Schrödinger',
      },
      {
        who: 'heisenberg',
        text: 'Two-photon loss, engineered on purpose. It pushes the cat back to its target amplitude.',
      },
      {
        who: 'heisenberg',
        text: 'Tune the rate and the target alpha, then wait for the recovery and settling criteria to pass. Patience.',
      },
    ],
    outro: [
      { who: 'heisenberg', text: 'Using dissipation to fight dissipation. I hate how much sense that makes.' },
      {
        who: 'schrodinger',
        text: 'The cat is never measured, and yet it stays itself. A dark state. Keep it that way. — E. Schrödinger',
      },
    ],
    takeaway:
      'Engineered two-photon dissipation with jump operator L2 = sqrt(kappa2)*(a^2 - alpha^2) makes cat states dark states that stabilize the logical subspace without measuring which logical state is stored.',
    hints: [
      'Dissipation normally destroys quantum information. Ask whether you can make it destroy only the errors, pushing the state back toward a target.',
      'Set the target amplitude first, then choose the two-photon dissipation rate. Watch the amplitude over time: it should approach the target and then stop moving.',
      'Set alpha to the target amplitude, then tune kappa2 so the recovery is fast enough, and check that the amplitude settles within the time window without measuring the logical state.',
    ],
    note: {
      clue: 'Let the thief work for you. Photons that leave in pairs can only leave when the cat is out of place.',
      concept:
        'The jump operator L2 = sqrt(kappa2)*(a^2 - alpha^2) pushes the resonator toward the cat manifold. Cat states are dark states of this dissipator, so they are left unchanged while other states are pushed back. The result stabilizes the logical subspace without measuring which logical state is stored.',
      equations: ['L2 = sqrt(kappa2)*(a^2 - alpha^2)', 'dx/dt = kappa2*x*(alpha^2 - x^2) (mean field)'],
      observation:
        'The amplitude relaxes toward the target alpha, and the logical state is preserved without any readout. Cat states stay stationary.',
      hardware: 'Engineered two-photon dissipation on the resonator, with target amplitude alpha and recovery and settling criteria.',
    },
    completion: 'Dark-state stabilization achieved.',
  },
  {
    id: 8,
    title: 'The Superconducting Frankenstein',
    subtitle: 'Memory, buffer, nonlinear coupling',
    intro: [
      {
        who: 'schrodinger',
        text: 'Note: the cat is a memory. Hold it in one mode, and let a lossy buffer do the rest. — E. Schrödinger',
      },
      {
        who: 'heisenberg',
        text: 'Memory, buffer, a SQUID for the nonlinearity, and a pump to make the coupling happen.',
      },
      {
        who: 'heisenberg',
        text: 'Set the pump to the frequency that makes the three-wave mixing work. Then balance the rates. No excuses.',
      },
    ],
    outro: [
      { who: 'heisenberg', text: 'Finally. Actual hardware.' },
      {
        who: 'schrodinger',
        text: 'The reduced model is elegant. The full model is honest, and it overshoots first. — E. Schrödinger',
      },
    ],
    takeaway:
      'A memory mode coupled through a SQUID and a pump to a lossy buffer gets effective two-photon dissipation with kappa2 = 4*g2^2/kappa_b, valid when the buffer is adiabatically eliminated.',
    hints: [
      'The memory must be pulled toward its target by loss that acts through the buffer. Think about how the buffer is linked to the memory.',
      'Set the pump frequency from the memory and buffer frequencies, then tune coupling, buffer damping and drive together. Keep buffer damping much larger than coupling times amplitude, and watch the transient overshoot.',
      'Set the pump to twice the memory frequency minus the buffer frequency. Then choose coupling, buffer damping and drive so alpha^2 = eps_d/g2 and kappa2 = 4*g2^2/kappa_b. Confirm the settling time with a truncation large enough to capture the overshoot.',
    ],
    note: {
      clue: 'The memory holds the cat, the buffer takes the heat. The pump is the matchmaker between them.',
      concept:
        'A three-wave-mixing SQUID couples the memory mode a to a lossy buffer b. With the pump at omega_p = 2*omega_a - omega_b, the buffer can be adiabatically eliminated, leaving effective two-photon dissipation with kappa2 = 4*g2^2/kappa_b. The drive sets the target amplitude alpha^2 = eps_d/g2, and the full model shows a transient overshoot that the reduced model misses.',
      equations: [
        'H = g2*(a^2*b^dag + a^dag^2*b) - eps_d*(b + b^dag)',
        'omega_p = 2*omega_a - omega_b',
        'kappa2 = 4*g2^2/kappa_b,  alpha^2 = eps_d/g2',
      ],
      observation:
        'The memory amplitude overshoots before settling at alpha. A truncation that is too small underestimates the height of the peak.',
      hardware: 'SQUID-based three-wave mixer, buffer resonator, drive tone and pump tone.',
    },
    completion: 'Pump frequency matched.',
  },
  {
    id: 9,
    title: 'The Million-to-One Gamble',
    subtitle: 'Bit flips versus phase flips',
    intro: [
      {
        who: 'schrodinger',
        text: 'Note: a bigger cat hides bit flips well, but leaves the phase exposed. Choose carefully. — E. Schrödinger',
      },
      {
        who: 'heisenberg',
        text: 'Initialize the logical zero as a positive cat. Then measure both error rates.',
      },
      {
        who: 'heisenberg',
        text: 'Fit the bit-flip decay and the phase-flip decay. Pick an alpha that satisfies both constraints.',
      },
    ],
    outro: [
      {
        who: 'heisenberg',
        text: 'Two rates, one knob. Bigger cat, fewer bit flips, more phase flips. Pick your poison.',
      },
      {
        who: 'schrodinger',
        text: 'These benchmark numbers exist only in the model. The gamble, however, is quite real. — E. Schrödinger',
      },
    ],
    takeaway:
      'The bit-flip rate falls exponentially with cat size while the phase-flip rate grows with alpha squared, so the best alpha balances the two error rates rather than maximizing one.',
    hints: [
      'Bigger is not always better here. Ask which error gets worse as the cat grows, and which one gets better.',
      'Prepare the logical zero, track the real part of the mean field over time for bit flips, track the parity decay separately for phase flips, and sweep alpha to find where both are acceptable.',
      'Initialize |0_L> as the positive cat |+alpha>, record Re<a> over time and fit its decay for bit flips, record parity decay for phase flips, then choose the alpha where both rates meet the target.',
    ],
    note: {
      clue: 'One error is exponentially rare, the other grows with size. Find the size where both are tolerable.',
      concept:
        'In a cat qubit, bit flips swap |+alpha> and |-alpha> and are exponentially suppressed as alpha grows, with an exponent that depends on the regime. Phase flips are parity flips and grow roughly with alpha squared, so increasing alpha trades one error for the other.',
      equations: ['Gamma_X ~ exp(-gamma*alpha^2)', 'Gamma_Z ~ 2*kappa_a*alpha^2', '|0_L> ~ |+alpha>'],
      observation:
        'Re<a>(t) decays slowly for bit flips, about 2.6 s in the model. Parity decays much faster for phase flips, about 1.94 microseconds in the model. These are model benchmarks, not a device specification.',
      hardware: 'Cat qubit with fit-based error characterization: Re<a>(t) for bit flips, parity decay for phase flips.',
    },
    completion: 'Noise bias characterized.',
  },
  {
    id: 10,
    title: "Don't Measure the Cat!",
    subtitle: 'Readout and backaction',
    intro: [
      {
        who: 'schrodinger',
        text: 'Note: looking at the cat changes the cat. Your readout is an interrogation, and the cat may talk back. — E. Schrödinger',
      },
      {
        who: 'heisenberg',
        text: 'Assemble the readout chain. Apply a drive along the logical Z direction and read out the buffer.',
      },
      {
        who: 'heisenberg',
        text: "You're not interrogating a suspect. Turn the power down.",
      },
      {
        who: 'heisenberg',
        text: 'Then optimize drive, time, alpha and pulse shape together. Minimize the total error, then read the bit.',
      },
    ],
    outro: [
      {
        who: 'heisenberg',
        text: 'Logical state resolved. Your cat is no longer a question, which is more than most physicists manage.',
      },
      {
        who: 'schrodinger',
        text: 'Measure gently and the cat remains a cat. Measure too hard and you get exactly what you asked for. — E. Schrödinger',
      },
    ],
    takeaway:
      'A readout drive along logical Z reveals the bit through the sign of the buffer quadrature, but a stronger drive increases switching, so total error has an optimum rather than being minimized by maximum drive.',
    hints: [
      'A stronger probe gives a clearer answer and also a bigger chance of disturbing the state. Find the balance point between clarity and disturbance.',
      'Sweep drive amplitude and integration time. Track contrast, assignment error and switching error separately, then add the errors. Shaped pulses reduce ringing, and fast settling is not the same as high fidelity.',
      'Set up the readout chain, sweep drive strength and integration time while adjusting alpha and the pulse shape. Choose the setting that minimizes assignment error plus switching error, then read the hidden bit from the sign of Re<b>.',
    ],
    note: {
      clue: 'Pushing harder on the cat gets an answer quickly, and also a different cat. Keep the probe gentle enough to ask the question once.',
      concept:
        'The Z-type readout term H_Z = eps_Z*(a + a^dag) acts as a logical Z, so the buffer quadrature has opposite sign for the two cat states and reveals the bit. Stronger drives raise contrast but also raise the switching rate, and total error = assignment + switching has an interior optimum. Temporarily enlarging alpha from 2.1 to 2.5 reduces switching, at the cost of contrast.',
      equations: [
        'H_Z = eps_Z*(a + a^dag)',
        'Re<b>_+/- ~ -/+ eps_Z/(2*alpha*g2)',
        'Gamma_X(eps) ~ Gamma_X(0) + c(alpha)*eps^2',
      ],
      observation:
        'Re<b> takes two opposite-sign values for the two cat states. An abrupt pulse rings, and a shaped pulse removes most of the ringing.',
      hardware: 'Readout chain: buffer quadrature measurement, tunable drive, integration window and shaped readout pulse.',
    },
    completion: 'Logical state successfully resolved.',
  },
];
