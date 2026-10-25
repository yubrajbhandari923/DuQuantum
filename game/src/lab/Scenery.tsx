import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Instance, Instances, Sparkles, useGLTF, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import { Prop } from './Components';
import { APO, PANEL, SIDES, STEP, faceIn, gap, onPanel, polar } from './layout';
import { DoorSwing } from './Door';
import { asset } from '../asset';

/**
 * A 1930s-50s physicist's study built from the "Modular Vintage Living Room" kit (Sketchfab, user-supplied, see ASSET_SOURCES.md),
 * split into recentred pieces in /models/vintage/kit.glb (each piece sits on y=0, centred on x/z).
 */
const KIT = asset('models/vintage/kit.glb');
const H = 4.78;

type Kit = Record<string, THREE.Mesh>;
function useKit() { return useGLTF(KIT).nodes as unknown as Kit; }

/** One kit piece; `flip` turns it 180 degrees for pieces authored facing -z. */
export function Piece({ n, flip, shadow = true, ...rest }: { n: string; flip?: boolean; shadow?: boolean } & JSX.IntrinsicElements['group']) {
  const k = useKit()[n];
  return <group {...rest}><mesh geometry={k.geometry} material={k.material} rotation-y={flip ? Math.PI : 0} castShadow={shadow} receiveShadow /></group>;
}

function Model({ url, ...rest }: { url: string } & JSX.IntrinsicElements['group']) {
  const { scene } = useGLTF(url);
  const obj = useMemo(() => {
    const s = scene.clone();
    s.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return;
      o.castShadow = o.receiveShadow = true;
      const m = (o as THREE.Mesh).material as THREE.MeshPhysicalMaterial;
      if (m.transmission > 0) { m.transmission = 0; m.transparent = true; m.opacity = 0.35; m.roughness = 0.1; } // transmission adds a full extra scene pass
    });
    return s;
  }, [scene]);
  return <group {...rest}><primitive object={obj} /></group>;
}

/** True once nothing has been loading for ~1 s; polled so we never set state while another component renders. */
function useLoaded() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let quiet = 0;
    const id = setInterval(() => { quiet = useProgress.getState().active ? 0 : quiet + 1; if (quiet >= 3) { setOk(true); clearInterval(id); } }, 300);
    return () => clearInterval(id);
  }, []);
  return ok;
}

/** A spot aimed straight down; the target is a child so it follows the light. */
function DownSpot({ position, color, intensity, angle, shadow = false }: { position: [number, number, number]; color: string; intensity: number; angle: number; shadow?: boolean }) {
  const target = useMemo(() => new THREE.Object3D(), []);
  return (
    <group position={position}>
      <primitive object={target} position={[0, -4, 0]} />
      <spotLight target={target} color={color} intensity={intensity} angle={angle} penumbra={0.7} decay={1.6} distance={10}
        castShadow={shadow} shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} />
    </group>
  );
}

function Fire() {
  const l = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => { const t = clock.elapsedTime; if (l.current) l.current.intensity = 5 + Math.sin(t * 7) * 0.8 + Math.sin(t * 13.3) * 0.6; });
  return <pointLight ref={l} position={[0, 0.5, 0.9]} color="#ff8a3c" distance={6} decay={1.8} />;
}

/** A small blue Bunsen flame: two additive cones that flicker. */
function Flame(props: JSX.IntrinsicElements['group']) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (g.current) g.current.scale.y = 1 + Math.sin(clock.elapsedTime * 23) * 0.08 + Math.sin(clock.elapsedTime * 9) * 0.06; });
  return (
    <group ref={g} {...props}>
      <mesh position-y={0.04}><coneGeometry args={[0.012, 0.08, 12, 1, true]} /><meshBasicMaterial color="#5a8cff" transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>
      <mesh position-y={0.025}><coneGeometry args={[0.007, 0.05, 10, 1, true]} /><meshBasicMaterial color="#bfe0ff" transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>
    </group>
  );
}

