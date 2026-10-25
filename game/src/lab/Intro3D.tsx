import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { create } from 'zustand';
import { useGame } from '../store';
import { play } from '../audio/sfx';
import { INTRO_BEATS, type IntroBeat } from '../story/intro';
import { BOMB_AT, resetBrain, useActors, type Actor } from './actors';
import { AnyCat } from './Chamber';
import { DESK, SPAWN } from './layout';
import { DOOR_IN, DOOR_OUT } from './Door';

type BeatId = IntroBeat['id'];
type Who = IntroBeat['who'];
const ORDER: BeatId[] = ['enter', 'place', 'arm', 'panic', 'schro_enter', 'schro_1', 'schro_2', 'schro_3', 'handoff'];
/** Minimum seconds each beat needs for its staging; a beat lasts longer when its lines take longer to read. */
const ACTION: Record<BeatId, number> = { enter: 7.4, place: 6, arm: 7, panic: 5.5, schro_enter: 4.4, schro_1: 3, schro_2: 3.5, schro_3: 3, handoff: 3 };
const read = (s: string) => 1.1 + s.length * 0.05;
// shortcut: extra `lines` that open like stage directions are shown as narration; give lines their own `who` if the script grows.
const narration = (s: string) => /^(The|A|An|He|She|It|Heisenberg|Schrödinger|Werner|Erwin)\b/.test(s);

export type Line = { who: Who; text: string; t0: number; t1: number };
export const LINES: Line[] = [];
const B = {} as Record<BeatId, { t0: number; t1: number }>;
let cursor = 1.4; // a moment of silence while the picture fades up
for (const id of ORDER) {
  const beat = INTRO_BEATS.find((b) => b.id === id);
  const texts = beat ? [beat.text, ...(beat.lines ?? [])] : [];
  const dur = Math.max(ACTION[id], texts.reduce((s, x) => s + read(x), 0));
  B[id] = { t0: cursor, t1: cursor + dur };
  let u = cursor;
  texts.forEach((text, i) => {
    const who = i > 0 && beat!.who !== 'narrator' && beat!.who !== 'player' && narration(text) ? 'narrator' : beat!.who;
    LINES.push({ who, text, t0: u, t1: i === texts.length - 1 ? cursor + dur : u + read(text) });
    u += read(text);
  });
  cursor += dur + 0.25;
}
export const INTRO_END = cursor + 0.6;
const E = B.enter.t0, P = B.place.t0, A = B.arm.t0, K = B.panic.t0, SE = B.schro_enter.t0, S1 = B.schro_1.t0, S2 = B.schro_2.t0, S3 = B.schro_3.t0, HO = B.handoff.t0;
const lineAt = (t: number) => { for (let i = 0; i < LINES.length; i++) if (t >= LINES[i].t0 && t < LINES[i].t1) return i; return -1; };

/** What the DOM overlay needs: which caption is up, and whether the panic vignette pulses. */
export const useIntro = create<{ line: number; panic: boolean }>(() => ({ line: -1, panic: false }));
/** Cutscene clock (seconds). Skip/seek write `t`. */
export const intro = { t: 0, skip: false, cam: null as null | number[] }; // cam: dev-only camera override [x, y, z, tx, ty, tz]

// --- staging ------------------------------------------------------------------------------------
const PLAYER = { x: SPAWN.x, z: SPAWN.z };
const EYE = 1.65;
const H_CH: [number, number] = [-1.25, 1.75]; // Heisenberg at the chamber, door side
const H_BOMB: [number, number] = [-0.32, 2.17]; // where he kneels... well, bends, to set the bomb down
const H_LEAN: [number, number] = [-3.2, 1.15]; // where he lounges afterwards, out of Schrödinger's way
const S_SPOT: [number, number] = [-1.1, 3.62]; // Schrödinger, in front of the player

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const ph = (t: number, a: number, b: number) => smooth((t - a) / (b - a));
const yawTo = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);
/** Walking profile: accelerate over the first 15 %, cruise, settle over the last 15 % (fraction of distance done). */
const walkProfile = (u: number) => {
  u = clamp01(u); const r = 0.15, v = 1 / (1 - r);
  return u < r ? (v * u * u) / (2 * r) : u > 1 - r ? 1 - (v * (1 - u) ** 2) / (2 * r) : v * (u - r / 2);
};
/** Position along a polyline at time t (walking profile between t0 and t1); writes x, z and heading into `a`. Returns true while moving. */
function route(a: Actor, t: number, t0: number, t1: number, pts: [number, number][]) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let s = walkProfile((t - t0) / (t1 - t0)) * total;
  for (let i = 1; i < pts.length; i++) {
    const [x0, z0] = pts[i - 1], [x1, z1] = pts[i], l = Math.hypot(x1 - x0, z1 - z0);
    if (s <= l || i === pts.length - 1) {
      const k = Math.min(1, s / l);
      a.x = x0 + (x1 - x0) * k; a.z = z0 + (z1 - z0) * k;
      a.yaw = Math.atan2(x1 - x0, z1 - z0);
      return t > t0 && t < t1;
    }
    s -= l;
  }
  return false;
}

