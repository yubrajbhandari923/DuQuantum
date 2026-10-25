# Handoff: Schrödinger's Last Experiment

3D first-person vintage physics-lab game. React 18 + TS + Vite 5, React Three Fiber 8 / Drei 9 / postprocessing, zustand, vitest. Run: `cd game && npm i && npm run dev`. Checks: `npx tsc --noEmit`, `npx vitest run`, `npm run build`. Docs: README.md, GAME_DESIGN.md, PHYSICS_MODELS.md, IMPLEMENTATION_LOG.md, ASSET_SOURCES.md (licences, many Sketchfab ones unverified).

## Done
- Ten levels with real physics validation (src/physics, tested), 2D instruments, notebook, hints, saves (`sle-save-v1`), procedural audio, staged ending, Free Laboratory sandbox (src/levels/Sandbox.tsx).
- Vintage study hub (src/lab/Scenery.tsx, kit split in public/models/vintage), brass bell-jar chamber with the bicolor cat (Chamber.tsx), photo-faced Schrödinger/Heisenberg on the Xbot body (Characters.tsx), photo dialogue portraits, 3D wooden circuit bench with drag/snap (src/instruments/CircuitBench3D.tsx, falls back to SVG).
- Mixamo clips retargeted to the Xbot: public/anims/mixamo.glb, src/lab/mixamoClips.ts, scripts/convert-mixamo.mjs.
- Optimised vintage props library: public/models/props (manifest.json). Originals in asset_originals/ (the 125 MB typewriter original is excluded: GitHub limit).
- New story text: src/story/intro.ts (9 cutscene beats), barks.ts (taunts, wrong-claim/fix pairs, hints, FETCH component lists per level), content.ts rewritten (bomb = ten locks, Heisenberg villain).

## Unfinished: story/gameplay redesign (code exists, UNVERIFIED in a browser)
Requested: Heisenberg carries the player's cat in, puts it in the chamber and starts a bomb; Schrödinger runs in and offers help. Then ONE large desk instead of ten stations; components for each level are collected around the room; a monitor on the desk opens the existing 2D level screens. Schrödinger follows the player; Heisenberg wanders and trash-talks with wrong physics.
Files in progress (written by agents, last states not confirmed): src/lab/actors.ts (+test), Characters.tsx, Intro3D.tsx, Bomb.tsx, Door.tsx, Desk.tsx, Components.tsx, Pickups.tsx, layout.ts, screens.ts, store.ts (collected parts, 'cutscene' screen), Hub.tsx.
To do:
1. Run the game and check each: Begin -> cutscene (skippable) -> hub; Continue skips it. The cutscene agent was mid-debug on a transition glitch when it hit a rate limit.
2. Walk the hub: Schrödinger follows, Heisenberg wanders and barks (barks.ts), bubbles show, nothing talks over dialogue.
3. Collect flow: FETCH pickups visible and pickable (aim + E), parts appear on the desk, monitor opens the current level only when its set is collected, a way not to soft-lock, window.__lab dev hook still works for tests.
4. Wire the Mixamo clips (talk, laugh, point, run_carry for Heisenberg carrying the cat, terrified) in Characters.tsx/actors.
5. Use real props from public/models/props for collectibles and desk dressing; pick one bomb (Bomb.tsx vs props time-bomb).
6. Old per-station hub (Stations.tsx) was removed; confirm nothing still references it.

## Known rough spots
- Heads are smooth ellipsoids with a nose bump; faces look pasted on at three-quarter view. Heisenberg's face photo is user-supplied (licence unknown).
- Ending: cat silhouette hard to see at 390 px; overlay opacity lowered to 0.55 (Ending.tsx) and unchecked.
- Cat is ginger tabby, one animation clip. Scene is heavy under software GL; check perf on a real GPU (about 250 draw calls, 260k triangles on high).
- Level 9 stage D centre column still sparse. Bundle is one ~1 MB chunk plus lazy levels. Sketchfab licences unverified.
- Playwright playthrough scripts are not in the repo; Level 1 was proven with real drags on an isolated page.