/** Period glassware from the low-poly lab set, authored at roughly 15x scale. */
function Glass({ n, scale = 0.09, ...rest }: { n: string; scale?: number } & JSX.IntrinsicElements['group']) {
  const { nodes } = useGLTF(asset('models/vintage/glassware.glb'));
  const obj = useMemo(() => nodes[n].clone(), [nodes, n]);
  return <group scale={scale} {...rest}><primitive object={obj} /></group>;
}

const card = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
/** Night outside the window as three cards: sky with stars, a moon with its halo, and a rooftop skyline. The moon and the
 *  roofs slide against the sky as you walk past, so the view has depth without any extra geometry behind the wall. */
const NIGHT = typeof document === 'undefined' ? null : {
  sky: card(256, 320, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 320);
    gr.addColorStop(0, '#060a18'); gr.addColorStop(0.55, '#14213d'); gr.addColorStop(0.85, '#2b3350'); gr.addColorStop(1, '#4a3a3a');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 320);
    let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,245,225,${0.25 + rnd() * 0.6})`; g.fillRect(rnd() * 256, rnd() * 220, rnd() < 0.15 ? 2 : 1, 1); }
  }),
  moon: card(128, 128, (g) => {
    const h = g.createRadialGradient(64, 64, 8, 64, 64, 64); h.addColorStop(0, 'rgba(255,240,205,0.55)'); h.addColorStop(0.3, 'rgba(200,210,235,0.15)'); h.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = h; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#f4ead0'; g.beginPath(); g.arc(64, 64, 15, 0, 7); g.fill();
    g.fillStyle = 'rgba(160,150,130,0.35)'; g.beginPath(); g.arc(59, 60, 4, 0, 7); g.arc(70, 69, 3, 0, 7); g.fill();
  }),
  roofs: card(512, 160, (g) => {
    let s = 3; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    g.fillStyle = '#05070d'; g.beginPath(); g.moveTo(0, 160);
    for (let x = 0; x < 512;) { const w = 30 + rnd() * 50, h = 50 + rnd() * 70; g.lineTo(x, 160 - h); g.lineTo(x + w * 0.5, 160 - h - rnd() * 22); g.lineTo(x + w, 160 - h); if (rnd() < 0.5) { g.lineTo(x + w * 0.75, 160 - h); g.lineTo(x + w * 0.75, 160 - h - 20); g.lineTo(x + w * 0.85, 160 - h - 20); g.lineTo(x + w * 0.85, 160 - h); } x += w; }
    g.lineTo(512, 160); g.fill();
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(255,${180 + rnd() * 40},110,${0.5 + rnd() * 0.4})`; g.fillRect(rnd() * 500, 110 + rnd() * 40, 4, 5); }
  }),
};
if (NIGHT) NIGHT.roofs.wrapS = THREE.RepeatWrapping;

function Window() {
  const ref = useRef<THREE.Group>(null), moon = useRef<THREE.Mesh>(null);
  const roofs = useMemo(() => { const t = NIGHT!.roofs.clone(); t.repeat.set(0.5, 1); return t; }, []);
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => { // parallax: the farther the layer, the less it slides
    if (!ref.current) return;
    const lx = ref.current.worldToLocal(v.copy(camera.position)).x;
    roofs.offset.x = lx * 0.025;
    if (moon.current) moon.current.position.x = 0.45 - lx * 0.035;
  });
  return (
    <group ref={ref}>
      <mesh position={[0, 1.7, 0.01]}><planeGeometry args={[2.3, 3.4]} /><meshBasicMaterial map={NIGHT!.sky} toneMapped={false} /></mesh>
      <mesh ref={moon} position={[0.45, 2.45, 0.015]}><planeGeometry args={[0.7, 0.7]} /><meshBasicMaterial map={NIGHT!.moon} transparent depthWrite={false} toneMapped={false} /></mesh>
      <mesh position={[0, 1.45, 0.02]}><planeGeometry args={[2.3, 0.75]} /><meshBasicMaterial map={roofs} transparent depthWrite={false} /></mesh>
      <Piece n="window" position={[0, 0, 0.2]} shadow={false} />
      <Piece n="radiator" position={[0, 0, 0.3]} />
    </group>
  );
}

