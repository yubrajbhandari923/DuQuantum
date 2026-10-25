# Understanding DuQuantum: From Quantum Mechanics to a Self-Stabilizing Quantum Computer

A detailed physics-first walkthrough of the `ak-changes` branch

I've examined the project's challenge specification, mathematical models, simulation scripts, numerical results, and the latest readout-optimization work.

I want to explain this as a connected scientific story, not simply walk through the repository files. We'll start with what a qubit fundamentally is, understand why ordinary qubits are fragile, construct the cat-qubit physics from oscillators and photon loss, and then examine what your team has actually discovered.

One correction to my earlier overview: Task 2.4 is now implemented in the branch, including circuit-level analysis and simulations of improved readout strategies.

# Part I — What problem are we trying to solve?

## 1. The fundamental challenge of quantum computing

Suppose you want to store one bit of classical information.

You can represent it using two different electrical states:

\\[ 0\longleftrightarrow \text{low voltage} \\]

\\[ 1\longleftrightarrow \text{high voltage}. \\]

These states are relatively easy to distinguish. If the voltage fluctuates slightly, the stored bit usually remains recognizable.

Classical computers exploit this. They don't require physical signals to be perfectly noise-free. They require signals to be sufficiently separated that small fluctuations don't change their logical meaning.

Now consider a quantum bit.

A qubit can be in a general state

\\[ |\psi\rangle=c_0|0\rangle+c_1|1\rangle, \\]

where

\\[ |c_0|^2+|c_1|^2=1. \\]

Unlike a classical bit, we must preserve not only the information about whether the state is 0 or 1, but also the relative quantum phase between those possibilities.

For example,

\\[ |+\rangle=\frac{|0\rangle+|1\rangle}{\sqrt2} \\]

and

\\[ |-\rangle=\frac{|0\rangle-|1\rangle}{\sqrt2} \\]

are different quantum states.

If you measure either one in the computational basis, you obtain 0 or 1 with equal probability. Yet they behave differently in subsequent quantum operations.

This relative-phase information is essential to quantum computation.

### Why is storing it difficult?

A physical qubit cannot be perfectly isolated from its environment.

Energy leaks away. Electromagnetic fields fluctuate. Materials contain microscopic defects. External equipment introduces noise.

These interactions can disturb the quantum state.

Two especially important errors are described by the Pauli operators:

\\[ X=\begin{pmatrix}0&1\\\1&0\end{pmatrix}, \qquad Z=\begin{pmatrix}1&0\\\0&-1\end{pmatrix}. \\]

A bit flip exchanges the logical states:

\\[ X|0\rangle=|1\rangle,\qquad X|1\rangle=|0\rangle. \\]

A phase flip changes their relative phase:

\\[ Z\frac{|0\rangle+|1\rangle}{\sqrt2} = \frac{|0\rangle-|1\rangle}{\sqrt2}. \\]

Both destroy information that the computer may need later.

In general, physical errors can also include continuous rotations, leakage outside the computational space, and correlated noise. But bit and phase errors give us a useful starting language.

## 2. The unusual strategy behind cat qubits

Ordinary quantum error correction uses multiple physical qubits to redundantly encode logical information.

The challenge is that if both bit flips and phase flips are common, correcting both kinds can become expensive.

Cat qubits pursue a different strategy.

What if we design the physical system so that bit flips almost never happen in the first place?

Then the higher-level error-correction system can concentrate on the remaining, predominantly phase-type errors.

This motivates the concept of a noise-biased qubit.

The physical device does not eliminate quantum errors. It makes their probabilities enormously unequal.

For the parameters in your simulation:

\\[ T_X\approx 2.6\ \mathrm{s}, \qquad T_Z\approx1.94\ \mu\mathrm{s}. \\]

The ratio is about

\\[ \frac{T_X}{T_Z}\approx1.3\times10^6. \\]

Thus, the characteristic timescale for a logical bit flip is more than a million times longer than the phase-coherence decay timescale.

These are simulated noise characteristics, not a claim that arbitrary quantum information can be stored for 2.6 seconds.

The profound point is that the physical system itself provides strong protection against one category of error.

That brings us to the next question.

What physical system could possibly behave this way?

# Part II — Why use an oscillator to represent a qubit?

## 3. From a superconducting circuit to a quantum harmonic oscillator

Think about an ordinary LC circuit.

It contains an inductor and a capacitor. Energy continuously exchanges between two forms:

- Energy stored in the capacitor's electric field.
- Energy stored in the inductor's magnetic field.

A charged capacitor discharges through the inductor. The resulting current builds a magnetic field. That field then transfers energy back to the capacitor.

The circuit oscillates.

Classically, this is described by the harmonic-oscillator equation

\\[ \ddot q+\omega^2q=0, \qquad \omega=\frac1{\sqrt{LC}}. \\]

Here, \\(q\\) is the capacitor charge.

The solutions look like

\\[ q(t)=A\cos(\omega t+\phi). \\]

Two quantities characterize the oscillation: its amplitude \\(A\\) and phase \\(\phi\\).

Now quantize the circuit.

Charge and magnetic flux become quantum operators, analogous to momentum and position.

The Hamiltonian takes the harmonic-oscillator form

\\[ H=\hbar\omega\left(a^\dagger a+\frac12\right). \\]

Its energy levels are

\\[ E_n=\hbar\omega\left(n+\frac12\right), \qquad n=0,1,2,\ldots \\]

An excitation of this electromagnetic oscillator is called a photon.

Because the circuit operates at microwave frequencies, we're talking about microwave photons, not visible light.

At millikelvin temperatures, superconducting circuits can preserve these quantum electromagnetic states long enough to control and measure them.

### Why is an oscillator different from an ordinary two-level qubit?

A conventional two-level qubit uses two states:

\\[ |0\rangle,\quad |1\rangle. \\]

A quantum oscillator instead has infinitely many possible energy states:

\\[ |0\rangle,\ |1\rangle,\ |2\rangle,\ |3\rangle,\ldots \\]

These are called Fock states.

The states have definite photon numbers, and creation and annihilation operators move between them:

\\[ a^\dagger|n\rangle=\sqrt{n+1}|n+1\rangle \\]

\\[ a|n\rangle=\sqrt n|n-1\rangle. \\]

Notice that one oscillator contains a much larger quantum state space than an ordinary two-level system.

The idea behind a bosonic qubit is to encode one logical qubit using carefully chosen states inside this larger space.

Cat qubits are one particular bosonic encoding.

## 4. Coherent states: quantum versions of classical oscillations

There is a special class of oscillator states called coherent states.

They are written

\\[ |\alpha\rangle. \\]

A coherent state is the closest quantum analogue of a classical electromagnetic oscillation with a specified amplitude and phase.

Mathematically,

\\[ |\alpha\rangle = e^{-|\alpha|^2/2} \sum\_{n=0}^{\infty} \frac{\alpha^n}{\sqrt{n!}}|n\rangle. \\]

This equation tells us something important.

A coherent state is not a state with a definite photon number.

It is a superposition of many photon-number states.

For instance,

\\[ |\alpha\rangle = c_0|0\rangle+c_1|1\rangle+c_2|2\rangle+\cdots \\]

with very specific coefficients.

The parameter \\(\alpha\\) is a complex number:

\\[ \alpha=x+iy=|\alpha|e^{i\phi}. \\]

Its magnitude determines the average number of photons:

\\[ \boxed{\langle a^\dagger a\rangle=|\alpha|^2.} \\]

Its argument specifies the phase of the electromagnetic oscillation.

In your project,

\\[ \alpha=2.1 \\]

so

\\[ |\alpha|^2=4.41. \\]

This means each logical coherent state contains approximately 4.41 photons on average.

It emphatically does not mean that the oscillator always contains exactly four photons.

The photon-number distribution is Poissonian:

\\[ P(n)=e^{-|\alpha|^2}\frac{|\alpha|^{2n}}{n!}. \\]

### The most useful property of coherent states

Coherent states are eigenstates of the annihilation operator:

