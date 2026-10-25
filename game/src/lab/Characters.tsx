import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { nextLevel, useGame } from '../store';
import { think, useActors, type ActorId, type Arms, type Gesture } from './actors';
import { useMixamoClips } from './mixamoClips';

/** Who is talking right now; Dialogue writes it, the hub lights that face. */
export const speaker: { who: string | null } = { who: null };

const live = (id: ActorId) => useActors.getState().a[id];
/** The two physicists. x/z are live (the walker collides with them); off-stage actors report a far-away spot. */
export const CHARACTERS = [
  {
    id: 'heisenberg', get x() { return live('heisenberg').visible ? live('heisenberg').x : 99; }, get z() { return live('heisenberg').z; }, photo: '/tex/heisenberg_face.jpg',
    crop: [58, 28, 186, 292], // ear to ear, crown to chin, in source pixels
    skinAt: [0.5, 0.22], hairAt: [0.5, 0.1], hairline: 0.3, grade: 'saturate(0.78)', nose: [-0.2, 0.17], // bald: "hair" is scalp
    jacket: '#2b2c30', shirt: '#4a1820', trousers: '#8d8068', shoes: '#2a211a', light: '#e4efd8', hem: 0.2,
  },
  {
    id: 'schrodinger', get x() { return live('schrodinger').visible ? live('schrodinger').x : 99; }, get z() { return live('schrodinger').z; }, photo: '/tex/schrodinger_face.jpg',
    crop: [45, 8, 195, 307],
    skinAt: [0.22, 0.6], hairAt: [0.5, 0.05], hairline: 0.6, grade: 'none', nose: [-0.27, 0.17],
    jacket: '#e8e5dc', shirt: '#f6f4ee', trousers: '#2e2f38', shoes: '#1c1a19', light: '#ffe6c4', hem: 0.62,
  },
] as const;
type Char = (typeof CHARACTERS)[number];

const HEAD = new THREE.Vector3(0.086, 0.124, 0.106); // ellipsoid half-axes, metres
const front = (() => { // front hemisphere with the photo projected straight on (planar UVs)
  const g = new THREE.SphereGeometry(1, 48, 32, 0, Math.PI);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getX(i) * 0.5, 0.5 + p.getY(i) * 0.5);
  return g;
})();
const back = new THREE.SphereGeometry(1, 48, 32, Math.PI, Math.PI);
/** Small bump at the nose (unit-head space) with the same straight-on photo projection, so 3/4 views get some relief. */
const nose = ([cy, hy]: readonly number[]) => {
  const g = new THREE.SphereGeometry(1, 20, 14).scale(0.17, hy, 0.2).translate(0, cy, Math.sqrt(1 - cy * cy) * 0.9);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getX(i) * 0.5, 0.5 + p.getY(i) * 0.5);
  return g;
};

const avg = (g: CanvasRenderingContext2D, x: number, y: number) => {
  const d = g.getImageData(x - 6, y - 6, 12, 12).data;
  let r = 0, gr = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; gr += d[i + 1]; b += d[i + 2]; }
  const n = d.length / 4;
  return `rgb(${Math.round(r / n)},${Math.round(gr / n)},${Math.round(b / n)})`;
};