const oak = new THREE.MeshStandardMaterial({ color: '#4a2c17', roughness: 0.55 });
const brass = new THREE.MeshStandardMaterial({ color: '#b8893e', metalness: 1, roughness: 0.3 });
const tweed = new THREE.MeshStandardMaterial({ color: '#3a3328', roughness: 1 });
/** Panelled oak door with a brass knob, and a coat rail with an overcoat and a hat beside it. */
function Door() {
  const b = (w: number, h: number, d: number) => <boxGeometry args={[w, h, d]} />;
  return (
    <group>
      <group position-x={-0.35}>
        {[[-0.62, 1.15, 0.1, 2.36], [0.62, 1.15, 0.1, 2.36], [0, 2.38, 1.34, 0.12]].map(([x, y, w, h], k) => <mesh key={k} material={oak} position={[x, y, 0.11]} castShadow>{b(w, h, 0.06)}</mesh>)}
<DoorSwing>{/* the intro opens it */}
        <mesh material={oak} position={[0, 1.15, 0.1]} receiveShadow>{b(1.14, 2.3, 0.04)}</mesh>
        {[[0.28, 1.85], [-0.24, 1.85], [0.28, 1.15], [-0.24, 1.15], [0.28, 0.45], [-0.24, 0.45]].map(([x, y], k) => <mesh key={k} material={oak} position={[x * 1.0, y, 0.125]}>{b(0.38, 0.55, 0.02)}</mesh>)}
        <mesh material={brass} position={[0.46, 1.05, 0.14]}><cylinderGeometry args={[0.025, 0.025, 0.14, 8]} /></mesh>
        <mesh material={brass} position={[0.46, 1.05, 0.2]}><sphereGeometry args={[0.035, 16, 12]} /></mesh>
        <mesh material={brass} position={[0.46, 0.96, 0.125]}>{b(0.04, 0.08, 0.005)}</mesh>
        </DoorSwing>
      </group>
      <group position={[1.05, 1.75, 0.05]}>
        <mesh material={oak}>{b(0.8, 0.1, 0.03)}</mesh>
        {[-0.27, 0, 0.27].map((x) => <mesh key={x} material={brass} position={[x, 0, 0.05]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.01, 0.012, 0.09, 8]} /></mesh>)}
        <group position={[-0.27, -0.55, 0.13]}>
          <mesh material={tweed} scale={[1, 1, 0.45]}><capsuleGeometry args={[0.2, 0.75, 6, 12]} /></mesh>
          <mesh material={tweed} position={[0, 0.5, 0]} scale={[1.2, 0.5, 0.5]}><sphereGeometry args={[0.18, 12, 8]} /></mesh>
        </group>
        <group position={[0.27, -0.06, 0.13]} rotation-x={0.25}>
          <mesh material={tweed}><cylinderGeometry args={[0.13, 0.12, 0.012, 20]} /></mesh>
          <mesh material={tweed} position-y={0.06}><cylinderGeometry args={[0.08, 0.085, 0.12, 20]} /></mesh>
          <mesh material={oak} position-y={0.02}><cylinderGeometry args={[0.087, 0.087, 0.025, 20]} /></mesh>
        </group>
      </group>
    </group>
  );
}