\\[ \boxed{a|\alpha\rangle=\alpha|\alpha\rangle.} \\]

This identity appears repeatedly throughout your project.

It tells us that applying the annihilation operator to a coherent state produces the same state, multiplied by a complex number.

That may look like a mathematical curiosity, but it's fundamental to why cat qubits have their characteristic error properties.

We'll return to it when we analyze photon loss.

## 5. How do two coherent states become one logical qubit?

We choose two states:

\\[ |0_L\rangle\approx|+\alpha\rangle \\]

\\[ |1_L\rangle\approx|-\alpha\rangle. \\]

The subscript \\(L\\) means logical.

If \\(\alpha\\) is real and positive, these correspond to electromagnetic oscillations with opposite phases.

One is proportional to

\\[ \cos(\omega t), \\]

while the other is proportional to

\\[ -\cos(\omega t). \\]

They are separated by a phase difference of \\(\pi\\).

The important property is that as \\(\alpha\\) grows, the two quantum states become increasingly distinguishable.

Their overlap is

\\[ \langle+\alpha|-\alpha\rangle=e^{-2|\alpha|^2}. \\]

For \\(\alpha=2.1\\),

\\[ \langle+\alpha|-\alpha\rangle \approx1.48\times10^{-4}. \\]

Their squared overlap is only about

\\[ 2.18\times10^{-8}. \\]

Thus, the two states are nearly orthogonal and form an excellent approximate computational basis.

This is the origin of the basic cat-qubit idea:

> Encode 0 and 1 as two well-separated configurations of a quantum oscillator, rather than as two neighboring energy levels.

### Where does the actual cat state enter?

We can superpose these configurations:

\\[ |\mathcal C\_+\rangle = \frac{|\alpha\rangle+|-\alpha\rangle} {\sqrt{2(1+e^{-2|\alpha|^2})}} \\]

and

\\[ |\mathcal C\_-\rangle = \frac{|\alpha\rangle-|-\alpha\rangle} {\sqrt{2(1-e^{-2|\alpha|^2})}}. \\]

These are the even and odd cat states.

There is a beautiful property hidden here.

If we expand both coherent states in the Fock basis, the coefficients of odd photon-number states have opposite signs. Adding the two states cancels every odd term.

Consequently,

\\[ |\mathcal C\_+\rangle =c_0|0\rangle+c_2|2\rangle+c_4|4\rangle+\cdots \\]

while

\\[ |\mathcal C\_-\rangle =c_1|1\rangle+c_3|3\rangle+c_5|5\rangle+\cdots. \\]

Therefore:

Even cat = only even photon-number components.

Odd cat = only odd photon-number components.

The even and odd cats are exactly orthogonal, even when the coherent states \\(|+\alpha\rangle\\) and \\(|-\alpha\rangle\\) have some overlap.

This distinction is crucial.

In this project's logical convention, \\(|+\alpha\rangle\\) and \\(|-\alpha\rangle\\) represent logical 0 and 1. The even and odd cats represent approximately the logical \\(+\\) and \\(-\\) superposition states.

So when you see the project measuring parity, it is essentially measuring an observable related to logical phase coherence, not directly asking whether the logical bit is 0 or 1.

# Part III — The central physical insight: engineering dissipation

## 6. Why doesn't an ordinary oscillator work as a quantum memory?

Suppose we prepare the oscillator in \\(|+\alpha\rangle\\).

In a perfectly isolated system, this state can evolve predictably.

But real oscillators lose photons.

If the oscillator is coupled to the surrounding electromagnetic environment, a photon can escape. Over time, the oscillation amplitude decreases.

For an ordinary lossy oscillator,

\\[ \langle a^\dagger a\rangle(t) = \langle a^\dagger a\rangle(0)e^{-\kappa t}. \\]

If we begin with \\(|\alpha\rangle\\), the state evolves approximately as

\\[ |\alpha\rangle \longrightarrow |\alpha e^{-\kappa t/2}\rangle. \\]

Eventually, it approaches vacuum:

\\[ |0\rangle. \\]

Consequently, both logical states gradually collapse toward the same physical state.

The information is lost.

We need something that continually restores the system to the desired configurations.

### A conventional solution would be feedback

Imagine continuously measuring the oscillator's amplitude, deciding whether it is too large or small, and applying corrections.

This is analogous to a thermostat.

But there's a problem: measuring a quantum system can disturb the quantum state.

In particular, if our goal is to preserve an unknown superposition

\\[ c_0|+\alpha\rangle+c_1|-\alpha\rangle, \\]

we cannot simply measure which coherent state the oscillator occupies and then correct it. That measurement would generally destroy the superposition.

We need a stabilization mechanism that does not learn the encoded logical information.

This is the elegant part of dissipative cat qubits.

## 7. Instead of fighting the environment, engineer it

Consider a very familiar classical system: a marble sitting in a bowl.

If you push the marble slightly, gravity brings it back toward the minimum.

The stable point doesn't require an external controller to detect and correct every small displacement. Stability is built into the dynamics.

Now imagine a landscape with two minima.

The marble can settle in either valley, and small perturbations are corrected automatically.

For the cat qubit, we want something analogous in the oscillator's phase space.

Conceptual phase-space picture

Schematic of the effective dissipative dynamics: two attracting amplitudes and an unstable origin. These are not literal spatial locations or the complete quantum dynamics.

The question becomes:

Can we create quantum dynamics with two stable coherent amplitudes, \\(+\alpha\\) and \\(-\alpha\\), while preserving coherence between them?

Yes, using engineered two-photon dissipation.

## 8. Why two-photon processes matter

Let's first consider an oscillator that loses photons one at a time.

A single-photon-loss event is described by

\\[ a. \\]

It changes a Fock state according to

\\[ |n\rangle\rightarrow|n-1\rangle. \\]

Now suppose we engineer a process that removes photons only in pairs.

Its operator is

\\[ a^2. \\]

It acts as

\\[ a^2|n\rangle = \sqrt{n(n-1)}|n-2\rangle. \\]

Notice something important: removing two photons preserves photon-number parity.

An even photon number remains even. An odd photon number remains odd.

For example,

\\[ |6\rangle\rightarrow|4\rangle\rightarrow|2\rangle\rightarrow|0\rangle \\]

and

\\[ |7\rangle\rightarrow|5\rangle\rightarrow|3\rangle\rightarrow|1\rangle. \\]

Pure pair loss therefore has two dark states:

\\[ |0\rangle,\qquad |1\rangle. \\]

These are dark because

\\[ a^2|0\rangle=a^2|1\rangle=0. \\]

Nothing more can be removed in pairs.

But a pair-loss process by itself doesn't stabilize the coherent states we want. It simply removes energy.

We need a driven version.

## 9. The key equation of the entire project

The idealized cat-qubit stabilization is described by the jump operator

\\[ \boxed{ L_2=\sqrt{\kappa_2}(a^2-\alpha^2). } \\]

Understanding this equation is arguably the single most important conceptual step in DuQuantum.

Here, \\(a^2\\) describes the two-photon process, \\(\alpha^2\\) determines the target coherent amplitude, and \\(\kappa_2\\) sets the strength of the engineered dissipation.

The term involving \\(\alpha^2\\) arises from the coherent driving of the dissipative mechanism. It should not be interpreted as an independent ordinary photon-creation jump; the complete operator represents the driven, engineered reservoir.

What happens when it acts on \\(|+\alpha\rangle\\)?

Remember:

\\[ a|\alpha\rangle=\alpha|\alpha\rangle. \\]

Therefore,

\\[ a^2|\alpha\rangle=\alpha^2|\alpha\rangle. \\]

So

\\[ L_2|+\alpha\rangle = \sqrt{\kappa_2}(\alpha^2-\alpha^2)|+\alpha\rangle =0. \\]

And because

\\[ (-\alpha)^2=\alpha^2, \\]

we also have

\\[ L_2|-\alpha\rangle=0. \\]

Both desired states are dark states of the engineered dissipation.

\\[ \boxed{ L_2|\pm\alpha\rangle=0. } \\]