/** Face canvas (photo feathered into sampled hair/skin colours) and a matching back-of-head gradient. */
function headTextures(c: Char, onSkin: (css: string) => void) {
  const [sx, sy, sw, sh] = c.crop;
  const W = 512, H = Math.round((W * sh) / sw);
  const fc = document.createElement('canvas'); fc.width = W; fc.height = H;
  const bc = document.createElement('canvas'); bc.width = 4; bc.height = 128;
  const face = new THREE.CanvasTexture(fc), backTex = new THREE.CanvasTexture(bc);
  face.colorSpace = backTex.colorSpace = THREE.SRGBColorSpace;
  face.anisotropy = 4;
  const img = new Image();
  img.onload = () => {
    const g = fc.getContext('2d', { willReadFrequently: true })!;
    g.filter = c.grade; g.drawImage(img, sx, sy, sw, sh, 0, 0, W, H); g.filter = 'none'; // tame the red cast under the warm lamps
    const skin = avg(g, c.skinAt[0] * W, c.skinAt[1] * H), hair = avg(g, c.hairAt[0] * W, c.hairAt[1] * H);
    const photo = document.createElement('canvas'); photo.width = W; photo.height = H;
    const pg = photo.getContext('2d')!;
    pg.drawImage(fc, 0, 0);
    // background: hair above the hairline, skin below, so the rim of the face blends into the back of the head
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, hair); bg.addColorStop(c.hairline * 0.6, hair); bg.addColorStop(Math.min(1, c.hairline + 0.15), skin); bg.addColorStop(1, skin);
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const m = document.createElement('canvas'); m.width = W; m.height = H; // feathered oval mask
    const mg = m.getContext('2d')!;
    mg.translate(W / 2, H / 2); mg.scale(1, H / W);
    const rad = mg.createRadialGradient(0, 0, W * 0.32, 0, 0, W * 0.47); // fade out before the photo's background shows
    rad.addColorStop(0, '#fff'); rad.addColorStop(1, 'rgba(255,255,255,0)');
    mg.fillStyle = rad; mg.fillRect(-W / 2, -W / 2, W, W);
    pg.globalCompositeOperation = 'destination-in'; pg.drawImage(m, 0, 0);
    g.drawImage(photo, 0, 0);
    const b = bc.getContext('2d')!, bgr = b.createLinearGradient(0, 0, 0, 128);
    bgr.addColorStop(0, hair); bgr.addColorStop(c.hairline, hair); bgr.addColorStop(Math.min(1, c.hairline + 0.15), skin); bgr.addColorStop(1, skin);
    b.fillStyle = bgr; b.fillRect(0, 0, 4, 128);
    face.needsUpdate = backTex.needsUpdate = true;
    onSkin(skin);
  };
  img.src = c.photo;
  return { face, backTex };
}

const KEEP = /Hand|Foot|Toe/; // Xbot parts we keep; everything else is replaced by clothes and the photo head
/** Keep only the Xbot's hands and feet (by dominant skinning bone) and colour them skin / shoe. */
function trim(m: THREE.SkinnedMesh, c: Char, skin: THREE.Color) {
  const g = m.geometry.clone(); m.geometry = g; // own the geometry (the GLTF one is shared by both clones)
  const si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = g.attributes.position.count;
  const name: string[] = [];
  for (let i = 0; i < n; i++) {
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > bw) { bw = sw.getComponent(i, k); best = si.getComponent(i, k); }
    name.push(m.skeleton.bones[best].name);
  }
  const keep = (i: number) => KEEP.test(name[i]);
  const idx = g.index!.array, out: number[] = [];
  for (let t = 0; t < idx.length; t += 3) if (keep(idx[t]) && keep(idx[t + 1]) && keep(idx[t + 2])) out.push(idx[t], idx[t + 1], idx[t + 2]);
  g.setIndex(out);
  const col = new Float32Array(n * 3), shoe = new THREE.Color(c.shoes);
  m.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
  return () => { // recolour once the photo's skin tone is known
    for (let i = 0; i < n; i++) (/Foot|Toe/.test(name[i]) ? shoe : skin).toArray(col, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  };
}

/** Jacket/coat texture for the torso capsule: the shirt shows in a V at the front (u = 0.5 after the geometry turn). */
function torsoTexture(c: Char) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
  const g = cv.getContext('2d')!;
  g.fillStyle = c.jacket; g.fillRect(0, 0, 256, 256);
  g.fillStyle = c.shirt; g.beginPath(); g.moveTo(128 - 30, 0); g.lineTo(128 + 30, 0); g.lineTo(128, 170); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3; g.beginPath(); g.moveTo(128 - 30, 0); g.lineTo(128, 170); g.lineTo(128 + 30, 0); g.stroke(); // lapel edge
  if (c.id === 'schrodinger') { g.fillStyle = '#1d2340'; g.beginPath(); g.ellipse(128 - 11, 16, 11, 7, 0, 0, 7); g.ellipse(128 + 11, 16, 11, 7, 0, 0, 7); g.fill(); } // bow tie
  else { g.fillStyle = '#3a1418'; g.fillRect(124, 4, 8, 120); } // tie
  g.fillStyle = 'rgba(0,0,0,0.3)'; for (const y of [190, 215, 240]) { g.beginPath(); g.arc(128, y, 3, 0, 7); g.fill(); } // buttons
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

