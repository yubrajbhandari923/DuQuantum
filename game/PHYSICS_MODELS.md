# Physics models

Conventions follow the DuQuantum cat-qubit tutorial: ħ = 1, |±α⟩ are the logical states (|0_L⟩ ≈ |+α⟩), even/odd cats are the X-basis states, the stabilizer is L₂ = √κ₂ (a² − α²), and the two-mode Hamiltonian is H = g₂(a²b† + a†²b) − ε_d(b + b†). All numerical models are **illustrative and calibrated**, not device specifications. Each is covered by tests in `src/physics/*.test.ts`.

## Oscillator and encodings (`quantum.ts`, Levels 1, 3, 4)
- ω = 1/√(LC); E_n = ω(n + ½): equal spacing, so a resonant drive cannot address one transition. A resonant drive on |0⟩ produces a coherent state, so population leaks to n ≥ 2 (Level 1 shows this with Poisson statistics).
- Coherent states: P(n) = e^{−|α|²}|α|^{2n}/n! (log-space), ⟨n⟩ = |α|², |⟨α|−α⟩|² = e^{−4|α|²}.
- Level 3 applies pure loss to Fock |n⟩: the survivors are binomial, P(m) = C(n,m) p^m (1−p)^{n−m} with p = e^{−κt}.

## Qubit rotations (`twoLevel.ts`, Level 2)
- Bloch vector (|0⟩ = +z) rotated about (Ω cos φ, Ω sin φ, Δ) by √(Ω²+Δ²)·t (Rodrigues). A resonant drive with phase φ = π/2 takes |0⟩ to +x.
- Ramsey: two π/2 pulses with a swept second phase give fringes of unit visibility only if the first pulse left a coherent equator state.
- Anharmonicity: transition frequency ω − A·n. *Limit:* the junction is a Kerr oscillator, not a transmon with charge dispersion.

## Cats and Wigner functions (`quantum.ts`, Levels 5–7)
- W_coh(β) = (2/π) e^{−2|β−α|²}. Cat: N²[W(α) + W(−α) ± 2(2/π)e^{−2|β|²}cos(4α Im β)], N² = 1/(2(1 ± e^{−2α²})). A `coherence` factor scales only the interference term; 0 is the classical mixture (no fringes, parity ≈ 0).
- Level 5's builder uses ψ = √w|+α⟩ + e^{iφ}√(1−w)|−α⟩ with the same formula; parity ⟨Π⟩ = (π/2)W(0). Fidelity uses exact coherent-state overlaps ⟨x|y⟩ = e^{−(x−y)²/2} (real amplitudes).
- Level 6 loss: α(t) = α₀e^{−κt/2}; cat parity/contrast decays as exp(−2α₀²(1−e^{−κt})); pure pair loss conserves parity and is nonlinear, d(α²)/dt = −2κ₂α⁴, so α²(t) = α₀²/(1 + 2κ₂α₀²t) decays algebraically to vacuum when undriven. *Limit:* closed forms for ideal single-mode loss; no thermal photons.

## Stabilization (`stabilizer.ts`, Level 7)
- Mean field dβ/dt = −κ₂ β*(β² − α²); on the real axis dx/dt = κ₂ x (α² − x²), stable at ±α, unstable at 0. Integrated with RK4.
- Dark-state check: ‖(a² − α²)|C±⟩‖ ≈ 0 in a truncated Fock space (N = 40). The "quantum demonstration" shows ideal stabilization leaves interference contrast at 1 and unprotected single-photon loss destroys it. *Limit:* the stabilized-contrast curve is the ideal dark-state statement, not a Lindblad run.

## Memory + buffer (`coupled.ts`, Level 8)
- Mean-field equations from H with damping: ȧ = −(κ_a/2)a − 2i g(t) a*b, ḃ = −(κ_b/2)b − i(g(t)* a² − ε_d). A detuned pump makes g(t) = g₂e^{iΔt} rotate and average out.
- Adiabatic elimination (κ_b ≫ g₂|α|) gives κ₂ = 4g₂²/κ_b and α² = ε_d/g₂; the reduced model is the real-axis equation above. The full model shows overshoot the reduced model hides (see `level8.test.ts`).
- The "truncation" checkbox is **illustrative**: it clips ⟨n⟩ at N−1 to mimic a too-small Fock cutoff; it is not a Hilbert-space simulation.
- Benchmark in rad/µs: g₂ = 2π·0.763, κ_b = 2π·2.6, κ_a = 2π·0.0093, α² = 4.41.

## Error rates (`errors.ts`, Level 9)
- Γ_Z ≈ 2κ_a α² (gives 1.94 µs at the benchmark); parity decays as e^{−Γ_Z t}.
- Γ_X = Γ₀ e^{−γα²} with γ = 2, Γ₀ fixed so 1/Γ_X(α=2.1) = 2.6 s. *γ is regime dependent*; this is a calibration, not a universal law.

## Readout (`readout.ts`, Level 10)
- Output means Re⟨b⟩± = ∓ε_Z/(2αg₂). Integrated signal has σ = σ₀/√T_eff; pulse ringing removes dead time (step 1.5 µs, shaped 0.4 µs).
- P_assign = Q(contrast·√T_eff / 2σ₀); Γ_X(ε) = Γ_X(0) + c(α)ε², c(α) = c₀e^{−2(α²−4.41)}; P_switch = Γ_X T/2; P_total = P_assign + P_switch has an interior optimum in drive.
- The constants σ₀, c₀ and the ring times are **game calibrations** chosen so the optimum sits at a few MHz and tens of µs; the trends (contrast ∝ ε/α, switching ∝ ε²T, larger α lowers switching) are the physics. Shots use a seeded mulberry32 generator; the hidden bit is drawn from `rng(1000 + attempt)`.
