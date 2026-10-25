// One-off: Mixamo FBX (no skin) -> public/anims/mixamo.glb, retargeted to public/models/Xbot.glb.
// Run: node scripts/convert-mixamo.mjs   (uses three's FBXLoader + GLTFExporter with a FileReader stub)
import fs from 'fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

globalThis.FileReader = class { // GLTFExporter binary path needs it; Node has Blob but no FileReader
  readAsArrayBuffer(b) { b.arrayBuffer().then((r) => { this.result = r; this.onloadend?.(); }); }
  readAsDataURL(b) { b.arrayBuffer().then((r) => { this.result = 'data:' + b.type + ';base64,' + Buffer.from(r).toString('base64'); this.onloadend?.(); }); }
};

const SRC = 'asset_originals/maximo/';
// name -> [file, loop, mode]; mode: 'loco' strips hips x/z root motion
const MAP = {
  idle: ['Idle', true], laugh: ['Laughing'], pickup: ['Picking Up'], point: ['Pointing'],
  run: ['Running', true, 'loco'], run_carry: ['Running_with_holding pose', true, 'loco'],
  walk_start: ['Start Walking', false, 'loco'], talk: ['Talking', true], talk2: ['Talking(1)', true],
  terrified: ['Terrified', true], victory: ['Victory'], walk: ['Walking', true, 'loco'],
};

const STEP = 1 / 24; // resample grid
// Xbot rest Hips translation, cm (Armature is scaled 0.01, so FBX cm values need no scaling)
const XBOT_HIPS_Y = 103.99; // FBX hips are also cm, so no scaling; only reported

const loader = new FBXLoader();
const out = new THREE.Group();
let skeletonRoot = null;
const clips = [];
const report = [];

for (const [name, [file, loop, mode]] of Object.entries(MAP)) {
  const buf = fs.readFileSync(`${SRC}${file}.fbx`);
  const fbx = loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  if (!skeletonRoot) { // any clip's hierarchy works as the bone-name carrier
    fbx.updateMatrixWorld(true);
    skeletonRoot = fbx.getObjectByName('mixamorigHips') ?? fbx.getObjectByName('mixamorig:Hips');
  }
  const src = fbx.animations[0];
  const tr = Object.fromEntries(src.tracks.map((t) => [t.name.replace('mixamorig:', 'mixamorig'), t]));
  const bones = [];
  fbx.traverse((o) => o.isBone && bones.push(o));
  fbx.updateMatrixWorld(true);
  const restW = new Map(bones.map((o) => [o, o.getWorldQuaternion(new THREE.Quaternion())]));
  // FBX bones carry pre-rotations (non-identity rest); Xbot's rest is identity everywhere. So take each
  // bone's world-space delta from rest, and re-express it in Xbot's parent frame (= parent's delta).
  const n = Math.round(src.duration / STEP) + 1;
  const times = Array.from({ length: n }, (_, i) => Math.min(i * STEP, src.duration));
  const rot = new Map(bones.map((o) => [o, new Float32Array(n * 4)]));
  const q = new THREE.Quaternion(), dW = new Map(), tmp = new THREE.Quaternion();
  const interp = new Map(bones.map((o) => [o, tr[o.name.replace('mixamorig:', 'mixamorig') + '.quaternion']?.createInterpolant()]));
  for (let i = 0; i < n; i++) {
    const anim = new Map(); // bone -> world quat this frame
    for (const o of bones) { // bones traversed parent-first
      const it = interp.get(o);
      if (it) { it.evaluate(times[i]); q.fromArray(it.resultBuffer); } else q.copy(o.quaternion);
      const pw = o.parent?.isBone ? anim.get(o.parent) : new THREE.Quaternion();
      const w = pw.clone().multiply(q); anim.set(o, w);
      const d = w.clone().multiply(restW.get(o).clone().invert()); // Xbot world rotation of this bone
      dW.set(o, d);
      const pd = o.parent?.isBone ? dW.get(o.parent) : tmp.identity();
      pd.clone().invert().multiply(d).toArray(rot.get(o), i * 4);
    }
  }
  const tracks = [];
  for (const o of bones) {
    const b = o.name.replace('mixamorig:', 'mixamorig');
    tracks.push(new THREE.QuaternionKeyframeTrack(`${b}.quaternion`, times, Array.from(rot.get(o), (v) => +v.toFixed(5))));
  }
  const hp = tr['mixamorigHips.position'];
  const hv = Array.from(hp.values);
  report.push(`${name}: hips y0=${hv[1].toFixed(1)} (xbot rest ${XBOT_HIPS_Y})`);
  const it = hp.createInterpolant(), hips = [];
  for (const t of times) { it.evaluate(t); const r = it.resultBuffer; hips.push(mode === 'loco' ? 0 : +r[0].toFixed(2), +r[1].toFixed(2), mode === 'loco' ? 0 : +r[2].toFixed(2)); }
  tracks.push(new THREE.VectorKeyframeTrack('mixamorigHips.position', times, hips));
  let clip = new THREE.AnimationClip(name, -1, tracks);
  clip.resetDuration();
  // loop-friendly: for loops, force last key == first key
  if (loop) for (const t of clip.tracks) {
    const n = t.getValueSize(), v = t.values, l = v.length;
    for (let k = 0; k < n; k++) v[l - n + k] = v[k];
  }
  clips.push(clip);
  console.log(name, clip.duration.toFixed(2) + 's', clip.tracks.length, 'tracks');
}
console.log(report.join('\n'));

// carrier scene: bone hierarchy named like Xbot (sanitized names)
skeletonRoot.traverse((o) => { o.name = o.name.replace('mixamorig:', 'mixamorig'); });
skeletonRoot.parent?.remove(skeletonRoot);
out.add(skeletonRoot);
out.updateMatrixWorld(true);

const exp = new GLTFExporter();
const glb = await exp.parseAsync(out, { binary: true, animations: clips, onlyVisible: false });
fs.mkdirSync('public/anims', { recursive: true });
fs.writeFileSync('public/anims/mixamo.glb', Buffer.from(glb));
console.log('wrote', glb.byteLength, 'bytes');
