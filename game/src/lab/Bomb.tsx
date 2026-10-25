import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LEVEL_COUNT, useGame } from '../store';
import { play } from '../audio/sfx';
import { useActors } from './actors';

const brass = <meshStandardMaterial color="#b08d4a" metalness={1} roughness={0.32} />;
const darkBrass = <meshStandardMaterial color="#6e5427" metalness={0.9} roughness={0.45} />;

/** Two nixie digits (glowing orange-red numerals) on a canvas; redrawn only when the number changes. */
function useNixie() {
  return useMemo(() => {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 96;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const draw = (text: string, on: boolean) => {
      const g = cv.getContext('2d')!;
      g.fillStyle = '#120806'; g.fillRect(0, 0, 128, 96);
      g.font = 'bold 76px "IBM Plex Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      [...text.padStart(2, '0')].forEach((d, i) => {
        const x = 34 + i * 60;
        g.fillStyle = 'rgba(255,120,60,0.12)'; g.fillText('8', x, 52); // unlit cathode stack behind
        if (!on) return;
        g.shadowColor = '#ff5a1e'; g.shadowBlur = 18; g.fillStyle = '#ffb27a'; g.fillText(d, x, 52);
        g.shadowBlur = 0; g.fillStyle = '#fff1dc'; g.fillText(d, x, 52);
      });
      tex.needsUpdate = true;
    };
    return { tex, draw };
  }, []);
}