/** Furniture against each wall panel. Local frame: x along the wall, +z into the room, z=0 at the wall face. */
const PANELS: Record<number, JSX.Element> = {
  0: <Piece n="bookcase" position={[0, 0, 0.4]} />,
  1: <><Piece n="armchair" position={[-0.6, 0, 0.75]} rotation-y={0.35} /><Piece n="coffee" position={[0.55, 0, 0.6]} rotation-y={Math.PI / 2} />
    <Piece n="tablelamp" position={[0.55, 0.62, 0.45]} /><Model url={asset('models/vintage/phone.glb')} position={[0.5, 0.62, 0.95]} rotation-y={-0.4} scale={0.09} /><Piece n="paintA" position={[0, 1.9, 0.03]} /></>,
  2: <><Piece n="fireplace" position={[0, 0, 0.52]} /><Fire /></>,
  3: <Window />,
  4: <Piece n="bookcase" position={[0, 0, 0.4]} />,
  5: <><Model url={asset('models/vintage/lab_cabinet.glb')} position={[-0.65, 0, 0.25]} /><Model url={asset('models/vintage/lab_cabinet.glb')} position={[0.65, 0, 0.25]} />
    <Glass n="tubes" position={[-0.6, 1.8, 0.25]} /><Glass n="beaker" position={[0.7, 1.8, 0.25]} />
    <Glass n="smallBeaker" position={[-0.8, 0.98, 0.3]} /><Glass n="flask" position={[-0.45, 0.98, 0.3]} scale={0.18} /><Glass n="beaker" position={[0.6, 1.36, 0.3]} /><Glass n="tubes" position={[0.75, 0.6, 0.3]} /></>,
  6: <><Piece n="table" position={[0, 0, 0.55]} scale={0.78} /><Prop model="typewriter-underwood" position={[-0.35, 0.72, 0.55]} rotation-y={0.25} /><Piece n="tablelamp" position={[0.45, 0.72, 0.45]} />
    <Piece n="chair" position={[0.35, 0, 1.2]} rotation-y={Math.PI + 0.3} /><Piece n="paintC" position={[0, 2.1, 0.03]} /></>,
  7: <Window />,
  8: <><Piece n="table" position={[0, 0, 0.55]} scale={0.78} /><Glass n="tubes" position={[-0.6, 0.72, 0.5]} rotation-y={0.4} /><Glass n="beaker" position={[-0.1, 0.72, 0.45]} />
    <Glass n="smallBeaker" position={[0.3, 0.72, 0.65]} /><Glass n="flask" position={[0.7, 0.72, 0.45]} scale={0.18} /><Prop model="paintings-pack" position={[0, 1.35, 0.03]} scale={0.9} /><Prop model="bunsen-burner" position={[-0.25, 0.72, 0.35]} /><Flame position={[-0.25, 0.97, 0.35]} /></>,
  9: <Door />,
};

