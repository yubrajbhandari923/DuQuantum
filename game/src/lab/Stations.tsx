import { forwardRef, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { MeshProps, GroupProps } from '@react-three/fiber';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { Suspense } from 'react';
import { coherentPn, fockEnergy, stabilizerRate, rk4, wignerCat, wignerCoherent } from '../physics/quantum';
import { drive, GROUND, ramseyP1 } from '../physics/twoLevel';
import { alphaSqUnderPairLoss, gammaX, gammaZ, BASE } from '../physics/errors';
import { contrast, noiseSigma } from '../physics/readout';

export type State = 'locked' | 'open' | 'done';
type Quality = 'low' | 'high';
const GREEN = '#7dff9a', AMBER = '#ffb347', WARM = '#ffe9c4';
const stateColor: Record<State, string> = { locked: '#6a1e16', open: '#5cff7a', done: AMBER };
const SCOPE = '/models/vintage/oscilloscope.glb', TERM = '/models/vintage/terminal.glb';
const DONE_T = 2.2; // frozen time for a completed station's "best result"

// ---------- shared geometry / materials (one instance each, never disposed) ----------
const gc = new Map<string, THREE.BufferGeometry>();
const geo = <T extends THREE.BufferGeometry>(k: string, f: () => T) => (gc.get(k) ?? (gc.set(k, f()), gc.get(k))) as T;
const bx = (w: number, h: number, d: number) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cy = (rt: number, rb: number, h: number, s = 24) => geo(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const tor = (r: number, t: number, s = 32) => geo(`t${r},${t},${s}`, () => new THREE.TorusGeometry(r, t, 8, s));
const sph = (r: number, s = 12) => geo(`s${r},${s}`, () => new THREE.SphereGeometry(r, s, s));

const M = {
  alu: new THREE.MeshStandardMaterial({ color: '#b8893e', metalness: 1, roughness: 0.32 }), // brass (name kept for the shared parts)
  dark: new THREE.MeshStandardMaterial({ color: '#1c120d', metalness: 0.1, roughness: 0.4 }), // bakelite
  green: new THREE.MeshStandardMaterial({ color: '#244235', metalness: 0.2, roughness: 0.45 }), // enamel case
  cream: new THREE.MeshStandardMaterial({ color: '#cfc4a0', metalness: 0.1, roughness: 0.55 }),
  walnut: new THREE.MeshStandardMaterial({ color: '#6e4424', metalness: 0, roughness: 0.5 }),
  ivory: new THREE.MeshStandardMaterial({ color: '#e8dcb8', metalness: 0, roughness: 0.5 }),
  copper: new THREE.MeshStandardMaterial({ color: '#c8793e', metalness: 0.9, roughness: 0.3 }),
  gold: new THREE.MeshStandardMaterial({ color: '#d9ad55', metalness: 1, roughness: 0.25 }),
  rubber: new THREE.MeshStandardMaterial({ color: '#120c08', metalness: 0, roughness: 0.35 }), // black bakelite knobs
  glass: new THREE.MeshPhysicalMaterial({ color: '#d8ead8', transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false }),
  coax: new THREE.MeshStandardMaterial({ color: '#3a2a18', metalness: 0, roughness: 1 }), // cloth-covered lead
};
const basic = (c: string, o = 1) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, transparent: o < 1, opacity: o, blending: o < 1 ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: o >= 1 });
const holoMat: Record<State, THREE.MeshBasicMaterial> = { locked: basic('#000'), open: basic(GREEN, 0.85), done: basic(AMBER, 0.85) };
const holoAlt = basic(WARM, 0.85);
const stateMat: Record<State, THREE.MeshBasicMaterial> = { locked: basic(stateColor.locked), open: basic(stateColor.open), done: basic(stateColor.done) };

type PartProps = Omit<MeshProps, 'geometry' | 'material'> & { g: THREE.BufferGeometry; m: THREE.Material; u: { station: number } };
const Part = forwardRef<THREE.Mesh, PartProps>(({ g, m, u, ...r }, ref) => <mesh ref={ref} geometry={g} material={m} userData={u} {...r} />);
type U = { u: { station: number } };

