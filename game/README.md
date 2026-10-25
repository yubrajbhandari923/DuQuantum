# Schrödinger's Last Experiment

**[▶ Play the game now](https://du-quantum.vercel.app/)** · [GitHub Pages mirror](https://yubrajbhandari923.github.io/DuQuantum/)

Build the quantum computer. Outsmart Heisenberg. Save your cat.

Explore a 3D physicist's study, collect apparatus, and use the desk monitor to run ten experiments. They take you from an LC circuit to a dissipatively stabilized cat qubit and its readout. Every success is checked against a physics model. Ask Schrödinger for contextual hints by text or voice: Gemini powers his replies and ElevenLabs handles speech.

## Run

```bash
cd game
npm install
npm run dev        # http://localhost:5173/
npm run build      # typecheck + production build into game/dist
npm test           # vitest: physics and level-mission tests
```

## Online deployments

The full game is live at [du-quantum.vercel.app](https://du-quantum.vercel.app/). The [GitHub Pages mirror](https://yubrajbhandari923.github.io/DuQuantum/) is built by `.github/workflows/pages.yml` when `game/` changes on `master`.

GitHub Pages serves static files and calls the Vercel API for live chat and speech. The Vercel project stores `GEMINI_API_KEY` and `ELEVENLABS_API_KEY` as production environment variables; the GitHub repository variable `TUTOR_API_URL` contains only `https://du-quantum.vercel.app`. Re-run the Pages workflow after changing that URL. API keys are never included in the browser build. The campaign and recorded voice lines still work without the live tutor.

## Ask Schrödinger (tutor and voices)

Press `T` or click "Ask Schrödinger" in the study or inside an experiment to text him, or click Speak to ask out loud. Gemini answers as a Socratic teacher, told the current experiment, its objective, notebook page, hints and Heisenberg's wrong claims. ElevenLabs speaks his replies and transcribes your voice. The scripted lines of the cutscene, dialogue and hub barks are recorded in `public/voice/` (197 lines), so they play without any key.

For local live tutoring, put the keys in `.env.local` (gitignored), then run `npm run dev` or `npm run preview`. The backend is a Vite plugin (`server/tutor.ts`), so the keys never reach the browser:

```bash
GEMINI_API_KEY=...
ELEVENLABS_API_KEY=...
GEMINI_MODEL=gemini-3.5-flash   # optional; the default
```

Endpoints: `POST /api/tutor/chat` (Gemini generateContent), `/api/tutor/tts` (ElevenLabs `eleven_flash_v2_5`), `/api/tutor/stt` (ElevenLabs `scribe_v1`). Without keys the panel says the tutor is offline and the rest of the game is unchanged. After changing a scripted line, run `node scripts/voice-lines.mjs` to record it (it skips lines already recorded).

Node 20+ is recommended. The core campaign runs in the browser; the live tutor needs network access and API keys. Fonts and recorded dialogue are bundled.

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
  lab/        the 3D study (react-three-fiber): walker, collectible parts, desk interaction
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