const v3 = new THREE.Vector3();
/** World point in front of an actor's chest (body frame offset, using the rendered facing). */
function chest(a: Actor, out: THREE.Vector3, up = 1.0, fwd = 0.32) {
  return out.set(a.x + Math.sin(a.ry) * fwd, up, a.z + Math.cos(a.ry) * fwd);
}

/** Deterministic state of everything at cutscene time t (so seek and skip are exact). */
function stage(t: number) {
  const st = useActors.getState(), { heisenberg: H, schrodinger: S } = st.a;
  H.mode = S.mode = 'script';
  H.tx = S.tx = null;

  // Heisenberg
  H.visible = t > E + 0.7;
  H.gesture = null; H.arms = null; H.look = false; H.carrying = null;
  if (t < A + 0.4) {
    if (!route(H, t, E + 0.8, E + 6.8, [DOOR_OUT, DOOR_IN, H_CH]) && t > E + 6.8) H.yaw = yawTo(H.x, H.z, 0, 0);
    if (t > E + 3.5 && t < P + 1.5) { H.look = true; H.lx = PLAYER.x; H.lz = PLAYER.z; } // glances at you as he talks
  } else if (t < K + 1.2) {
    if (!route(H, t, A + 0.4, A + 1.6, [H_CH, H_BOMB]) && t > A + 1.6) H.yaw = t > A + 3.4 ? yawTo(H.x, H.z, PLAYER.x, PLAYER.z) : yawTo(H.x, H.z, BOMB_AT.x, BOMB_AT.z);
  } else if (!route(H, t, K + 1.2, K + 4.6, [H_BOMB, H_LEAN]) && t > K + 4.6) {
    const atS = t > SE + 2.4 && t < S1;
    H.yaw = atS ? yawTo(H.x, H.z, S.x, S.z) : yawTo(H.x, H.z, PLAYER.x, PLAYER.z);
  }
  if (t < P + 2.0) { H.arms = 'carry'; H.carrying = 'cat'; }
  if (t > P + 1.6 && t < P + 3.3) H.arms = 'reach';
  if (t > A + 0.3 && t < A + 1.5) { H.arms = 'carry'; H.carrying = 'bomb'; }
  if (t > A + 1.5 && t < A + 2.9) H.arms = 'low';
  if (t > A + 3.6 && t < A + 5.6) H.gesture = 'agree'; // the smug chuckle
  if ((t > SE + 3.0 && t < SE + 5) || (t > S3 + 0.3 && t < S3 + 2.3)) H.gesture = 'headShake';
  if (t > K + 4.6) { H.look = true; H.lx = S.visible ? S.x : PLAYER.x; H.lz = S.visible ? S.z : PLAYER.z; }

  // Schrödinger
  S.visible = t > SE + 0.25;
  S.gesture = null; S.arms = null; S.look = false;
  if (!route(S, t, SE + 0.3, SE + 2.7, [DOOR_OUT, DOOR_IN, S_SPOT]) && t > SE + 2.7) {
    S.yaw = yawTo(S.x, S.z, PLAYER.x, PLAYER.z);
    S.look = true; S.lx = PLAYER.x; S.lz = PLAYER.z;
    if ((t > B.schro_enter.t1 - 1.8 && t < S1 + 0.2) || (t > S3 && t < S3 + 1.8)) { S.lx = H.x; S.lz = H.z; } // "Hello, Werner." / a look at him
    if (t > S2 + 0.8 && t < S2 + 3.6) { S.yaw = yawTo(S.x, S.z, DESK.x, DESK.z); S.lx = DESK.x; S.lz = DESK.z; } // the big desk
  }
  if ((t > S1 + 0.3 && t < S1 + 2.3) || (t > HO + 0.4 && t < HO + 2.4)) S.gesture = 'agree';

  // props
  st.door = Math.max(ph(t, E + 0.3, E + 1.1) * (1 - ph(t, E + 6.4, E + 7.3)), ph(t, SE - 0.1, SE + 0.25) * (1 - ph(t, SE + 3.2, SE + 4.0)));
  st.jar = ph(t, P + 0.4, P + 1.9) * (1 - ph(t, P + 3.6, P + 5.0));
  st.catInChamber = t >= P + 3.2;
  const b = st.bomb;
  b.visible = t > A + 0.35; b.armed = t > A + 3.0;
  if (t < A + 1.6) { chest(H, v3, 1.0, 0.36); b.x = v3.x; b.y = v3.y - 0.1; b.z = v3.z; b.yaw = H.ry; b.s = ph(t, A + 0.35, A + 0.6); }
  else {
    const k = ph(t, A + 1.6, A + 2.6);
    chest(H, v3, 1.0, 0.36);
    b.x = THREE.MathUtils.lerp(v3.x, BOMB_AT.x, k); b.y = THREE.MathUtils.lerp(v3.y - 0.1, 0, k); b.z = THREE.MathUtils.lerp(v3.z, BOMB_AT.z, k);
    b.yaw = THREE.MathUtils.lerp(H.ry, BOMB_AT.yaw, k); b.s = 1;
  }
}

