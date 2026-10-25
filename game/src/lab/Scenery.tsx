import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, Instance, Instances, Sparkles, useGLTF, useProgress } from '@react-three/drei';
import * as THREE from 'three';

/**
 * A 1930s-50s physicist's study built from the "Modular Vintage Living Room" kit (Sketchfab, user-supplied, see ASSET_SOURCES.md),
 * split into recentred pieces in /models/vintage/kit.glb (each piece sits on y=0, centred on x/z).
 */
const KIT = '/models/vintage/kit.glb';
const H = 4.78, SIDES = 10, STEP = (Math.PI * 2) / SIDES;
/** Gap between console k and k+1: wall-panel centres, where furniture stands. Same angle convention as stationPos. */
const gap = (k: number) => Math.PI + (k + 0.5) * STEP;
const polar = (a: number, r: number) => [Math.cos(a) * r, Math.sin(a) * r] as const;
const faceIn = (a: number) => -a - Math.PI / 2; // +z of the object points to the room centre

/** Player colliders for the furniture against each wall panel (consumed by Rig, like CHARACTERS). */
export const PROPS = Array.from({ length: SIDES }, (_, k) => { const [x, z] = polar(gap(k), 6.6); return { x, z, r: 1.0 }; });

type Kit = Record<string, THREE.Mesh>;
function useKit() { return useGLTF(KIT).nodes as unknown as Kit; }

/** One kit piece; `flip` turns it 180 degrees for pieces authored facing -z. */
function Piece({ n, flip, shadow = true, ...rest }: { n: string; flip?: boolean; shadow?: boolean } & JSX.IntrinsicElements['group']) {
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

/** Period glassware from the low-poly lab set, authored at roughly 15x scale. */
function Glass({ n, scale = 0.09, ...rest }: { n: string; scale?: number } & JSX.IntrinsicElements['group']) {
  const { nodes } = useGLTF('/models/vintage/glassware.glb');
  const obj = useMemo(() => nodes[n].clone(), [nodes, n]);
  return <group scale={scale} {...rest}><primitive object={obj} /></group>;
}

/** Night window: the kit frame plus a faint moonlit backdrop so the glass reads as looking outside. */
function Window() {
  return (
    <>
      <mesh position={[0, 1.9, 0.01]}><planeGeometry args={[2.3, 2.9]} /><meshBasicMaterial color="#1b2a44" /></mesh>
      <Piece n="window" position={[0, 0.6, 0.2]} shadow={false} />
      <Piece n="radiator" position={[0, 0, 0.3]} />
    </>
  );
}

/** Furniture against each wall panel. Local frame: x along the wall, +z into the room, z=0 at the wall face. */
const PANELS: Record<number, JSX.Element> = {
  0: <Piece n="bookcase" position={[0, 0, 0.4]} />,
  1: <><Piece n="armchair" position={[-0.6, 0, 0.75]} rotation-y={0.35} /><Piece n="coffee" position={[0.55, 0, 0.6]} rotation-y={Math.PI / 2} />
    <Piece n="tablelamp" position={[0.55, 0.62, 0.45]} /><Model url="/models/vintage/phone.glb" position={[0.5, 0.62, 0.95]} rotation-y={-0.4} scale={0.09} /><Piece n="paintA" position={[0, 1.9, 0.03]} /></>,
  2: <><Piece n="fireplace" position={[0, 0, 0.52]} /><Fire /></>,
  3: <Window />,
  4: <Piece n="bookcase" position={[0, 0, 0.4]} />,
  5: <><Model url="/models/vintage/lab_cabinet.glb" position={[-0.65, 0, 0.25]} /><Model url="/models/vintage/lab_cabinet.glb" position={[0.65, 0, 0.25]} />
    <Glass n="tubes" position={[-0.6, 1.8, 0.25]} /><Glass n="beaker" position={[0.7, 1.8, 0.25]} />
    <Glass n="smallBeaker" position={[-0.8, 0.98, 0.3]} /><Glass n="flask" position={[-0.45, 0.98, 0.3]} scale={0.18} /><Glass n="beaker" position={[0.6, 1.36, 0.3]} /><Glass n="tubes" position={[0.75, 0.6, 0.3]} /></>,
  6: <><Piece n="table" position={[0, 0, 0.55]} scale={0.78} /><Model url="/models/vintage/terminal.glb" position={[-0.3, 0.72, 0.55]} rotation-y={0.2} scale={0.8} />
    <Piece n="chair" position={[0.35, 0, 1.2]} rotation-y={Math.PI + 0.3} /><Piece n="paintC" position={[0, 2.1, 0.03]} /></>,
  7: <Window />,
  8: <><Piece n="table" position={[0, 0, 0.55]} scale={0.78} /><Glass n="tubes" position={[-0.6, 0.72, 0.5]} rotation-y={0.4} /><Glass n="beaker" position={[-0.1, 0.72, 0.45]} />
    <Glass n="smallBeaker" position={[0.3, 0.72, 0.65]} /><Glass n="flask" position={[0.7, 0.72, 0.45]} scale={0.18} /><Piece n="paintB" position={[0, 2.0, 0.03]} /></>,
  9: <><Model url="/models/vintage/lab_cabinet.glb" position={[0, 0, 0.25]} /><Glass n="flask" position={[-0.3, 1.8, 0.25]} scale={0.18} /><Glass n="smallBeaker" position={[0.3, 1.8, 0.25]} /></>,
};

/** Faceted wallpapered room from the kit, timber ceiling, rug, practical lamps and furniture between the consoles. */
export function Room({ wall, chamber, quality = 'high' }: { wall: number; ring: number; chamber: number; quality?: 'low' | 'high' }) {
  const kit = useKit();
  const baked = useLoaded();
  const low = quality === 'low';
  const apo = wall * Math.cos(Math.PI / SIDES); // distance to the flat face of each wall panel
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
      <Environment files="/tex/studio.hdr" environmentIntensity={0.12} />

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
      <Instances geometry={kit.ceiling.geometry} material={kit.ceiling.material} limit={25}>
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
        const [x, z] = polar(gap(k) + STEP / 2, 4.3);
        return (
          <group key={k}>
            <Model url="/models/lab/hanging_industrial_lamp.glb" position={[x, H - 0.3, z]} />
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

      <Sparkles count={low ? 40 : 110} scale={[11, 3.6, 11]} position-y={2} size={1.6} speed={0.15} opacity={0.35} color="#ffd9a8" noise={0.6} />
      {/* soft contact shadows, baked once after everything (incl. other suspended models) has loaded */}
      {baked && <ContactShadows frames={1} position-y={0.008} scale={wall * 2} resolution={low ? 256 : 512} far={1.4} blur={2.4} opacity={0.6} color="#1a0f06" />}
      <mesh rotation-x={-Math.PI / 2} position-y={0.006}><ringGeometry args={[chamber + 0.3, chamber + 0.36, 96]} /><meshStandardMaterial color="#5a3d18" metalness={1} roughness={0.3} /></mesh>
    </>
  );
}

useGLTF.preload(KIT);
for (const u of ['/models/vintage/lab_cabinet.glb', '/models/vintage/glassware.glb', '/models/vintage/phone.glb', '/models/vintage/terminal.glb', '/models/lab/hanging_industrial_lamp.glb']) useGLTF.preload(u);