This gives a physical reason why those two configurations can be stabilized simultaneously.

Even more importantly, the operator annihilates any superposition of them:

\\[ L_2\left(c_0|\alpha\rangle+c_1|-\alpha\rangle\right)=0. \\]

That means the ideal stabilizer does not need to distinguish logical 0 from logical 1.

It can preserve an entire two-dimensional quantum subspace.

That is why this is a quantum memory rather than simply a bistable classical memory.

## 10. Why do nearby states move toward those two amplitudes?

We can make the intuition much more concrete by examining the effective classical dynamics.

For the ideal memory-only model, a mean-field approximation gives

\\[ \frac{d\alpha\_{\mathrm{cl}}}{dt} = -\kappa_2\alpha\_{\mathrm{cl}}^\* \left(\alpha\_{\mathrm{cl}}^2-\alpha^2\right), \\]

where \\(\alpha\_{\mathrm{cl}}=\langle a\rangle\\) is the instantaneous oscillator amplitude and \\(\alpha\\) without the subscript denotes the chosen target.

For a real-valued amplitude \\(x\\), the equation reduces to

\\[ \boxed{ \frac{dx}{dt}=\kappa_2x(\alpha^2-x^2). } \\]

Consider its fixed points:

\\[ x=0,\qquad x=+\alpha,\qquad x=-\alpha. \\]

If \\(x\\) is slightly smaller than \\(+\alpha\\), its derivative is positive, pushing it upward.

If \\(x\\) is slightly larger than \\(+\alpha\\), its derivative is negative, pushing it downward.

So \\(+\alpha\\) is stable.

The same argument works for \\(-\alpha\\).

But the origin behaves differently.

If \\(x\\) is slightly positive near zero, it moves further positive. If slightly negative, it moves further negative.

Thus \\(x=0\\) is unstable along the real-amplitude direction.

This is the mathematical origin of the two-valley picture.

Strictly speaking, this is a dynamical analogy, not a claim that the quantum device has an ordinary spatial double-well potential.

The complete quantum evolution acts on a density matrix and supports coherent superpositions of both stable configurations.

# Part IV — How does the superconducting device implement this?

## 11. The memory–buffer architecture

So far, we've assumed that we somehow possess an engineered jump operator \\(a^2-\alpha^2\\).

But where does it come from physically?

Your actual device model contains two electromagnetic modes.

The first is the memory resonator, described by the operator \\(a\\). This stores the quantum information and is designed to lose photons slowly.

The second is the buffer resonator, described by \\(b\\). This is deliberately coupled strongly to the environment, so that its photons escape quickly.

The two modes are connected through a nonlinear superconducting circuit element.

The central interaction converts two memory photons into one buffer photon, or the reverse.

Symbolically,

\\[ 2\text{ memory photons} \rightleftharpoons 1\text{ buffer photon}. \\]

This is a nonlinear frequency-conversion process. An external pump supplies or absorbs the energy difference between the modes.

The buffer is then allowed to leak energy away.

Why do we need the buffer?

Because we want to engineer photon-pair dissipation without making the memory itself extremely lossy.

The buffer acts as an intermediary between the protected memory and the environment.

## 12. The full Hamiltonian

Your simulation uses

\\[ \boxed{ H = g_2(a^2b^\dagger+a^{\dagger 2}b) -\epsilon_d(b+b^\dagger). } \\]

Let's understand each term physically.

### The conversion term

\\[ g_2 a^2b^\dagger \\]

annihilates two memory photons and creates one buffer photon.

For example,

\\[ |4\rangle_a|0\rangle_b \rightarrow |2\rangle_a|1\rangle_b. \\]

The Hermitian-conjugate term

\\[ g_2a^{\dagger2}b \\]

reverses this process.

The coefficient \\(g_2\\) determines how strongly the two resonators exchange excitations through this conversion.

### The drive term

\\[ -\epsilon_d(b+b^\dagger) \\]

represents a microwave drive applied to the buffer.

The drive continuously supplies coherent electromagnetic energy to the system.

Together, these terms enable a driven exchange of photon pairs between the memory and buffer.

### The buffer dissipation

The buffer loses photons to the environment at rate \\(\kappa_b\\).

This is represented separately from the Hamiltonian because the loss is irreversible.

The memory also has unwanted single-photon loss at rate \\(\kappa_a\\).

The parameters used in the project are:

| Parameter           | Physical meaning          | Value     |
| ------------------- | ------------------------- | --------- |
| \\(g_2/2\pi\\)      | Memory–buffer coupling    | 0.763 MHz |
| \\(\kappa_b/2\pi\\) | Buffer loss               | 2.6 MHz   |
| \\(\kappa_a/2\pi\\) | Memory loss               | 9.3 kHz   |
| \\(\alpha\\)        | Target coherent amplitude | 2.1       |
| \\(\alpha^2\\)      | Target mean photon number | 4.41      |

These are model parameters drawn from experimentally motivated values, not measurements collected by this repository.

The buffer loses energy much faster than the memory. That is intentional.

## 13. Why do we need a Lindblad equation?

You might wonder why the project doesn't simply solve the Schrödinger equation

\\[ i\frac{d}{dt}|\psi\rangle=H|\psi\rangle. \\]

The reason is that the Schrödinger equation for the memory-plus-buffer system alone does not describe the irreversible escape of photons into an unobserved environment.

We are dealing with an open quantum system.

Instead of tracking a state vector alone, we describe the reduced system using a density matrix:

\\[ \rho. \\]

The evolution equation becomes

\\[ \boxed{ \dot\rho = -i[H,\rho] + \kappa_b\mathcal D[b]\rho + \kappa_a\mathcal D[a]\rho. } \\]

Here, setting \\(\hbar=1\\),

\\[ \mathcal D[L]\rho = L\rho L^\dagger -\frac12L^\dagger L\rho -\frac12\rho L^\dagger L. \\]

This is the Lindblad master equation.

It has two conceptually different parts.

The Hamiltonian term,

\\[ -i[H,\rho], \\]

describes coherent, reversible quantum dynamics.

The dissipative terms describe irreversible interaction with the environment.

The \\(\kappa_b\\) term describes photons escaping from the buffer, while the \\(\kappa_a\\) term describes unwanted single-photon loss from the memory.

The reason this is so important is that the project's desired behavior arises from the combination of coherent Hamiltonian interactions and irreversible dissipation.

Neither alone gives the complete stabilization process.

## 14. How do we obtain the simpler memory-only model?

This is the first major model-reduction idea in the project.

Suppose the buffer loses photons much faster than the memory and buffer can exchange them.

Then the buffer quickly responds to whatever the memory is doing.

Rather than tracking its full independent dynamics, we approximate the buffer as following the memory almost instantaneously.

This is called adiabatic elimination.

The mean-field equations are

\\[ \dot a\_{\mathrm{cl}} = -2ig_2a\_{\mathrm{cl}}^\*b\_{\mathrm{cl}} -\frac{\kappa_a}{2}a\_{\mathrm{cl}} \\]

and

\\[ \dot b\_{\mathrm{cl}} = -i(g_2a\_{\mathrm{cl}}^2-\epsilon_d) -\frac{\kappa_b}{2}b\_{\mathrm{cl}}. \\]

If the buffer responds sufficiently rapidly, we approximate

\\[ \dot b\_{\mathrm{cl}}\approx0. \\]

Solving the second equation gives

\\[ b\_{\mathrm{cl}} \approx -\frac{2i}{\kappa_b} (g_2a\_{\mathrm{cl}}^2-\epsilon_d). \\]

Substituting into the memory equation produces

\\[ \dot a\_{\mathrm{cl}} = -\frac{4g_2^2}{\kappa_b} a\_{\mathrm{cl}}^\* \left(a\_{\mathrm{cl}}^2-\frac{\epsilon_d}{g_2}\right) -\frac{\kappa_a}{2}a\_{\mathrm{cl}}. \\]

Compare this with our previous stabilizing equation.

We identify