/** Where the player's eyes rest at time t (writes into `out`). */
function focus(t: number, out: THREE.Vector3) {
  const { heisenberg: H, schrodinger: S } = useActors.getState().a;
  if (t < E + 1.6) return out.set(DOOR_IN[0], 1.4, DOOR_IN[1]);
  if (t < P + 0.3) return out.set(H.x, 1.45, H.z);
  if (t < P + 2.1) return out.set(H.x * 0.45, 1.25, H.z * 0.45); // the jar going up
  if (t < P + 5.4) return out.set(0, 0.7, 0); // the cat in the glass
  if (t < A + 0.2) return out.set(H.x, 1.6, H.z);
  if (t < A + 3.3) { const b = useActors.getState().bomb; return out.set(b.x * 0.6 + H.x * 0.4, b.y + 0.55, b.z * 0.6 + H.z * 0.4); }
  if (t < K + 0.2) return out.set(H.x, 1.62, H.z);
  if (t < K + 3.6) return out.set(BOMB_AT.x, 0.2, BOMB_AT.z); // panic: stare at the device
  if (t < SE + 0.8) return out.set(DOOR_IN[0], 1.5, DOOR_IN[1]);
  if (t > S2 + 1.0 && t < S2 + 3.4) return out.set(DESK.x * 0.6 + S.x * 0.4, 1.2, DESK.z * 0.6 + S.z * 0.4);
  if (t > S3 && t < S3 + 1.6) return out.set(H.x * 0.6 + S.x * 0.4, 1.6, H.z * 0.6 + S.z * 0.4);
  return out.set(S.x, 1.6, S.z);
}

/** First-person cutscene camera: the player stands frozen by the chamber; the eyes follow the action with eased lookAt, the panic adds a dolly-zoom and shake. */
export function CutsceneCamera() {
  const { camera } = useThree();
  const cur = useRef(new THREE.Vector3()), want = useMemo(() => new THREE.Vector3(), []), last = useRef(-1);
  useFrame(({ clock }, dt) => {
    if (useGame.getState().screen !== 'cutscene') return; // handed off: the hub rig owns the camera even if this unmounts a frame late
    const t = intro.t, cam = camera as THREE.PerspectiveCamera;
    if (intro.cam) { cam.position.set(intro.cam[0], intro.cam[1], intro.cam[2]); cam.lookAt(intro.cam[3], intro.cam[4], intro.cam[5]); return; }
    focus(t, want);
    if (Math.abs(t - last.current) > 0.5) cur.current.copy(want); // seek: snap
    else cur.current.lerp(want, 1 - Math.exp(-3.2 * dt));
    last.current = t;
    const panic = ph(t, K, K + 1.2) * (1 - ph(t, SE - 0.6, SE + 0.6));
    const back = panic * 0.3, wt = clock.elapsedTime;
    const dx = cur.current.x - PLAYER.x, dz = cur.current.z - PLAYER.z, dl = Math.hypot(dx, dz) || 1;
    cam.position.set(PLAYER.x - (dx / dl) * back, EYE + Math.sin(wt * 1.3) * 0.008 - panic * 0.05, PLAYER.z - (dz / dl) * back);
    const shake = panic * 0.035 + ph(t, P + 4.9, P + 5.0) * (1 - ph(t, P + 5.0, P + 5.4)) * 0.02;
    cam.position.x += Math.sin(wt * 23) * shake; cam.position.y += Math.sin(wt * 31 + 1) * shake;
    cam.lookAt(cur.current);
    cam.rotation.setFromQuaternion(cam.quaternion, 'YXZ'); // the walker reads yaw/pitch from here on hand-off
    cam.rotation.z += Math.sin(wt * 17) * panic * 0.02;
    const fov = 68 - ph(t, K + 0.3, K + 2.8) * (1 - ph(t, SE - 0.4, SE + 0.5)) * 20;
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
  });
  return null;
}