type Part = 'torso' | 'jacket' | 'trousers' | 'skin';
const SIDE = ['Left', 'Right'];
/** [bone, child it reaches toward, radius, x scale, z scale, part] */
const SEGMENTS: [string, string, number, number, number, Part][] = [
  ['Spine1', 'Neck', 0.12, 1.4, 0.82, 'torso'],
  ['Hips', 'Spine1', 0.118, 1.3, 0.86, 'jacket'],
  ['Neck', 'Head', 0.042, 1, 1, 'skin'],
  ...SIDE.flatMap((s): typeof SEGMENTS => [
    [`${s}Shoulder`, `${s}Arm`, 0.062, 1, 1, 'jacket'],
    [`${s}Arm`, `${s}ForeArm`, 0.056, 1, 1, 'jacket'],
    [`${s}ForeArm`, `${s}Hand`, 0.048, 1, 1, 'jacket'],
    [`${s}UpLeg`, `${s}Leg`, 0.078, 1, 1, 'trousers'],
    [`${s}Leg`, `${s}Foot`, 0.06, 1, 1, 'trousers'],
  ]),
];

type Follower = { bone: THREE.Object3D; rest: THREE.Quaternion; obj: THREE.Object3D };

function Physicist({ c }: { c: Char }) {
  const { scene, animations } = useGLTF('/models/Xbot.glb');
  const mix = useMixamoClips();
  const skin = useMemo(() => new THREE.Color('#c99a80'), []);
  const { model, clothes, followers, recolour, skinMat } = useMemo(() => {
    const model = clone(scene);
    const bone = (n: string) => (model.getObjectByName(`mixamorig${n}`) ?? model.getObjectByName(`mixamorig:${n}`))!;
    const recolour: (() => void)[] = [];
    model.traverse((o) => {
      const s = o as THREE.SkinnedMesh;
      if (s.isSkinnedMesh) { s.castShadow = true; recolour.push(trim(s, c, skin)); }
    });
    model.updateMatrixWorld(true); // bind pose: build every clothing piece in model axes
    const mats: Record<Part, THREE.Material> = {
      torso: new THREE.MeshStandardMaterial({ map: torsoTexture(c), roughness: 0.85 }),
      jacket: new THREE.MeshStandardMaterial({ color: c.jacket, roughness: 0.85 }),
      trousers: new THREE.MeshStandardMaterial({ color: c.trousers, roughness: 0.9 }),
      skin: new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 }),
    };
    const clothes = new THREE.Group(), followers: Follower[] = [];
    const follow = (b: THREE.Object3D) => {
      let f = followers.find((x) => x.bone === b);
      if (!f) { f = { bone: b, rest: b.getWorldQuaternion(new THREE.Quaternion()).invert(), obj: new THREE.Group() }; followers.push(f); clothes.add(f.obj); }
      return f.obj;
    };
    const a = new THREE.Vector3(), d = new THREE.Vector3();
    for (const [bn, cn, r, sx, sz, part] of SEGMENTS) {
      const b = bone(bn);
      b.getWorldPosition(a); bone(cn).getWorldPosition(d).sub(a);
      const len = d.length();
      const geo = part === 'torso' // tapered chest: waist, broad shoulders, sloping into the neck
        ? new THREE.LatheGeometry([[0.82, -0.6], [0.86, -0.2], [0.98, 0.2], [1, 0.38], [0.85, 0.5], [0.5, 0.56], [0.3, 0.58]].map(([x, y]) => new THREE.Vector2(x * r, y * (len + r))), 28).rotateY(Math.PI)
        : new THREE.CapsuleGeometry(r, Math.max(0.01, len - r), 6, 20);
      const mesh = new THREE.Mesh(geo, mats[part]);
      mesh.castShadow = true;
      mesh.position.copy(d).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      mesh.scale.set(sx, 1, sz);
      follow(b).add(mesh);
    }
    const hem = new THREE.Mesh( // jacket / lab-coat skirt below the waist, open at the front
      new THREE.CylinderGeometry(0.165, 0.18 + c.hem * 0.1, c.hem, 32, 1, true, c.hem > 0.3 ? 0.3 : 0, Math.PI * 2 - (c.hem > 0.3 ? 0.6 : 0)), // the lab coat hangs open
      new THREE.MeshStandardMaterial({ color: c.jacket, roughness: 0.85, side: THREE.DoubleSide }),
    );
    hem.position.y = 0.08 - c.hem / 2; hem.scale.z = 0.82; hem.castShadow = true;
    follow(bone('Hips')).add(hem);
    const head = bone('Head');
    return { model, clothes, followers: [...followers, { bone: head, rest: head.getWorldQuaternion(new THREE.Quaternion()).invert(), obj: new THREE.Group() }], recolour, skinMat: mats.skin };
  }, [scene, c, skin]);
  const tex = useMemo(() => headTextures(c, (css) => { skin.set(css); (skinMat as THREE.MeshStandardMaterial).color.set(css); recolour.forEach((f) => f()); }), [c, skin, skinMat, recolour]);
  const noseGeo = useMemo(() => nose(c.nose), [c]);
  const faceMat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex.face, emissiveMap: tex.face, emissive: '#ffffff', emissiveIntensity: 0.08, roughness: 0.75 }), [tex]);
  const root = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const rig = useMemo(() => {
    const mixer = new THREE.AnimationMixer(model);
    const clip = (n: string) => animations.find((a) => a.name === n)!;
    const base = { idle: mixer.clipAction(clip('idle')), walk: mixer.clipAction(clip('walk')), run: mixer.clipAction(clip('run')) };
    for (const a of Object.values(base)) a.setEffectiveWeight(0).play();
    const talk = mixer.clipAction(mix[c.id === 'heisenberg' ? 'talk2' : 'talk']); talk.setEffectiveWeight(0).play(); // Mixamo talking loop, blended in while standing and speaking
    const shots = ['laugh', 'point'].map((n) => mixer.clipAction(mix[n]).setLoop(THREE.LoopOnce, 1)); // Heisenberg's taunts start with one of these
    base.idle.setEffectiveWeight(1);
    // gestures layer on top of the walk/idle as additive clips (as in three's Xbot example)
    const gest = Object.fromEntries(['agree', 'headShake', 'sad_pose', 'sneak_pose'].map((n) => {
      const c = THREE.AnimationUtils.makeClipAdditive(clip(n).clone());
      const a = mixer.clipAction(c);
      if (/pose/.test(n)) a.setLoop(THREE.LoopRepeat, Infinity); else { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = false; }
      return [n, a];
    })) as Record<Exclude<Gesture, null>, THREE.AnimationAction>;
    const bone = (n: string) => (model.getObjectByName(`mixamorig${n}`) ?? model.getObjectByName(`mixamorig:${n}`))!;
    const bones = { la: bone('LeftArm'), lf: bone('LeftForeArm'), ra: bone('RightArm'), rf: bone('RightForeArm'), neck: bone('Neck'), head: bone('Head') };
    return { mixer, base, gest, bones, talk, shots };
  }, [model, animations, mix]);
  const st = useRef({ talk: 0, said: '', nshot: 0, ry: 0, v: 0, px: NaN, pz: 0, gesture: null as Gesture, armW: 0, arms: null as Arms, gaze: 0 });
  const headObj = followers[followers.length - 1].obj;

  useEffect(() => () => { rig.mixer.stopAllAction(); }, [rig]);

  useFrame((_, rawDt) => {
    const scr = useGame.getState().screen;
    if (scr === 'level' || scr === 'sandbox' || !root.current) return; // off camera: no animation work at all
    const dt = Math.min(rawDt, 0.1), a = useActors.getState().a[c.id], s = st.current, g = root.current;
    g.visible = a.visible && !(scr === 'ending' && c.id === 'heisenberg'); // he has left by the ending
    if (!a.visible) { s.px = NaN; return; }
    // facing: turn smoothly (rate-limited) toward the wanted yaw
    let dy = a.yaw - s.ry; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    s.ry += THREE.MathUtils.clamp(dy * Math.min(1, dt * 7), -6 * dt, 6 * dt);
    a.ry = s.ry;
    g.position.set(a.x, 0, a.z); g.rotation.y = s.ry;
    // measured ground speed drives the idle / walk / run blend (works for scripted and AI motion alike)
    const moved = Number.isNaN(s.px) ? 0 : Math.hypot(a.x - s.px, a.z - s.pz);
    s.px = a.x; s.pz = a.z;
    s.v += (Math.min(5, moved / Math.max(dt, 1e-3)) - s.v) * Math.min(1, dt * 8);
    const v = s.v, run = THREE.MathUtils.clamp((v - 1.7) / 1.0, 0, 1), walk = THREE.MathUtils.clamp(v / 0.5, 0, 1) - run;
    const said = a.speech?.text ?? '';
    if (c.id === 'heisenberg' && said && said !== s.said && v < 0.4) rig.shots[s.nshot++ % 2].reset().play();
    s.said = said;
    const shot = Math.max(0, ...rig.shots.map((x) => (x.isRunning() ? Math.min(1, x.time / 0.25, (x.getClip().duration - x.time) / 0.4) : 0)));
    const still = 1 - walk - run;
    s.talk += (+((!!a.speech || speaker.who === c.id) && v < 0.4) - s.talk) * Math.min(1, dt * 4);
    rig.base.idle.setEffectiveWeight(still * (1 - shot) * (1 - s.talk)); rig.talk.setEffectiveWeight(still * (1 - shot) * s.talk);
    for (const x of rig.shots) x.setEffectiveWeight(x.isRunning() ? still * shot : 0);
    rig.base.walk.setEffectiveWeight(walk).setEffectiveTimeScale(THREE.MathUtils.clamp(v / 1.25, 0.5, 1.6));
    rig.base.run.setEffectiveWeight(run).setEffectiveTimeScale(THREE.MathUtils.clamp(v / 3.3, 0.7, 1.4));
    if (a.gesture !== s.gesture) { // start / stop a gesture layer
      if (s.gesture) rig.gest[s.gesture].fadeOut(0.35);
      if (a.gesture) rig.gest[a.gesture].reset().setEffectiveWeight(1).fadeIn(0.25).play();
      s.gesture = a.gesture;
    }
    rig.mixer.update(dt);

    // procedural overrides on top of the clips: arms (carry / reach / low) and head gaze
    if (a.arms) s.arms = a.arms;
    s.armW += ((a.arms ? 1 : 0) - s.armW) * Math.min(1, dt * 6);
    if (s.armW > 0.01 && s.arms) {
      const pose = POSES[s.arms];
      aim(rig.bones.la, pose[0], g.quaternion, s.armW); aim(rig.bones.lf, pose[1], g.quaternion, s.armW);
      aim(rig.bones.ra, pose[2], g.quaternion, s.armW); aim(rig.bones.rf, pose[3], g.quaternion, s.armW);
    }
    let want = 0;
    if (a.look) {
      const rel = Math.atan2(a.lx - a.x, a.lz - a.z) - s.ry, r = Math.atan2(Math.sin(rel), Math.cos(rel));
      want = Math.abs(r) < 2.2 ? THREE.MathUtils.clamp(r, -1.05, 1.05) : 0;
    }
    s.gaze += (want - s.gaze) * Math.min(1, dt * 4);
    if (Math.abs(s.gaze) > 0.01) { turn(rig.bones.neck, s.gaze * 0.4); turn(rig.bones.head, s.gaze * 0.6); }

    // clothes and head follow their bones' pose (bones carry the armature's 0.01 scale, so copy pose only)
    model.updateMatrixWorld(true);
    const inv = g.getWorldQuaternion(qInv).invert();
    for (const f of followers) {
      f.bone.getWorldPosition(f.obj.position); g.worldToLocal(f.obj.position);
      f.obj.quaternion.copy(inv).multiply(f.bone.getWorldQuaternion(qTmp)).multiply(f.rest);
    }
    const on = speaker.who === c.id, k = 1 - Math.exp(-6 * dt);
    faceMat.emissiveIntensity += ((on ? 0.4 : 0.08) - faceMat.emissiveIntensity) * k;
    if (light.current) light.current.intensity += ((on ? 8 : 2.5) - light.current.intensity) * k;
  });

  const Y = 0.095; // head centre above the head bone
  return (
    <group ref={root}>
      <primitive object={model} />
      <primitive object={clothes} />
      <primitive object={headObj}>
        <group position-y={Y} scale={HEAD}>
          <mesh geometry={front} material={faceMat} castShadow />
          <mesh geometry={noseGeo} material={faceMat} />
          <mesh geometry={back} castShadow><meshStandardMaterial map={tex.backTex} roughness={0.8} /></mesh>
        </group>
        <mesh position-y={-0.045}><cylinderGeometry args={[0.052, 0.058, 0.05, 24, 1, true]} /><meshStandardMaterial color={c.shirt} side={THREE.DoubleSide} /></mesh>
        {c.id === 'heisenberg' && <Hat y={Y} />}
      </primitive>
      <pointLight ref={light} position={[0, 2.1, 0.9]} intensity={2.5} distance={3.5} color={c.light} />
      <Bubble id={c.id} />
    </group>
  );
}

