import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { C } from '../styles/colors';

type V3 = [number, number, number];

interface Props {
  vector: V3;
  trail?: V3[];
  axis?: V3 | null;
  label?: string;
}

interface View {
  yaw: number;
  pitch: number;
}

const YAW0 = 0.6;
const PITCH0 = 0.4;
const EASE = 10; // exponential smoothing rate, 1/s
const LIM = 1.5; // pitch clamp, rad

const cssVar = (el: Element, name: string, fallback: string) =>
  getComputedStyle(el).getPropertyValue(name).trim() || fallback;
const clampPitch = (v: number) => Math.max(-LIM, Math.min(LIM, v));
const len = (v: V3) => Math.hypot(v[0], v[1], v[2]);
function unit(v: V3): V3 {
  const n = len(v);
  return n > 1e-9 ? [v[0] / n, v[1] / n, v[2] / n] : [0, 0, 0];
}

// Great circles precomputed once: equator, xz-meridian, yz-meridian.
const N = 120;
const ringPts = (f: (t: number) => V3) => Array.from({ length: N + 1 }, (_, k) => f((k / N) * Math.PI * 2));
const RINGS: V3[][] = [
  ringPts((t) => [Math.cos(t), Math.sin(t), 0]),
  ringPts((t) => [Math.cos(t), 0, Math.sin(t)]),
  ringPts((t) => [0, Math.cos(t), Math.sin(t)]),
];
const AXES: [V3, string][] = [
  [[0, 0, 1], '|0>'],
  [[0, 0, -1], '|1>'],
  [[1, 0, 0], '|+>'],
  [[-1, 0, 0], '|->'],
  [[0, 1, 0], '|+i>'],
  [[0, -1, 0], '|-i>'],
];

// Rotate by yaw about z, then pitch about x. Returns screen x, screen y (down), and front (>0 faces viewer).
function project(p: V3, yaw: number, pitch: number): V3 {
  const c = Math.cos(yaw), s = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const x1 = p[0] * c - p[1] * s;
  const y1 = p[0] * s + p[1] * c;
  const z1 = p[2];
  const y2 = y1 * cp - z1 * sp;
  const z2 = y1 * sp + z1 * cp;
  return [x1, -z2, -y2];
}

type Cur = { vector: V3; trail: V3[]; axis: V3 | null; size: number };

