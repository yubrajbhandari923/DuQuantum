import type { DialogueLine, LevelContent } from '../types';

export const INTRO: DialogueLine[] = [
  { who: 'heisenberg', text: "Your cat, in my chamber, under my bomb. I am the one who knocks." },
  { who: 'schrodinger', text: "Do not panic. The lock opens for physics, and you can do physics. Ten experiments, in a row." },
  { who: 'schrodinger', text: "Find the parts around the study, assemble them at the big desk, read the monitor. Werner will offer advice. Check his sums." },
];

export const ENDING: DialogueLine[] = [
  { who: 'narrator', text: "The tenth bar goes dark. The bomb powers down. The glass door slides open and the cat walks out, meowing." },
  { who: 'schrodinger', text: "There you are. Alive, and entirely decided. Splendid work." },
  { who: 'heisenberg', text: "This is not over. I was being generous. The physics was a test, and you cheated by passing it." },
  { who: 'heisenberg', text: "Fine. Keep the cat. I am leaving, and I will not be told otherwise." },
];

export const LEVELS: LevelContent[] = [
  {
    id: 1,
    title: 'The Quantum Ladder',
    subtitle: 'Trap a quantum of energy',
    intro: [
      { who: 'schrodinger', text: "First lock, my friend. An inductor and a capacitor from around the study, assembled at the big desk. — E. Schrödinger" },
      { who: 'heisenberg', text: "A ladder with equal rungs. Perfect. Every step is special." },
      { who: 'schrodinger', text: "Werner means well. Check the monitor before you believe him." },
    ],
    outro: [
      { who: 'heisenberg', text: "Congratulations. You've built an extremely expensive spring." },
      { who: 'schrodinger', text: "Every rung identical, and so the drive cannot choose one. The first bar goes dark." },
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
      { who: 'schrodinger', text: "Second lock. The ladder is too even. Find the junction chip and take it to the desk. — E. Schrödinger" },
      { who: 'heisenberg', text: "A junction is a resistor with ambitions. Nothing to it." },
      { who: 'schrodinger', text: "A nonlinear inductor, actually. Tune to the 0-1 step, then calibrate your pulses on the monitor." },
    ],
    outro: [
      { who: 'heisenberg', text: "Half zero, half one. No, that doesn't mean we only did half the work." },
      { who: 'schrodinger', text: "The fringes return when the second pulse turns. Coherence is a phase, and the second bar goes dark." },
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
      { who: 'schrodinger', text: "Third lock. Collect the parts from the cabinets and the bench, then compare two codes on the monitor. — E. Schrödinger" },
      { who: 'heisenberg', text: "Zero to four in one pulse. Just push harder." },
      { who: 'schrodinger', text: "No single pulse jumps four rungs. Climb, check each step, then watch them leak." },
    ],
    outro: [
      { who: 'heisenberg', text: "Separation is protection. Four rungs away is four rungs safe." },
      { who: 'schrodinger', text: "Distance is a comfort, not a shield. A lost photon finds both. Lock three opens." },
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
      { who: 'schrodinger', text: "Fourth lock. A drive from the armchair, assembled at the desk. Vacuum is not empty. — E. Schrödinger" },
      { who: 'heisenberg', text: "Add photons until it is a wave. Count them one by one." },
      { who: 'schrodinger', text: "Displace the vacuum instead, and match the mean photon number on the monitor." },
    ],
    outro: [
      { who: 'heisenberg', text: "Mean photon number is alpha squared. I said so first." },
      { who: 'schrodinger', text: "Two waves, mirror images, equally real. You will need both. Lock four opens." },
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
      { who: 'schrodinger', text: "Fifth lock. Gather the cat parts and a tomography lens, then assemble at the desk. — E. Schrödinger" },
      { who: 'heisenberg', text: "Negative probability? Absurd. Throw the plot away." },
      { who: 'schrodinger', text: "It is not a probability. Look at the fringes on the monitor, and check the parity." },
    ],
    outro: [
      { who: 'heisenberg', text: "Two blobs. A cat. Done." },
      { who: 'schrodinger', text: "Two blobs plus fringes. Even cat, parity plus one. Lock five opens." },
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
      { who: 'schrodinger', text: "Sixth lock. The box is leaky. Gather the loss tools and watch the cat shrink on the monitor. — E. Schrödinger" },
      { who: 'heisenberg', text: "Photon loss is a bookkeeping error. Ignore it." },
      { who: 'schrodinger', text: "One photon flips the parity. Measure the amplitude and the parity separately." },
    ],
    outro: [
      { who: 'heisenberg', text: "Your cat was doing fine until the universe started asking questions." },
      { who: 'schrodinger', text: "Two photons leave parity intact but cannot hold the cat up. Lock six opens." },
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
      { who: 'schrodinger', text: "Seventh lock. Turn the thief into a bouncer. Fetch the dissipator, assemble at the desk. — E. Schrödinger" },
      { who: 'heisenberg', text: "Keep watching the cat. Stabilization is just staring." },
      { who: 'schrodinger', text: "No staring. Engineered pair loss pushes the cat home, and the monitor will show when it settles." },
    ],
    outro: [
      { who: 'heisenberg', text: "Using dissipation to fight dissipation. I hate how much sense that makes." },
      { who: 'schrodinger', text: "A dark state. The cat is never measured, and stays itself. Lock seven opens." },
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
      { who: 'schrodinger', text: "Eighth lock. Memory, buffer, SQUID and pump. Gather them all and build the thing at the desk. — E. Schrödinger" },
      { who: 'heisenberg', text: "Pump at the memory frequency. Simple matching." },
      { who: 'schrodinger', text: "Twice the memory, less the buffer. Then mind the overshoot on the monitor." },
    ],
    outro: [
      { who: 'heisenberg', text: "Finally. Actual hardware." },
      { who: 'schrodinger', text: "The reduced model is elegant. The full model is honest, and it overshoots first. Lock eight opens." },
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
      { who: 'schrodinger', text: "Ninth lock. Bring the fit kit to the desk and read the two error rates on the monitor. — E. Schrödinger" },
      { who: 'heisenberg', text: "Bigger cat, fewer errors of every kind. Make it huge." },
      { who: 'schrodinger', text: "Bit flips fall, phase flips grow. One knob, two errors. Choose carefully." },
    ],
    outro: [
      { who: 'heisenberg', text: "Two rates, one knob. Pick your poison." },
      { who: 'schrodinger', text: "These numbers live in the model, but the gamble is real. Lock nine opens." },
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
      { who: 'schrodinger', text: "The last lock. Detector, drive and output line. Assemble the readout chain at the desk. — E. Schrödinger" },
      { who: 'heisenberg', text: "Maximum drive. Read the bit loud and clear." },
      { who: 'schrodinger', text: "Gently, please. Looking at the cat changes the cat. Sweep drive and time on the monitor." },
      { who: 'heisenberg', text: "You're not interrogating a suspect. Turn the power down. Or do not. I am not worried." },
    ],
    outro: [
      { who: 'heisenberg', text: "Logical state resolved. Your cat is no longer a question, which is more than most physicists manage." },
      { who: 'schrodinger', text: "Measure gently and the cat remains a cat. The final bar goes dark." },
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