// ---------- reusable instruments ----------
function Coax({ pts, u }: { pts: [number, number, number][]; u: U['u'] }) {
  const g = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 24, 0.008, 6), [pts]);
  return <Part g={g} m={M.coax} u={u} />;
}
const Knob = ({ u, ...r }: U & GroupProps) => (
  <group userData={u} {...r}>
    <Part g={cy(0.03, 0.032, 0.008, 20)} m={M.alu} u={u} rotation-x={Math.PI / 2} />
    <Part g={cy(0.022, 0.027, 0.034, 16)} m={M.rubber} u={u} rotation-x={Math.PI / 2} position-z={0.02} />
    <Part g={bx(0.004, 0.02, 0.004)} m={M.ivory} u={u} position={[0, 0.012, 0.038]} />
  </group>
);
const Lamp = ({ u, mat, ...r }: U & { mat: THREE.Material } & Omit<MeshProps, 'geometry' | 'material'>) => <Part g={sph(0.012, 8)} m={mat} u={u} {...r} />;
/** Josephson / SQUID chip: die with a copper loop and two junction pads. */
const Chip = ({ u, ...r }: U & GroupProps) => (
  <group userData={u} {...r}>
    <Part g={bx(0.12, 0.012, 0.12)} m={M.dark} u={u} />
    <Part g={tor(0.03, 0.004)} m={M.copper} u={u} position-y={0.008} rotation-x={Math.PI / 2} />
    <Part g={bx(0.012, 0.004, 0.012)} m={M.gold} u={u} position={[-0.03, 0.01, 0]} />
    <Part g={bx(0.012, 0.004, 0.012)} m={M.gold} u={u} position={[0.03, 0.01, 0]} />
    <Part g={bx(0.1, 0.002, 0.012)} m={M.gold} u={u} position={[0, 0.008, 0.045]} />
  </group>
);
/** Cryostat can: aluminium shell, flanges, stacked gold plates visible through a glass band. */
const Cryo = ({ u, h = 0.34, ...r }: U & { h?: number } & GroupProps) => (
  <group userData={u} {...r}>
    <Part g={cy(0.13, 0.13, h)} m={M.alu} u={u} position-y={h / 2} />
    <Part g={cy(0.145, 0.145, 0.02)} m={M.alu} u={u} position-y={h} />
    <Part g={cy(0.145, 0.145, 0.02)} m={M.alu} u={u} position-y={0.01} />
    <Part g={cy(0.133, 0.133, 0.1)} m={M.glass} u={u} position-y={h * 0.55} />
    {[0, 1, 2].map((k) => <Part key={k} g={cy(0.09 - k * 0.02, 0.09 - k * 0.02, 0.008)} m={M.gold} u={u} position-y={h * 0.55 + 0.03 - k * 0.03} />)}
    <Part g={cy(0.02, 0.02, 0.1)} m={M.alu} u={u} position-y={h + 0.07} />
  </group>
);
const Cavity = ({ u, ...r }: U & GroupProps) => (
  <group userData={u} {...r}>
    <Part g={cy(0.065, 0.065, 0.3)} m={M.alu} u={u} position-y={0.15} />
    <Part g={cy(0.075, 0.075, 0.02)} m={M.alu} u={u} position-y={0.31} />
    <Part g={cy(0.068, 0.068, 0.07)} m={M.glass} u={u} position-y={0.17} />
    <Part g={cy(0.012, 0.012, 0.08)} m={M.gold} u={u} position={[0.03, 0.34, 0]} />
  </group>
);

