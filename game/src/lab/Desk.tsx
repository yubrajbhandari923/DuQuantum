import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { LEVEL_COUNT, hasSet, isUnlocked, nextLevel, useGame } from '../store';
import { LEVELS } from '../story/content';
import { FETCH } from '../story/barks';
import { M } from '../instruments/parts3d';
import { DESK, SPOTS } from './layout';
import { ComponentModel, Prop, walnut } from './Components';
import { PICK_SCALE, flying, roman, waiting } from './Pickups';
import { W as PW, drawPreview } from './screens';
import { Piece } from './Scenery';

/** The hero desk: a walnut pedestal desk with a green leather top, a banker's lamp, the terminal (the monitor that opens the
 *  experiments), the oscilloscope (live preview of the current experiment) and a ten-compartment parts case at the front. */
const TERM = '/models/vintage/terminal.glb', SCOPE = '/models/vintage/oscilloscope.glb';
const TOP = DESK.top, HW = DESK.w / 2, HD = DESK.d / 2;
const TERM_S = 1.45, TERM_Z = -0.08; // terminal placement; its screen centre is DESK.monitor
const PART_S = 0.13; // parts in the case

const leather = new THREE.MeshStandardMaterial({ color: '#1f3a2a', roughness: 0.62, metalness: 0 });
const felt = new THREE.MeshStandardMaterial({ color: '#3a1418', roughness: 1 });
const paper = new THREE.MeshStandardMaterial({ color: '#e6dcc0', roughness: 0.9 });
const BOOK = ['#5a1a16', '#1d2a44', '#3b4a22', '#6b4a1e', '#2a1a12'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));

/** Walnut from the bench texture set, tinted dark. */
function useWood() {
  const [d, r, n] = useLoader(THREE.TextureLoader, ['/tex/bench_diff.jpg', '/tex/bench_rough.jpg', '/tex/bench_nor.jpg']);
  return useMemo(() => {
    d.colorSpace = THREE.SRGBColorSpace;
    for (const t of [d, r, n]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
    return new THREE.MeshStandardMaterial({ map: d, roughnessMap: r, normalMap: n, color: '#a06a44', roughness: 0.8, normalScale: new THREE.Vector2(0.6, 0.6) });
  }, [d, r, n]);
}

const box = (w: number, h: number, d: number) => <boxGeometry args={[w, h, d]} />;

function Pedestal({ x, wood, open }: { x: number; wood: THREE.Material; open: number }) {
  return (
    <group position-x={x}>
      <mesh material={wood} position-y={0.4} castShadow receiveShadow>{box(0.6, 0.68, 1.0)}</mesh>
      <mesh material={walnut} position-y={0.03}>{box(0.64, 0.06, 1.04)}</mesh>
      {[0.6, 0.38, 0.16].map((y, k) => (
        <group key={k} position={[0, y, 0.505 + (k === 0 ? open : 0)]}>
          {k === 0 && open > 0.05 && <>
            <mesh material={wood} position={[0, -0.05, -open / 2]}>{box(0.5, 0.012, open)}</mesh>
            {[-1, 1].map((s) => <mesh key={s} material={wood} position={[s * 0.25, -0.01, -open / 2]}>{box(0.012, 0.09, open)}</mesh>)}
          </>}
          <mesh material={wood} castShadow>{box(0.54, 0.19, 0.02)}</mesh>
          <mesh material={walnut} position-z={0.012}>{box(0.48, 0.14, 0.006)}</mesh>
          <mesh material={M.gold} position={[0, 0.0, 0.025]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.012, 0.012, 0.12, 10]} /></mesh>
          {[-1, 1].map((s) => <mesh key={s} material={M.gold} position={[s * 0.06, 0, 0.018]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.018, 0.018, 0.01, 12]} /></mesh>)}
          <mesh material={M.gold} position={[0, 0.06, 0.016]}>{box(0.06, 0.02, 0.004)}</mesh>
        </group>
      ))}
    </group>
  );
}

