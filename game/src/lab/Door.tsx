import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PANEL, onPanel } from './layout';
import { useActors } from './actors';

/** Door centre along panel 9 (local x; Scenery's Door uses the same). Actors enter from DOOR_OUT through DOOR_IN. */
export const DOOR_X = -0.35;
const at = (lz: number) => { const [x, , z] = onPanel(PANEL.DOOR, DOOR_X, 0, lz); return [x, z] as [number, number]; };
export const DOOR_OUT = at(-1.1), DOOR_IN = at(0.9);
const W = 1.14, H = 2.3, Z = 0.12; // leaf width/height, hinge depth (front face of the leaf)

/**
 * Hinge for the study door's leaf (children, in door-centred coordinates), opened by useActors().door (0..1).
 * Behind it there is no corridor, only an opaque warm-lit plane: an actor walking in from behind the wall
 * emerges through the doorway because the plane hides whatever is still "outside".
 */
export function DoorSwing({ children }: { children: ReactNode }) {
  const hinge = useRef<THREE.Group>(null), lamp = useRef<THREE.PointLight>(null);
  const corridor = useMemo(() => {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128;
    const g = cv.getContext('2d')!, v = g.createLinearGradient(0, 0, 0, 128);
    v.addColorStop(0, '#120a05'); v.addColorStop(0.55, '#4a2c14'); v.addColorStop(1, '#8a5a2a');
    g.fillStyle = v; g.fillRect(0, 0, 64, 128);
    const h = g.createRadialGradient(32, 40, 2, 32, 40, 40); h.addColorStop(0, 'rgba(255,214,150,0.65)'); h.addColorStop(1, 'rgba(255,214,150,0)');
    g.fillStyle = h; g.fillRect(0, 0, 64, 128);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useFrame(({ clock }) => {
    const d = useActors.getState().door;
    if (hinge.current) hinge.current.rotation.y = -d * 1.75;
    if (lamp.current) lamp.current.intensity = d * (3 + Math.sin(clock.elapsedTime * 9) * 0.15);
  });
  return (
    <>
      {/* sits inside the closed leaf; in front of the dado and chair rail, which stand ~0.1 proud of the wall */}
      <mesh position={[0, H / 2, 0.105]}><planeGeometry args={[W, H]} /><meshBasicMaterial map={corridor} /></mesh>
      <group ref={hinge} position={[-W / 2, 0, Z]}>
        <group position={[W / 2, 0, -Z]}>{children}</group>
      </group>
      <pointLight ref={lamp} position={[0, 2.0, 0.6]} color="#ffc68a" distance={4.5} decay={1.6} intensity={0} />
    </>
  );
}