/** Wall-glow card for the sconces: the pool of light a shade throws up and down the plaster. */
const scallop = typeof document === 'undefined' ? null : card(64, 128, (g) => {
  const r = g.createRadialGradient(32, 64, 2, 32, 64, 62); r.addColorStop(0, 'rgba(255,200,130,0.9)'); r.addColorStop(0.4, 'rgba(255,170,90,0.25)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 128);
});
/** Sconces that really light the room (the rest only glow): either side of the desk, and the far bookcase on high. */
const LIT = [[PANEL.DESK_WALL, -1.72], [PANEL.DESK_WALL, 1.72], [PANEL.BOOKCASE, -1.72], [PANEL.BOOKCASE, 1.72]] as const;

/** Faceted wallpapered room from the kit, timber ceiling, rug, practical lamps and furniture against the walls. */
export function Room({ wall, chamber, quality = 'high' }: { wall: number; chamber: number; quality?: 'low' | 'high' }) {
  const kit = useKit();
  const gl = useThree((s) => s.gl);
  const ceiling = useMemo(() => { // coffers are a square grid; clip them to the ten walls so none pokes through a corner
    gl.localClippingEnabled = true;
    const m = (kit.ceiling.material as THREE.Material).clone();
    m.clippingPlanes = Array.from({ length: SIDES }, (_, k) => new THREE.Plane(new THREE.Vector3(-Math.cos(gap(k)), 0, -Math.sin(gap(k))), APO - 0.02));
    return m;
  }, [kit, gl]);
  const baked = useLoaded();
  const low = quality === 'low';
  const apo = APO;
  const side = 2 * wall * Math.sin(Math.PI / SIDES);
  const wood = kit.beam.material as THREE.Material;
  const floorMat = useMemo(() => {
    const m = (kit.floor.material as THREE.MeshStandardMaterial).clone();
    for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'] as const) {
      const t = m[key]; if (!t) continue;
      const c = t.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(wall * 2 / 3, wall * 2 / 3); c.needsUpdate = true; m[key] = c;
    }
    return m;
  }, [kit, wall]);
  useMemo(() => { // the kit authors its lamp shades and fire at emissive strength 10, far too hot for our exposure
    (kit.sconce.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.9;
    (kit.fire.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.5;
    (kit.wall.material as THREE.MeshStandardMaterial).color.set('#9c8f7c'); // age the bright plaster
  }, [kit]);
  const tiles = useMemo(() => { const t: [number, number][] = []; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) t.push([i, j]); return t; }, []);

  return (
    <>
      <Environment files={asset('tex/studio.hdr')} environmentIntensity={0.12} />

      {/* floor boards, a big rug under the chamber */}
      <mesh rotation-x={-Math.PI / 2} material={floorMat} receiveShadow><circleGeometry args={[wall, 40]} /></mesh>
      <Piece n="rug" position-y={0.004} rotation-y={Math.PI / 2} shadow={false} />

      {/* walls: wallpapered kit panels, wooden dado, chair rail and picture rail */}
      <Instances geometry={kit.wall.geometry} material={kit.wall.material} limit={SIDES} receiveShadow>
        {Array.from({ length: SIDES }, (_, k) => { const a = gap(k), [x, z] = polar(a, apo + 0.215); return <Instance key={k} position={[x, 0, z]} rotation-y={faceIn(a)} scale={[side / 3.92 + 0.02, H / 4.78, 1]} />; })}
      </Instances>
      <Instances material={wood} limit={SIDES * 3}>
        <boxGeometry />
        {Array.from({ length: SIDES }, (_, k) => {
          const a = gap(k), [x, z] = polar(a, apo - 0.03), [x2, z2] = polar(a, apo - 0.05);
          return [
            <Instance key={`d${k}`} position={[x, 0.55, z]} rotation-y={faceIn(a)} scale={[side + 0.06, 1.1, 0.06]} />,
            <Instance key={`r${k}`} position={[x2, 1.12, z2]} rotation-y={faceIn(a)} scale={[side + 0.1, 0.07, 0.1]} />,
            <Instance key={`p${k}`} position={[x2, 3.35, z2]} rotation-y={faceIn(a)} scale={[side + 0.1, 0.06, 0.1]} />,
          ];
        })}
      </Instances>

      {/* timber ceiling: kit coffers, radial beams, a brass collar the chamber glass retracts into */}
      <mesh position-y={H - 0.02} rotation-x={Math.PI / 2}><circleGeometry args={[wall, SIDES]} /><meshStandardMaterial color="#1a110b" roughness={0.9} side={THREE.DoubleSide} /></mesh>
      <Instances geometry={kit.ceiling.geometry} material={ceiling} limit={25}>
        {tiles.map(([i, j]) => <Instance key={`${i}${j}`} position={[i * 3.18, H - 0.17, j * 3.18]} />)}
      </Instances>
      <Instances geometry={kit.beam.geometry} material={wood} limit={SIDES}>
        {Array.from({ length: SIDES }, (_, k) => { const a = gap(k) + STEP / 2, [x, z] = polar(a, 4.1); return <Instance key={k} position={[x, H - 0.73, z]} rotation-y={-a} />; })}
      </Instances>
      <mesh position-y={H - 0.25}><cylinderGeometry args={[1.32, 1.32, 0.5, 40, 1, true]} /><meshStandardMaterial color="#6b4a22" metalness={0.9} roughness={0.35} side={THREE.DoubleSide} /></mesh>
      <mesh position-y={H - 0.5} rotation-x={Math.PI / 2}><torusGeometry args={[1.32, 0.04, 8, 64]} /><meshStandardMaterial color="#b8893e" metalness={1} roughness={0.3} /></mesh>

      {/* practical light: warm enamel lamps over the floor and a key over the chamber; consoles add the cold accents */}
      <DownSpot position={[0, H - 0.1, 0]} color="#ffc98a" intensity={low ? 40 : 55} angle={0.42} shadow={!low} />
      {[0, 2, 4, 6, 8].map((k, j) => {
        const [x, z] = k ? polar(gap(k) + STEP / 2, 4.3) : polar(gap(0), 4.75); // the first hangs over the desk
        return (
          <group key={k}>
            <Model url={asset('models/lab/hanging_industrial_lamp.glb')} position={[x, H - 0.3, z]} />
            {(!low || j % 2 === 0) && <DownSpot position={[x, H - 1.65, z]} color="#ffb36a" intensity={18} angle={0.95} />}
          </group>
        );
      })}

      {/* furniture on every panel, wall sconces either side */}
      {Object.entries(PANELS).map(([k, el]) => { const a = gap(+k), [x, z] = polar(a, apo); return <group key={k} position={[x, 0, z]} rotation-y={faceIn(a)}>{el}</group>; })}
      <Instances geometry={kit.sconce.geometry} material={kit.sconce.material} limit={SIDES * 2}>
        {Array.from({ length: SIDES }, (_, k) => k).filter((k) => k !== 2 && k !== 3 && k !== 7).map((k) => [-1.72, 1.72].map((s) => {
          const a = gap(k), [x, z] = polar(a, apo + 0.02), t = faceIn(a);
          return <Instance key={`${k}${s}`} position={[x + Math.cos(t) * s, 2.35, z - Math.sin(t) * s]} rotation-y={t} />;
        }))}
      </Instances>
      <Instances limit={SIDES * 2}>
        <planeGeometry args={[0.9, 1.8]} />
        <meshBasicMaterial map={scallop} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        {Array.from({ length: SIDES }, (_, k) => k).filter((k) => k !== 2 && k !== 3 && k !== 7).map((k) => [-1.72, 1.72].map((s) => {
          const a = gap(k), [x, z] = polar(a, apo - 0.07), t = faceIn(a);
          return <Instance key={`${k}${s}`} position={[x + Math.cos(t) * s, 2.65, z - Math.sin(t) * s]} rotation-y={t} />;
        }))}
      </Instances>
      {LIT.slice(0, low ? 2 : 4).map(([k, s]) => <pointLight key={`${k}${s}`} position={onPanel(k, s, 2.7, 0.35)} color="#ffc27e" intensity={2.4} distance={4.5} decay={1.7} />)}

      <Sparkles count={low ? 40 : 110} scale={[11, 3.6, 11]} position-y={2} size={1.6} speed={0.15} opacity={0.35} color="#ffd9a8" noise={0.6} />
      {/* soft contact shadows, baked once after everything (incl. other suspended models) has loaded */}
      {baked && <ContactShadows frames={1} position-y={0.008} scale={wall * 2} resolution={low ? 256 : 512} far={1.4} blur={2.4} opacity={0.6} color="#1a0f06" />}
      <mesh rotation-x={-Math.PI / 2} position-y={0.006}><ringGeometry args={[chamber + 0.3, chamber + 0.36, 96]} /><meshStandardMaterial color="#5a3d18" metalness={1} roughness={0.3} /></mesh>
    </>
  );
}

useGLTF.preload(KIT);
for (const u of ['models/vintage/lab_cabinet.glb', 'models/vintage/glassware.glb', 'models/vintage/phone.glb', 'models/lab/hanging_industrial_lamp.glb']) useGLTF.preload(asset(u));
