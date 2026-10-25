import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { create } from 'zustand';
import { hasSet, isUnlocked, nextLevel, useGame } from '../store';
import { ARRIVAL, FETCH } from '../story/barks';
import { play } from '../audio/sfx';
import { SPOTS } from './layout';
import { ComponentModel } from './Components';

export const PICK_SCALE = 0.32;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
export const roman = (n: number) => ROMAN[n - 1];

/** FETCH ids still lying around the study: every uncollected part of the current level and of any unlocked unfinished one. */
export function waiting(s: { collected: string[]; completed: number[] }) {
  const cur = nextLevel(s.completed), out: { id: string; level: number }[] = [];
  for (let l = 1; l <= cur; l++) {
    if (!isUnlocked(s.completed, l) || hasSet(s.collected, s.completed, l)) continue;
    for (const f of FETCH[l] ?? []) if (!s.collected.includes(f.id)) out.push({ id: f.id, level: l });
  }
  return out;
}

/** One short HUD notice (Hub renders it). `key` changes on every new message so the fade restarts. */
export const useToast = create<{ msg: string; sub: string; key: number }>(() => ({ msg: '', sub: '', key: 0 }));
const toast = (msg: string, sub = '') => useToast.setState((s) => ({ msg, sub, key: s.key + 1 }));

/** Parts that should fly from their room spot onto the desk the next time the desk mounts them. */
export const flying = new Set<string>();

export function collect(id: string) {
  const level = +Object.keys(FETCH).find((l) => FETCH[+l].some((f) => f.id === id))!;
  const set = FETCH[level], g = useGame.getState();
  if (!set || g.collected.includes(id)) return;
  flying.add(id);
  g.collect([id]);
  const have = set.filter((f) => useGame.getState().collected.includes(f.id)).length;
  play(have === set.length ? 'success' : 'reveal');
  const name = set.find((f) => f.id === id)!.name;
  toast(`Collected: ${name} (${have}/${set.length})`, have === set.length ? ARRIVAL[level] ?? '' : '');
}

const tagTex = new Map<number, THREE.CanvasTexture>();
function tagMaterial(level: number) {
  let t = tagTex.get(level);
  if (!t) { // iron lettering stamped on a brass tag
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const g = c.getContext('2d')!, gr = g.createLinearGradient(0, 0, 128, 64);
    gr.addColorStop(0, '#e2bd6c'); gr.addColorStop(0.5, '#b8893e'); gr.addColorStop(1, '#8a6528');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 64);
    g.strokeStyle = '#5a4018'; g.lineWidth = 3; g.strokeRect(4, 4, 120, 56);
    g.fillStyle = '#5a4018'; g.beginPath(); g.arc(16, 32, 6, 0, 7); g.fill();
    g.fillStyle = '#2a2420'; g.font = 'bold 30px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(`No. ${ROMAN[level - 1]}`, 72, 34);
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; tagTex.set(level, t);
  }
  return t;
}

const halo = (() => {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!, r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,214,150,1)'); r.addColorStop(0.35, 'rgba(255,170,90,0.35)'); r.addColorStop(1, 'rgba(255,150,60,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const haloMat = new THREE.SpriteMaterial({ map: halo, color: '#ffc27a', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const poolMat = new THREE.MeshBasicMaterial({ map: halo, color: '#ffb066', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

function Pickup({ id, level, i }: { id: string; level: number; i: number }) {
  const bob = useRef<THREE.Group>(null);
  const [x, y, z] = SPOTS[id];
  const u = useMemo(() => ({ aim: id }), [id]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + i * 1.7;
    if (bob.current) { bob.current.position.y = 0.1 + Math.sin(t * 1.6) * 0.025; bob.current.rotation.y = t * 0.45; }
  });
  return (
    <group position={[x, y, z]} userData={u}>
      <mesh material={poolMat} rotation-x={-Math.PI / 2} position-y={0.004}><circleGeometry args={[0.22, 24]} /></mesh>
      <group ref={bob}>
        <group scale={PICK_SCALE}><ComponentModel id={id} /></group>
        <sprite material={haloMat} scale={0.75} position-y={0.08} renderOrder={2} />
        <group position={[0.17, 0.06, 0.06]} rotation-z={0.25}>
          <mesh material={tagStringMat} position-y={0.035}><cylinderGeometry args={[0.0015, 0.0015, 0.07, 4]} /></mesh>
          <mesh position-y={-0.012}><boxGeometry args={[0.07, 0.035, 0.003]} /><meshStandardMaterial map={tagMaterial(level)} metalness={0.7} roughness={0.35} /></mesh>
        </group>
      </group>
    </group>
  );
}
const tagStringMat = new THREE.MeshStandardMaterial({ color: '#d8c8a0', roughness: 1 });

/** Glowing, bobbing, tagged components waiting in the study. Aim (userData.aim = id) and press E to collect. */
export function Pickups() {
  const list = useGame((s) => waiting(s).map((w) => `${w.level}:${w.id}`).join(','));
  return <>{list && list.split(',').map((k, i) => { const [l, id] = k.split(':'); return <Pickup key={id} id={id} level={+l} i={i} />; })}</>;
}
