import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '../store';
import { C } from '../styles/colors';

type Mats = Record<'fur' | 'white', THREE.Material>;
function Tail({ i, refs, mats }: { i: number; refs: React.MutableRefObject<(THREE.Group | null)[]>; mats: Mats }) {
  return (
    <group ref={(g) => { refs.current[i] = g; }}>
      <mesh material={i > 4 ? mats.white : mats.fur} position={[0, 0.05, 0]}><capsuleGeometry args={[0.034 - i * 0.003, 0.06, 4, 8]} /></mesh>
      {i < 6 && <group position={[0, 0.1, 0]}><Tail i={i + 1} refs={refs} mats={mats} /></group>}
    </group>
  );
}

// Procedural stylised cat (no free cat GLB was reachable). Faces +z, feet at y=0.
function Cat({ ghost = false, walk }: { ghost?: boolean; walk: React.MutableRefObject<number> }) {
  const head = useRef<THREE.Group>(null), body = useRef<THREE.Group>(null);
  const legs = useRef<(THREE.Mesh | null)[]>([]);
  const tail = useRef<(THREE.Group | null)[]>([]);
  const mats = useMemo(() => {
    const m = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, transparent: ghost, opacity: ghost ? 0.25 : 1, depthWrite: !ghost, emissive: ghost ? '#ffd9a0' : '#000', emissiveIntensity: ghost ? 0.6 : 0 });
    return { fur: m('#2a2a33'), white: m('#ece8e0'), pink: m('#d98a96'), eye: new THREE.MeshBasicMaterial({ color: ghost ? '#ffd9a0' : '#9bff7a', transparent: ghost, opacity: ghost ? 0.4 : 1 }) };
  }, [ghost]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime, w = walk.current;
    if (body.current) body.current.scale.set(1, 1 + Math.sin(t * 2.2) * 0.025, 1 + Math.sin(t * 2.2) * 0.02);
    if (body.current) body.current.position.y = Math.abs(Math.sin(t * 9)) * 0.035 * w;
    if (head.current) head.current.rotation.y = Math.sin(t * 0.5) * 0.7 * Math.max(0, Math.sin(t * 0.23)) * (1 - w);
    legs.current.forEach((l, i) => { if (l) l.rotation.x = Math.sin(t * 9 + (i % 3 ? Math.PI : 0)) * 0.6 * w; });
    tail.current.forEach((s, i) => { if (s) s.rotation.x = 0.16 + Math.sin(t * 1.6 - i * 0.7) * 0.2; });
  });
  const legAt: [number, number][] = [[-0.09, 0.2], [0.09, 0.2], [-0.09, -0.2], [0.09, -0.2]];
  return (
    <group>
      <group ref={body}>
        <mesh material={mats.fur} position={[0, 0.3, 0]} rotation-x={Math.PI / 2} scale={[1, 1, 0.95]}><capsuleGeometry args={[0.14, 0.34, 6, 14]} /></mesh>
        <mesh material={mats.white} position={[0, 0.27, 0.2]} scale={[0.8, 0.9, 0.9]}><sphereGeometry args={[0.13, 12, 10]} /></mesh>
        <group ref={head} position={[0, 0.5, 0.33]}>
          <mesh material={mats.fur} scale={[1.1, 0.95, 1]}><sphereGeometry args={[0.13, 16, 14]} /></mesh>
          <mesh material={mats.white} position={[0, -0.04, 0.09]} scale={[0.6, 0.5, 0.5]}><sphereGeometry args={[0.1, 10, 8]} /></mesh>
          <mesh material={mats.pink} position={[0, -0.01, 0.125]}><sphereGeometry args={[0.014, 6, 6]} /></mesh>
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh material={mats.fur} position={[s * 0.075, 0.12, -0.01]} rotation-z={-s * 0.25}><coneGeometry args={[0.05, 0.11, 4]} /></mesh>
              <mesh material={mats.eye} position={[s * 0.052, 0.025, 0.11]} scale={[1, 1.3, 0.5]}><sphereGeometry args={[0.02, 8, 8]} /></mesh>
            </group>
          ))}
        </group>
        <group position={[0, 0.34, -0.3]} rotation-x={-0.9}><Tail i={0} refs={tail} mats={mats} /></group>
      </group>
      {legAt.map(([x, z], i) => (
        <mesh key={i} ref={(m) => { legs.current[i] = m; }} material={i < 2 ? mats.white : mats.fur} position={[x, 0.17, z]}><capsuleGeometry args={[0.04, 0.18, 4, 8]} /></mesh>
      ))}
    </group>
  );
}

const CAT = '/models/cat.glb';
const BICOLOR_YAW = 0;
const BICOLOR = '/models/sketchfab/bicolor_cat.glb';