// ---------- live-screen drawing, all from the real physics ----------
const W = 256;
let H = 160; // set to the canvas height before each draw (screens have different aspect ratios)
const hm = typeof document !== 'undefined' ? document.createElement('canvas') : (null as unknown as HTMLCanvasElement);
if (hm) { hm.width = 48; hm.height = 30; }
type G2 = CanvasRenderingContext2D;
let HP = [110, 255, 140], HN = [255, 140, 60]; // heat-map colours: positive / negative Wigner lobes
function heat(g: G2, f: (x: number, y: number) => number, reveal = 1, x0 = 0, y0 = 14, w = W, h = H - 14) {
  const gh = hm.getContext('2d')!, img = gh.createImageData(48, 30);
  for (let j = 0; j < 30; j++) for (let k = 0; k < 48; k++) {
    if (k / 48 > reveal) continue;
    const v = f(((k + 0.5) / 48 - 0.5) * 6, ((j + 0.5) / 30 - 0.5) * 3.75) * Math.PI / 2; // normalised to peak 1
    const o = (j * 48 + k) * 4, a = Math.min(1, Math.abs(v));
    const c = v > 0 ? HP : HN; img.data[o] = c[0] * a; img.data[o + 1] = c[1] * a; img.data[o + 2] = c[2] * a; img.data[o + 3] = 255;
  }
  gh.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true; g.drawImage(hm, x0, y0, w, h);
}
function plot(g: G2, f: (u: number) => number, col: string, lo = -1, hi = 1, y0 = 18, h = H - 36, n = 96, w = W - 16) {
  g.strokeStyle = col; g.lineWidth = 2; g.beginPath();
  for (let k = 0; k <= n; k++) { const u = k / n, y = y0 + h * (1 - (f(u) - lo) / (hi - lo)); k ? g.lineTo(8 + u * w, y) : g.moveTo(8, y); }
  g.stroke();
}
function bars(g: G2, v: number[], col: string, y1 = H - 10, hh = 100) {
  const bw = (W - 16) / v.length;
  g.fillStyle = col; v.forEach((a, k) => g.fillRect(8 + k * bw + 1, y1 - a * hh, bw - 2, a * hh));
}
function grid(g: G2) {
  g.strokeStyle = 'rgba(77,224,220,0.12)'; g.lineWidth = 1;
  for (let x = 8; x < W; x += 30) { g.beginPath(); g.moveTo(x, 14); g.lineTo(x, H - 6); g.stroke(); }
  for (let y = 14; y < H; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
}
const stabCurves = [0.15, 0.6, 3.2].map((x0) => Array.from({ length: 64 }, (_, k) => rk4(stabilizerRate(1.2, 1.8), x0, 0.05, k)));
const stabAt = (x0i: number, t: number) => stabCurves[x0i][Math.min(63, Math.floor(((t * 0.35) % 1) * 64))];
const poisson = (a2: number, n = 14) => Array.from({ length: n }, (_, k) => coherentPn(k, a2) * 2.2);

const DRAW: ((g: G2, t: number, tint: string) => void)[] = [
  (g, t, c) => { grid(g); plot(g, (u) => Math.exp(-u * 1.6) * Math.cos(u * 26 - t * 6), c, -1.1, 1.1); plot(g, (u) => Math.exp(-u * 1.6), WARM, -1.1, 1.1); },
  (g, t, c) => { grid(g); const ph = (t * 1.1) % (4 * Math.PI); plot(g, (u) => ramseyP1(u * 4 * Math.PI), c, 0, 1); g.fillStyle = AMBER; g.beginPath(); g.arc(8 + (ph / (4 * Math.PI)) * (W - 16), 18 + (H - 36) * (1 - ramseyP1(ph)), 4, 0, 7); g.fill(); },
  (g, t) => heat(g, (x, y) => wignerCoherent(x, y - 1.5 * Math.sin(t * 1.3), 1.5 * Math.cos(t * 1.3))),
  (g, t) => heat(g, (x, y) => wignerCat(x, y, 1.8, 'even', 0.7 + 0.3 * Math.sin(t * 0.9))),
  (g, t) => { const r = (t * 0.35) % 1.2; heat(g, (x, y) => wignerCat(x, y, 1.2, 'odd'), Math.min(1, r)); g.fillStyle = GREEN; g.fillRect(Math.min(1, r) * W, 14, 2, H - 14); },
  (g, t, c) => { const tt = (t * 0.8) % 6, a2 = alphaSqUnderPairLoss(4.41, 0.25, tt); plot(g, (u) => alphaSqUnderPairLoss(4.41, 0.25, u * 6) / 4.41, c, 0, 1.05, 18, 60); g.fillStyle = AMBER; g.beginPath(); g.arc(8 + (tt / 6) * (W - 16), 18 + 60 * (1 - a2 / 4.41 / 1.05), 4, 0, 7); g.fill(); bars(g, poisson(a2), WARM, H - 8, 70); },
  (g, t, c) => { grid(g); [WARM, c, AMBER].forEach((col, k) => plot(g, (u) => stabCurves[k][Math.floor(u * 63)], col, 0, 3.4)); g.fillStyle = '#fff'; g.fillRect(8 + (((t * 0.35) % 1) * (W - 16)), 14, 1, H - 20); },
  (g, t, c) => { grid(g); plot(g, (u) => Math.cos(u * 12 + t * 2) ** 2, c, 0, 1); plot(g, (u) => Math.sin(u * 12 + t * 2) ** 2, AMBER, 0, 1); },
  (g, t, c) => { const a = 0.8 + ((t * 0.25) % 1) * 2.2; grid(g); plot(g, (u) => Math.log10(gammaX(0.8 + u * 2.2)), c, -3, 7); plot(g, (u) => Math.log10(gammaZ(BASE.kappaA, 0.8 + u * 2.2)), AMBER, -3, 7); g.fillStyle = '#fff'; g.fillRect(8 + ((a - 0.8) / 2.2) * (W - 16), 14, 1, H - 20); },
  (g, t, c) => { const s = noiseSigma(3, 'shaped'), m = contrast(2, 2.1) / 2; grid(g); const gz = (x: number, mu: number) => Math.exp(-((x - mu) ** 2) / (2 * s * s)); plot(g, (u) => gz(u * 8 - 4, -m) + 0.02 * Math.sin(u * 40 + t * 9), WARM, 0, 1.2); plot(g, (u) => gz(u * 8 - 4, m) + 0.02 * Math.sin(u * 40 - t * 9), c, 0, 1.2); },
];
const TAGS = ['LC  f(t)', 'RAMSEY  P1(phi)', 'W(b)  COHERENT', 'W(b)  CAT +', 'TOMOGRAPHY', 'PAIR LOSS  a^2(t)', 'x(t) -> alpha', 'MEMORY / BUFFER', 'log Gamma vs alpha', 'READOUT  I/Q'];

function useNear(x: number, z: number, r = 8) {
  const near = useRef(false);
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    camera.getWorldDirection(v);
    const dx = x - camera.position.x, dz = z - camera.position.z, d = Math.hypot(dx, dz);
    near.current = d < r && (d < 1.5 || (dx * v.x + dz * v.z) / d > -0.2);
  });
  return near;
}