/** Live boot / menu page on the terminal: the experiment list, the current experiment and its component checklist. */
function useMonitorTexture() {
  const { cv, tex } = useMemo(() => {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 450;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; return { cv, tex };
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  const acc = useRef(9), sig = useRef('');
  useFrame(({ clock, camera }, dt) => {
    acc.current += dt;
    const near = camera.position.distanceTo(new THREE.Vector3(...DESK.monitor)) < 7;
    const g0 = useGame.getState(), blink = Math.floor(clock.elapsedTime * 2) % 2;
    const key = `${g0.completed.join()}|${g0.collected.join()}|${blink}|${g0.screen}`;
    if (!near || (key === sig.current && acc.current < 2)) return;
    acc.current = 0; sig.current = key;
    const { completed, collected } = g0, cur = nextLevel(completed), lv = LEVELS.find((l) => l.id === cur)!;
    const ready = hasSet(collected, completed, cur);
    const g = cv.getContext('2d')!, A = '#ffcf7a', G = '#8dffaa', D = '#3f7a4c';
    g.fillStyle = '#04110a'; g.fillRect(0, 0, 512, 450);
    const rg = g.createRadialGradient(256, 225, 40, 256, 225, 330); rg.addColorStop(0, 'rgba(60,255,140,0.10)'); rg.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.textBaseline = 'top'; g.font = 'bold 20px "IBM Plex Mono", monospace'; g.fillStyle = A;
    g.fillText('E.S. LABORATORIUM  -  BENCH CONTROL', 22, 18);
    g.fillStyle = D; g.fillRect(22, 46, 468, 2);
    g.font = '16px "IBM Plex Mono", monospace';
    LEVELS.forEach((l, k) => {
      const done = completed.includes(l.id), open = isUnlocked(completed, l.id), here = l.id === cur;
      g.fillStyle = here ? G : done ? A : open ? G : D;
      const mark = done ? '[x]' : here ? '[>]' : open ? '[ ]' : '[#]';
      g.fillText(`${mark} ${String(l.id).padStart(2)}  ${open ? l.title.toUpperCase().slice(0, 30) : '- LOCKED -'}`, 22, 58 + k * 21);
    });
    g.fillStyle = D; g.fillRect(22, 272, 468, 2);
    g.fillStyle = A; g.font = 'bold 17px "IBM Plex Mono", monospace';
    g.fillText(`EXPT ${roman(cur)}: ${lv.title.toUpperCase().slice(0, 32)}`, 22, 282);
    g.font = '16px "IBM Plex Mono", monospace';
    if (completed.length >= LEVEL_COUNT) { g.fillStyle = G; g.fillText('ALL EXPERIMENTS COMPLETE.', 22, 312); }
    else if (ready) {
      g.fillStyle = G; g.fillText('COMPONENTS ............ ALL PRESENT', 22, 312);
      if (blink) { g.fillStyle = A; g.font = 'bold 20px "IBM Plex Mono", monospace'; g.fillText('> PRESS E / CLICK TO POWER ON_', 22, 350); }
    } else {
      g.fillStyle = '#ff9a6a'; g.fillText(`MISSING COMPONENTS${blink ? ' !' : ''}`, 22, 312);
      (FETCH[cur] ?? []).forEach((f, k) => {
        const have = collected.includes(f.id);
        g.fillStyle = have ? G : '#ffb38a'; g.fillText(`${have ? '[x]' : '[ ]'} ${f.name.toUpperCase().slice(0, 38)}`, 34, 336 + k * 20);
      });
      g.fillStyle = D; g.fillText('SEARCH THE STUDY.  [E] AT A PART TO TAKE IT.', 22, 412);
    }
    g.fillStyle = rg; g.fillRect(0, 0, 512, 450);
    g.fillStyle = 'rgba(0,0,0,0.22)'; for (let y = 0; y < 450; y += 3) g.fillRect(0, y, 512, 1);
    tex.needsUpdate = true;
  });
  return tex;
}

/** Oscilloscope: the current experiment's live preview once its parts are in; a noisy flat line until then. */
function useScopeTexture() {
  const { cv, tex } = useMemo(() => {
    const cv = document.createElement('canvas'); cv.width = PW; cv.height = Math.round(PW * 1.2 / 1.555);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; return { cv, tex };
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  const acc = useRef(9);
  useFrame(({ clock, camera }, dt) => {
    acc.current += dt;
    const q = useGame.getState();
    if (acc.current < (q.settings.quality === 'low' ? 0.2 : 0.1) || camera.position.distanceTo(new THREE.Vector3(DESK.x, 1, DESK.z)) > 7) return;
    acc.current = 0;
    const g = cv.getContext('2d')!, cur = nextLevel(q.completed), t = clock.elapsedTime;
    if (hasSet(q.collected, q.completed, cur)) drawPreview(g, cur - 1, t);
    else {
      const H = cv.height; g.fillStyle = '#031208'; g.fillRect(0, 0, PW, H);
      g.strokeStyle = '#3f9a5c'; g.lineWidth = 2; g.beginPath();
      for (let k = 0; k <= 64; k++) { const y = H / 2 + (Math.random() - 0.5) * 6; k ? g.lineTo(k * 4, y) : g.moveTo(0, y); }
      g.stroke(); g.fillStyle = '#3f9a5c'; g.font = '11px monospace'; g.fillText('NO INPUT', 8, 6);
    }
    tex.needsUpdate = true;
  });
  return tex;
}

function Terminal() {
  const { scene } = useGLTF(TERM);
  const o = useMemo(() => { const s = scene.clone(true); s.traverse((m) => { m.castShadow = true; }); return s; }, [scene]);
  const tex = useMonitorTexture();
  const u = useMemo(() => ({ aim: 'monitor' }), []);
  return (
    <group position={[0, TOP, TERM_Z]} scale={TERM_S} userData={u}>
      <group position-z={-0.1}>
        <primitive object={o} />
        <mesh position={[0.0025, 0.371, 0.2]}><planeGeometry args={[0.33, 0.29]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
      </group>
    </group>
  );
}

function Scope() {
  const { scene } = useGLTF(SCOPE);
  const o = useMemo(() => {
    const s = scene.clone(true); // tint the modern orange casing to an aged olive enamel
    s.traverse((m) => { const mesh = m as THREE.Mesh; if (mesh.isMesh) { mesh.material = (mesh.material as THREE.MeshStandardMaterial).clone(); (mesh.material as THREE.MeshStandardMaterial).color.set('#8f9a78'); } });
    return s;
  }, [scene]);
  const tex = useScopeTexture();
  return (
    <group position={[0.98, TOP, -0.08]} rotation-y={-0.35} scale={0.22} rotation-x={-0.25}>
      <group position={[-0.0125, 1.9, -0.343]}>
        <primitive object={o} />
        <mesh position={[0.0125, 0.93, 0.35]}><planeGeometry args={[1.555, 1.2]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
      </group>
    </group>
  );
}

function BankersLamp() {
  return (
    <group position={[-1.0, TOP, -0.14]} rotation-y={0.3}>
      <Prop model="desk-lamp" scale={1.1} />
      <pointLight position={[0, 0.36, 0.06]} color="#ffcf8a" intensity={1.8} distance={2.6} decay={2} />
    </group>
  );
}

/** A part resting in the case; on its first mount after a pickup it flies there from the room. */
function DeskPart({ id, at }: { id: string; at: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  const fly = useRef<{ t: number; from: THREE.Vector3 } | null>(null);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    if (flying.has(id) && !fly.current && g.parent) {
      flying.delete(id);
      g.parent.updateWorldMatrix(true, false);
      fly.current = { t: 0, from: g.parent.worldToLocal(new THREE.Vector3(...SPOTS[id]).setY(SPOTS[id][1] + 0.1)) };
    }
    const f = fly.current;
    if (!f) return;
    f.t = Math.min(1, f.t + dt / 1.5);
    const e = f.t * f.t * (3 - 2 * f.t);
    g.position.lerpVectors(f.from, new THREE.Vector3(...at), e);
    g.position.y += Math.sin(e * Math.PI) * 0.9;
    g.rotation.y = (1 - e) * Math.PI * 3;
    g.scale.setScalar(THREE.MathUtils.lerp(PICK_SCALE, PART_S, e));
    if (f.t >= 1) fly.current = null;
  });
  return <group ref={ref} position={at} scale={PART_S}><ComponentModel id={id} /></group>;
}

/** Ten felt-lined compartments with brass numerals, one per experiment. Front row I-V, back row VI-X. */
function PartsCase({ collected, completed }: { collected: string[]; completed: number[] }) {
  const plates = useMemo(() => Array.from({ length: LEVEL_COUNT }, (_, k) => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 32;
    const g = c.getContext('2d')!; g.fillStyle = '#c99a45'; g.fillRect(0, 0, 64, 32);
    g.fillStyle = '#2a1a0a'; g.font = 'bold 20px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(roman(k + 1), 32, 17);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }), []);
  const CW = 0.52, CD = 0.165, x0 = -1.04;
  return (
    <group position-y={TOP}>
      <mesh material={walnut} position={[0, 0.006, 0.37]} castShadow receiveShadow>{box(2.66, 0.012, 0.34)}</mesh>
      {Array.from({ length: LEVEL_COUNT }, (_, k) => {
        const row = k < 5 ? 1 : 0, x = x0 + (k % 5) * CW, z = 0.29 + row * 0.165, lvl = k + 1, set = FETCH[lvl] ?? [];
        return (
          <group key={k} position={[x, 0.012, z]}>
            <mesh material={felt} position-y={0.002} receiveShadow>{box(CW - 0.03, 0.004, CD - 0.02)}</mesh>
            <mesh position={[-CW / 2 + 0.055, 0.022, CD / 2 - 0.004]} rotation-x={-0.5}>{box(0.07, 0.03, 0.004)}<meshStandardMaterial map={plates[k]} metalness={0.8} roughness={0.35} /></mesh>
            {set.map((f, j) => (collected.includes(f.id) || completed.includes(lvl)) && (
              <DeskPart key={f.id} id={f.id} at={[(j - (set.length - 1) / 2) * 0.15 + 0.03, 0.004, -0.01]} />
            ))}
          </group>
        );
      })}
      {/* dividers */}
      {[0, 1, 2, 3, 4, 5].map((k) => <mesh key={`v${k}`} material={walnut} position={[x0 - CW / 2 + k * CW, 0.022, 0.37]}>{box(0.016, 0.032, 0.34)}</mesh>)}
      {[0.207, 0.372, 0.537].map((z) => <mesh key={`h${z}`} material={walnut} position={[0, 0.022, z]}>{box(2.62, 0.032, 0.016)}</mesh>)}
      <mesh material={M.gold} position={[0, 0.04, 0.545]}>{box(2.64, 0.005, 0.006)}</mesh>
    </group>
  );
}

function Riser({ x, wood }: { x: number; wood: THREE.Material }) {
  return (
    <group position={[x, TOP, -0.43]}>
      <mesh material={wood} position-y={0.17} castShadow receiveShadow>{box(0.72, 0.34, 0.22)}</mesh>
      <mesh material={walnut} position={[0, 0.17, 0.06]}>{box(0.66, 0.29, 0.12)}</mesh>
      {[-0.11, 0.11].map((dx) => <mesh key={dx} material={wood} position={[dx, 0.17, 0.06]}>{box(0.016, 0.3, 0.12)}</mesh>)}
      {[0, 1, 2, 3].map((k) => <mesh key={k} material={paper} position={[-0.22, 0.04 + k * 0.012, 0.06]} rotation-y={k * 0.04}>{box(0.18, 0.008, 0.1)}</mesh>)}
      {[0, 1, 2, 3, 4].map((k) => <mesh key={k} material={BOOK[k]} position={[0.01 + k * 0.035 - 0.07, 0.13, 0.06]} rotation-z={k === 4 ? 0.2 : 0}>{box(0.03, 0.22 - (k % 2) * 0.03, 0.1)}</mesh>)}
      <mesh material={M.gold} position={[0.22, 0.06, 0.07]}><cylinderGeometry args={[0.035, 0.04, 0.06, 16]} /></mesh>
      <mesh material={M.gold} position-y={0.36}>{box(0.74, 0.012, 0.24)}</mesh>
      <Prop model="book-stack" position={[0.12, 0.366, 0]} rotation-y={x < 0 ? 0.4 : -0.3} scale={0.85} />
    </group>
  );
}

export function Desk() {
  const wood = useWood();
  const { collected, completed } = useGame();
  const drawerOpen = useGame((s) => waiting(s).some((w) => w.id === 'l9-fit-kit'));
  const u = useMemo(() => ({ aim: 'desk' }), []);
  return (
    <group position={[DESK.x, 0, DESK.z]} rotation-y={DESK.yaw} userData={u}>
      {/* carcass: two drawer pedestals, a modesty panel, the top with a moulded edge and a tooled leather inset */}
      <Pedestal x={-HW + 0.35} wood={wood} open={drawerOpen ? 0.3 : 0.03} />
      <Pedestal x={HW - 0.35} wood={wood} open={0} />
      <mesh material={wood} position={[0, 0.45, -HD + 0.08]} receiveShadow>{box(DESK.w - 1.3, 0.6, 0.03)}</mesh>
      <mesh material={wood} position={[0, 0.7, 0.45]}>{box(DESK.w - 1.3, 0.1, 0.03)}</mesh>
      <mesh material={wood} position-y={TOP - 0.03} castShadow receiveShadow>{box(DESK.w, 0.06, DESK.d)}</mesh>
      <mesh material={walnut} position={[0, TOP - 0.03, HD]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.032, 0.032, DESK.w, 12]} /></mesh>
      <mesh material={leather} position-y={TOP + 0.001} receiveShadow>{box(DESK.w - 0.24, 0.002, DESK.d - 0.2)}</mesh>
      {[[0, HD - 0.12, DESK.w - 0.28, 0.006], [0, -HD + 0.12, DESK.w - 0.28, 0.006], [HW - 0.14, 0, 0.006, DESK.d - 0.24], [-HW + 0.14, 0, 0.006, DESK.d - 0.24]].map(([x, z, w, d], k) =>
        <mesh key={k} material={M.gold} position={[x, TOP + 0.003, z]}>{box(w, 0.001, d)}</mesh>)}
      <Riser x={-HW + 0.38} wood={wood} />
      <Riser x={HW - 0.38} wood={wood} />
      <BankersLamp />
      <Suspense fallback={null}><Terminal /><Scope /></Suspense>
      <PartsCase collected={collected} completed={completed} />
      {/* a few things a physicist leaves lying about */}
      <group position={[-0.72, TOP, 0.04]} rotation-y={0.3}>
        <mesh material={paper} position-y={0.006}>{box(0.2, 0.01, 0.28)}</mesh>
        <mesh material={M.dark} position={[0.05, 0.013, 0.02]} rotation-y={0.6} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.004, 0.004, 0.16, 6]} /></mesh>
      </group>
      <group position={[0.68, TOP, 0.0]}>
        <mesh material={M.pcb} position-y={0.04}><cylinderGeometry args={[0.04, 0.035, 0.08, 20]} /></mesh>
        <mesh material={M.pcb} position={[0.045, 0.045, 0]} rotation-x={Math.PI / 2}><torusGeometry args={[0.022, 0.006, 6, 16]} /></mesh>
      </group>
      <Piece n="chair" position={[-1.1, 0, 1.0]} rotation-y={Math.PI + 0.6} />
    </group>
  );
}

useGLTF.preload(TERM); useGLTF.preload(SCOPE);