/** Real animated cat: Idle while caged, Walk while leaving. Normalised to ~0.8 long, feet at y=0. */
function CatGLB({ url, yaw = 0, ghost, walk }: { url: string; yaw?: number; ghost: boolean; walk: React.MutableRefObject<number> }) {
  const { scene, animations } = useGLTF(url);
  const { obj, mixer, actions, fit } = useMemo(() => {
    const obj = clone(scene);
    const mat = ghost ? new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0.25, depthWrite: false }) : null;
    obj.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.frustumCulled = false; if (mat) m.material = mat; } });
    const mixer = new THREE.AnimationMixer(obj);
    const actions: Record<string, THREE.AnimationAction> = {};
    animations.forEach((a) => { actions[a.name.split('|').pop()!] = mixer.clipAction(a); });
    if (!actions.Idle && animations[0]) actions.Idle = mixer.clipAction(animations[0]); // single-clip models: it is the idle
    obj.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(obj), sz = b.getSize(new THREE.Vector3());
    const f = 0.8 / Math.max(sz.x, sz.z, sz.y);
    return { obj, mixer, actions, fit: { s: f, y: -b.min.y * f } };
  }, [scene, animations, ghost]);
  const cur = useRef('');
  useEffect(() => () => { mixer.stopAllAction(); }, [mixer]);
  useFrame((_, dt) => {
    const want = walk.current && actions.Walk ? 'Walk' : 'Idle';
    if (want !== cur.current && actions[want]) { actions[cur.current]?.fadeOut(0.25); actions[want].reset().fadeIn(0.25).play(); cur.current = want; }
    mixer.update(dt);
  });
  return <group rotation-y={yaw}><primitive object={obj} scale={fit.s} position-y={fit.y} /></group>;
}

class Guard extends Component<{ fallback: ReactNode; children: ReactNode }, { bad: boolean }> {
  state = { bad: false };
  static getDerivedStateFromError() { return { bad: true }; }
  render() { return this.state.bad ? this.props.fallback : this.props.children; }
}

function AnyCat({ ghost = false, walk }: { ghost?: boolean; walk: React.MutableRefObject<number> }) {
  const fb = <Cat ghost={ghost} walk={walk} />;
  return <Guard fallback={<Guard fallback={fb}><Suspense fallback={null}><CatGLB url={CAT} ghost={ghost} walk={walk} /></Suspense></Guard>}><Suspense fallback={null}><CatGLB url={BICOLOR} yaw={BICOLOR_YAW} ghost={ghost} walk={walk} /></Suspense></Guard>;
}

const ease = (x: number) => x * x * (3 - 2 * x);