function Screen({ i, state, quality, near, u, w = 0.5, h = 0.3125, z = 0.0505 }: { i: number; state: State; quality: Quality; near: React.MutableRefObject<boolean>; u: U['u']; w?: number; h?: number; z?: number }) {
  const { tex, g } = useMemo(() => {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = Math.round((W * h) / w);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    return { tex: t, g: cv.getContext('2d')! };
  }, []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), [tex]);
  useEffect(() => () => { tex.dispose(); mat.dispose(); }, [tex, mat]);
  const acc = useRef(0), drawn = useRef('');
  useFrame(({ clock }, dt) => {
    acc.current += dt;
    if (acc.current < (quality === 'low' ? 0.2 : 0.1)) return;
    if (state !== 'open' && drawn.current === state) return;
    if (state === 'open' && !near.current) return;
    acc.current = 0; drawn.current = state; H = g.canvas.height; [HP, HN] = state === 'done' ? [[255, 184, 80], [255, 240, 210]] : [[110, 255, 140], [255, 140, 60]];
    g.fillStyle = state === 'locked' ? '#0a0605' : '#031208'; g.fillRect(0, 0, W, H);
    g.font = '11px monospace'; g.textBaseline = 'top';
    if (state === 'locked') { g.fillStyle = '#6a1e16'; g.fillText('STANDBY', 10, 10); g.fillRect(10, 26, 54, 1); }
    else {
      DRAW[i](g, state === 'done' ? DONE_T : clock.elapsedTime, state === 'done' ? AMBER : GREEN);
      g.fillStyle = 'rgba(3,18,8,0.7)'; g.fillRect(0, 0, W, 14); g.fillStyle = state === 'done' ? AMBER : GREEN; g.fillText(TAGS[i] + (state === 'done' ? '  [HOLD]' : ''), 6, 1);
    }
    if (state !== 'locked') { g.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1); } // phosphor scanlines
    tex.needsUpdate = true;
  });
  return <Part g={geo(`p${w},${h}`, () => new THREE.PlaneGeometry(w, h))} m={mat} u={u} position={[0, 0, z]} />;
}

// ---------- holograms (cheap lines / spheres / points driven by the real functions) ----------
const SPR = 0.17;
const BAR = new THREE.BoxGeometry(0.04, 1, 0.04).translate(0, 0.5, 0);