\\[ \boxed{ \kappa_2=\frac{4g_2^2}{\kappa_b} } \\]

and

\\[ \boxed{ \alpha^2=\frac{\epsilon_d}{g_2}. } \\]

These are two of the most important relationships in your entire project.

The buffer drive and nonlinear coupling set where the stable states are located.

The coupling and buffer dissipation determine the effective two-photon stabilization strength.

At the quantum level, under the appropriate fast-buffer approximation, this yields the effective memory dissipator

\\[ \kappa_2\mathcal D[a^2-\alpha^2]\rho. \\]

So the two descriptions are connected:

Physical two-mode system

\\[ H=g_2(a^2b^\dagger+a^{\dagger2}b)-\epsilon_d(b+b^\dagger) \\]

Fast-buffer approximation / adiabatic elimination

Effective memory-only description

\\[ L_2=\sqrt{\kappa_2}(a^2-\alpha^2) \\]

But there's a catch: the approximation isn't particularly good for all of the parameters and timescales in your actual problem.

That leads directly to one of the project's most interesting findings.

# Part V — What the simulations reveal about creating the cat

## 15. Task 1.0: Establishing the basic physics

The first numerical task gradually introduces different physical processes.

You simulate ordinary single-photon loss and confirm that coherent states shrink in amplitude while remaining coherent.

Then you simulate pure two-photon loss and confirm that photon-number parity is preserved.

Finally, you introduce driven two-photon stabilization.

Starting from vacuum, the system evolves toward a state supported by the two stable coherent amplitudes.

The average photon number increases from zero and approaches approximately 4.41.

The important observation is that the memory no longer simply decays toward vacuum. The engineered reservoir maintains a nonzero-amplitude quantum state.

You also vary the stabilization rate \\(\kappa_2\\).

As \\(\kappa_2\\) increases, the system reaches its target faster.

In the ideal model, the characteristic settling time scales as

\\[ t\_{\mathrm{settle}}\propto\frac1{\kappa_2}. \\]

This provides an initial confirmation that the mathematical stabilization mechanism behaves as expected.

## 16. Task 1.1: Why the real two-mode system behaves differently

This is where the project moves beyond the textbook idealization.

When you simulate both memory and buffer explicitly, the behavior is not a smooth, monotonic approach to the target photon number.

Instead, the memory initially gains too much energy.

TASK 1.1 — SIMULATED MEMORY PHOTON NUMBER

Mean photon numberTarget

0246800.100.2350.380.550.700.91.11.5

Illustrative transient based on reported peak and settling behavior; intermediate points are schematic, not simulation samples.

At the peak, the memory contains approximately

\\[ \langle n_a\rangle\_{\max}=6.91 \\]

photons, rather than the target 4.41.

The peak happens at about

\\[ t=0.235\ \mu\mathrm{s}. \\]

The system then oscillates before settling near its target.

Why?

Because the buffer cannot be treated as infinitely fast.

The memory and buffer exchange energy coherently while the buffer simultaneously loses energy.

This resembles two coupled classical oscillators with damping.

### The mathematical explanation

When the mean-field equations are linearized near one stable coherent state, the memory perturbation obeys

\\[ \boxed{ \ddot{\delta a} + \frac{\kappa_b}{2}\dot{\delta a} + 4g_2^2\alpha^2\delta a =0. } \\]

This is the equation of a damped harmonic oscillator.

The effective oscillation frequency is

\\[ \omega\_{\mathrm{ring}} = \sqrt{4g_2^2\alpha^2-\frac{\kappa_b^2}{16}}. \\]

The corresponding period is

\\[ T\_{\mathrm{ring}} = \frac{2\pi}{\omega\_{\mathrm{ring}}}. \\]

The model predicts

\\[ T\_{\mathrm{ring}}\approx0.319\ \mu\mathrm{s}. \\]

The simulation produces oscillations with periods close to 0.32 microseconds.

That agreement is significant.

It demonstrates that the unexpected overshoot is not merely numerical noise. It follows from the actual coupled-mode dynamics.

The effective memory-only model overlooks this behavior because it assumes the buffer responds much faster than the relevant energy-exchange dynamics.

For your parameters,

\\[ \frac{g_2}{\kappa_b}\approx0.29, \qquad \frac{\epsilon_d}{\kappa_b}\approx1.29. \\]

These ratios are not sufficiently small to justify treating the buffer as instantaneous during the full transient.

Scientific lesson: an effective theory can correctly predict the stable endpoint but fail to describe how the system gets there.

That matters whenever we're designing control pulses or measuring how quickly a device can prepare a state.

## 17. How do we know a cat has formed, rather than just an oscillator with 4.41 photons?

This is a subtle but extremely important distinction.

Suppose I tell you the mean photon number is

\\[ \langle a^\dagger a\rangle=4.41. \\]

Does that establish that the memory is in a cat state?

Absolutely not.

An ordinary coherent state, a statistical mixture of states, and a quantum cat superposition can all have approximately the same mean photon number.

We need information about the structure of the quantum state.

That is where Wigner functions become useful.

### What does a Wigner function represent?

A quantum oscillator has two field quadratures, analogous to the position and momentum of a harmonic oscillator.

Its state can be represented over a two-dimensional phase space.

A coherent state appears as a localized Gaussian-like blob.

The vacuum appears near the center.

Two coherent states at \\(+\alpha\\) and \\(-\alpha\\) appear as two separated blobs.

But a coherent superposition of those states also produces interference fringes between them.

A classical mixture,

\\[ \rho\_{\mathrm{mix}} = \frac12|\alpha\rangle\langle\alpha| + \frac12|-\alpha\rangle\langle-\alpha|, \\]

does not produce the same interference pattern.

That's the key difference.

Two blobs alone are not enough to establish quantum coherence.

The interference structure is essential.

In Task 1.1, the simulated Wigner function evolves from a vacuum blob into two separated regions with interference fringes between them.

This is evidence of cat-state formation.

However, the fringes subsequently fade because unwanted photon loss destroys coherence.

This brings us to the next problem: making a cat state is not the same as making a useful logical state, and making it is not the same as keeping it coherent.

# Part VI — Preparing a genuine quantum state

## 18. Task 1.3: What state do we actually get when we start from vacuum?

This is a subtle aspect of the problem.

Suppose we begin with

\\[ |0\rangle_a|0\rangle_b. \\]

That means both memory and buffer initially contain no photons.

We switch on the buffer drive and the two-photon interaction.

Eventually, the memory approaches the space spanned by

\\[ |+\alpha\rangle,\qquad|-\alpha\rangle. \\]

But which of these states does it occupy?

The answer follows from photon-number parity.

Define the parity operator

\\[ P=e^{i\pi a^\dagger a}=(-1)^{a^\dagger a}. \\]

It gives \\(+1\\) for even photon number and \\(-1\\) for odd photon number.

The vacuum is even:

\\[ P|0\rangle=|0\rangle. \\]

Our stabilization mechanism changes the memory photon number only in pairs, so the ideal stabilizer conserves parity.

Consequently, starting with even parity, the system must remain in the even-parity sector.

Of the two cat states, only

\\[ |\mathcal C\_+\rangle = \frac{|+\alpha\rangle+|-\alpha\rangle}{\mathcal N\_+} \\]

has even parity.

Therefore, in the ideal absence of unwanted memory loss, the stabilization dynamics produce the even cat state.

This is not logical 0 or logical 1 individually.

It is approximately

\\[ |+\_L\rangle = \frac{|0_L\rangle+|1_L\rangle}{\sqrt2}. \\]

That is an actual quantum superposition.

### Why does this matter?

Imagine trying to initialize a quantum computer.

If your goal is to store the classical bit 0, preparing an equal superposition of logical 0 and 1 is not what you want.

The stabilizer naturally gives us a protected two-dimensional space, but we still need a way to select the desired initial state within that space.

Before solving that, however, the simulation examines how long the even cat remains coherent.

## 19. How long does the superposition survive?

Realistically, photons can still escape individually from the memory.

Every such event changes photon-number parity.

Recall that