export function Chamber({ open, radius, quality = 'high' }: { open: boolean; radius: number; quality?: 'low' | 'high' }) {
  const seen = useRef(false); // latched: after the ending the cat stays out until the save is reset
  const ending = useGame((s) => { if (s.screen === 'ending') seen.current = true; else if (!open) seen.current = false; return seen.current; });
  const k = useRef(0), walk = useRef(0), ghostWalk = useRef(0);
  const glass = useRef<THREE.Group>(null), ghost = useRef<THREE.Group>(null), cat = useRef<THREE.Group>(null);
  const lights = useRef<THREE.MeshBasicMaterial[]>([]), ring = useRef<THREE.MeshBasicMaterial>(null), glow = useRef<THREE.PointLight>(null);
  const steam = useRef<THREE.Points>(null);
  const R = radius * 0.6, N = 8;
  const pts = useMemo(() => {
    const a = new Float32Array(3 * 24);
    for (let i = 0; i < 24; i++) { const th = (i / 24) * 6.283, r = radius * 0.75; a.set([Math.cos(th) * r, Math.random() * 0.6, Math.sin(th) * r], i * 3); }
    return a;
  }, [radius]);
  const dot = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d')!, r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    r.addColorStop(0, '#fff'); r.addColorStop(1, '#000'); g.fillStyle = r; g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }, []);
  const tmpC = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    k.current = Math.min(1, Math.max(0, k.current + (ending ? dt / 6 : -dt)));
    const e = ease(k.current);
    const ready = open || ending;
    // glass lifts (0..0.35), lights go green, cat walks out (0.3..1)
    if (glass.current) glass.current.position.y = 0.2 + ease(Math.min(1, e / 0.35)) * 2.4;
    const wk = ease(Math.min(1, Math.max(0, (e - 0.3) / 0.7)));
    const out = wk * (radius + 1.1);
    if (cat.current) { cat.current.position.set(0, 0.2 - wk * 0.2 * Math.min(1, out / 1), out); cat.current.position.y = 0.2 * (1 - Math.min(1, out / (radius * 0.8))) + walk.current * Math.abs(Math.sin(t * 9)) * 0.04; }
    walk.current = wk > 0 && wk < 1 ? 1 : 0;
    const green = ending ? Math.min(1, e * 3) : 0;
    lights.current.forEach((m, i) => {
      const blink = ready ? 0.55 + 0.45 * Math.sin(t * 2 + i) : Math.sin(t * 3 + i * 0.8) > 0 ? 1 : 0.15;
      tmpC.set(i % 2 ? '#ff7a2a' : C.amber).lerp(new THREE.Color('#5dff8a'), ready ? Math.max(green, ending ? 1 : 0) : 0).multiplyScalar(blink + 0.2);
      m.color.copy(tmpC);
    });
    if (ring.current) ring.current.color.set('#ffb347').lerp(tmpC.set('#5dff8a'), green).multiplyScalar(0.6 + 0.4 * Math.sin(t * 2));
    if (glow.current) { glow.current.color.set(C.amber).lerp(tmpC.set('#5dff8a'), green); glow.current.intensity = (ready ? 4 : 2.5) * (0.85 + 0.15 * Math.sin(t * 3)); }
    // superposition ghost: fades in/out, offset and mirrored
    if (ghost.current) {
      const s = Math.max(0, Math.sin(t * 0.6));
      ghost.current.visible = s > 0.02 && k.current < 0.3;
      ghost.current.position.set(Math.sin(t * 0.6) * 0.1 + 0.12, 0, -0.1);
      ghost.current.rotation.y = 2.2;
      ghost.current.children[0]?.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial; if (m && m.transparent) m.opacity = 0.3 * s; });
    }
    if (steam.current) {
      const p = steam.current.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < 24; i++) { const y = (p.getY(i) + dt * 0.25) % 0.9; p.setY(i, y); }
      p.needsUpdate = true;
      (steam.current.material as THREE.PointsMaterial).opacity = 0.35 * (0.6 + 0.4 * Math.sin(t));
    }
  });
  const glassMat = quality === 'high'
    ? <meshPhysicalMaterial color="#ffeccc" transparent opacity={0.1} side={THREE.DoubleSide} roughness={0.05} metalness={0.1} clearcoat={1} depthWrite={false} />
    : <meshBasicMaterial color="#ffeccc" transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />;
  return (
    <group>
      {/* wooden plinth with brass trim */}
      <mesh position-y={0.09}><cylinderGeometry args={[radius * 0.7, radius * 0.8, 0.18, 40]} /><meshStandardMaterial color="#4a2f1b" roughness={0.6} metalness={0.1} /></mesh>
      <mesh position-y={0.185}><cylinderGeometry args={[radius * 0.72, radius * 0.72, 0.03, 40]} /><meshStandardMaterial color="#b08d4a" metalness={1} roughness={0.35} /></mesh>
      <mesh position-y={0.205}><cylinderGeometry args={[R + 0.05, R + 0.05, 0.02, 40]} /><meshStandardMaterial color="#2a1c10" roughness={0.7} /></mesh>
      <mesh position-y={0.22} rotation-x={Math.PI / 2}><torusGeometry args={[radius * 0.62, 0.018, 8, 48]} /><meshBasicMaterial ref={ring} color="#ffb347" toneMapped={false} /></mesh>
      {/* amber lamps + brass vents */}
      {Array.from({ length: N }, (_, i) => { const a = (i / N) * 6.283; return (
        <group key={i} position={[Math.cos(a) * radius * 0.76, 0.1, Math.sin(a) * radius * 0.76]} rotation-y={-a}>
          {i % 2 ? <mesh position={[0.06, 0, 0]}><boxGeometry args={[0.05, 0.07, 0.22]} /><meshStandardMaterial color="#8a6a32" metalness={0.9} roughness={0.45} /></mesh>
            : <mesh><sphereGeometry args={[0.05, 10, 8]} /><meshBasicMaterial ref={(m) => { if (m) lights.current[i] = m; }} toneMapped={false} /></mesh>}
        </group>); })}
      {/* brass-framed bell jar: lifts off on opening */}
      <group ref={glass} position-y={0.2}>
        <mesh position-y={1}><cylinderGeometry args={[R, R, 2, 40, 1, true]} />{glassMat}</mesh>
        <mesh position-y={2}><sphereGeometry args={[R, 40, 16, 0, 6.283, 0, Math.PI / 2]} />{glassMat}</mesh>
        <mesh rotation-x={Math.PI / 2} position-y={0.03}><torusGeometry args={[R, 0.04, 8, 48]} /><meshStandardMaterial color="#b08d4a" metalness={1} roughness={0.3} /></mesh>
        <mesh position-y={2 + R + 0.02}><sphereGeometry args={[0.07, 12, 10]} /><meshStandardMaterial color="#b08d4a" metalness={1} roughness={0.3} /></mesh>
        {[0, 1, 2, 3].map((i) => <mesh key={i} position={[Math.cos(i * 1.571 + 0.785) * R, 1, Math.sin(i * 1.571 + 0.785) * R]}><boxGeometry args={[0.03, 2, 0.03]} /><meshStandardMaterial color="#b08d4a" metalness={1} roughness={0.35} /></mesh>)}
      </group>
      <points ref={steam} position-y={0.22}>
        <bufferGeometry><bufferAttribute attach="attributes-position" array={pts} count={24} itemSize={3} /></bufferGeometry>
        <pointsMaterial color="#ffe6c0" size={0.09} map={dot} alphaMap={dot} transparent opacity={0.3} depthWrite={false} />
      </points>
      <group ref={cat} position-y={0.2} scale={1.35}>
        <AnyCat walk={walk} />
        <group ref={ghost}><group><AnyCat ghost walk={ghostWalk} /></group></group>
      </group>
      <pointLight ref={glow} position={[0, 1.4, 0]} color={C.amber} intensity={2.5} distance={6} />
    </group>
  );
}