function Holo({ i, state, near, u }: { i: number; state: State; near: React.MutableRefObject<boolean>; u: U['u'] }) {
  const root = useRef<THREE.Group>(null);
  const a = useRef<THREE.Object3D>(null), b = useRef<THREE.Object3D>(null), pts = useRef<THREE.Points>(null), bar = useRef<THREE.Group>(null);
  const pg = useMemo(() => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(15 * 15 * 3), 3)); return g;
  }, []);
  const ptsMat = useMemo(() => new THREE.PointsMaterial({ color: GREEN, size: 0.012, toneMapped: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), []);
  const acc = useRef(0);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const Y = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const vv = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }, dt) => {
    if (!root.current) return;
    root.current.visible = state !== 'locked';
    if (state === 'locked' || !near.current) return;
    if (state === 'done' && acc.current > 0 && i !== 4) return;
    const t = state === 'done' ? DONE_T : clock.elapsedTime;
    acc.current += dt;
    const A = a.current, B = b.current;
    if (i === 0 && A) { const n = Math.floor(t * 1.5) % 6, f = (t * 1.5) % 1; A.position.y = 0.07 * fockEnergy(n, 1) + 0.06 * Math.sin(f * Math.PI); }
    if (i === 1 && A) { const v = drive(GROUND, 1, 0.5, 0, t * 0.9); vv.set(v[0], v[2], -v[1]); A.quaternion.copy(q.setFromUnitVectors(Y, vv)); }
    if (i === 2 && A && B) { const x = 1.5 * Math.cos(t * 1.3), y = 1.5 * Math.sin(t * 1.3); A.position.set(x * 0.08, 0, -y * 0.08); B.position.copy(A.position); }
    if (i === 3 && A && B) { const s = 1 + 0.05 * Math.sin(t * 3); A.scale.setScalar(s); B.scale.setScalar(2 - s); }
    if (i === 5 && A && B) { const al = Math.sqrt(alphaSqUnderPairLoss(4.41, 0.25, (t * 0.8) % 6)); A.position.x = -al * 0.05; B.position.x = al * 0.05; }
    if (i === 6 && A) A.position.x = stabAt(1, t) * 0.07 - 0.1;
    if (i === 7 && A && B) { A.scale.setScalar(0.5 + Math.cos(t * 1.5) ** 2); B.scale.setScalar(0.5 + Math.sin(t * 1.5) ** 2); }
    if (i === 8 && A && B) { A.scale.y = 0.3; B.scale.y = 0.04 + 0.08 * Math.abs(Math.sin(t * 17)); } // bit flip: long-lived; phase flip: flickers
    if (i === 9 && bar.current) bar.current.children.forEach((c, k) => { c.scale.y = 0.02 + 2 * coherentPn(k, 4) * (1 + 0.15 * Math.sin(t * 5 + k)); });
    if (i === 4 && pts.current && acc.current > 0.1) { // Wigner surface of a cat as a point cloud
      acc.current = 0.0001;
      const p = pg.attributes.position as THREE.BufferAttribute;
      for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) {
        const x = (c / 14 - 0.5) * 4, y = (r / 14 - 0.5) * 3, w = wignerCat(x, y, 1.4, 'odd', 0.8 + 0.2 * Math.sin(t));
        p.setXYZ(r * 15 + c, x * 0.07, w * 0.28, y * 0.07);
      }
      p.needsUpdate = true;
    }
  });
  const hm = holoMat[state];
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { if (ring.current) ring.current.rotation.z = clock.elapsedTime * (state === 'open' ? 0.9 : 0.25); });
  const lvl = [0, 1, 2, 3, 4, 5];
  return (
    <group ref={root} position={[i === 9 ? 0.4 : 0.3, 1.5, -0.05]} userData={u}>
      <Part g={tor(0.22, 0.006, 40)} m={stateMat[state]} u={u} position-y={-0.2} rotation-x={Math.PI / 2} />
      <mesh ref={ring} userData={u} geometry={tor(0.2, 0.004, 40)} material={stateMat[state]} position-y={-0.2} rotation-x={Math.PI / 2} />
      {i === 0 && <>{lvl.map((n) => <Part key={n} g={bx(0.28, 0.006, 0.006)} m={hm} u={u} position-y={0.07 * fockEnergy(n, 1) - 0.2} />)}<group position-y={-0.2}><Part ref={a as never} g={sph(0.02)} m={holoAlt} u={u} /></group></>}
      {i === 1 && <><mesh userData={u} geometry={sph(SPR, 14)}><meshBasicMaterial wireframe color={state === 'done' ? AMBER : GREEN} toneMapped={false} transparent opacity={0.35} /></mesh>
        <group ref={a as never}><Part g={cy(0.006, 0.006, SPR)} m={holoAlt} u={u} position-y={SPR / 2} /><Part g={sph(0.022)} m={holoAlt} u={u} position-y={SPR} /></group></>}
      {i === 2 && <><Part g={tor(0.12, 0.003, 40)} m={hm} u={u} rotation-x={Math.PI / 2} /><Part ref={b as never} g={sph(0.04)} m={hm} u={u} /><Part ref={a as never} g={sph(0.02)} m={holoAlt} u={u} /></>}
      {i === 3 && <><group position-x={-0.1}><Part ref={a as never} g={sph(0.045)} m={hm} u={u} /></group><group position-x={0.1}><Part ref={b as never} g={sph(0.045)} m={hm} u={u} /></group>
        {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((k) => <Part key={k} g={sph(0.012 + 0.006 * Math.abs(Math.cos(k * 0.8)), 6)} m={k % 2 ? holoAlt : hm} u={u} position-z={k * 0.022} />)}</>}
      {i === 4 && <points ref={pts} geometry={pg} material={ptsMat} userData={u} />}
      {i === 5 && <><group ref={a as never}><Part g={sph(0.04)} m={hm} u={u} /></group><group ref={b as never}><Part g={sph(0.04)} m={hm} u={u} /></group></>}
      {i === 6 && <><Part g={bx(0.28, 0.004, 0.004)} m={hm} u={u} position-y={-0.1} /><Part g={sph(0.012)} m={holoAlt} u={u} position={[-0.1, -0.1, 0]} /><Part g={sph(0.012)} m={holoAlt} u={u} position={[0.1, -0.1, 0]} /><group position-y={-0.06}><Part ref={a as never} g={sph(0.03)} m={hm} u={u} /></group></>}
      {i === 7 && <><group position-x={-0.1}><Part ref={a as never} g={sph(0.05)} m={hm} u={u} /></group><group position-x={0.1}><Part ref={b as never} g={sph(0.05)} m={holoAlt} u={u} /></group><Part g={bx(0.2, 0.003, 0.003)} m={hm} u={u} /></>}
      {i === 8 && <><group position-x={-0.05}><Part ref={a as never} g={BAR} m={hm} u={u} /></group><group position-x={0.05}><Part ref={b as never} g={BAR} m={holoAlt} u={u} /></group></>}
      {i === 9 && <group ref={bar} position={[-0.14, -0.2, 0]}>{Array.from({ length: 12 }, (_, k) => <Part key={k} g={BAR} scale-x={0.5} scale-z={0.5} m={k % 2 ? hm : holoAlt} u={u} position-x={k * 0.025} />)}</group>}
    </group>
  );
}

