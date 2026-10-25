# Game design

**Shape.** A circular 3D laboratory with ten consoles arranged clockwise around a central cat chamber. Walk (WASD, mouse), press `E` at a console; the camera glides in and a full-screen instrument bench opens. Back to lab returns. Experiments unlock in order; completed consoles turn amber, available ones cyan, locked ones stay dim. `Tab` opens a blueprint for anyone who would rather not walk.

**Loop.** Intro dialogue (skippable) → bench with a live objective checklist → physics-validated completion → outro dialogue → takeaway sheet → notebook page unlocked. Hints come in three tiers; Reset restarts only the bench. Failures are feedback lines in experimental language, never a game over.

| # | Level | Core interaction | Completion (validated in physics) |
|---|---|---|---|
| 1 | Quantum Ladder | Drag L and C onto sockets, tune into 4–6 GHz, quantize, pick |0⟩ and |1⟩ on the ladder, drive | circuit valid and tuned; both states prepared; P(n≥2) > 15% after a resonant drive |
| 2 | Forbidden Transition | Insert junction, tune drive to the 0–1 line, calibrate π and π/2 pulses on a Bloch sphere, sweep Ramsey phase | P₁ ≥ 98%; x ≥ 98% on the equator; fringe visibility ≥ 0.9 |
| 3 | Great Quantum Escape | Build pulse sequences for {0,1} and {0,4}; a direct 0→4 jump is refused; apply loss and compare | both encodings prepared; distant code leaks > 20% |
| 4 | Quantum Wave Machine | Displace a Gaussian blob in phase space with amplitude, time, phase (or drag) | reach 2+i; match ⟨n⟩ = 6.25 ± 0.3; lock |+α⟩ and |−α⟩ |
| 5 | Two Cats, One Box | Identify the even cat among four Wigner candidates with parity probes; build one with weight, phase, coherence | fidelity ≥ 97% at α ≥ 1.5, negative Wigner regions, parity > 0.95 |
| 6 | Photon Thief | Watch a coherent state shrink and a cat decohere; compare single- vs pair loss; classify the error | amplitude decay, parity decay, pair-loss parity conserved, Z_L identified |
| 7 | Immortality Machine | Tune κ₂ and α; perturb and watch recovery; compare ideal stabilizer with bare loss | α = 2 ± 0.1, settle < 1.5 µs, κ₂ ≤ 3, coherence preserved |
| 8 | Superconducting Frankenstein | Assemble memory, SQUID, buffer, pump, drive, output; tune the pump to 2ωa − ωb; balance g₂, κ_b, ε_d | α² = 4.41 ± 0.3, settle ≤ 1 µs, overshoot ≤ 30% |
| 9 | Million-to-One Gamble | Displacement pulse to |+α⟩; fit bit-flip and phase-flip times from noisy traces; choose α | fidelity ≥ 97%, fits within 15%, T_X ≥ 50 ms and T_Z ≥ 2 µs |
| 10 | Don't Measure the Cat! | Assemble the readout chain; trade drive, time, cat size and pulse shape; read a seeded hidden bit | total error ≤ 0.5%, switching ≤ 0.25%, confidence ≥ 95%, correct bit |

**Visual language.** Dark lab, amber instrument light, cyan signal, violet interference. The title is shown twice, offset and tinted, as a state in superposition. IM Fell English (titles), IBM Plex Sans (UI), IBM Plex Mono (readouts), all bundled. Wigner maps use cyan for positive and amber for negative with a dashed zero contour, so negativity is never colour-only.

**Accessibility.** Keyboard play throughout (arrows turn, `Tab` blueprint, sockets are focusable buttons, tap-to-place alternative to dragging), visible focus, reduced-motion respected, text ≥ 12 px.

**Not implemented (known gaps).** Free Laboratory sandbox; per-station 3D holograms (the physics visualizations live in the 2D benches); voice lines and speech synthesis; full Lindblad truncation study (illustrative clip only).
