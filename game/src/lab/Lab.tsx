import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { create } from 'zustand';
import { LEVEL_COUNT, isUnlocked, useGame } from '../store';
import { C } from '../styles/colors';
import { play } from '../audio/sfx';
import { Suspense } from 'react';
import { PROPS, Room } from './Scenery';
import { Chamber } from './Chamber';
import { CHARACTERS, Characters } from './Characters';
import { Station } from './Stations';

/** Which console the reticle is on (null = none). Only written when it changes. */
export const useAim = create<{ aimed: number | null; set: (n: number | null) => void }>((set) => ({ aimed: null, set: (aimed) => set({ aimed }) }));

const RING = 5.6, WALL = 7, EYE = 1.65, BODY = 0.4, CHAMBER = 1.7;
const stationPos = (i: number) => {
  const a = Math.PI + (i / LEVEL_COUNT) * Math.PI * 2; // level 1 at the west side, clockwise
  return { x: Math.cos(a) * RING, z: Math.sin(a) * RING, rot: -a - Math.PI / 2 };
};

/** Walks the player and eases the camera between the menu orbit, the hub and the bench close-up. */
function Rig() {
  const { camera, gl, raycaster, scene } = useThree();
  const keys = useRef(new Set<string>());
  const look = useRef({ yaw: 0, pitch: -0.08 });
  const pos = useRef(new THREE.Vector3(0, EYE, 3.2));
  const target = useRef(new THREE.Vector3());
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const aimedRef = useRef<number | null>(null);

  const aim = () => {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    for (const h of raycaster.intersectObjects(scene.children, true)) {
      let o: THREE.Object3D | null = h.object;
      while (o && o.userData.station === undefined) o = o.parent;
      if (o) return h.distance < 3.6 ? (o.userData.station as number) : null; // non-console hits (glass, floor rings) never block the aim
    }
    return null;
  };

  const activate = () => {
    const g = useGame.getState();
    const id = aimedRef.current;
    if (g.screen !== 'hub' || id === null) return;
    if (isUnlocked(g.completed, id)) { document.exitPointerLock(); play('connect'); g.openLevel(id); } else play('fail');
  };

  useEffect(() => {
    const el = gl.domElement;
    const down = (e: KeyboardEvent) => {
      const g = useGame.getState();
      if (g.screen !== 'hub' || g.panel) return;
      keys.current.add(e.code);
      if (e.code === 'KeyE' || e.code === 'Enter') activate();
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const move = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return;
      look.current.yaw -= e.movementX * 0.0022;
      look.current.pitch = THREE.MathUtils.clamp(look.current.pitch - e.movementY * 0.0022, -1.2, 1.2);
    };
    const click = () => {
      if (useGame.getState().screen !== 'hub' || useGame.getState().panel) return;
      if (document.pointerLockElement !== el) el.requestPointerLock();
      else activate();
    };
    if ((import.meta as unknown as { env: { DEV: boolean } }).env.DEV) { // test hook: stand `d` metres from console n (1-based), facing it
      (window as unknown as Record<string, unknown>).__lab = {
        stand: (n: number, d = 2) => {
          const p = stationPos(n - 1), r = Math.hypot(p.x, p.z);
          pos.current.set(p.x * (1 - d / r), EYE, p.z * (1 - d / r));
          look.current = { yaw: Math.atan2(p.x - pos.current.x, p.z - pos.current.z) + Math.PI, pitch: -0.08 };
        },
        view: (x: number, z: number, yaw: number, pitch = -0.05) => { pos.current.set(x, EYE, z); look.current = { yaw, pitch }; },
        aimed: () => useAim.getState().aimed, game: useGame, renderer: gl,
      };
    }
    addEventListener('keydown', down); addEventListener('keyup', up); addEventListener('mousemove', move); el.addEventListener('click', click);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('mousemove', move); el.removeEventListener('click', click); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(({ clock }, dt) => {
    const g = useGame.getState();
    const t = clock.elapsedTime;
    if (g.screen !== 'hub' && document.pointerLockElement) document.exitPointerLock();

    if (g.screen === 'level') { // bench close-up: drift toward the active console
      const i = g.level - 1, p = stationPos(i);
      const k = 1 - Math.exp(-3 * dt);
      tmp.set(p.x * 0.72, 1.55, p.z * 0.72);
      camera.position.lerp(tmp, k);
      target.current.lerp(tmp.set(p.x, 1.25, p.z), k);
      camera.lookAt(target.current);
      pos.current.copy(camera.position);
      if (aimedRef.current !== null) { aimedRef.current = null; useAim.getState().set(null); }
      return;
    }
    if (g.screen !== 'hub') { // cinematic orbit behind menus
      const a = t * 0.07;
      tmp.set(Math.cos(a) * 3.4, 2.1, Math.sin(a) * 3.4);
      camera.position.lerp(tmp, 1 - Math.exp(-2 * dt));
      target.current.lerp(tmp.set(0, 1, 0), 1 - Math.exp(-2 * dt));
      camera.lookAt(target.current);
      pos.current.set(camera.position.x, EYE, camera.position.z);
      return;
    }

    const { pitch } = look.current;
    if (!g.panel) {
      const f = +keys.current.has('KeyW') - +keys.current.has('KeyS') + +keys.current.has('ArrowUp') - +keys.current.has('ArrowDown');
      const s = +keys.current.has('KeyD') - +keys.current.has('KeyA');
      look.current.yaw -= (+keys.current.has('ArrowRight') - +keys.current.has('ArrowLeft')) * 1.8 * dt; // arrows turn: keyboard-only look
      const { yaw } = look.current;
      const sp = 3.2 * dt;
      let nx = pos.current.x + (-Math.sin(yaw) * f + Math.cos(yaw) * s) * sp;
      let nz = pos.current.z + (-Math.cos(yaw) * f - Math.sin(yaw) * s) * sp;
      const r = Math.hypot(nx, nz);
      if (r > WALL - BODY - 0.1) { nx *= (WALL - BODY - 0.1) / r; nz *= (WALL - BODY - 0.1) / r; }
      if (r < CHAMBER + BODY - 0.2) { const k = (CHAMBER + BODY - 0.2) / Math.max(r, 1e-3); nx *= k; nz *= k; }
      for (const c of PROPS) { const dx = nx - c.x, dz = nz - c.z, d = Math.hypot(dx, dz); if (d < c.r) { nx = c.x + (dx / d) * c.r; nz = c.z + (dz / d) * c.r; } }
      for (const c of CHARACTERS) { const dx = nx - c.x, dz = nz - c.z, d = Math.hypot(dx, dz); if (d < 0.6) { nx = c.x + (dx / d) * 0.6; nz = c.z + (dz / d) * 0.6; } }
      for (let i = 0; i < LEVEL_COUNT; i++) { // console collision: push out of a disc around each console
        const p = stationPos(i), dx = nx - p.x, dz = nz - p.z, d = Math.hypot(dx, dz);
        if (d < 0.85) { nx = p.x + (dx / d) * 0.85; nz = p.z + (dz / d) * 0.85; }
      }
      pos.current.set(nx, EYE + Math.sin(t * 6) * 0.01 * (f || s ? 1 : 0), nz);
    }
    camera.position.lerp(pos.current, 1 - Math.exp(-14 * dt));
    camera.rotation.set(pitch, look.current.yaw, 0, 'YXZ');

    let a = aim();
    if (a === null) { // proximity assist: the nearest console you roughly face within 2.6 m, so aiming never needs pixel precision
      const fx = -Math.sin(look.current.yaw), fz = -Math.cos(look.current.yaw);
      let best = 2.6;
      for (let i = 0; i < LEVEL_COUNT; i++) {
        const p = stationPos(i), dx = p.x - pos.current.x, dz = p.z - pos.current.z, d = Math.hypot(dx, dz);
        if (d < best && (dx * fx + dz * fz) / d > 0.8) { best = d; a = i + 1; }
      }
    }
    if (a !== aimedRef.current) { aimedRef.current = a; useAim.getState().set(a); }
  });
  return null;
}

export function Lab({ quality }: { quality: 'low' | 'high' }) {
  const completed = useGame((s) => s.completed);
  return (
    <>
      <color attach="background" args={['#0d0907']} />
      <fog attach="fog" args={['#0d0907', 6, 18]} />
      <ambientLight intensity={0.08} color="#ffe2c0" />
      <hemisphereLight args={['#ffd8a8', '#24170e', 0.16]} />
      <Suspense fallback={null}><Room wall={WALL} ring={RING} chamber={CHAMBER} quality={quality} /></Suspense>
      <Characters />
      <Chamber open={completed.length >= LEVEL_COUNT} radius={CHAMBER} quality={quality} />
      {Array.from({ length: LEVEL_COUNT }, (_, i) => (
        <Station key={i} i={i} pos={stationPos(i)} quality={quality} state={completed.includes(i + 1) ? 'done' : isUnlocked(completed, i + 1) ? 'open' : 'locked'} />
      ))}
      <Rig />
    </>
  );
}
