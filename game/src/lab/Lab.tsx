import { Suspense, useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { LEVEL_COUNT, hasSet, nextLevel, useGame } from '../store';
import { play } from '../audio/sfx';
import { Room } from './Scenery';
import { Chamber } from './Chamber';
import { CHARACTERS, Characters } from './Characters';
import { BODY, COLLIDERS, DESK, EYE, SPAWN, SPOTS, WALL } from './layout';
import { Desk } from './Desk';
import { Pickups, collect, useAim, waiting } from './Pickups';
import { Intro3D } from './Intro3D';

const CHAMBER = 1.7;
const MON = new THREE.Vector3(...DESK.monitor), VIEW = new THREE.Vector3(...DESK.view), CENTRE = new THREE.Vector2();

/** Monitor / desk: power on the current experiment if its parts are all on the desk; after the tenth, open the box. */
export function powerOn() {
  const g = useGame.getState(), cur = nextLevel(g.completed);
  if (!hasSet(g.collected, g.completed, cur)) { play('fail'); return false; }
  document.exitPointerLock(); play('connect');
  if (g.completed.length >= LEVEL_COUNT) g.go('ending'); else g.openLevel(cur);
  return true;
}

/** Walks the player and eases the camera between the menu orbit, the hub and the bench close-up. */
function Rig({ targets }: { targets: RefObject<THREE.Group> }) {
  const { camera, gl, raycaster, scene } = useThree();
  const keys = useRef(new Set<string>());
  const look = useRef({ yaw: SPAWN.yaw, pitch: -0.08 });
  const pos = useRef(new THREE.Vector3(SPAWN.x, EYE, SPAWN.z));
  const target = useRef(new THREE.Vector3());
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const aimedRef = useRef<string | null>(null);

  const aim = () => {
    raycaster.setFromCamera(CENTRE, camera);
    if (!targets.current) return null;
    for (const h of raycaster.intersectObjects(targets.current.children, true)) {
      let o: THREE.Object3D | null = h.object;
      while (o && o.userData.aim === undefined) o = o.parent;
      if (o) return h.distance < 3.4 ? (o.userData.aim as string) : null; // only the desk and the parts are cast against: the room never blocks the aim
    }
    return null;
  };

  const activate = () => {
    const g = useGame.getState();
    const id = aimedRef.current;
    if (g.screen !== 'hub' || id === null) return;
    if (id === 'monitor' || id === 'desk') powerOn(); else collect(id);
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
    if ((import.meta as unknown as { env: { DEV: boolean } }).env.DEV) { // dev test hook
      (window as unknown as Record<string, unknown>).__lab = { // stand(): in front of the desk; stand(id): beside a waiting component
        stand: (id?: string, d = 1.5) => {
          const [x, y, z] = id && SPOTS[id] ? SPOTS[id] : DESK.monitor, r = Math.hypot(x, z);
          pos.current.set(x * (1 - d / r), EYE, z * (1 - d / r));
          look.current = { yaw: Math.atan2(x - pos.current.x, z - pos.current.z) + Math.PI, pitch: Math.atan2(y - EYE, d) };
        },
        collect, waiting: () => waiting(useGame.getState()), powerOn,
        view: (x: number, z: number, yaw: number, pitch = -0.05) => { pos.current.set(x, EYE, z); look.current = { yaw, pitch }; },
        aimed: () => useAim.getState().aimed, game: useGame, renderer: gl, scene, camera,
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

    if (g.screen === 'level') { // seated close-up at the desk, eyes on the monitor
      const k = 1 - Math.exp(-3 * dt);
      camera.position.lerp(VIEW, k);
      target.current.lerp(MON, k);
      camera.lookAt(target.current);
      pos.current.copy(camera.position);
      if (aimedRef.current !== null) { aimedRef.current = null; useAim.getState().set(null); }
      return;
    }
    if (g.screen === 'cutscene') { // Intro3D drives the camera; keep the walker where the player will stand at the hand-off
      pos.current.set(camera.position.x, EYE, camera.position.z); look.current.yaw = camera.rotation.y; look.current.pitch = camera.rotation.x;
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
      for (const c of COLLIDERS) { const dx = nx - c.x, dz = nz - c.z, d = Math.hypot(dx, dz); if (d < c.r) { nx = c.x + (dx / d) * c.r; nz = c.z + (dz / d) * c.r; } }
      for (const c of CHARACTERS) { const dx = nx - c.x, dz = nz - c.z, d = Math.hypot(dx, dz); if (d < 0.6) { nx = c.x + (dx / d) * 0.6; nz = c.z + (dz / d) * 0.6; } }
      pos.current.set(nx, EYE + Math.sin(t * 6) * 0.01 * (f || s ? 1 : 0), nz);
    }
    camera.position.lerp(pos.current, 1 - Math.exp(-14 * dt));
    camera.rotation.set(pitch, look.current.yaw, 0, 'YXZ');

    let a = aim();
    if (a === null) { // proximity assist: a component or the monitor you roughly face, so aiming never needs pixel precision
      const fx = -Math.sin(look.current.yaw), fz = -Math.cos(look.current.yaw);
      let best = 2.2;
      const near = (x: number, z: number, cos: number) => { const dx = x - pos.current.x, dz = z - pos.current.z, d = Math.hypot(dx, dz); return d < best && (dx * fx + dz * fz) / d > cos ? d : 0; };
      for (const w of waiting(g)) { const d = near(SPOTS[w.id][0], SPOTS[w.id][2], 0.85); if (d) { best = d; a = w.id; } }
      if (a === null) { best = 2.8; if (near(DESK.monitor[0], DESK.monitor[2], 0.7)) a = 'monitor'; }
    }
    if (a !== aimedRef.current) { aimedRef.current = a; useAim.getState().set(a); }
  });
  return null;
}

export function Lab({ quality }: { quality: 'low' | 'high' }) {
  const completed = useGame((s) => s.completed);
  const targets = useRef<THREE.Group>(null);
  return (
    <>
      <color attach="background" args={['#0d0907']} />
      <fog attach="fog" args={['#0d0907', 6, 18]} />
      <ambientLight intensity={0.08} color="#ffe2c0" />
      <hemisphereLight args={['#ffd8a8', '#24170e', 0.16]} />
      <Suspense fallback={null}><Room wall={WALL} chamber={CHAMBER} quality={quality} /></Suspense>
      <group ref={targets}>
        <Suspense fallback={null}><Desk /></Suspense>
        <Pickups />
      </group>
      <Characters />
      <Chamber open={completed.length >= LEVEL_COUNT} radius={CHAMBER} quality={quality} />
      <Intro3D />
      <Rig targets={targets} />
    </>
  );
}