/** Clock dial with ticks, drawn once. */
function useDial() {
  return useMemo(() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d')!;
    g.fillStyle = '#efe4c8'; g.beginPath(); g.arc(64, 64, 64, 0, 7); g.fill();
    g.strokeStyle = '#2a1c10';
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2, r0 = i % 5 ? 54 : 46;
      g.lineWidth = i % 5 ? 1.5 : 4;
      g.beginPath(); g.moveTo(64 + Math.sin(a) * r0, 64 - Math.cos(a) * r0); g.lineTo(64 + Math.sin(a) * 60, 64 - Math.cos(a) * 60); g.stroke();
    }
    g.fillStyle = '#7a1d18'; g.font = 'italic 15px Georgia, serif'; g.textAlign = 'center'; g.fillText('W.H.', 64, 92);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

/**
 * Heisenberg's device: three red drums strapped to a board, a brass alarm clock, a two-tube nixie read-out
 * of the locks left, and a row of ten lock lamps that go dark as experiments are completed.
 * Placement comes from useActors().bomb (the intro carries it in; afterwards it sits by the chamber).
 */
export function BombDevice() {
  const g = useRef<THREE.Group>(null), second = useRef<THREE.Group>(null), minute = useRef<THREE.Group>(null), glow = useRef<THREE.PointLight>(null);
  const lamps = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const completed = useGame((s) => s.completed);
  const nixie = useNixie(), dial = useDial();
  const armed = useRef(false), lastTick = useRef(0);
  const wires = useMemo(() => [
    [[-0.05, 0.2, 0.06], [-0.12, 0.26, 0.12], [-0.17, 0.2, 0.02]],
    [[0.05, 0.2, 0.06], [0.1, 0.27, 0.1], [0.15, 0.2, 0.0]],
    [[0.13, 0.12, 0.1], [0.2, 0.06, 0.13], [0.18, 0.13, -0.02]],
  ].map((pts, i) => ({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 16, 0.005, 6), color: ['#b3261e', '#d9b23a', '#2a4f8f'][i] })), []);
  const left = LEVEL_COUNT - completed.length;
  useEffect(() => { nixie.draw(String(left), armed.current); }, [left, nixie]);

  useFrame(({ clock, camera }) => {
    const b = useActors.getState().bomb, scr = useGame.getState().screen;
    if (!g.current) return;
    g.current.visible = b.visible;
    if (!b.visible) return;
    g.current.position.set(b.x, b.y, b.z); g.current.rotation.y = b.yaw; g.current.scale.setScalar(b.s * 1.25);
    if (b.armed !== armed.current) { armed.current = b.armed; nixie.draw(String(left), b.armed); }
    const t = clock.elapsedTime, sec = Math.floor(t);
    if (second.current) second.current.rotation.z = b.armed ? -(sec % 60) / 60 * Math.PI * 2 : 0;
    if (minute.current) minute.current.rotation.z = -t / 600;
    const blink = b.armed ? (t % 1 < 0.5 ? 1 : 0.35) : 0.05;
    lamps.current.forEach((m, i) => m && m.color.set(i < completed.length ? '#1c2a1e' : '#ff2a1a').multiplyScalar(i < completed.length ? 1 : blink * 2));
    if (glow.current) glow.current.intensity = b.armed ? 0.6 + 0.4 * blink : 0;
    // a soft tick when the player stands close (the cutscene plays its own)
    if (b.armed && scr === 'hub' && sec !== lastTick.current) {
      lastTick.current = sec;
      if (camera.position.distanceToSquared(g.current.position) < 2.6 * 2.6) play('tick');
    }
  });

  return (
    <group ref={g}>
      <mesh position-y={0.015} castShadow receiveShadow><boxGeometry args={[0.46, 0.03, 0.28]} /><meshStandardMaterial color="#3a2414" roughness={0.75} /></mesh>
      {/* drums */}
      {[-0.07, 0.0, 0.07].map((z, i) => (
        <mesh key={i} position={[0, i === 1 ? 0.13 : 0.075, z - 0.04]} rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.045, 0.045, 0.38, 18]} /><meshStandardMaterial color="#8a2a1c" roughness={0.6} />
        </mesh>
      ))}
      {[-0.13, 0.13].map((x) => <mesh key={x} position={[x, 0.1, -0.04]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.1, 0.1, 0.025, 24, 1, true]} /><meshStandardMaterial color="#6e5427" metalness={0.9} roughness={0.45} side={THREE.DoubleSide} /></mesh>)}
      {/* alarm clock, front centre */}
      <group position={[0, 0.17, 0.08]}>
        <mesh rotation-x={Math.PI / 2} castShadow><cylinderGeometry args={[0.085, 0.085, 0.045, 32]} />{brass}</mesh>
        <mesh position-z={0.0235}><circleGeometry args={[0.075, 32]} /><meshStandardMaterial map={dial} roughness={0.5} /></mesh>
        <group ref={minute} position-z={0.026}><mesh position-y={0.025}><boxGeometry args={[0.007, 0.06, 0.002]} /><meshStandardMaterial color="#1a120a" /></mesh></group>
        <group ref={second} position-z={0.028}><mesh position-y={0.028}><boxGeometry args={[0.003, 0.07, 0.002]} /><meshBasicMaterial color="#c0221a" /></mesh></group>
        {[-1, 1].map((s) => <mesh key={s} position={[s * 0.05, 0.09, -0.01]} rotation-z={-s * 0.5}><sphereGeometry args={[0.03, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />{brass}</mesh>)}
        {[-1, 1].map((s) => <mesh key={s} position={[s * 0.05, -0.085, 0]}><cylinderGeometry args={[0.008, 0.012, 0.03, 8]} />{darkBrass}</mesh>)}
      </group>
      {/* nixie read-out on the right: locks remaining */}
      <group position={[0.155, 0.075, 0.09]}>
        <mesh><boxGeometry args={[0.13, 0.05, 0.07]} />{darkBrass}</mesh>
        <mesh position={[0, 0.06, 0]}><planeGeometry args={[0.1, 0.075]} /><meshBasicMaterial map={nixie.tex} toneMapped={false} /></mesh>
        {[-0.026, 0.026].map((x) => <mesh key={x} position={[x, 0.065, 0]}><cylinderGeometry args={[0.024, 0.024, 0.085, 16, 1, true]} /><meshPhysicalMaterial color="#ffe0c0" transparent opacity={0.18} roughness={0.05} depthWrite={false} side={THREE.DoubleSide} /></mesh>)}
      </group>
      {/* ten lock lamps along the front edge */}
      {Array.from({ length: LEVEL_COUNT }, (_, i) => (
        <mesh key={i} position={[-0.2 + i * (0.4 / 9), 0.04, 0.13]}>
          <sphereGeometry args={[0.011, 10, 8]} /><meshBasicMaterial ref={(m) => { lamps.current[i] = m; }} toneMapped={false} />
        </mesh>
      ))}
      {wires.map((w, i) => <mesh key={i} geometry={w.geo}><meshStandardMaterial color={w.color} roughness={0.5} /></mesh>)}
      <pointLight ref={glow} position={[0, 0.2, 0.3]} color="#ff3a1e" distance={1.6} intensity={0} />
    </group>
  );
}
