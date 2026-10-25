import { create } from 'zustand';
import { COLLIDERS, WALL } from './layout';
import { ARRIVAL, BARKS, SCHRO_HINTS, TAUNTS } from '../story/barks';
import { speak } from '../audio/voice';

export type ActorId = 'heisenberg' | 'schrodinger';
export type Mode = 'idle' | 'walk' | 'follow' | 'wander' | 'script';
export type Gesture = 'agree' | 'headShake' | 'sad_pose' | 'sneak_pose' | null;
export type Arms = 'carry' | 'reach' | 'low' | null;
export type Circle = { x: number; z: number; r: number };

/**
 * One physicist. Position/facing are mutated in place every frame (no React re-render);
 * only `speech` changes go through set(), so bubbles re-render and nothing else does.
 */
export interface Actor {
  x: number; z: number;
  yaw: number; // wanted facing (0 = +z); the renderer turns toward it smoothly
  ry: number; // rendered facing, written by Characters
  v: number; // current ground speed, m/s (drives idle/walk/run blending)
  mode: Mode;
  anim: 'idle' | 'walk' | 'run'; // base clip the speed maps to (informational)
  gesture: Gesture; gUntil: number;
  arms: Arms;
  carrying: 'cat' | 'bomb' | null;
  visible: boolean;
  look: boolean; lx: number; lz: number; // turn the head toward (lx, lz)
  speech: { text: string; until: number } | null;
  tx: number | null; tz: number; speed: number; // walk target
}

const actor = (x: number, z: number, yaw: number): Actor => ({
  x, z, yaw, ry: yaw, v: 0, mode: 'idle', anim: 'idle', gesture: null, gUntil: 0, arms: null, carrying: null,
  visible: true, look: false, lx: 0, lz: 0, speech: null, tx: null, tz: 0, speed: 1,
});

export const BOMB_AT = { x: 0.18, z: 1.49, yaw: 0.12 }; // on the floor in front of the chamber, facing the spawn side

interface Actors {
  a: Record<ActorId, Actor>;
  catInChamber: boolean; jar: number; door: number; // door/jar: 0 closed/down .. 1 open/up
  bomb: { x: number; y: number; z: number; yaw: number; s: number; visible: boolean; armed: boolean };
  walkTo: (id: ActorId, to: [number, number], speed?: number) => Promise<void>;
  say: (id: ActorId, text: string, ms?: number) => void;
  reset: () => void;
}

const pending: Partial<Record<ActorId, () => void>> = {};
/** Seconds of game time; advanced by think() so speech and pauses freeze with the frame loop. */
export const clock = { now: 0 };

const initial = () => ({
  a: { heisenberg: actor(1.7, 2.1, -0.35), schrodinger: actor(-1.7, 2.1, 0.35) },
  catInChamber: true, jar: 0, door: 0,
  bomb: { x: BOMB_AT.x, y: 0, z: BOMB_AT.z, yaw: BOMB_AT.yaw, s: 1, visible: true, armed: true },
});

export const useActors = create<Actors>((set, get) => ({
  ...initial(),
  walkTo: (id, [x, z], speed = 1.1) => new Promise<void>((done) => {
    const a = get().a[id];
    pending[id]?.();
    pending[id] = done;
    Object.assign(a, { tx: x, tz: z, speed, mode: a.mode === 'script' ? 'script' : 'walk' });
  }),
  say: (id, text, ms = Math.min(9000, Math.max(3500, 1600 + text.length * 55))) => {
    get().a[id].speech = text ? { text, until: clock.now + ms / 1000 } : null;
    if (text) speak(id, text);
    set({ a: { ...get().a } });
  },
  reset: () => { for (const k in pending) pending[k as ActorId]?.(); set(initial()); },
}));

/** Obstacles an actor steers around: furniture, desk and chamber (radii already include a body), then the player and the other actor (mutable). */
const player: Circle = { x: 0, z: 99, r: 0.75 };
const other: Circle = { x: 0, z: 99, r: 0.7 };
export const OBSTACLES: Circle[] = [...COLLIDERS, player, other];
const STATIC = OBSTACLES.slice(0, -2), NO_OTHER = OBSTACLES.slice(0, -1);

const blocked = (x: number, z: number, obs: readonly Circle[]) => {
  const r = Math.hypot(x, z);
  if (r > WALL - 0.9) return true;
  for (const o of obs) if (Math.hypot(x - o.x, z - o.z) < o.r + 0.1) return true;
  return false;
};

