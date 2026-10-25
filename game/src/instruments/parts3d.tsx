import { useMemo } from 'react';
import * as THREE from 'three';
import { C, type Tone } from '../styles/colors';
import type { Glyph } from './CircuitBench';

/** Shared PBR materials, built once, in a 1930s-50s lab palette: nickel, copper, brass, porcelain, bakelite, enamel, cloth. */
export const M = {
  alu: new THREE.MeshPhysicalMaterial({ color: '#a9a294', metalness: 1, roughness: 0.38, anisotropy: 0.6 }), // nickel plate
  dark: new THREE.MeshPhysicalMaterial({ color: '#2b1910', metalness: 0, roughness: 0.28, clearcoat: 0.8 }), // bakelite
  enamel: new THREE.MeshStandardMaterial({ color: '#34433a', metalness: 0.25, roughness: 0.55 }), // hammertone instrument case
  copper: new THREE.MeshStandardMaterial({ color: '#d0784a', metalness: 1, roughness: 0.28 }),
  gold: new THREE.MeshStandardMaterial({ color: '#c99a45', metalness: 1, roughness: 0.25 }), // brass
  pcb: new THREE.MeshPhysicalMaterial({ color: '#e4d9c2', metalness: 0, roughness: 0.35, clearcoat: 0.6 }), // porcelain base
  rubber: new THREE.MeshStandardMaterial({ color: '#5e412a', metalness: 0, roughness: 1 }), // cloth braid
  silicon: new THREE.MeshPhysicalMaterial({ color: '#4a4136', metalness: 0.4, roughness: 0.2, clearcoat: 1, iridescence: 0.5 }),
  ferrite: new THREE.MeshStandardMaterial({ color: '#2a2622', metalness: 0.2, roughness: 0.7 }),
  face: new THREE.MeshStandardMaterial({ color: '#efe6cf', metalness: 0, roughness: 0.5 }),
};
const glowCache: Partial<Record<Tone, THREE.MeshBasicMaterial>> = {};
/** Unlit tone-coloured material for LEDs, screens and junction dots. */
export const glow = (t: Tone) => (glowCache[t] ??= new THREE.MeshBasicMaterial({ color: C[t], toneMapped: false }));

const tube = (pts: THREE.Vector3[], r: number, seg = 64, closed = false) =>
  new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed, 'catmullrom', 0.2), seg, r, 8, closed);
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// Geometries are pure functions of the glyph, so build each once per page.
const geo = {
  helix: (() => {
    const n = 9, pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 360; i++) { const t = i / 360, a = t * n * Math.PI * 2; pts.push(v(-0.3 + 0.6 * t, 0.22 + 0.12 * Math.sin(a), 0.12 * Math.cos(a))); }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 900, 0.02, 8);
  })(),
  meander: (turns: number, w: number) => {
    const pts: THREE.Vector3[] = [v(-0.36, 0, 0)];
    for (let i = 0; i < turns; i++) { const x = -0.28 + (0.56 * i) / (turns - 1), s = i % 2 ? 1 : -1; pts.push(v(x, 0, -w * s), v(x + 0.28 / (turns - 1), 0, -w * s)); }
    pts.push(v(0.36, 0, 0));
    const path = new THREE.CurvePath<THREE.Vector3>();
    pts.slice(1).forEach((p, i) => path.add(new THREE.LineCurve3(pts[i], p)));
    return new THREE.TubeGeometry(path as unknown as THREE.Curve<THREE.Vector3>, 240, 0.014, 6);
  },
  coax: tube([v(-0.4, 0.05, 0.05), v(-0.2, 0.06, -0.18), v(0.05, 0.07, 0.12), v(0.2, 0.06, -0.15), v(0.4, 0.05, 0.05)], 0.035, 96),
  bond: (a: THREE.Vector3, b: THREE.Vector3) => new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, v((a.x + b.x) / 2, Math.max(a.y, b.y) + 0.07, (a.z + b.z) / 2), b), 12, 0.005, 4),
};
const meanderRes = geo.meander(8, 0.13), meanderBuf = geo.meander(5, 0.1);