// ---------- real models (oscilloscope, terminal) with our live texture over their screen ----------
type GCfg = { p: [number, number, number]; s: number; off: [number, number, number]; sp: [number, number, number]; sw: number; sh: number };
function Gadget({ url, i, state, quality, near, u, cfg }: { url: string; i: number; state: State; quality: Quality; near: React.MutableRefObject<boolean>; u: U['u']; cfg: GCfg }) {
  const { scene } = useGLTF(url);
  const o = useMemo(() => scene.clone(true), [scene]);
  return (
    <group position={cfg.p} scale={cfg.s} rotation-x={-0.2} userData={u}>
      <group position={cfg.off} userData={u}>
        <primitive object={o} userData={u} />
        <group position={cfg.sp}><Screen i={i} state={state} quality={quality} near={near} u={u} w={cfg.sw} h={cfg.sh} z={0} /></group>
      </group>
    </group>
  );
}
useGLTF.preload(SCOPE); useGLTF.preload(TERM);
const SCOPE_I = [0, 4, 9], TERM_I = [2, 8];

// ---------- the station ----------
export function Station({ i, state, pos, quality }: { i: number; state: State; pos: { x: number; z: number; rot: number }; quality: Quality }) {
  const u = useMemo(() => ({ station: i + 1 }), [i]);
  const near = useNear(pos.x, pos.z);
  const big = i === 9;
  const sm = stateMat[state];
  return (
    <group position={[pos.x, 0, pos.z]} rotation-y={pos.rot} userData={u}>
      {/* walnut cabinet with brass trim, cream enamel panel, bakelite knobs */}
      <Part g={bx(1.1, 0.7, 0.55)} m={M.walnut} u={u} position-y={0.37} />
      <Part g={bx(1.14, 0.03, 0.59)} m={M.walnut} u={u} position-y={0.735} />
      <Part g={bx(1.145, 0.008, 0.595)} m={M.alu} u={u} position-y={0.753} scale={[1, 0.5, 1]} />
      {[[-0.5, -0.22], [0.5, -0.22], [-0.5, 0.22], [0.5, 0.22]].map(([x, z], k) => <Part key={k} g={sph(0.035, 10)} m={M.alu} u={u} position={[x, 0.03, z]} scale={[1, 0.7, 1]} />)}
      <Part g={bx(1.0, 0.2, 0.012)} m={M.cream} u={u} position={[0, 0.5, 0.276]} />
      <Part g={bx(1.03, 0.012, 0.016)} m={M.alu} u={u} position={[0, 0.605, 0.278]} /><Part g={bx(1.03, 0.012, 0.016)} m={M.alu} u={u} position={[0, 0.395, 0.278]} />
      {[0, 1, 2, 3, 4].map((k) => <Part key={k} g={bx(0.22, 0.005, 0.004)} m={M.rubber} u={u} position={[-0.3, 0.44 + k * 0.016, 0.284]} />)}
      <Part g={bx(0.2, 0.05, 0.004)} m={M.alu} u={u} position={[-0.3, 0.56, 0.284]} />
      <Knob u={u} position={[0.12, 0.52, 0.29]} /><Knob u={u} position={[0.24, 0.52, 0.29]} rotation-z={0.8} /><Knob u={u} position={[0.36, 0.52, 0.29]} rotation-z={-0.6} />
      <Lamp u={u} mat={sm} position={[0.12, 0.44, 0.285]} /><Lamp u={u} mat={sm} position={[0.18, 0.44, 0.285]} />
      <Part g={tor(0.016, 0.004, 16)} m={M.alu} u={u} position={[0.12, 0.44, 0.283]} /><Part g={tor(0.016, 0.004, 16)} m={M.alu} u={u} position={[0.18, 0.44, 0.283]} />
      {SCOPE_I.includes(i) && <Suspense fallback={null}><Gadget url={SCOPE} i={i} state={state} quality={quality} near={near} u={u} cfg={i === 9 ? { p: [-0.1, 0.76, 0.05], s: 0.3, off: [-0.0125, 1.9, -0.343], sp: [0.0125, 0.93, 0.35], sw: 1.555, sh: 1.2 } : { p: [-0.25, 0.76, 0.05], s: 0.19, off: [-0.0125, 1.9, -0.343], sp: [0.0125, 0.93, 0.35], sw: 1.555, sh: 1.2 }} /></Suspense>}
      {TERM_I.includes(i) && <Suspense fallback={null}><Gadget url={TERM} i={i} state={state} quality={quality} near={near} u={u} cfg={{ p: [-0.22, 0.76, 0.02], s: 1, off: [0, 0, -0.1], sp: [0.0025, 0.371, 0.2], sw: 0.33, sh: 0.29 }} /></Suspense>}
      {!SCOPE_I.includes(i) && !TERM_I.includes(i) && (
        <group position={[-0.25, 0.75, 0.02]} rotation-x={-0.2} userData={u}>
          <Part g={bx(0.6, 0.42, 0.1)} m={M.dark} u={u} position-y={0.21} />
          <Part g={bx(0.44, 0.3, 0.2)} m={M.green} u={u} position={[0, 0.2, -0.12]} />
          {[[0, 0.385, 0.56, 0.03], [0, 0.045, 0.56, 0.03], [-0.275, 0.215, 0.03, 0.36], [0.275, 0.215, 0.03, 0.36]].map(([x, y, w, h], k) => <Part key={k} g={bx(w, h, 0.014)} m={M.alu} u={u} position={[x, y, 0.05]} />)}
          <Part g={bx(0.52, 0.34, 0.006)} m={M.rubber} u={u} position={[0, 0.215, 0.047]} />
          <group position-y={0.215}><Screen i={i} state={state} quality={quality} near={near} u={u} z={0.0505} /></group>
        </group>
      )}
      {/* themed module */}
      <group position={[big ? 0.4 : 0.3, 0.75, -0.08]} scale={1.25} userData={u}>
        {i === 0 && <>
          <Part g={cy(0.05, 0.05, 0.22)} m={M.alu} u={u} position={[0, 0.11, 0]} />
          <Part g={useCoil()} m={M.copper} u={u} position={[0, 0.12, 0]} />
          <Part g={cy(0.035, 0.035, 0.2)} m={M.alu} u={u} position={[0.16, 0.1, 0.06]} /><Part g={cy(0.036, 0.036, 0.04)} m={M.rubber} u={u} position={[0.16, 0.2, 0.06]} />
          <Part g={cy(0.035, 0.035, 0.2)} m={M.alu} u={u} position={[0.16, 0.1, -0.05]} /><Part g={cy(0.036, 0.036, 0.04)} m={M.rubber} u={u} position={[0.16, 0.2, -0.05]} />
          <Coax u={u} pts={COAX_LC} />
        </>}
        {i === 1 && <>
          <Part g={bx(0.3, 0.12, 0.2)} m={M.green} u={u} position={[0, 0.06, 0]} />
          {[-0.09, 0, 0.09].map((x) => <Part key={x} g={cy(0.014, 0.014, 0.03, 12)} m={M.gold} u={u} position={[x, 0.13, 0.05]} />)}
          <Chip u={u} position={[0, 0.126, -0.04]} scale={0.8} />
        </>}
        {i === 2 && <>
          <Part g={bx(0.28, 0.1, 0.2)} m={M.green} u={u} position={[0, 0.05, 0]} />
          <Part g={cy(0.1, 0.02, 0.2, 24)} m={M.alu} u={u} position={[0, 0.2, 0]} />
          <Part g={cy(0.01, 0.01, 0.1)} m={M.copper} u={u} position={[0, 0.12, 0]} />
          <Knob u={u} position={[0.1, 0.06, 0.105]} />
        </>}
        {i === 3 && <>
          <Part g={cy(0.14, 0.15, 0.04)} m={M.alu} u={u} position={[0, 0.02, 0]} />
          <Part g={cy(0.12, 0.12, 0.24)} m={M.glass} u={u} position={[0, 0.16, 0]} />
          <Part g={cy(0.04, 0.04, 0.012)} m={M.copper} u={u} position={[-0.06, 0.1, 0]} /><Part g={cy(0.04, 0.04, 0.012)} m={M.copper} u={u} position={[0.06, 0.1, 0]} />
          <Part g={cy(0.13, 0.13, 0.02)} m={M.alu} u={u} position={[0, 0.29, 0]} />
        </>}
        {i === 4 && <>
          <Part g={cy(0.1, 0.1, 0.1)} m={M.alu} u={u} position={[0, 0.05, 0]} />
          <Part g={cy(0.1, 0.1, 0.22, 24)} m={M.glass} u={u} position={[0, 0.21, 0]} />
          <Part g={cy(0.02, 0.1, 0.1)} m={M.dark} u={u} position={[0, 0.37, 0]} />
          <Part g={tor(0.1, 0.012)} m={M.gold} u={u} position={[0, 0.1, 0]} rotation-x={Math.PI / 2} />
          <Coax u={u} pts={COAX_W} />
        </>}
        {i === 5 && <>
          <Part g={bx(0.3, 0.14, 0.2)} m={M.green} u={u} position={[0, 0.07, 0]} />
          <Part g={cy(0.015, 0.015, 0.2)} m={M.copper} u={u} position={[-0.07, 0.24, 0]} /><Part g={cy(0.015, 0.015, 0.2)} m={M.copper} u={u} position={[0.07, 0.24, 0]} />
          {[0, 1, 2, 3].map((k) => <Part key={k} g={bx(0.2, 0.006, 0.004)} m={M.rubber} u={u} position={[0, 0.03 + k * 0.025, 0.101]} />)}
        </>}
        {i === 6 && <>
          <Cryo u={u} />
          <Coax u={u} pts={COAX_C} />
        </>}
        {i === 7 && <>
          <Cavity u={u} position={[-0.18, 0, 0]} /><Cavity u={u} position={[0.13, 0, 0]} />
          <Part g={bx(0.12, 0.12, 0.16)} m={M.dark} u={u} position={[-0.02, 0.06, -0.03]} />
          <Knob u={u} position={[-0.02, 0.08, 0.052]} />
          <Coax u={u} pts={COAX_M} />
        </>}
        {i === 8 && <>
          <Part g={bx(0.3, 0.06, 0.22)} m={M.dark} u={u} position={[0, 0.03, 0]} />
          <Chip u={u} position={[0, 0.07, 0]} scale={1.4} />
          {[-1, 1].map((s) => <Part key={s} g={cy(0.012, 0.012, 0.06, 10)} m={M.gold} u={u} position={[s * 0.13, 0.09, 0.08]} />)}
          <Coax u={u} pts={COAX_J} />
        </>}
        {i === 9 && <>
          <Part g={bx(0.2, 0.09, 0.18)} m={M.green} u={u} position={[0, 0.045, 0]} />
          <Part g={tor(0.07, 0.007)} m={M.copper} u={u} position={[0, 0.14, 0]} rotation-x={Math.PI / 2} />
          <Part g={cy(0.02, 0.02, 0.05)} m={M.dark} u={u} position={[0, 0.115, 0]} />
        </>}
      </group>
      <Holo i={i} state={state} near={near} u={u} />
      {state !== 'locked' && <pointLight position={[0, 1.9, 0.5]} color={stateColor[state]} intensity={0.9} distance={3} />}
    </group>
  );
}