export function BlochSphere({ vector, trail = [], axis = null, label }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);

  const cur: Cur = { vector, trail, axis, size };
  const latest = useRef(cur);
  latest.current = cur;

  const view = useRef<View>({ yaw: YAW0, pitch: PITCH0 });
  const disp = useRef<V3>([vector[0], vector[1], vector[2]]);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const raf = useRef(0);
  const last = useRef(0);

  const draw = (c: HTMLCanvasElement, s: Cur, v: V3, rot: View) => {
    const ctx = c.getContext('2d');
    if (!ctx || !s.size) return;
    const S = s.size;
    const dpr = c.width / S;
    const R = S / 2 - 30;
    const cx = S / 2, cy = S / 2;
    const mono = cssVar(c, '--font-mono', 'monospace');
    const scr = (p: V3) => {
      const q = project(p, rot.yaw, rot.pitch);
      return { x: cx + R * q[0], y: cy + R * q[1], f: q[2] };
    };

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, S, S);

    // Sphere body and outline.
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = C.surface;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = C.muted;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Great circles: solid on the front, faint dashed on the back.
    ctx.strokeStyle = C.muted;
    ctx.lineWidth = 1;
    for (const ring of RINGS) {
      let a = scr(ring[0]);
      for (let k = 1; k < ring.length; k++) {
        const b = scr(ring[k]);
        const front = a.f + b.f >= 0;
        ctx.globalAlpha = front ? 0.85 : 0.3;
        ctx.setLineDash(front ? [] : [3, 3]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        a = b;
      }
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Basis axes through the origin.
    ctx.strokeStyle = C.muted;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    for (const d of [[1, 0, 0], [0, 1, 0], [0, 0, 1]] as V3[]) {
      const p0 = scr([-d[0], -d[1], -d[2]]);
      const p1 = scr(d);
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Axis labels; dimmed when on the back.
    ctx.font = `12px ${mono}`;
    ctx.fillStyle = C.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [p, text] of AXES) {
      const q = scr([p[0] * 1.15, p[1] * 1.15, p[2] * 1.15]);
      ctx.globalAlpha = q.f >= 0 ? 1 : 0.5;
      ctx.fillText(text, q.x, q.y);
    }
    ctx.globalAlpha = 1;

    // Drive axis: dashed amber line with arrowhead at the + end.
    if (s.axis) {
      const a = unit(s.axis);
      if (len(a) > 0) {
        const at = (k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
        const p0 = scr(at(-1.25));
        const pm = scr(at(0.9));
        const p1 = scr(at(1.25));
        ctx.strokeStyle = C.amber;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
        ctx.setLineDash([]);
        const ang = Math.atan2(p1.y - pm.y, p1.x - pm.x);
        ctx.fillStyle = C.amber;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p1.x - 9 * Math.cos(ang - 0.4), p1.y - 9 * Math.sin(ang - 0.4));
        ctx.lineTo(p1.x - 9 * Math.cos(ang + 0.4), p1.y - 9 * Math.sin(ang + 0.4));
        ctx.closePath();
        ctx.fill();
        ctx.font = `12px ${mono}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText('drive', p1.x + 6, p1.y - 4);
      }
    }

    // Trail on the sphere surface, fading toward the newest point.
    const tr = s.trail;
    if (tr.length > 1) {
      ctx.strokeStyle = C.cyan;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      let a = scr(tr[0]);
      for (let k = 1; k < tr.length; k++) {
        const b = scr(tr[k]);
        ctx.globalAlpha = 0.1 + 0.8 * (k / (tr.length - 1));
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        a = b;
      }
      ctx.lineCap = 'butt';
      ctx.globalAlpha = 1;
    }

    // State vector, its equatorial shadow, and the projection line joining them.
    const origin = scr([0, 0, 0]);
    const tip = scr(v);
    const shadow = scr([v[0], v[1], 0]);
    ctx.strokeStyle = C.violet;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.8;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(shadow.x, shadow.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = C.violet;
    ctx.beginPath();
    ctx.arc(shadow.x, shadow.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    ctx.fillStyle = C.muted;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.cyan;
    ctx.strokeStyle = C.text;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };

  // One rAF loop: ease the displayed vector toward props, stop once settled.
  const tick = (now: number) => {
    const s = latest.current;
    const c = canvasRef.current;
    const dt = last.current ? Math.min((now - last.current) / 1000, 0.05) : 0;
    last.current = now;
    const d = disp.current;
    const tgt = s.vector;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let moving = false;
    if (reduce) {
      d[0] = tgt[0];
      d[1] = tgt[1];
      d[2] = tgt[2];
    } else {
      const e = 1 - Math.exp(-dt * EASE);
      for (let i = 0; i < 3; i++) {
        d[i] += (tgt[i] - d[i]) * e;
        if (Math.abs(tgt[i] - d[i]) > 1e-3) moving = true;
      }
    }
    if (c) draw(c, s, unit(d), view.current);
    raf.current = moving ? requestAnimationFrame(tick) : 0;
  };

  const kick = () => {
    if (!raf.current) {
      last.current = 0;
      raf.current = requestAnimationFrame(tick);
    }
  };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !size) return;
    c.width = c.height = Math.round(size * (window.devicePixelRatio || 1));
    kick();
  }, [size]);

  // Props (vector, trail, axis) may change on any render: schedule one redraw.
  useEffect(() => {
    kick();
  });

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const st = drag.current;
    if (!st) return;
    const rot = view.current;
    rot.yaw += (e.clientX - st.x) * 0.01;
    rot.pitch = clampPitch(rot.pitch + (e.clientY - st.y) * 0.01);
    st.x = e.clientX;
    st.y = e.clientY;
    kick();
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const reset = () => {
    view.current = { yaw: YAW0, pitch: PITCH0 };
    kick();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const rot = view.current;
    const step = 0.1;
    if (e.key === 'ArrowLeft') rot.yaw -= step;
    else if (e.key === 'ArrowRight') rot.yaw += step;
    else if (e.key === 'ArrowUp') rot.pitch = clampPitch(rot.pitch + step);
    else if (e.key === 'ArrowDown') rot.pitch = clampPitch(rot.pitch - step);
    else return;
    e.preventDefault();
    kick();
  };

  // Readouts come from props (exact), not the eased display, so they never re-render per frame.
  const n = unit(vector);
  const hasV = len(n) > 0;
  const p1 = hasV ? (1 - n[2]) / 2 : NaN;
  const phi = hasV && Math.hypot(n[0], n[1]) > 1e-9 ? (Math.atan2(n[1], n[0]) * 180) / Math.PI : NaN;
  const p1Text = Number.isNaN(p1) ? 'n/a' : p1.toFixed(3);
  const phiText = Number.isNaN(phi) ? 'n/a' : `${phi.toFixed(1)}°`;

  return (
    <figure style={{ margin: 0, display: 'grid', gap: 8, width: '100%' }}>
      {label && <figcaption style={{ font: '500 13px var(--font-ui)', color: C.text }}>{label}</figcaption>}
      <div ref={wrapRef} style={{ width: '100%', maxWidth: 'min(100%, 56vh)', margin: '0 auto' }}>
        <canvas
          ref={canvasRef}
          role="application"
          tabIndex={0}
          aria-label={`${label ?? 'Bloch sphere'}. Arrow keys rotate the view; double-click resets.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={reset}
          onKeyDown={onKeyDown}
          style={{ display: 'block', width: '100%', aspectRatio: '1', borderRadius: 6, touchAction: 'none', cursor: 'grab' }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px 16px',
          font: '13px var(--font-mono)',
          fontVariantNumeric: 'tabular-nums',
          color: C.text,
        }}
      >
        <span>{`P(|1>) ${p1Text}`}</span>
        <span>{`phi ${phiText}`}</span>
      </div>
    </figure>
  );
}