/** Small PCB carrier every component part sits on, with two gold contact pads. */
function Carrier({ w = 0.9, d = 0.5 }: { w?: number; d?: number }) {
  return <>
    <mesh material={M.pcb} position-y={0.03} castShadow receiveShadow><boxGeometry args={[w, 0.06, d]} /></mesh>
    {[-1, 1].map((s) => <mesh key={s} material={M.gold} position={[s * (w / 2 - 0.07), 0.062, 0]}><boxGeometry args={[0.1, 0.006, 0.16]} /></mesh>)}
  </>;
}
const Led = ({ tone, at }: { tone: Tone; at: [number, number, number] }) =>
  <mesh material={glow(tone)} position={at}><sphereGeometry args={[0.022, 12, 8]} /></mesh>;

/** Chip with two cross-hatched pads (junction) or a superconducting loop (SQUID), bonded to the carrier. */
function Chip({ tone, loop }: { tone: Tone; loop?: boolean }) {
  const bonds = useMemo(() => [-1, 1].map((s) => geo.bond(v(s * 0.15, 0.115, 0), v(s * 0.38, 0.065, 0))), []);
  const hatch = (cx: number) => Array.from({ length: 5 }, (_, i) => -0.05 + i * 0.025).flatMap((o, i) => [
    <mesh key={`a${i}`} material={M.gold} position={[cx + o, 0.112, 0]}><boxGeometry args={[0.008, 0.006, 0.12]} /></mesh>,
    <mesh key={`b${i}`} material={M.gold} position={[cx, 0.112, o]}><boxGeometry args={[0.12, 0.006, 0.008]} /></mesh>,
  ]);
  return <>
    <Carrier />
    <mesh material={M.silicon} position-y={0.085} castShadow><boxGeometry args={[0.42, 0.05, 0.42]} /></mesh>
    {loop ? <>
      {[[0, 0.1, 0.24, 0.02], [0, -0.1, 0.24, 0.02], [0.11, 0, 0.02, 0.2], [-0.11, 0, 0.02, 0.2]].map(([x, z, w, d], i) =>
        <mesh key={i} material={M.gold} position={[x, 0.113, z]}><boxGeometry args={[w, 0.008, d]} /></mesh>)}
      {[-1, 1].map((s) => <mesh key={s} material={glow(tone)} position={[s * 0.11, 0.12, 0]}><boxGeometry args={[0.03, 0.01, 0.03]} /></mesh>)}
      {[-1, 1].map((s) => <mesh key={`p${s}`} material={M.gold} position={[s * 0.16, 0.112, 0]}><boxGeometry args={[0.06, 0.006, 0.06]} /></mesh>)}
    </> : <>
      {hatch(-0.11)}{hatch(0.11)}
      <mesh material={M.gold} position={[0, 0.112, 0]}><boxGeometry args={[0.1, 0.006, 0.01]} /></mesh>
      <mesh material={glow(tone)} position={[0, 0.118, 0]}><boxGeometry args={[0.02, 0.008, 0.02]} /></mesh>
    </>}
    {bonds.map((g, i) => <mesh key={i} geometry={g} material={M.gold} />)}
  </>;
}

/** Bench instrument case: dark anodized box with an aluminium front panel, screen, knob(s) and an SMA port. */
function Instrument({ tone, knobs, dial }: { tone: Tone; knobs: number; dial?: boolean }) {
  return <>
    <mesh material={M.enamel} position-y={0.2} castShadow receiveShadow><boxGeometry args={[0.82, 0.4, 0.52]} /></mesh>
    <mesh material={M.alu} position={[0, 0.2, 0.262]}><boxGeometry args={[0.8, 0.38, 0.012]} /></mesh>
    {[-1, 1].map((s) => <mesh key={s} material={M.dark} position={[s * 0.36, 0.012, 0]}><boxGeometry args={[0.06, 0.024, 0.48]} /></mesh>)}
    {dial ? <>
      <mesh material={M.face} position={[-0.12, 0.21, 0.27]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.13, 0.13, 0.01, 40]} /></mesh>
      <mesh material={M.alu} position={[-0.12, 0.21, 0.27]} rotation-x={Math.PI / 2}><torusGeometry args={[0.135, 0.012, 8, 40]} /></mesh>
      <mesh material={M.dark} position={[-0.09, 0.24, 0.28]} rotation-z={-0.75}><boxGeometry args={[0.008, 0.11, 0.004]} /></mesh>
      <mesh material={glow(tone)} position={[-0.12, 0.13, 0.276]}><boxGeometry args={[0.14, 0.012, 0.004]} /></mesh>
    </> : <mesh material={glow(tone)} position={[-0.15, 0.24, 0.27]}><boxGeometry args={[0.32, 0.14, 0.006]} /></mesh>}
    {Array.from({ length: knobs }, (_, i) => (
      <group key={i} position={[0.2 + (knobs > 1 ? (i - 0.5) * 0.14 : 0), knobs > 1 ? 0.14 : 0.2, 0.3]} rotation-x={Math.PI / 2}>
        <mesh material={M.dark} castShadow><cylinderGeometry args={[0.05, 0.06, 0.07, 28]} /></mesh>
        <mesh material={M.alu} position-y={-0.03}><cylinderGeometry args={[0.07, 0.07, 0.008, 28]} /></mesh>
        <mesh material={M.face} position-y={0.036}><boxGeometry args={[0.008, 0.004, 0.05]} /></mesh>
      </group>
    ))}
    <group position={[dial ? -0.44 : 0.44, 0.14, 0]} rotation-z={Math.PI / 2}>
      <mesh material={M.gold}><cylinderGeometry args={[0.04, 0.04, 0.08, 20]} /></mesh>
      <mesh material={M.dark}><cylinderGeometry args={[0.016, 0.016, 0.085, 12]} /></mesh>
    </group>
    <Led tone={tone} at={[0.33, 0.33, 0.27]} />
  </>;
}

