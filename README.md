# DuQuantum — Schrödinger's Last Experiment

## Play the game

**[▶ Play Schrödinger's Last Experiment](https://du-quantum.vercel.app/)** in your browser. No installation is needed.

[GitHub Pages mirror](https://yubrajbhandari923.github.io/DuQuantum/) · [Game guide and controls](game/README.md)

Your cat is trapped behind ten quantum locks. Explore a 3D physicist's study, collect the parts for a quantum computer, and solve ten hands-on experiments to free it. The experiments progress from an LC circuit to a cat qubit, with results checked by physics models. Ask Schrödinger for contextual hints by text or voice; Gemini powers his replies and ElevenLabs handles speech.

## Run locally

Requires Node.js 20 or newer.

```bash
cd game
npm install
npm run dev
```

Open `http://localhost:5173/`. The campaign and recorded dialogue work without API keys. For the live tutor, add `GEMINI_API_KEY` and `ELEVENLABS_API_KEY` to `game/.env.local`; keep that ignored file out of Git. See the [game README](game/README.md) for controls, tests, and deployment details.

## Research material

The repository also includes the [challenge prompt](ChallengePrompt.md), [explainer](EXPLAINER.md), and quantum computing tutorials in the root directory.