\\[ a|\mathcal C\_+\rangle\propto|\mathcal C\_-\rangle, \\]

and

\\[ a|\mathcal C\_-\rangle\propto|\mathcal C\_+\rangle. \\]

Therefore, individual photon losses continually switch the even and odd cat components.

If those losses are unobserved, the originally pure even-cat state gradually becomes a statistical mixture.

We can track this using three different quantities.

Parity indicates the imbalance between even and odd photon-number components. Purity, defined by \\(\operatorname{Tr}(\rho^2)\\), measures whether the state is pure or mixed. Fidelity measures how closely the evolving state resembles a target state.

Your numerical results show the parity decaying over a characteristic timescale of approximately

\\[ \boxed{T_Z=1.943\ \mu\mathrm{s}.} \\]

With ideal two-photon stabilization and no unwanted single-photon loss, the simulations approach an almost perfectly pure even cat.

With realistic memory loss included, the even-cat fidelity reaches a maximum of about 0.844 before decreasing.

Eventually the state approaches a near-equal mixture of the two logical configurations.

The project also uses parity \\(0.5\\) as an operational threshold for significant remaining coherence. That threshold is crossed at about 1.45 microseconds.

Importantly, 1.45 microseconds is not a fundamental instant at which superposition suddenly disappears. Decoherence is continuous; the threshold is a convenient convention.

There's an interesting race here.

The system needs time to prepare a cat state, but unwanted single-photon loss is already destroying its coherence during preparation.

We therefore want the stabilization to operate quickly compared with the decoherence timescale.

## 20. How do we prepare logical 0 deliberately?

Your project investigates ways to break the symmetry between the two stable amplitudes.

The simplest conceptual idea is this:

If a quantum state starts slightly closer to the \\(+\alpha\\) configuration, the stabilizing dynamics should favor that configuration.

Similarly, a state initially biased toward \\(-\alpha\\) should tend toward logical 1.

Your implementation investigates applying a temporary microwave drive to the memory.

The Hamiltonian is

\\[ H_x(t)=i\epsilon(t)(a^\dagger-a). \\]

The pulse is shaped as

\\[ \epsilon(t)=\epsilon_0\sin^2\left(\frac{\pi t}{T\_{\mathrm{on}}}\right) \\]

during the pulse interval.

This drive displaces the oscillator along the real quadrature, where the two stable states are separated.

Intuitively, we provide an initial push toward one of the two stable configurations.

Then the dissipation reinforces the chosen direction.

For the best in-pump pulse tested, your results give

\\[ F(|+\alpha\rangle)\approx0.99962. \\]

That corresponds to a state-preparation infidelity of roughly

\\[ 3.8\times10^{-4}. \\]

You also investigate a slightly different strategy: displace the memory before switching on the stabilizing pump.

Starting close to the target \\(|+\alpha\rangle\\) gives

\\[ \boxed{F\approx0.999991.} \\]

That's very high state-preparation fidelity within the model.

However, the method requires accurately calibrated control pulses and phase synchronization with the pump.

A drive that's applied with the wrong phase can push the oscillator in the wrong quadrature or introduce unwanted logical phase evolution.

So we're seeing the beginning of a recurring engineering issue:

The same controls that make the qubit useful can also disturb the protection mechanism.

# Part VII — Why cat qubits suppress bit flips but not phase flips

This is the central scientific result of the Standard Track.

## 21. What happens when a photon escapes?

Let's return to our two logical states:

\\[ |0_L\rangle\approx|+\alpha\rangle, \qquad |1_L\rangle\approx|-\alpha\rangle. \\]

We know that

\\[ a|+\alpha\rangle=+\alpha|+\alpha\rangle \\]

and

\\[ a|-\alpha\rangle=-\alpha|-\alpha\rangle. \\]

Notice what happens.

The annihilation operator does not exchange the two coherent states.

Instead, it introduces a relative sign.

On the logical subspace,

\\[ a\approx\alpha Z_L. \\]

This is an extraordinarily useful result.

It tells us that the dominant physical photon-loss process acts approximately like a logical phase error rather than a logical bit error.

Let's make that concrete.

Suppose the initial state is

\\[ |\psi\rangle = \frac{|+\alpha\rangle+|-\alpha\rangle}{\sqrt2}, \\]

ignoring the tiny overlap between the coherent states.

Apply the annihilation operator:

\\[ a|\psi\rangle = \frac{\alpha|+\alpha\rangle-\alpha|-\alpha\rangle}{\sqrt2}. \\]

Ignoring normalization after the jump, this becomes

\\[ \frac{|+\alpha\rangle-|-\alpha\rangle}{\sqrt2}. \\]

The superposition has changed from logical plus to logical minus.

That is a phase flip.

But a photon-loss jump acting on \\(|+\alpha\rangle\\) alone does not turn it into \\(|-\alpha\rangle\\).

This explains the fundamental asymmetry.

The physical loss process readily changes the relative phase of a quantum superposition, but it does not readily switch between the two stable coherent configurations.

## 22. Why are bit flips exponentially suppressed?

We know that

\\[ |\langle+\alpha|-\alpha\rangle|^2=e^{-4\alpha^2}. \\]

As \\(\alpha\\) grows, the states become exponentially more distinguishable.

Ordinary local noise has an increasingly small direct matrix element connecting them.

At the same time, engineered dissipation continually restores small displacements toward the nearby stable amplitude.

A bit flip requires a relatively rare transition through states outside the protected subspace.

The result is an approximate scaling law

\\[ \boxed{ \Gamma_X\sim e^{-\gamma\alpha^2}, } \\]

where \\(\Gamma_X\\) is the logical bit-flip decay rate.

The exponent \\(\gamma\\) depends on the physical noise mechanisms and the operating regime.

The bit-flip characteristic time is

\\[ T_X=\frac1{\Gamma_X}. \\]

As \\(\alpha\\) increases, \\(T_X\\) can become extraordinarily long.

Contrast this with the phase-flip rate, which grows approximately as

\\[ \boxed{ \Gamma_Z\approx2\kappa_a\alpha^2. } \\]

So increasing the cat size has opposing effects.

It exponentially improves bit-flip protection while approximately linearly worsening phase coherence.

### The fundamental cat-size trade-off

Bit-flip rate

Decreases exponentially

Phase-flip rate

Increases approximately linearly

Schematic scaling trends, not fitted numerical data.

This trade-off is at the heart of cat-qubit engineering.

## 23. Task 2.1: How does the project actually measure bit-flip rates?

Suppose you initialize the memory in logical 0:

\\[ |+\alpha\rangle. \\]

Now let the noisy system evolve.

If rare transitions occur between logical 0 and logical 1, the average amplitude will eventually approach zero.

Why?

Because the two states have opposite amplitudes.

If \\(p_0(t)\\) and \\(p_1(t)\\) represent their populations, then approximately

\\[ \langle a\rangle = \alpha[p_0(t)-p_1(t)]. \\]

If switching is symmetric, the population difference satisfies

\\[ \frac{d}{dt}(p_0-p_1) = -\Gamma_X(p_0-p_1). \\]

Therefore,

\\[ p_0(t)-p_1(t) = e^{-\Gamma_Xt} \\]

for an initially prepared logical 0.

Consequently,

\\[ \boxed{ \operatorname{Re}\langle a\rangle(t) \approx \alpha e^{-\Gamma_Xt}. } \\]

By simulating \\(\langle a\rangle(t)\\) and fitting its decay, we can estimate \\(\Gamma_X\\).

### The numerical difficulty

At large \\(\alpha\\), bit flips become so rare that direct time simulations are extremely expensive.

If the bit-flip time is seconds but the memory–buffer dynamics operate on microsecond scales, directly simulating the entire interval requires resolving enormously different timescales.

The project therefore uses two approaches.

The first is direct time evolution, measuring the decay of \\(\langle a\rangle\\).

The second uses eigenvalues of the Liouvillian, the linear operator generating the open-system dynamics:

\\[ \dot\rho=\mathcal L\rho. \\]

If

