import { Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { C } from '../styles/colors';
import { play } from '../audio/sfx';
import { useGame } from '../store';
import type { Part, Slot } from './CircuitBench';
import { M, PartModel } from './parts3d';

interface Props {
  parts: Part[]; slots: Slot[]; wires: [string, string][];
  placed: Record<string, string>; onPlace: (slot: string, type: string | null) => void;
  notice?: string;
}

const PX = 0.01; // world units per old 640x300 SVG pixel
const SNAP = 60 * PX; // the old 60px drop radius
const LIFT = 0.45; // held part height above the bench
const TRAY_Z = 2.3;
const slotPos = (s: Slot) => new THREE.Vector3((s.x - 320) * PX, 0, (s.y - 150) * PX);
const trayPos = (i: number, n: number) => new THREE.Vector3((i - (n - 1) / 2) * Math.min(1.05, 6.6 / n), 0, TRAY_Z);
const TRAY_SCALE = 0.82;

type Three = { camera: THREE.Camera; size: { width: number; height: number }; invalidate: () => void };
type Snap = { p: THREE.Vector3; t: number };

/** 3D drag-and-snap bench, same props and rules as the SVG bench. Accessible HTML buttons sit over every socket and tray part. */
export function CircuitBench3D({ parts, slots, wires, placed, onPlace, notice }: Props) {
  const low = useGame((s) => s.settings.quality === 'low');
  const [armed, setArmed] = useState<string | null>(null);
  const [held, setHeld] = useState<{ type: string; rot: number } | null>(null);
  const [bad, setBad] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [rot, setRot] = useState<Record<string, number>>({});
  const [anim, setAnim] = useState(0);
  const three = useRef<Three | null>(null);
  const pointer = useRef(new THREE.Vector3(0, LIFT, TRAY_Z));
  const snaps = useRef<Record<string, Snap>>({});
  const badAt = useRef(0);
  const labels = useRef<Record<string, HTMLElement | null>>({});
  const press = useRef<{ type: string; slot?: string; sx: number; sy: number; dragging: boolean; onButton: boolean } | null>(null);
  const suppress = useRef(false);
  const wrap = useRef<HTMLDivElement>(null);
  const heldRef = useRef(held); heldRef.current = held;
  const placedRef = useRef(placed); placedRef.current = placed; // window listeners outlive the render that added them

  const byType = (t: string) => parts.find((p) => p.type === t)!;
  const used = new Set(Object.values(placed));
  const tray = useMemo(() => parts.map((p, i) => ({ type: p.type, pos: trayPos(i, parts.length) })), [parts]);
  const kick = () => { setAnim((a) => a + 1); setTimeout(() => setAnim((a) => a - 1), 700); };

  // Ray from a client point onto the horizontal plane at height y.
  const ray = new THREE.Raycaster();
  const toPlane = (cx: number, cy: number, y: number) => {
    const t = three.current, el = wrap.current?.querySelector('canvas');
    if (!t || !el) return null;
    const r = el.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), t.camera);
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), new THREE.Vector3());
  };
  const nearest = <T,>(items: T[], pos: (x: T) => THREE.Vector3, p: THREE.Vector3, max: number) =>
    items.map((x) => ({ x, d: Math.hypot(pos(x).x - p.x, pos(x).z - p.z) })).filter((h) => h.d < max).sort((a, b) => a.d - b.d)[0]?.x;

  const tryPlace = (slot: Slot, type: string, from?: THREE.Vector3) => {
    if (!slot.accepts.includes(type)) {
      play('fail'); setBad(slot.id); badAt.current = performance.now(); kick(); setTimeout(() => setBad(null), 650);
      setMsg(`${byType(type).label} does not fit the ${slot.label} socket.`); return;
    }
    const i = parts.findIndex((p) => p.type === type);
    snaps.current[slot.id] = { p: from ?? trayPos(i, parts.length), t: performance.now() };
    setRot((r) => ({ ...r, [slot.id]: heldRef.current?.rot ?? 0 }));
    play('connect'); setMsg(''); setArmed(null); kick(); onPlace(slot.id, type);
  };
  const lift = (slot: Slot) => { play('click'); onPlace(slot.id, null); kick(); };

  // Pointer: press on a tray part or a placed part, drag past 8px to pick it up, release near a socket to snap.
  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || heldRef.current) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-part],[data-slot]');
    let type: string | undefined, slot: string | undefined;
    if (el) { type = el.dataset.part; slot = el.dataset.slot; if (slot) type = placed[slot]; if (el.hasAttribute('disabled')) type = undefined; }
    else if ((e.target as HTMLElement).tagName === 'CANVAS') {
      const p = toPlane(e.clientX, e.clientY, 0.15);
      const t = p && nearest(tray.filter((x) => !used.has(x.type)), (x) => x.pos, p, 0.45);
      const s = p && !t ? nearest(slots.filter((x) => placed[x.id]), slotPos, p, 0.5) : undefined;
      type = t ? t.type : s ? placed[s.id] : undefined; slot = s?.id;
      if (type) e.stopPropagation(); // keep the orbit controls from grabbing a part press
      else if (p && armed) { const hit = nearest(slots.filter((x) => !placed[x.id]), slotPos, p, SNAP); if (hit) tryPlace(hit, armed); }
    }
    if (!type) return;
    press.current = { type, slot, sx: e.clientX, sy: e.clientY, dragging: false, onButton: !!el };
    const move = (ev: PointerEvent) => {
      const pr = press.current; if (!pr) return;
      if (!pr.dragging && Math.hypot(ev.clientX - pr.sx, ev.clientY - pr.sy) > 8) {
        pr.dragging = true; setArmed(null);
        const r = pr.slot ? rot[pr.slot] ?? 0 : 0;
        if (pr.slot) lift(slots.find((s) => s.id === pr.slot)!); else play('click');
        setHeld({ type: pr.type, rot: r });
      }
      if (pr.dragging) { const p = toPlane(ev.clientX, ev.clientY, LIFT); if (p) pointer.current.copy(p); three.current?.invalidate(); }
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      const pr = press.current; press.current = null; if (!pr) return;
      if (pr.dragging) {
        suppress.current = true; setTimeout(() => { suppress.current = false; }, 0);
        const p = toPlane(ev.clientX, ev.clientY, LIFT);
        const hit = p && nearest(slots, slotPos, p, SNAP);
        if (hit && !placedRef.current[hit.id]) tryPlace(hit, pr.type, p!.clone()); else if (hit) { setMsg(`The ${hit.label} socket is taken. Pick its part up first.`); play('fail'); }
        setHeld(null); kick();
      } else if (!pr.onButton) {
        // A tap on a 3D part, same as clicking its button.
        if (pr.slot) lift(slots.find((s) => s.id === pr.slot)!); else { play('click'); setArmed((a) => (a === pr.type ? null : pr.type)); }
      }
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  // R or the mouse wheel turns the held part a quarter turn; Escape drops the selection.
  useEffect(() => {
    const turn = (d: number) => { setHeld((h) => (h ? { ...h, rot: h.rot + (d * Math.PI) / 2 } : h)); three.current?.invalidate(); };
    const key = (e: KeyboardEvent) => {
      if ((e.key === 'r' || e.key === 'R') && heldRef.current) turn(1);
      if (e.key === 'Escape') { setArmed(null); }
    };
    const wheel = (e: WheelEvent) => { if (heldRef.current) { e.preventDefault(); turn(Math.sign(e.deltaY)); } };
    const el = wrap.current;
    window.addEventListener('keydown', key); el?.addEventListener('wheel', wheel, { passive: false });
    return () => { window.removeEventListener('keydown', key); el?.removeEventListener('wheel', wheel); };
  }, []);

  const live = wires.some(([a, b]) => placed[a] && placed[b]);
  const busy = !!held || !!armed || !!bad || anim > 0 || live;
  const pressedOk = held?.type ?? armed;

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div ref={wrap} onPointerDownCapture={onDown} role="img" aria-label="Circuit workbench"
        style={{ position: 'relative', height: 'min(52vh, 460px)', minHeight: 300, borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.edge}`, background: '#140d08', touchAction: 'none', cursor: held ? 'grabbing' : undefined, userSelect: 'none' }}>
        <Canvas shadows={!low} dpr={low ? 1 : [1, 1.75]} frameloop={busy ? 'always' : 'demand'} camera={{ position: [0, 5, 6.1], fov: 31 }}
          gl={{ antialias: !low, powerPreference: 'high-performance' }} onCreated={(s) => { s.gl.toneMappingExposure = 1.05; }}>
          <Bridge out={three} />
          <color attach="background" args={['#140d08']} />
          <fog attach="fog" args={['#140d08', 10, 16]} />
          <OrbitControls target={[0, 0, 0.5]} enabled={!held} enablePan={false} enableZoom={false} enableDamping={false}
            minPolarAngle={0.55} maxPolarAngle={0.95} minAzimuthAngle={-0.35} maxAzimuthAngle={0.35} />
          <Lights low={low} />
          <Suspense fallback={null}>
            <Environment files="/tex/studio.hdr" environmentIntensity={0.55} />
            <Table />
            <ContactShadows position-y={0.002} scale={[9, 7]} blur={2.2} far={1.2} opacity={0.75} resolution={low ? 256 : 512} frames={24} key={JSON.stringify(placed)} />
          </Suspense>
          {slots.map((s) => <Socket key={s.id} slot={s} ok={!!pressedOk && !placed[s.id] && s.accepts.includes(pressedOk)} bad={bad === s.id} badAt={badAt} />)}
          {wires.map(([a, b]) => <Cable key={a + b} a={slots.find((s) => s.id === a)!} b={slots.find((s) => s.id === b)!} live={!!placed[a] && !!placed[b]} />)}
          {slots.map((s) => placed[s.id] && <Placed key={s.id + placed[s.id]} slot={s} part={byType(placed[s.id])} rot={rot[s.id] ?? 0} snap={snaps.current[s.id]} />)}
          {tray.map(({ type, pos }) => !used.has(type) && held?.type !== type &&
            <TrayPart key={type} part={byType(type)} pos={pos} armed={armed === type} />)}
          {held && <Held part={byType(held.type)} at={pointer} rot={held.rot} />}
          <Labels slots={slots} tray={tray} labels={labels} />
        </Canvas>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div role="group" aria-label="Parts tray">
            {parts.map((p, i) => {
              const up = parts.length > 5 && i % 2 === 1; // stagger crowded tray labels above/below
              const gone = used.has(p.type);
              return (
                <button key={p.type} ref={(el) => { labels.current['part:' + p.type] = el; }} data-part={p.type} className="b3-hit" aria-pressed={armed === p.type} disabled={gone}
                  style={{ width: 84, height: 62 }}
                  onClick={() => { if (suppress.current) return; play('click'); setArmed(armed === p.type ? null : p.type); }}>
                  <span className="b3-tag" style={{ ...(up && { top: 'auto', bottom: '100%' }), borderColor: armed === p.type ? C.cyan : undefined, color: gone ? C.muted : C[p.tone] }}>{p.label}</span>
                </button>
              );
            })}
          </div>
          <div role="group" aria-label="Sockets">
            {slots.map((s) => {
              const part = placed[s.id] ? byType(placed[s.id]) : null;
              return (
                <button key={s.id} ref={(el) => { labels.current['slot:' + s.id] = el; }} data-slot={s.id} className="b3-hit"
                  aria-label={`${s.label} socket${part ? `, holds ${part.label}` : ', empty'}`} style={{ width: 92, height: 70 }}
                  onClick={() => { if (suppress.current) return; if (part) lift(s); else if (armed) tryPlace(s, armed); }}>
                  <span className="b3-tag" style={{ borderColor: bad === s.id ? C.red : undefined }}>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="muted" style={{ minHeight: '1.4em', fontSize: 14 }} role="status">{msg || notice || 'Drag a part onto a socket, or tap a part and then a socket. Tap a placed part to pick it up. R or the wheel turns a held part.'}</div>
      <style>{`.b3-hit{position:absolute;left:0;top:0;transform:translate(-9999px,0);pointer-events:auto;background:none;border:0;padding:0;border-radius:10px;cursor:grab;color:inherit;font:inherit}
.b3-hit:disabled{cursor:default;pointer-events:none}
.b3-hit:focus-visible{outline:2px solid ${C.cyan};outline-offset:2px}
.b3-tag{position:absolute;left:50%;top:100%;transform:translate(-50%,2px);white-space:nowrap;font-size:12px;padding:2px 8px;border-radius:6px;background:rgba(7,9,15,.78);border:1px solid ${C.edge};color:${C.text}}`}</style>
    </div>
  );
}

function Bridge({ out }: { out: MutableRefObject<Three | null> }) {
  const { camera, size, invalidate } = useThree();
  out.current = { camera, size, invalidate };
  return null;
}

/** Keeps each HTML button centred over its socket or tray part as the camera moves. */
function Labels({ slots, tray, labels }: { slots: Slot[]; tray: { type: string; pos: THREE.Vector3 }[]; labels: MutableRefObject<Record<string, HTMLElement | null>> }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    const put = (key: string, p: THREE.Vector3, y: number) => {
      const el = labels.current[key]; if (!el) return;
      v.set(p.x, y, p.z).project(camera);
      el.style.transform = `translate(${((v.x + 1) / 2) * size.width - el.offsetWidth / 2}px, ${((1 - v.y) / 2) * size.height - el.offsetHeight / 2}px)`;
    };
    slots.forEach((s) => put('slot:' + s.id, slotPos(s), 0.12));
    tray.forEach((t) => put('part:' + t.type, t.pos, 0.15));
  });
  return null;
}

/** Warm tungsten key from a desk lamp, a dim cool window fill, and a low amber bounce. */
function Lights({ low }: { low: boolean }) {
  return <>
    <ambientLight intensity={0.06} color="#ffdcb0" />
    <directionalLight position={[3.5, 6, 3]} intensity={2.2} color="#ffc27a" castShadow={!low}
      shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={4} shadow-camera-bottom={-4} />
    <directionalLight position={[-5, 3, -2]} intensity={0.45} color="#9fb6dc" />
    <spotLight position={[-1.5, 4, 4.5]} angle={0.8} penumbra={1} intensity={7} color="#ffb867" distance={12} />
  </>;
}

const tiled = (t: THREE.Texture, rx: number, ry: number, srgb: boolean) => {
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; return t;
};

/** Worn wooden bench top (Poly Haven Wood Table Worn) with a green baize blotter along the front for the parts tray. */
function Table() {
  const [bd, br, bn] = useLoader(THREE.TextureLoader, ['/tex/bench_diff.jpg', '/tex/bench_rough.jpg', '/tex/bench_nor.jpg']);
  useMemo(() => { tiled(bd, 1.6, 1.1, true); tiled(br, 1.6, 1.1, false); tiled(bn, 1.6, 1.1, false); }, [bd, br, bn]);
  return <>
    <mesh position={[0, -0.12, 0.45]} receiveShadow><boxGeometry args={[9, 0.24, 6.4]} />
      <meshStandardMaterial map={bd} roughnessMap={br} normalMap={bn} color="#d8c2a8" metalness={0} roughness={0.9} envMapIntensity={0.5} /></mesh>
    <mesh position={[0, 0.006, TRAY_Z]} receiveShadow><boxGeometry args={[7.6, 0.012, 1.25]} />
      <meshStandardMaterial color="#1f3a2a" roughness={1} /></mesh>
    {/* brass rule between the work area and the tray */}
    <mesh position={[0, 0.01, TRAY_Z - 0.68]} material={M.gold}><boxGeometry args={[7.6, 0.02, 0.025]} /></mesh>
  </>;
}

/** Socket plate: bakelite pad, brass ring, brass binding posts. Glows when the held part fits, flashes red and shakes on a bad drop. */
function Socket({ slot, ok, bad, badAt }: { slot: Slot; ok: boolean; bad: boolean; badAt: MutableRefObject<number> }) {
  const g = useRef<THREE.Group>(null);
  const ring = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b08a45', metalness: 1, roughness: 0.3 }), []);
  const p = slotPos(slot);
  useFrame(({ clock }) => {
    const t = (performance.now() - badAt.current) / 1000;
    if (g.current) g.current.position.x = p.x + (bad ? Math.sin(t * 70) * 0.05 * Math.max(0, 1 - t / 0.65) : 0);
    ring.emissive.set(bad ? C.red : ok ? '#ffb347' : '#000000');
    ring.emissiveIntensity = bad ? 2 : ok ? 1.2 + 0.8 * Math.sin(clock.elapsedTime * 5) : 0;
  });
  return (
    <group ref={g} position={p}>
      <mesh material={M.dark} position-y={0.02} receiveShadow castShadow><boxGeometry args={[1.02, 0.04, 0.78]} /></mesh>
      <mesh material={ring} position-y={0.045} rotation-x={-Math.PI / 2}><ringGeometry args={[0.3, 0.34, 48]} /></mesh>
      <mesh material={ring} position-y={0.044} rotation-x={-Math.PI / 2}><torusGeometry args={[0.32, 0.018, 8, 48]} /></mesh>
      {[-1, 1].map((s) => <mesh key={s} material={M.gold} position={[s * 0.44, 0.06, 0]}><cylinderGeometry args={[0.035, 0.035, 0.05, 16]} /></mesh>)}
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b], i) => <mesh key={i} material={M.alu} position={[a * 0.45, 0.042, b * 0.33]}><cylinderGeometry args={[0.02, 0.02, 0.01, 10]} /></mesh>)}
    </group>
  );
}

// Moving stripe texture for the energy-flow sleeve on a live cable.
let flowTexC: THREE.CanvasTexture | undefined;
const flowTex = () => (flowTexC ??= (() => {
  const c = document.createElement('canvas'); c.width = 128; c.height = 4;
  const x = c.getContext('2d');
  if (x) { const g = x.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,255,255,0.15)'); g.addColorStop(0.92, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 4); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t;
})());

/** Cloth-covered cable sagging between two socket terminals; an energy pulse runs along it once both ends hold parts. */
function Cable({ a, b, live }: { a: Slot; b: Slot; live: boolean }) {
  const { core, sleeve, len } = useMemo(() => {
    const pa = slotPos(a), pb = slotPos(b), dir = pb.clone().sub(pa).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const s = pa.clone().addScaledVector(dir, 0.46).setY(0.07), e = pb.clone().addScaledVector(dir, -0.46).setY(0.07);
    const mid = s.clone().lerp(e, 0.5).setY(0.04).addScaledVector(side, 0.14);
    const curve = new THREE.CatmullRomCurve3([s, s.clone().addScaledVector(dir, 0.12).setY(0.2), mid, e.clone().addScaledVector(dir, -0.12).setY(0.2), e]);
    return { core: new THREE.TubeGeometry(curve, 80, 0.032, 10), sleeve: new THREE.TubeGeometry(curve, 80, 0.042, 10), len: curve.getLength() };
  }, [a, b]);
  const mat = useMemo(() => {
    const t = flowTex().clone(); t.repeat.set(Math.max(1, Math.round(len * 2)), 1);
    return new THREE.MeshBasicMaterial({ map: t, color: '#ffb55a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  }, [len]);
  useEffect(() => () => { core.dispose(); sleeve.dispose(); mat.map?.dispose(); mat.dispose(); }, [core, sleeve, mat]);
  useFrame((_, dt) => { if (live && mat.map) mat.map.offset.x -= dt * 1.4; });
  return <>
    <mesh geometry={core} material={M.rubber} castShadow />
    {live && <mesh geometry={sleeve} material={mat} />}
  </>;
}

const ease = (x: number) => 1 - Math.pow(1 - x, 3);

/** A part sitting in its socket; it eases down from wherever it was dropped. */
function Placed({ slot, part, rot, snap }: { slot: Slot; part: Part; rot: number; snap?: Snap }) {
  const g = useRef<THREE.Group>(null);
  const to = slotPos(slot).setY(0.045);
  useFrame(({ invalidate }) => {
    if (!g.current) return;
    const k = snap ? ease(Math.min(1, (performance.now() - snap.t) / 260)) : 1;
    if (k < 1) invalidate(); // finish the snap even on a slow GPU where the busy window ends first
    g.current.position.lerpVectors(snap?.p ?? to, to, k);
    g.current.scale.setScalar(THREE.MathUtils.lerp(snap && snap.p.z > 2 ? TRAY_SCALE : 1, 1, k));
  });
  return <group ref={g} position={to} rotation-y={rot}><PartModel glyph={part.glyph} tone={part.tone} /></group>;
}

function TrayPart({ part, pos, armed }: { part: Part; pos: THREE.Vector3; armed: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (g.current) g.current.position.y = 0.012 + (armed ? 0.12 + 0.03 * Math.sin(clock.elapsedTime * 4) : 0); });
  return <group ref={g} position={pos} scale={TRAY_SCALE}><PartModel glyph={part.glyph} tone={part.tone} /></group>;
}

/** The part in hand: follows the pointer above the bench and tilts with its motion. */
function Held({ part, at, rot }: { part: Part; at: MutableRefObject<THREE.Vector3>; rot: number }) {
  const g = useRef<THREE.Group>(null);
  const prev = useMemo(() => at.current.clone(), [at]);
  const vel = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const o = g.current; if (!o) return;
    o.position.lerp(at.current, 1 - Math.exp(-dt * 25));
    vel.lerp(at.current.clone().sub(prev).divideScalar(Math.max(dt, 1e-3)), 0.2); prev.copy(at.current);
    o.rotation.z = THREE.MathUtils.clamp(-vel.x * 0.04, -0.4, 0.4);
    o.rotation.x = THREE.MathUtils.clamp(vel.z * 0.04, -0.4, 0.4);
    o.rotation.y = THREE.MathUtils.lerp(o.rotation.y, rot, 1 - Math.exp(-dt * 14));
  });
  return <group ref={g} position={at.current}><PartModel glyph={part.glyph} tone={part.tone} /></group>;
}