const qInv = new THREE.Quaternion(), qTmp = new THREE.Quaternion(), qP = new THREE.Quaternion(), qW = new THREE.Quaternion(), qR = new THREE.Quaternion();
const vTmp = new THREE.Vector3(), vDir = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const n = (x: number, y: number, z: number) => new THREE.Vector3(-x, y, z).normalize(); // TEST flip
/** Arm poses as bone directions in the body frame (+z forward, +x the character's left): [L upper, L fore, R upper, R fore]. */
const POSES: Record<Exclude<Arms, null>, THREE.Vector3[]> = {
  carry: [n(0.3, -0.75, 0.45), n(-0.6, 0.25, 0.75), n(-0.3, -0.75, 0.45), n(0.6, 0.25, 0.75)],
  reach: [n(0.12, -0.3, 1), n(0.04, -0.05, 1), n(-0.12, -0.3, 1), n(-0.04, -0.05, 1)],
  low: [n(0.12, -0.75, 0.65), n(-0.05, -0.85, 0.5), n(-0.12, -0.75, 0.65), n(0.05, -0.85, 0.5)],
};
/** Blend a bone so its +y (Mixamo bones point down the limb along +y) aims along `dir` (body frame, rotated by `body`). */
function aim(b: THREE.Object3D, dir: THREE.Vector3, body: THREE.Quaternion, w: number) {
  b.getWorldQuaternion(qW);
  qR.setFromUnitVectors(vTmp.copy(UP).applyQuaternion(qW), vDir.copy(dir).applyQuaternion(body));
  qW.premultiply(qR);
  b.parent!.getWorldQuaternion(qP).invert();
  b.quaternion.slerp(qP.multiply(qW), w);
}
/** Turn a bone by `ang` about the world vertical (head/neck gaze). */
function turn(b: THREE.Object3D, ang: number) {
  b.getWorldQuaternion(qW).premultiply(qR.setFromAxisAngle(UP, ang));
  b.parent!.getWorldQuaternion(qP).invert();
  b.quaternion.copy(qP.multiply(qW));
}