/** Physical model of one part, resting on y = 0, front facing +z, about 0.9 x 0.5 footprint. */
export function PartModel({ glyph, tone }: { glyph: Glyph; tone: Tone }) {
  switch (glyph) {
    case 'inductor': return <>
      <Carrier />
      <mesh geometry={geo.helix} material={M.copper} castShadow />
      <mesh material={M.ferrite} position-y={0.22} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.07, 0.07, 0.66, 24]} /></mesh>
      {[-1, 1].map((s) => <mesh key={s} material={M.copper} position={[s * 0.33, 0.14, 0]}><cylinderGeometry args={[0.02, 0.02, 0.17, 8]} /></mesh>)}
      <Led tone={tone} at={[0, 0.07, 0.22]} />
    </>;
    case 'capacitor': return <>
      <Carrier />
      {[-1, 1].map((s) => <group key={s}>
        <mesh material={M.alu} position={[s * 0.065, 0.27, 0]} castShadow><boxGeometry args={[0.035, 0.38, 0.42]} /></mesh>
        <mesh material={M.copper} position={[s * 0.2, 0.2, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.016, 0.016, 0.24, 8]} /></mesh>
        <mesh material={M.copper} position={[s * 0.32, 0.13, 0]}><cylinderGeometry args={[0.016, 0.016, 0.15, 8]} /></mesh>
        <mesh material={M.dark} position={[s * 0.065, 0.075, 0]}><boxGeometry args={[0.06, 0.03, 0.44]} /></mesh>
      </group>)}
      <Led tone={tone} at={[0, 0.08, 0.22]} />
    </>;
    case 'junction': return <Chip tone={tone} />;
    case 'squid': return <Chip tone={tone} loop />;
    case 'resonator': case 'buffer': {
      const buf = glyph === 'buffer';
      return <>
        <mesh material={buf ? M.dark : M.alu} position-y={0.1} castShadow receiveShadow><boxGeometry args={[0.86, 0.2, 0.52]} /></mesh>
        <mesh material={M.pcb} position-y={0.201}><boxGeometry args={[0.76, 0.004, 0.4]} /></mesh>
        <mesh geometry={buf ? meanderBuf : meanderRes} material={M.copper} position-y={0.206} />
        {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b], i) => <mesh key={i} material={M.alu} position={[a * 0.4, 0.205, b * 0.23]}><cylinderGeometry args={[0.018, 0.018, 0.012, 12]} /></mesh>)}
        {[-1, 1].map((s) => <mesh key={s} material={M.gold} position={[s * 0.46, 0.1, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.035, 0.035, 0.07, 16]} /></mesh>)}
        <Led tone={tone} at={[0.34, 0.12, 0.262]} />
      </>;
    }
    case 'drive': return <Instrument tone={tone} knobs={1} />;
    case 'pump': return <Instrument tone={tone} knobs={2} />;
    case 'detector': return <Instrument tone={tone} knobs={1} dial />;
    default: return <>
      <mesh geometry={geo.coax} material={M.rubber} castShadow />
      {[-1, 1].map((s) => <mesh key={s} material={M.gold} position={[s * 0.42, 0.05, 0.05]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.045, 0.045, 0.09, 16]} /></mesh>)}
      <Led tone={tone} at={[0, 0.02, 0.2]} />
    </>;
  }
}