\\[ \mathcal L R_j=\lambda_jR_j, \\]

then the corresponding dynamical mode evolves as

\\[ e^{\lambda_jt}. \\]

A slowly decaying eigenmode has an eigenvalue with a small negative real part.

In the relevant symmetry sector, the bit-flip decay rate is extracted from the slow Liouvillian mode.

This is a powerful numerical technique because it allows us to determine a very long lifetime without simulating all the way to that time.

Your team confirms that the eigenvalue approach and time-domain fits agree extremely closely where both are tractable.

### A surprising finding: the exponent isn't universal

In the small-cat regime \\(\alpha=0.8\\) to \\(1.4\\), the simulations obtain approximately

\\[ \gamma=3.02. \\]

A simple estimate based on direct transition matrix elements suggests an asymptotic exponent closer to 4.

Why the difference?

The full two-mode system has additional error pathways involving excursions outside the protected space and interaction with the buffer.

Some contributions scale beyond first order in the memory loss rate and decrease with cat size more slowly than the simplest projected mechanism.

At the target \\(\alpha=2.1\\), those additional mechanisms become important. The local suppression exponent falls to approximately 1.9.

That is scientifically interesting because it shows that the simplest two-state picture does not fully capture how bit flips occur.

The surrounding quantum states and dissipative buffer matter, even when the logical state remains strongly protected.

### The headline result

At \\(\alpha=2.1\\), the model gives

\\[ \Gamma_X\approx3.85\times10^{-7}\ \mu\mathrm{s}^{-1}. \\]

Therefore,

\\[ \boxed{ T_X\approx2.6\ \mathrm{s}. } \\]

That's an enormous timescale compared with the underlying microsecond dynamics.

Again, this is the undriven logical bit-flip timescale, not the coherence time of arbitrary quantum information.

## 24. Task 2.2: Measuring phase-flip rates

To investigate phase errors, we prepare the even cat:

\\[ |\mathcal C\_+\rangle. \\]

Initially, its photon-number parity is

\\[ \langle P\rangle=1. \\]

Single-photon losses change its parity.

Starting from the Lindblad master equation, one can derive

\\[ \boxed{ \frac{d}{dt}\langle P\rangle = -2\kappa_a\langle a^\dagger aP\rangle. } \\]

For sufficiently large cats, the photon number is concentrated around \\(\alpha^2\\) in the relevant sense, giving the approximation

\\[ \frac{d}{dt}\langle P\rangle \approx -2\kappa_a\alpha^2\langle P\rangle. \\]

Therefore,

\\[ \langle P(t)\rangle\approx e^{-\Gamma_Zt}, \\]

with

\\[ \Gamma_Z\approx2\kappa_a\alpha^2. \\]

Physically, the average photon-loss event rate is approximately \\(\kappa_a\alpha^2\\), while the even–odd population difference decays at twice that rate.

The full model includes a small nonzero long-time parity offset and minor corrections to the simple formula.

Your simulations sweep across different cat amplitudes and confirm that the phase-flip rate is approximately linear in \\(\alpha^2\\).

At the target operating point,

\\[ \Gamma_Z\approx0.51456\ \mu\mathrm{s}^{-1}, \\]

so

\\[ \boxed{T_Z\approx1.943\ \mu\mathrm{s}.} \\]

Putting the two error mechanisms together:

ERROR CHARACTERIZATION — α = 2.1

Bit-flip timescale

# 2.6 s

Phase-flip timescale

# 1.94 µs

Noise bias

# \~1.3 × 10⁶

The logical bit is extraordinarily resistant to switching, while superposition phase information remains vulnerable to individual photon-loss events.

This confirms the defining idea of a noise-biased cat qubit.

# Part VIII — How can we measure the quantum memory?

## 25. Why readout is a separate physical problem

Suppose we've successfully prepared the memory in either

\\[ |+\alpha\rangle \\]

or

\\[ |-\alpha\rangle. \\]

How do we determine which one is present?

We could, in principle, measure an appropriate quadrature of the memory's electromagnetic field.

But directly coupling measurement hardware to the protected memory may introduce additional loss and other disturbances.

Your project investigates an alternative.

Can we use the buffer itself as the readout channel?

Remember, the buffer is already coupled to the memory, and its photons can escape into a measurable transmission line.

If we can make the outgoing buffer field depend on the memory's logical state, then the buffer provides a way to extract the stored information.

## 26. Task 2.3: Turning logical information into a measurable signal

The project adds an additional drive to the memory:

\\[ H_Z=\epsilon_Z(a+a^\dagger). \\]

Within the logical code space, this is approximately

\\[ H_Z\approx2\alpha\epsilon_Z Z_L. \\]

So the drive is primarily a logical-\\(Z\\) perturbation.

But because the physical memory has states beyond the code space, the drive also causes a small displacement away from the ideal stabilized configurations.

The buffer responds to this displacement.

And crucially, the response depends on which logical state is present.

The simple theoretical prediction is

\\[ \boxed{ \langle b\rangle\_\pm \approx \mp\frac{\epsilon_Z}{2\alpha g_2} +i\frac{\kappa_a}{4g_2}. } \\]

Focus on the real part.

For logical 0:

\\[ \operatorname{Re}\langle b\rangle\_+ \approx-\frac{\epsilon_Z}{2\alpha g_2}. \\]

For logical 1:

\\[ \operatorname{Re}\langle b\rangle\_- \approx+\frac{\epsilon_Z}{2\alpha g_2}. \\]

These have opposite signs.

Therefore, by measuring the buffer's outgoing microwave field, we can distinguish the logical states.

This is the central idea of the transmon-free readout investigated in your project.

The readout protocol uses the existing memory–buffer interaction rather than requiring a separate transmon to serve as the state-dependent measurement element.

## 27. Why doesn't a distinguishable signal immediately imply a good measurement?

A measurement requires more than two different average signals.

The environment introduces quantum fluctuations.

Even if the mean outgoing field differs between logical 0 and logical 1, any finite-duration measurement produces a noisy estimate.

To reliably discriminate the two states, we must integrate the signal for a sufficiently long time.

This is analogous to trying to hear a quiet sound in a noisy room.

If the signal is very faint, averaging it over a longer interval can improve confidence.

For ideal homodyne detection, the project's approximate assignment-error formula is

\\[ P\_{\mathrm{assign}} = \frac12\operatorname{erfc} \left( \sqrt{2\kappa_b\tau} \left|\operatorname{Re}\langle b\rangle\_{\mathrm{ss}}\right| \right), \\]

where \\(\tau\\) is the integration time.

For the baseline readout drive,

\\[ \epsilon_Z=0.1g_2, \\]

your model predicts approximately 146 microseconds of integration to reach a 1% ideal homodyne misassignment probability.

This highlights an interesting difference between two timescales.

The buffer field itself settles after roughly

\\[ 0.97\ \mu\mathrm{s}. \\]

But collecting enough information to distinguish the states with high confidence takes much longer.

Fast system response does not necessarily mean fast high-fidelity readout.

A signal can become stable quickly while remaining too weak to measure reliably without prolonged integration.

## 28. The readout itself creates errors

Now we reach a central engineering difficulty.

A stronger drive creates a larger buffer signal.

That helps the detector distinguish the two logical states more rapidly.

However, the same drive also moves the memory further away from its protected dark states.

This creates additional pathways for switching between the logical configurations.

Your simulations find an approximately quadratic increase in drive-induced switching:

\\[ \boxed{ \Gamma_X(\epsilon_Z) \approx \Gamma_X(0)+c(\alpha)\epsilon_Z^2 } \\]

for weak drives.

Why quadratic?

The drive produces a small perturbation proportional to \\(\epsilon_Z\\).

The transition probabilities produced by that perturbation are generally proportional to the square of the relevant transition amplitudes, giving a leading quadratic dependence.

So the signal grows linearly with drive strength, while the information acquisition rate grows approximately quadratically.

But the induced bit-flip rate also grows quadratically.

This creates a fundamental trade-off.