/** The cat while it is in Heisenberg's arms or in the air (the chamber shows its own once it lands). */
function FreeCat() {
  const g = useRef<THREE.Group>(null), walk = useRef(1);
  useFrame(({ clock }) => {
    const t = intro.t, H = useActors.getState().a.heisenberg;
    if (!g.current) return;
    g.current.visible = H.visible && t < P + 3.2;
    if (!g.current.visible) return;
    const wt = clock.elapsedTime;
    if (t < P + 2.1) { // tucked across his arms, wriggling
      chest(H, v3, 0.93, 0.34);
      g.current.position.copy(v3);
      g.current.rotation.set(Math.sin(wt * 6) * 0.08, H.ry + Math.PI / 2 + Math.sin(wt * 3.3) * 0.15, Math.sin(wt * 7.5) * 0.12);
      g.current.scale.setScalar(0.72);
    } else { // set down in a short arc onto the plinth
      const u = ph(t, P + 2.1, P + 3.2);
      chest(H, v3, 0.93, 0.34);
      g.current.position.set(v3.x * (1 - u), THREE.MathUtils.lerp(v3.y, 0.2, u) + Math.sin(u * Math.PI) * 0.45, v3.z * (1 - u));
      g.current.rotation.set(0, THREE.MathUtils.lerp(H.ry + Math.PI / 2, Math.PI * 2, u), 0);
      g.current.scale.setScalar(THREE.MathUtils.lerp(0.72, 1.35, u));
    }
  });
  return <group ref={g} visible={false}><AnyCat walk={walk} /></group>;
}

/** Plays the opening: advances the clock, stages actors/props, cues sound, hands over to the hub at the end. */
function Director() {
  const go = useGame((s) => s.go);
  const scene = useThree((s) => s.scene);
  const finish = () => {
    stage(INTRO_END);
    const { heisenberg: H, schrodinger: S } = useActors.getState().a;
    H.mode = 'wander'; S.mode = 'follow'; H.gesture = S.gesture = null; H.arms = null; H.carrying = null;
    resetBrain(5);
    useIntro.setState({ line: -1, panic: false });
    go('hub');
  };
  const paused = useRef(false);
  useLayoutEffect(() => {
    intro.t = 0; intro.skip = false;
    useActors.getState().reset();
    stage(0);
    if ((import.meta as unknown as { env: { DEV: boolean } }).env.DEV) {
      (window as unknown as Record<string, unknown>).__intro = { seek: (t: number) => { intro.t = t; }, get t() { return intro.t; }, end: INTRO_END, lines: LINES, beats: B, pause: (p = true) => { paused.current = p; }, cam: (c: number[] | null) => { intro.cam = c; }, scene, actors: useActors };
    }
  }, []);
  useFrame((_, dt) => {
    if (useGame.getState().screen !== 'cutscene') return;
    if (intro.skip) { intro.skip = false; intro.t = INTRO_END; }
    const prev = intro.t;
    if (!paused.current) intro.t += Math.min(dt, 0.1);
    const t = intro.t;
    if (t >= INTRO_END) return finish();
    stage(t);
    const line = lineAt(t);
    const panic = t > K && t < SE;
    if (line !== useIntro.getState().line || panic !== useIntro.getState().panic) useIntro.setState({ line, panic });
    if (t - prev > 0.5 || t < prev) return; // seeking: no sound cues
    const cue = (at: number) => prev < at && t >= at;
    if (cue(E + 0.35) || cue(SE - 0.05)) play('thud');
    if (cue(E + 7.2) || cue(SE + 3.9)) play('thud');
    if (cue(P + 0.4)) play('stabilize');
    if (cue(P + 2.4)) play('meow');
    if (cue(P + 5.0)) play('thud');
    if (cue(A + 3.0)) play('connect');
    if (t > A + 3.0 && Math.floor(t) !== Math.floor(prev)) play('tick');
    if (panic && Math.floor(t / 0.72) !== Math.floor(prev / 0.72)) play('heartbeat');
  });
  return <><CutsceneCamera /><FreeCat /></>;
}

/** Mounted inside the Lab canvas; active only on the 'cutscene' screen. */
export function Intro3D() {
  const on = useGame((s) => s.screen === 'cutscene');
  return on ? <Director /> : null;
}