const COAX_LC: [number, number, number][] = [[0.0, 0.23, 0], [0.05, 0.3, 0.05], [0.12, 0.28, 0.1], [0.16, 0.22, 0.06]];
const COAX_W: [number, number, number][] = [[0, 0.4, 0], [-0.1, 0.35, -0.1], [-0.25, 0.2, -0.05], [-0.4, 0.05, 0.1]];
const COAX_C: [number, number, number][] = [[0, 0.5, 0], [0.12, 0.45, 0.05], [0.2, 0.25, 0.05], [0.25, 0.02, 0.08]];
const COAX_M: [number, number, number][] = [[-0.15, 0.34, 0], [-0.05, 0.4, 0], [0.05, 0.4, 0], [0.16, 0.34, 0]];
const COAX_J: [number, number, number][] = [[-0.13, 0.12, 0.08], [-0.2, 0.14, 0.2], [-0.3, 0.05, 0.25], [-0.42, 0.0, 0.2]];

function useCoil() {
  return useMemo(() => geo('coil', () => {
    const pts = Array.from({ length: 80 }, (_, k) => { const a = (k / 80) * Math.PI * 2 * 7; return new THREE.Vector3(Math.cos(a) * 0.065, (k / 80 - 0.5) * 0.2, Math.sin(a) * 0.065); });
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.008, 6);
  }), []);
}