/** Moves `a` one tick toward its target, steering around `obs`. Returns true once it has arrived (or has nowhere to go). */
export function step(a: Actor, dt: number, obs: readonly Circle[] = OBSTACLES): boolean {
  if (a.tx === null) { a.v = Math.max(0, a.v - dt * 4); return true; }
  let dx = a.tx - a.x, dz = a.tz - a.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.06) { a.tx = null; a.v = 0; return true; }
  dx /= d; dz /= d;
  let sx = dx, sz = dz;
  for (const o of obs) { // slide around anything in front of us that is nearer than the target
    const ox = o.x - a.x, oz = o.z - a.z, oc = Math.hypot(ox, oz), gap = oc - o.r;
    if (gap > 1.3 || ox * dx + oz * dz <= 0 || oc - o.r > d) continue;
    const side = dx * oz - dz * ox >= 0 ? 1 : -1; // which side of our path the obstacle is on
    const w = 1.6 * (1 - Math.max(0, gap) / 1.3);
    sx -= -dz * side * w; sz -= dx * side * w;
  }
  const sl = Math.hypot(sx, sz) || 1;
  const want = a.speed * Math.min(1, 0.35 + d / 0.8); // ease into the stop
  a.v += (want - a.v) * Math.min(1, dt * 5);
  let nx = a.x + (sx / sl) * a.v * dt, nz = a.z + (sz / sl) * a.v * dt;
  if (a.mode !== 'script') {
    for (const o of obs) { const ox = nx - o.x, oz = nz - o.z, od = Math.hypot(ox, oz); if (od < o.r && od > 1e-4) { nx = o.x + (ox / od) * o.r; nz = o.z + (oz / od) * o.r; } }
    const r = Math.hypot(nx, nz), max = WALL - 0.6;
    if (r > max) { nx *= max / r; nz *= max / r; }
  }
  a.x = nx; a.z = nz;
  a.yaw = Math.atan2(sx, sz);
  return false;
}

/** Runs one actor's locomotion; resolves its walkTo promise on arrival. */
function move(id: ActorId, a: Actor, dt: number) {
  const o = id === 'heisenberg' ? useActors.getState().a.schrodinger : useActors.getState().a.heisenberg;
  other.x = o.visible ? o.x : 0; other.z = o.visible ? o.z : 99;
  if (step(a, dt) && pending[id]) { const p = pending[id]!; delete pending[id]; if (a.mode === 'walk') a.mode = 'idle'; p(); }
  a.anim = a.v > 1.8 ? 'run' : a.v > 0.1 ? 'walk' : 'idle';
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: readonly T[] | undefined) => (xs && xs.length ? xs[Math.floor(Math.random() * xs.length)] : undefined);
const gesture = (a: Actor, g: Gesture, s = 2.6) => { a.gesture = g; a.gUntil = clock.now + s; };
const faceTo = (a: Actor, x: number, z: number) => { a.yaw = Math.atan2(x - a.x, z - a.z); };

function upkeep(a: Actor, p: { x: number; z: number }, now: number, quiet: boolean) {
  if (a.speech && (a.speech.until < now || quiet)) { a.speech = null; useActors.setState({ a: { ...useActors.getState().a } }); }
  if (a.gesture && a.gUntil < now) a.gesture = null;
  a.look = Math.hypot(p.x - a.x, p.z - a.z) < 6; a.lx = p.x; a.lz = p.z;
}

/** Hub behaviour state (timers, last player position). */
const brain = { hBark: 8, sHint: 22, pause: 1, retarget: 0, reply: null as null | { at: number; text: string }, px: 0, pz: 0, still: 0, fidget: 6, level: 0 };
export const resetBrain = (firstBarkIn = 6) => Object.assign(brain, { hBark: firstBarkIn, sHint: 20, pause: 0.5, retarget: 3, reply: null, level: 0 }); // retarget: Schrödinger stands a moment before he starts following

/**
 * Hub AI, called once per frame while the player walks the lab:
 * Schrödinger follows a couple of metres behind and drops hints; Heisenberg wanders and talks nonsense.
 * `quiet` = a dialogue or panel is open (nobody talks, bubbles clear).
 */