Suppose doubling the drive makes the detector gather information four times faster.

If the induced bit-flip rate simultaneously increases fourfold, you may not actually improve the overall measurement fidelity.

You have simply exchanged a long, gentle measurement for a short, disruptive one.

That's exactly the sort of effect Task 2.4 investigates.

# Part IX — The final challenge: optimizing measurement without destroying protection

## 29. Task 2.4: What does the newest work add?

The latest `ak-changes` branch goes beyond demonstrating a readable signal.

It investigates whether the measurement can be made more accurate and efficient.

This involves two related questions.

The first concerns physical realism: where does the simplified Hamiltonian come from, and what terms did we ignore when deriving it from the superconducting circuit?

The second concerns optimization: can we choose better drive strengths, cat sizes, or pulse shapes to improve measurement performance?

## 30. Deriving the interaction from circuit physics

The simplified Hamiltonian

\\[ H=g_2(a^2b^\dagger+a^{\dagger2}b)-\epsilon_d(b+b^\dagger) \\]

does not appear magically.

It originates from a nonlinear superconducting element called an asymmetrically threaded SQUID, or ATS.

At the circuit level, the Hamiltonian contains Josephson-energy terms involving a cosine of the superconducting phase.

In the challenge's notation,

\\[ H\_{\mathrm{circuit}} = \omega_a a^\dagger a+ \omega_b b^\dagger b - 2E_J\cos\varphi\_\Sigma \cos(\hat\varphi+\varphi\_\Delta), \\]

where

\\[ \hat\varphi= \varphi_a(a+a^\dagger)+ \varphi_b(b+b^\dagger). \\]

The Josephson element introduces nonlinearity into an otherwise approximately harmonic system.

By choosing an appropriate magnetic-flux bias and applying a periodic pump, we generate the desired frequency-conversion terms.

The pump frequency is selected as

\\[ \boxed{\omega_p=2\omega_a-\omega_b.} \\]

Why this frequency?

Because two memory photons have energy \\(2\hbar\omega_a\\), while one buffer photon has energy \\(\hbar\omega_b\\).

The pump provides the difference.

That makes the process

\\[ a^2b^\dagger \\]

resonant.

One can see the term explicitly by expanding the Josephson nonlinearity. At the selected bias, the relevant part is approximately proportional to

\\[ \cos(\omega_pt)\sin\hat\varphi. \\]

Using

\\[ \sin\hat\varphi = \hat\varphi-\frac{\hat\varphi^3}{6}+\cdots, \\]

the cubic term generates combinations involving two memory operators and one buffer operator.

In the rotating frame, the appropriately pumped \\(a^2b^\dagger\\) term becomes slowly varying, while many other terms oscillate rapidly.

This is the basis of the rotating-wave approximation.

The resulting leading coupling is

\\[ g_2\approx \frac12E_J\epsilon_p\varphi_a^2\varphi_b, \\]

up to the sign and phase convention for the pump, and corrections from higher orders.

### Why does this matter?

The simplified model neglects off-resonant processes, higher-order nonlinearities, and frequency shifts.

These can produce effects such as Kerr nonlinearities and Stark shifts.

For example, a Kerr term has the general structure

\\[ H_K\propto a^{\dagger2}a^2, \\]

which makes the oscillator's effective frequency depend on its occupation.

That can modify dynamics and error rates.

Your Task 2.4 circuit analysis estimates these corrections and tests their influence on selected error-rate calculations.

The method is not a brute-force simulation of the entire circuit at gigahertz resolution. It uses rotating-frame and perturbative approximations to derive and evaluate the important corrections.

This gives a more physically justified connection between the superconducting circuit and the effective open-system model.

## 31. The combined measurement-error objective

How should we decide which readout drive is best?

A reasonable strategy is to combine the probability of incorrectly distinguishing the two signals with the probability that a logical bit flip occurs during measurement.

Your project uses an approximate objective of the form

\\[ \boxed{ P\_{\mathrm{total}}(\tau) = \frac12\operatorname{erfc} \left( \sqrt{2\kappa_b\tau}\\, |\operatorname{Re}\langle b\rangle\_{\mathrm{ss}}| \right) + \frac12\left(1-e^{-\Gamma_X\tau}\right). } \\]

The first term represents ideal homodyne assignment error.

The second is the probability of an odd number of symmetric logical switches over the measurement interval, expressed using the population-difference decay rate \\(\Gamma_X\\).

This is an approximate error budget rather than a complete detector-plus-quantum-trajectory simulation.

There are now two competing effects.

If we integrate for too little time, our measurement is noisy.

If we integrate for too long, the logical state has more opportunity to switch.

The best measurement duration balances these effects.

Your results show that simply increasing drive strength does not necessarily improve this optimum.

At weak drives, the gain in measurement speed is offset by an increase in induced switching.

At stronger drives, the readout begins leaving the perturbative regime, and the degradation can become worse.

## 32. The main optimization insight: make the cat larger during readout

This is perhaps the most important additional idea in the final task.

We established earlier that larger cats have exponentially smaller bit-flip rates.

But we also found that the readout signal depends approximately on

\\[ \operatorname{Re}\langle b\rangle \propto\frac{\epsilon_Z}{\alpha}. \\]

So if we increase \\(\alpha\\), the readout signal becomes somewhat weaker.

At first, this seems undesirable.

However, the induced bit-flip rate can decrease much faster than the signal strength.

The numerical analysis finds the coefficient of readout-induced switching decreases approximately as

\\[ c(\alpha)\sim e^{-2\alpha^2} \\]

over the investigated range.

That suggests a useful idea.

Temporarily increase the cat amplitude during readout, then return it to its normal operating value.

Instead of permanently keeping the memory at a larger cat size, use a larger cat specifically when measuring logical \\(Z\\).

The project explores changing the target from

\\[ \alpha=2.1 \\]

to

\\[ \alpha_r=2.5 \\]

for the readout.

At a drive amplitude of \\(0.2g_2\\), the modeled optimum total error improves from approximately

\\[ 4.11\times10^{-3} \\]

to

\\[ 2.30\times10^{-4}. \\]

TASK 2.4 — OPTIMIZED READOUT AT 0.2 g₂

Normal cat, α = 2.1

# 0.411%

Modeled minimum total error

Larger readout cat, α = 2.5

# 0.023%

Modeled minimum total error

# \~18× lower error

The improvement comes from suppressing measurement-induced switching more rapidly than the useful readout signal weakens.

This is a genuine optimization strategy rather than just characterization of an existing design.

It has important limitations.

The larger cat must be prepared and later returned to its original amplitude. That takes additional control time.

A larger cat also experiences faster phase errors, although logical phase flips commute with an ideal logical-\\(Z\\) measurement and therefore are not necessarily harmful to that particular measurement outcome.

And the simulation assumes a calibrated physical model, not arbitrary experimental imperfections.

Nevertheless, the approach demonstrates a useful control principle: the best operating point for storing information need not be the best operating point for reading it out.

## 33. Can pulse shaping make readout faster?

The project also investigates another issue.

Remember the oscillatory response of the memory–buffer system?

When a drive is suddenly turned on, the buffer signal overshoots and rings before settling.

This is similar to the step response of an underdamped classical control system.

Instead of applying the full drive instantaneously, we can shape its turn-on profile so that the resulting oscillations cancel.

One strategy uses two drive steps separated by approximately half an oscillation period.

In the weak-drive regime, the reported simulation reduces the first overshoot from about 44% to almost zero.

The 1% settling time improves from approximately

\\[ 0.965\ \mu\mathrm{s} \\]

to

\\[ 0.250\ \mu\mathrm{s}. \\]

That's a dramatic improvement in the settling response.

However, the project also finds an important limitation: reducing overshoot does not automatically improve an integrating detector's signal-to-noise ratio.

A detector that can exploit the entire transient signal may not benefit much from suppressing ringing.

This distinguishes two optimization objectives that are often confused.

One is making the physical signal settle quickly.

The other is extracting enough information, with sufficiently little backaction, to minimize total readout error.

These are not identical problems.

