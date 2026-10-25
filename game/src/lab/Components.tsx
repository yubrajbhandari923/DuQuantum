import { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { M, PartModel, glow } from '../instruments/parts3d';
import type { Glyph } from '../instruments/CircuitBench';
import { asset } from '../asset';

/** Collectible apparatus, one model per FETCH id. Same scale and frame as PartModel: ~0.9 x 0.5 footprint, on y = 0, front +z. */
type Kind = Glyph | 'toroid' | 'valve' | 'knob' | 'case';
const KIND: Record<string, Kind> = {
  'l1-inductor': 'inductor', 'l1-capacitor': 'capacitor', 'l2-junction': 'junction',
  'l3-loss-dial': 'detector',
  'l5-cat-coil': 'toroid', 'l6-loss-valve': 'valve',
  'l7-pair-dissipator': 'resonator', 'l7-rate-knob': 'knob', 'l8-squid': 'squid', 'l8-pump': 'pump', 'l8-buffer': 'buffer',
  'l9-fit-kit': 'case', 'l10-detector': 'detector', 'l10-drive': 'drive', 'l10-line': 'line',
};

/** Real scanned props (public/models/props, metres, origin bottom-centre, front +z) standing in for some components. */
const PROP: Record<string, string> = {
  'l3-pulse-box': 'vacuum-tube-instruments', 'l4-drive': 'radio-bush-dac10', 'l5-wigner-lens': 'microscope',
  'l6-parity-meter': 'voltmeter-rusty', 'l9-bias-gauge': 'voltmeter-rusty',
};
export const propUrl = (id: string) => asset(`models/props/${id}.glb`);

/** One prop at real size (or `fit`: scaled so its larger footprint side is `fit`). Clones share geometry and materials. */
export function Prop({ model, fit, ...rest }: { model: string; fit?: number } & JSX.IntrinsicElements['group']) {
  const { scene } = useGLTF(propUrl(model));
  const { o, s } = useMemo(() => {
    const o = scene.clone(true);
    o.traverse((m) => { m.castShadow = true; m.receiveShadow = true; });
    const size = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());
    return { o, s: fit ? fit / Math.max(size.x, size.z) : 1 };
  }, [scene, fit]);
  return <group {...rest}><primitive object={o} scale={s} /></group>;
}

const glass = new THREE.MeshPhysicalMaterial({ color: '#e8f0e0', transparent: true, opacity: 0.28, roughness: 0.05, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide });
export const walnut = new THREE.MeshStandardMaterial({ color: '#4e2c16', roughness: 0.45, metalness: 0 });

const toroidGeo = (() => { // copper wound on a ferrite ring: (R + r cos v) around u, v = turns * u
  const R = 0.22, r = 0.085, turns = 36, pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 1440; i++) { const u = (i / 1440) * Math.PI * 2, v = u * turns; pts.push(new THREE.Vector3((R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u))); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 2880, 0.011, 5, true);
})();

function Model({ kind }: { kind: Kind }) {
  const ticks = useMemo(() => Array.from({ length: 11 }, (_, i) => -1.2 + (i / 10) * 2.4), []);
  switch (kind) {
    case 'toroid': return <>
      <mesh material={M.pcb} position-y={0.03} castShadow receiveShadow><cylinderGeometry args={[0.36, 0.38, 0.06, 36]} /></mesh>
      <group position-y={0.16}>
        <mesh material={M.ferrite} rotation-x={Math.PI / 2}><torusGeometry args={[0.22, 0.075, 12, 40]} /></mesh>
        <mesh geometry={toroidGeo} material={M.copper} castShadow />
      </group>
      {[-1, 1].map((s) => <mesh key={s} material={M.gold} position={[s * 0.3, 0.09, 0.12]}><cylinderGeometry args={[0.025, 0.025, 0.06, 12]} /></mesh>)}
    </>;
    case 'valve': return <>
      <mesh material={M.dark} position-y={0.05} castShadow><cylinderGeometry args={[0.13, 0.14, 0.1, 24]} /></mesh>
      <mesh material={M.gold} position-y={0.105}><cylinderGeometry args={[0.135, 0.135, 0.012, 24]} /></mesh>
      <mesh material={M.alu} position-y={0.3}><boxGeometry args={[0.12, 0.26, 0.05]} /></mesh>
      <mesh material={glow('amber')} position-y={0.3}><cylinderGeometry args={[0.008, 0.008, 0.24, 6]} /></mesh>
      <mesh material={glass} position-y={0.3}><cylinderGeometry args={[0.12, 0.12, 0.38, 24, 1, true]} /></mesh>
      <mesh material={glass} position-y={0.49}><sphereGeometry args={[0.12, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
      <mesh material={M.dark} position-y={0.62}><coneGeometry args={[0.02, 0.05, 8]} /></mesh>
    </>;
    case 'knob': return <>
      <mesh material={M.gold} position-y={0.015} castShadow><cylinderGeometry args={[0.34, 0.34, 0.03, 40]} /></mesh>
      <mesh material={M.face} position-y={0.032}><cylinderGeometry args={[0.31, 0.31, 0.005, 40]} /></mesh>
      {ticks.map((a, i) => <mesh key={i} material={M.dark} position={[Math.sin(a) * 0.26, 0.037, -Math.cos(a) * 0.26]} rotation-y={-a}><boxGeometry args={[0.008, 0.003, i % 5 ? 0.04 : 0.07]} /></mesh>)}
      <mesh material={M.dark} position-y={0.1} castShadow><cylinderGeometry args={[0.13, 0.16, 0.13, 28]} /></mesh>
      <mesh material={M.alu} position-y={0.17}><cylinderGeometry args={[0.1, 0.1, 0.01, 28]} /></mesh>
      <mesh material={M.face} position={[0, 0.176, -0.06]}><boxGeometry args={[0.014, 0.006, 0.08]} /></mesh>
    </>;
    case 'case': return <>
      <mesh material={walnut} position-y={0.11} castShadow receiveShadow><boxGeometry args={[0.8, 0.22, 0.46]} /></mesh>
      <mesh material={walnut} position={[0, 0.235, 0]}><boxGeometry args={[0.82, 0.03, 0.48]} /></mesh>
      {[-1, 1].map((s) => <mesh key={s} material={M.gold} position={[s * 0.24, 0.18, 0.235]}><boxGeometry args={[0.07, 0.08, 0.012]} /></mesh>)}
      <mesh material={M.face} position={[0, 0.12, 0.233]}><boxGeometry args={[0.26, 0.08, 0.004]} /></mesh>
      <mesh material={M.gold} position={[0, 0.27, 0]}><boxGeometry args={[0.2, 0.025, 0.03]} /></mesh>
    </>;
    default: return <PartModel glyph={kind} tone="amber" />;
  }
}

export function ComponentModel({ id }: { id: string }) {
  return PROP[id] ? <Suspense fallback={null}><Prop model={PROP[id]} fit={0.9} /></Suspense> : <Model kind={KIND[id] ?? 'line'} />;
}
for (const p of new Set(Object.values(PROP))) useGLTF.preload(propUrl(p));
