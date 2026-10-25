# Schrödinger's Last Experiment

Build the quantum computer. Outsmart Schrödinger. Save your cat.

A browser game: walk a 3D laboratory, step up to ten consoles, and run ten experiments that take you from an LC circuit to a dissipatively stabilized cat qubit and its readout. Every success is checked against a physics model, never against a script.

## Run

```bash
cd game
npm install
npm run dev        # http://localhost:5173/
npm run build      # typecheck + production build into game/dist
npm test           # vitest: physics and level-mission tests
```

## GitHub Pages

The workflow in `.github/workflows/pages.yml` builds and publishes the game when `game/` changes on `master`. In the repository's **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions**. The site URL is `https://yubrajbhandari923.github.io/DuQuantum/`.

GitHub Pages serves static files, so the live Ask Schrödinger chat and speech endpoints need a separate backend to work online. The scripted voice lines and the rest of the game work without one. Keep API keys out of the Pages build and repository.

## Ask Schrödinger (tutor and voices)

Press `T` or click "Ask Schrödinger" in the study or inside an experiment to text him, or click Speak to ask out loud. Gemini answers as a Socratic teacher, told the current experiment, its objective, notebook page, hints and Heisenberg's wrong claims. ElevenLabs speaks his replies and transcribes your voice. The scripted lines of the cutscene, dialogue and hub barks are recorded in `public/voice/` (197 lines), so they play without any key.

Put the keys in `game/.env.local` (gitignored), then run `npm run dev` or `npm run preview`; the backend is a Vite plugin (`server/tutor.ts`), so the keys never reach the browser:

```bash
GEMINI_API_KEY=...
ELEVENLABS_API_KEY=...
GEMINI_MODEL=gemini-3.5-flash   # optional; the default
```

Endpoints: `POST /api/tutor/chat` (Gemini generateContent), `/api/tutor/tts` (ElevenLabs `eleven_flash_v2_5`), `/api/tutor/stt` (ElevenLabs `scribe_v1`). Without keys the panel says the tutor is offline and the rest of the game is unchanged. After changing a scripted line, run `node scripts/voice-lines.mjs` to record it (it skips lines already recorded).

Node 20+ is recommended. Everything is client-side; no network access or API keys are needed (fonts are bundled).

## Play

| Input | Action |
|---|---|
| Click the lab | capture the mouse (`Esc` releases it) |
| `W A S D` | walk |
| Arrow keys | `↑ ↓` walk, `← →` turn (keyboard-only look) |
| `E` / click | open the console you face |
| `Tab` | blueprint: jump to any unlocked experiment |
| `N` | Schrödinger's notebook |

Inside an experiment you drag parts onto sockets (or tap a part, then a socket), move sliders, and read the instruments. **Hint** gives three tiers: a nudge, specific advice, the answer. **Reset experiment** restarts the bench without losing progress. Progress is saved in `localStorage` (`sle-save-v1`); *Settings → Reset campaign* erases it after a confirmation.

## Layout

```
game/src
  physics/    pure functions + tests: quantum.ts (oscillator, coherent, cat, Wigner, loss), twoLevel.ts (Bloch/Ramsey),
              errors.ts (Γ_X, Γ_Z), stabilizer.ts, coupled.ts (memory+buffer RK4), readout.ts (homodyne model)
  instruments/ reusable displays: EnergyLadder, BlochSphere, PhaseSpace, WignerPlot, PhotonHistogram, Oscilloscope, CircuitBench
  levels/     Level1..Level10.tsx (one screen each) + kit.tsx (Bench, Slider, Readout, Checklist, Feedback, hooks) + index.ts
  lab/        the 3D hub (react-three-fiber): ring of consoles, walker, aim detection
  ui/         Menu, Dialogue (typewriter), Hub HUD, LevelFrame, Overlays (Blueprint, Notebook, Settings), Ending, Portrait, CatSprite
  story/      content.ts: all dialogue, notebook pages, hints, takeaways
  audio/      sfx.ts: procedural Web Audio (no audio files)
  store.ts    zustand store + persistence
```

## Modify

- **Dialogue and notes:** edit `src/story/content.ts` (`LEVELS`, `INTRO`, `ENDING`). A `DialogueLine` may carry an `audio` path for later voice lines; text works without it.
- **Add a level:** create `src/levels/LevelN.tsx` with a default export taking `LevelProps` (`onComplete`, `onReport`), add its content to `content.ts`, and raise `LEVEL_COUNT` in `store.ts`. Use `useOnce(done, () => onComplete(...))` so completion fires once.
- **Tune a mission:** thresholds live next to each level (`LEVELS` limits in `Level8.tsx`, `BUDGET` in `Level10.tsx`); each has a test proving the mission is satisfiable.

See `PHYSICS_MODELS.md` for every model and its limits, and `GAME_DESIGN.md` for the level designs.