export function think(dt: number, p: { x: number; z: number; yaw: number }, level: number, quiet: boolean) {
  clock.now += dt;
  const st = useActors.getState(), { heisenberg: H, schrodinger: S } = st.a;
  const now = clock.now;
  const moved = Math.hypot(p.x - brain.px, p.z - brain.pz);
  brain.px = p.x; brain.pz = p.z;
  brain.still = moved > dt * 0.3 ? 0 : brain.still + dt;
  const walking = brain.still < 0.25;
  player.x = p.x; player.z = p.z;
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw); // player's forward on the floor

  upkeep(H, p, now, quiet); upkeep(S, p, now, quiet);

  // --- Schrödinger: follow ---
  S.mode = 'follow';
  brain.retarget -= dt;
  const sd = Math.hypot(S.x - p.x, S.z - p.z);
  if (brain.retarget <= 0) {
    brain.retarget = 0.4;
    const sx = -fz, sz = fx; // player's right
    let best: [number, number] | null = null, bd = 1e9;
    for (const [b, l] of [[1.7, 1], [1.7, -1], [1.2, 1.4], [1.2, -1.4], [2.2, 0]] as const) { // behind-right/left, beside, straight behind
      const x = p.x - fx * b + sx * l, z = p.z - fz * b + sz * l;
      if (blocked(x, z, STATIC)) continue;
      const c = Math.hypot(x - S.x, z - S.z);
      if (c < bd) { bd = c; best = [x, z]; }
    }
    const ahead = (S.x - p.x) * fx + (S.z - p.z) * fz, lateral = Math.abs((S.x - p.x) * -fz + (S.z - p.z) * fx);
    if (sd > 2.6 || (walking && sd > 2.3) || (walking && ahead > 0 && lateral < 0.8 && sd < 2.5) || sd < 1.0) {
      if (best && bd > 0.3) { S.tx = best[0]; S.tz = best[1]; S.speed = sd > 4.5 ? 2.9 : sd < 1.0 ? 0.9 : 1.35; }
    } else if (!walking && S.tx !== null && sd < 2.4 && bd < 0.8) S.tx = null; // close enough: stop and wait
  }
  move('schrodinger', S, dt);
  if (S.tx === null && S.v < 0.2) faceTo(S, p.x, p.z);

  // --- Heisenberg: wander, pause, gesture ---
  H.mode = 'wander';
  if (H.tx === null) {
    brain.pause -= dt;
    if (Math.hypot(p.x - H.x, p.z - H.z) < 7) faceTo(H, p.x, p.z);
    if (brain.pause <= 0) {
      for (let i = 0; i < 10; i++) {
        let x: number, z: number;
        if (Math.random() < 0.3) { x = p.x + fx * 2.2 + rnd(-1, 1); z = p.z + fz * 2.2 + rnd(-1, 1); } // swagger into the player's view
        else { const ang = Math.atan2(H.z, H.x) + rnd(-1.6, 1.6), r = rnd(2.4, 4.4); x = Math.cos(ang) * r; z = Math.sin(ang) * r; }
        if (!blocked(x, z, NO_OTHER) && Math.hypot(x - p.x, z - p.z) > 1.3 && Math.hypot(x - H.x, z - H.z) > 1.2) { H.tx = x; H.tz = z; H.speed = rnd(0.85, 1.1); break; }
      }
      brain.pause = rnd(2.5, 6);
    }
  }
  move('heisenberg', H, dt);
  if (H.tx === null && brain.pause > 1 && brain.pause < 1.1 && !H.gesture) gesture(H, Math.random() < 0.5 ? 'headShake' : 'agree');

  // idle fidgets for whoever is standing
  brain.fidget -= dt;
  if (brain.fidget < 0) { brain.fidget = rnd(6, 11); const a = Math.random() < 0.5 ? H : S; if (a.tx === null && !a.gesture) gesture(a, a === H ? 'headShake' : 'agree', 2.2); }

  // --- talk ---
  if (quiet) return;
  if (brain.level !== level) { // new console unlocked (or first arrival): Schrödinger points at it
    const first = brain.level === 0; brain.level = level;
    if (!first) { st.say('schrodinger', pick(SCHRO_HINTS[level]) ?? ''); gesture(S, 'agree'); brain.sHint = rnd(28, 40); }
  }
  if (brain.reply && now > brain.reply.at) { st.say('schrodinger', brain.reply.text); gesture(S, 'headShake'); brain.reply = null; brain.sHint = Math.max(brain.sHint, 12); }
  brain.hBark -= dt;
  if (brain.hBark <= 0 && !S.speech) {
    brain.hBark = rnd(12, 20);
    const b = Math.random() < 0.65 ? pick(BARKS[level]) : undefined;
    const text = b ? b.wrong : pick(TAUNTS) ?? '';
    st.say('heisenberg', text);
    gesture(H, Math.random() < 0.5 ? 'agree' : 'headShake');
    if (b && Math.random() < 0.6) brain.reply = { at: now + Math.min(9, Math.max(3.5, 1.6 + text.length * 0.055)) + 0.4, text: b.fix };
  }
  brain.sHint -= dt;
  if (brain.sHint <= 0 && !H.speech && !brain.reply) {
    brain.sHint = rnd(28, 42);
    const h = pick(SCHRO_HINTS[level]);
    if (h) { st.say('schrodinger', h); gesture(S, 'agree'); }
  }
}

/** Short line Schrödinger says when the player has gathered everything for `level` (for the fetch flow to call). */
export const arrival = (level: number) => { const t = ARRIVAL[level]; if (t) useActors.getState().say('schrodinger', t); };
