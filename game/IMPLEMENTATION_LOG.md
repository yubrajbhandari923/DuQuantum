# Implementation log

## Done and verified
- Physics modules with tests (`npm test`): oscillator, coherent and cat states, Wigner functions, two-level rotations, loss, stabilizer, memory-buffer RK4, error rates, readout. Level-specific mission tests for levels 2, 5, 7, 8, 10.
- App shell: menu, intro dialogue, hub HUD, blueprint, notebook, settings (reset with confirmation), level frame with three-tier hints and reset, ending. Progress persists in `localStorage`.
- Browser-verified (Playwright, real clicks and drags): menu → Begin → intro → blueprint → Level 1 end to end (tap-place, drag-place, rejected part, tuning, quantize, encoding, preparation, drive, win sheet, save, next level unlocked). No console errors.
- Fixed from browser evidence: unclickable empty sockets (SVG fill none), dialogue and hub prompt pushed off-screen by an animation overriding the centering transform, 3D scene bleeding through level panels, Bench column layout, Wigner plot sizing and idle overlay, near-black lab lighting.

## Per-level browser playtests (agents, own dev servers)
Each level was scripted through the UI (Playwright, own dev server) at 1366x800 and, for most, 390x844. All reached the completion dialog with no console errors, except as noted.
- L2: complete; Ramsey plot moved above the Bloch sphere.
- L3: complete; no changes needed.
- L4: complete; live blob hidden after locking |-alpha> (labels overlapped).
- L5: complete; Wigner plot sizing fixed (grid column blowout), thumbnails de-cluttered, banner no longer says complete before Verify.
- L6: complete; plots side by side. Playtest exposed a physics error (pair loss was exponential): now algebraic, alpha^2/(1+2 k alpha^2 t), tested against Euler integration.
- L7: complete; playback slowed so the recovery is visible.
- L8: complete; better detuning feedback; readouts blank until the pump is tuned.
- L9: stages A-D completed on desktop; the final completion dialog and the mobile commit were not observed by the agent (unverified).
- L10: complete through the ending at both sizes; a minimum of 3 readouts is required; ending is now a staged reveal.

## Known gaps
- Free Laboratory sandbox not built.
- Station holograms are 2D benches; the 3D hub carries consoles and a cat chamber only.
- No voice lines or speech synthesis; audio is procedural and unheard in automated runs.
- Truncation comparison in Level 8 is an illustrative clip, not a Hilbert-space simulation.
- Walking in the 3D hub renders correctly (screenshot-checked); pressing E at a console was not confirmed in-browser (hand-timed headless aiming did not converge). A raycast bug (non-console hits blocking the aim) was fixed and a proximity aim-assist added, both untested in play. The blueprint (Tab) path is verified.
- Oscilloscope series labels can still crowd at the right edge; CatSprite has a dark square background; bundle is one 1 MB chunk (levels are lazy, the 3D stack is not).
