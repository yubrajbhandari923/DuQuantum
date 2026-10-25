import { useGLTF } from '@react-three/drei';
import type * as THREE from 'three';

/**
 * Mixamo clips retargeted to the Xbot rig (bone names `mixamorigHips`...), from /anims/mixamo.glb.
 * Loops: idle, talk, talk2, terrified, walk, run, run_carry.
 * One-shots: laugh, pickup, point, victory, walk_start.
 * walk/run/run_carry/walk_start have hips x/z root motion stripped (y bob kept): move the group yourself.
 * Regenerate with `node scripts/convert-mixamo.mjs`.
 */
export function useMixamoClips(): Record<string, THREE.AnimationClip> {
  const { animations } = useGLTF('/anims/mixamo.glb');
  return Object.fromEntries(animations.map((a) => [a.name, a]));
}

useGLTF.preload('/anims/mixamo.glb');