/** Speech bubble over an actor's head (hub only; cutscene lines use the caption box). */
function Bubble({ id }: { id: ActorId }) {
  const speech = useActors((s) => s.a[id].speech);
  const hub = useGame((s) => s.screen === 'hub');
  if (!speech || !hub) return null;
  return (
    <Html position={[0, 2.25, 0]} center zIndexRange={[15, 10]} style={{ pointerEvents: 'none' }}>
      <div className={`bubble bubble-${id}`} key={speech.text}>
        <b>{id === 'heisenberg' ? 'Heisenberg' : 'Schrödinger'}</b>
        {speech.text}
      </div>
    </Html>
  );
}

/** Heisenberg's pork-pie hat (the photo already has the glasses and goatee). */
function Hat({ y }: { y: number }) {
  const black = <meshStandardMaterial color="#141414" roughness={0.7} />;
  return (
    <group position={[0, y + HEAD.y * 0.62, -0.006]} rotation-x={-0.08}>
      <mesh castShadow position-y={0.035}><cylinderGeometry args={[0.09, 0.095, 0.07, 32]} />{black}</mesh>
      <mesh position-y={0.012}><cylinderGeometry args={[0.0965, 0.0965, 0.018, 32]} /><meshStandardMaterial color="#2c2c2c" /></mesh>
      <mesh castShadow><cylinderGeometry args={[0.155, 0.155, 0.007, 40]} />{black}</mesh>
    </group>
  );
}

useGLTF.preload('/models/Xbot.glb');

/** Hub AI: runs only while the player walks the lab. */
function Brains() {
  useFrame(({ camera }, dt) => {
    const g = useGame.getState();
    if (g.screen !== 'hub') return;
    think(Math.min(dt, 0.1), { x: camera.position.x, z: camera.position.z, yaw: camera.rotation.y }, nextLevel(g.completed), !!g.panel || speaker.who !== null);
  });
  return null;
}

export function Characters() {
  return <><Brains /><Suspense fallback={null}>{CHARACTERS.map((c) => <Physicist key={c.id} c={c} />)}</Suspense></>;
}