# Part X — What makes the computational work scientifically credible?

## 34. You're not simulating a two-state qubit directly

The simulation has to represent the full quantum state of two oscillators.

Each oscillator has an infinite-dimensional Fock space, which must be truncated.

If the memory keeps \\(N_a\\) photon-number levels and the buffer keeps \\(N_b\\), the combined Hilbert-space dimension is

\\[ N=N_aN_b. \\]

For example, using

\\[ N_a=32,\qquad N_b=12, \\]

gives

\\[ N=384. \\]

The density matrix is therefore a

\\[ 384\times384 \\]

complex matrix.

It contains 147,456 elements.

The simulation evolves that matrix according to the Lindblad master equation.

For some calculations, it also constructs or implicitly operates with the Liouvillian acting on the vectorized density matrix, which creates a substantially larger eigenvalue problem.

This is why slow bit-flip modes are computationally demanding.

### Why must the truncation be checked?

Suppose you use only six buffer Fock states.

If the buffer briefly becomes highly excited, significant population may reach the highest retained levels.

Those states cannot evolve correctly if higher levels have been artificially removed.

The simulation could give a plausible-looking trajectory that is quantitatively wrong.

Your team explicitly examines this issue.

For example, the steady-state memory photon number converges with smaller truncations than the transient overshoot does.

The initial suggested buffer dimension \\(N_b=6\\) underestimates the overshoot peak by about 11.5%.

A larger buffer dimension is needed to reproduce the transient correctly.

This is an important computational-science result.

A model that accurately predicts equilibrium can still be inaccurate during transient dynamics.

That principle extends far beyond quantum computing.

The same problem appears in fluid simulations, chemical kinetics, numerical PDEs, and reduced-order dynamical systems.

## 35. What computational methods does the repository use?

The simulations use the Python library `dynamiqs`, with JAX-based numerical infrastructure.

The core open-system evolution is obtained using `mesolve`, which solves Lindblad master equations.

The scripts use adaptive numerical integration with tight tolerances, generally \\(10^{-10}\\), because the quantities of interest can include extremely small probabilities and decay rates.

The project also computes Liouvillian eigenvalues, performs parameter sweeps, checks numerical convergence, compares against mean-field or analytic approximations, and plots Wigner functions and observables.

For larger simulations, the repository includes Slurm scripts intended for high-performance computing environments.

The different mathematical descriptions serve different roles.

The full two-mode Lindblad model captures the quantum dynamics.

The memory-only model helps explain stabilization conceptually.

The semiclassical equations explain transient oscillations and fixed points.

Liouvillian eigenvalues reveal slow error rates.

Perturbative circuit calculations explain which physical interactions produce the effective Hamiltonian.

A strength of the project is that the same phenomena are repeatedly examined from more than one mathematical viewpoint.

For example, the ringing period is understood through a classical linearization and confirmed by the full quantum simulation.

The bit-flip rates are obtained using both time-dependent decay and Liouvillian eigenmodes.

The readout contrast is compared against a simple analytical expression.

This sort of cross-checking helps separate robust physical conclusions from numerical artifacts.

# Part XI — How all the pieces fit together

We can now describe the project at several levels of abstraction.

## 36. At the hardware level

You're studying a superconducting memory oscillator connected to a deliberately lossy buffer through a nonlinear coupling element.

Microwave drives and a parametric pump control the interaction.

The nonlinearity enables the conversion of two memory photons into one buffer photon.

## 37. At the quantum-dynamics level

The system is described by a Hamiltonian plus dissipative Lindblad terms.

The Hamiltonian governs coherent interactions.

The dissipators describe how photons escape into the environment.

When combined appropriately, they generate a two-dimensional protected subspace spanned by two coherent states.

## 38. At the information-theoretic level

The two coherent states represent logical 0 and 1.

The engineered stabilization suppresses transitions between them.

Single-photon loss predominantly causes logical phase flips.

This gives rise to a strongly biased error channel.

## 39. At the control level

We need to initialize the qubit, maintain it, manipulate its state, and measure it.

Each control operation interacts with the stabilizing physics.

Preparation pulses can cause transient excitation. Readout drives can produce additional bit flips. Larger cat sizes suppress switching but worsen phase errors.

The control problem is to manage these competing effects.

## 40. At the numerical-modeling level

You repeatedly move between simplified analytical approximations and full quantum simulations.

This lets you understand which physical mechanisms matter, where approximations break down, and which parameters improve performance.

The full project is therefore much more than a demonstration that a cat state can exist.

It is a study of how an engineered quantum memory behaves as a physical, dissipative, controllable system.

# Part XII — What I think is most important to understand deeply

There are four interconnected ideas that explain most of the project.

### A. Dissipation can stabilize quantum information

Normally, we associate dissipation with the destruction of information.

But what matters is not simply whether energy leaves the system.

It matters what information the environment acquires during that process.

The engineered two-photon process can remove unwanted deviations while preserving information within the cat-code subspace.

That is why a carefully designed reservoir can be useful.

### B. Protection depends on how logical information is encoded

A photon-loss process is not inherently an \\(X\\) error or a \\(Z\\) error.

Its logical action depends on the chosen encoding.

In this encoding,

\\[ a\approx\alpha Z_L. \\]

That's why single-photon loss predominantly produces phase errors.

The very same physical process would have a different logical interpretation under a different encoding.

This is one of the deeper connections between quantum information theory and physical engineering.

### C. The protected space is only part of the full Hilbert space

The two logical coherent states span approximately a two-dimensional space.

But the actual oscillator possesses infinitely many quantum states.

Noise and control drives can temporarily populate states outside the logical space.

Those excursions determine many important behaviors, including transient ringing, leakage and higher-order bit-flip mechanisms.

That's why treating the device as nothing more than an abstract two-level qubit can miss essential physics.

### D. Reading information can undermine its protection

The same physical interaction that lets the environment carry away a useful measurement signal can also disturb the logical state.

This is particularly clear in the readout simulations.

A stronger drive creates a stronger signal, but can also increase switching.

The optimization is not simply to maximize signal strength. It is to maximize useful information extracted for an acceptable level of disturbance.

That is a general principle in quantum measurement and control.

## The project in one scientific picture

Superconducting microwave circuit

Memory + nonlinear coupler + lossy buffer

Engineered two-photon dissipation

\\(L_2=\sqrt{\kappa_2}(a^2-\alpha^2)\\)

Stabilized logical subspace

\\(|0_L\rangle\approx|+\alpha\rangle,\quad |1_L\rangle\approx|-\alpha\rangle\\)

Error protection

Bit flips strongly suppressed, phase flips remain

Control and readout

State preparation, buffer measurement, drive optimization

## What your team has achieved

Based on the numerical results reported in the current branch, the team has demonstrated a consistent simulation of cat-state formation, identified and explained nontrivial memory–buffer transients, established suitable numerical truncations, prepared logical basis states with high fidelity, measured strongly biased logical error rates, and investigated transmon-free readout.

The final work goes further by deriving effective interactions from the circuit Hamiltonian and demonstrating a numerical strategy that reduces readout-induced errors by increasing the cat amplitude during measurement.

Those are computational and theoretical results. The repository does not establish that a new physical chip has been fabricated or experimentally benchmarked by the team.

The work is documented in the [project README](https://github.com/yubrajbhandari923/DuQuantum/blob/ak-changes/README.md?utm_source=chatgpt.com), and the main simulations are available in the [scripts directory](https://github.com/yubrajbhandari923/DuQuantum/tree/ak-changes/scripts?utm_source=chatgpt.com).

## The central takeaway

The deepest way to understand DuQuantum is this:

We're not trying to build an isolated quantum system that never loses energy. We're trying to design a quantum system whose natural, dissipative dynamics preserve the information we care about.

And once we've constructed that protected space, the next challenge is learning how to initialize, manipulate, and measure it without destroying the protection.

That is the unifying thread connecting every major part of this project—from coherent states and Josephson circuits to Lindblad equations, rare-event eigenvalues, and readout optimization.