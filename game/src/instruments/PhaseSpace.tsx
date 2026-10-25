import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { C, type Tone } from '../styles/colors';

interface Pt {
  x: number;
  y: number;
}

interface Props {
  blobs: { x: number; y: number; tone: Tone; label?: string }[];
  targets?: { x: number; y: number; r: number; label?: string }[];
  trajectories?: Pt[][];
  flow?: (x: number, y: number) => [number, number];
  range?: number;
  draggable?: boolean;
  onDrag?: (x: number, y: number) => void;
  ghost?: Pt[];
}

// Margins hold tick labels and axis titles; l+r == t+b keeps the plot square.
const M = { l: 40, r: 22, t: 22, b: 40 };
const FRAME = M.l + M.r;
const SIGMA = 0.5; // vacuum-noise width in these units
const EASE = 12; // exponential smoothing rate, 1/s
const DIRS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
};

const clamp = (v: number, r: number) => Math.min(r, Math.max(-r, v));
const cssVar = (el: Element, name: string, fallback: string) =>
  getComputedStyle(el).getPropertyValue(name).trim() || fallback;
function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function PhaseSpace({
  blobs,
  targets = [],
  trajectories = [],
  flow,
  range = 4,
  draggable = false,
  onDrag,
  ghost = [],
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);

  const cur = { blobs, targets, trajectories, flow, range, ghost, size };
  const latest = useRef(cur);
  latest.current = cur;

  const disp = useRef<Pt[]>([]); // eased display positions, one per blob
  const sprites = useRef<{ key: string; map: Partial<Record<Tone, HTMLCanvasElement>> }>({ key: '', map: {} });
  const raf = useRef(0);
  const last = useRef(0);
  const dragging = useRef(false);

  // Cached radial-gradient sprites: rebuilt only when size or dpr changes.
  const sprite = (tone: Tone, sig: number, dpr: number) => {
    const key = `${sig.toFixed(2)}|${dpr}`;
    if (sprites.current.key !== key) sprites.current = { key, map: {} };
    const m = sprites.current.map;
    if (!m[tone]) {
      const n = Math.ceil(6 * sig * dpr);
      const cv = document.createElement('canvas');
      cv.width = cv.height = n;
      const g = cv.getContext('2d')!;
      const h = n / 2;
      const grad = g.createRadialGradient(h, h, 0, h, h, h);
      grad.addColorStop(0, rgba(C[tone], 0.55));
      grad.addColorStop(0.5, rgba(C[tone], 0.22));
      grad.addColorStop(1, rgba(C[tone], 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, n, n);
      m[tone] = cv;
    }
    return m[tone]!;
  };

  const draw = (c: HTMLCanvasElement, s: typeof cur, d: Pt[]) => {
    const ctx = c.getContext('2d');
    if (!ctx || !s.size) return;
    const { size: S, range: R } = s;
    const dpr = c.width / S;
    const P = S - FRAME;
    const k = P / (2 * R); // px per unit
    const X = (x: number) => M.l + (x + R) * k;
    const Y = (y: number) => M.t + (R - y) * k;
    const mono = cssVar(c, '--font-mono', 'monospace');
    const ui = cssVar(c, '--font-ui', 'sans-serif');
    const n0 = Math.floor(R);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, S, S);

    // Faint grid at integers, stronger axes at zero.
    ctx.lineWidth = 1;
    ctx.strokeStyle = C.edge;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    for (let n = -n0; n <= n0; n++) {
      const gx = Math.round(X(n)) + 0.5;
      const gy = Math.round(Y(n)) + 0.5;
      ctx.moveTo(gx, M.t);
      ctx.lineTo(gx, M.t + P);
      ctx.moveTo(M.l, gy);
      ctx.lineTo(M.l + P, gy);
    }
    ctx.stroke();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = C.muted;
    ctx.beginPath();
    ctx.moveTo(X(0), M.t);
    ctx.lineTo(X(0), M.t + P);
    ctx.moveTo(M.l, Y(0));
    ctx.lineTo(M.l + P, Y(0));
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = C.edge;
    ctx.strokeRect(M.l + 0.5, M.t + 0.5, P - 1, P - 1);

    // Tick labels at integers, plus axis titles.
    ctx.font = `12px ${mono}`;
    ctx.fillStyle = C.muted;
    ctx.strokeStyle = C.muted;
    ctx.beginPath();
    for (let n = -n0; n <= n0; n++) {
      ctx.moveTo(X(n), M.t + P);
      ctx.lineTo(X(n), M.t + P + 4);
      ctx.moveTo(M.l - 4, Y(n));
      ctx.lineTo(M.l, Y(n));
    }
    ctx.stroke();
    for (let n = -n0; n <= n0; n++) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(String(n), X(n), M.t + P + 6);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(n), M.l - 7, Y(n));
    }
    ctx.font = `12px ${ui}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Im(α)', M.l, M.t - 6);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Re(α)', M.l + P, S - 6);

    ctx.save();
    ctx.beginPath();
    ctx.rect(M.l, M.t, P, P);
    ctx.clip();

    // Sparse flow field; arrow length scaled to the strongest vector.
    if (s.flow) {
      const f = s.flow;
      const N = 13;
      const cell = P / (N - 1);
      let maxM = 0;
      for (let i = 0; i < N; i++)
        for (let j = 0; j < N; j++) {
          const [u, v] = f(-R + (i * 2 * R) / (N - 1), -R + (j * 2 * R) / (N - 1));
          maxM = Math.max(maxM, Math.hypot(u, v));
        }
      if (maxM > 0) {
        ctx.strokeStyle = C.muted;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        for (let i = 0; i < N; i++)
          for (let j = 0; j < N; j++) {
            const x = -R + (i * 2 * R) / (N - 1);
            const y = -R + (j * 2 * R) / (N - 1);
            const [u, v] = f(x, y);
            const len = (Math.hypot(u, v) / maxM) * cell * 0.42;
            if (len < 1) continue;
            const ang = Math.atan2(-v, u);
            const x0 = X(x), y0 = Y(y);
            const x1 = x0 + Math.cos(ang) * len;
            const y1 = y0 + Math.sin(ang) * len;
            const hd = Math.min(4, len * 0.5);
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.moveTo(x1 - hd * Math.cos(ang - 0.5), y1 - hd * Math.sin(ang - 0.5));
            ctx.lineTo(x1, y1);
            ctx.lineTo(x1 - hd * Math.cos(ang + 0.5), y1 - hd * Math.sin(ang + 0.5));
          }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // Targets: dashed circles with labels.
    ctx.strokeStyle = C.text;
    ctx.fillStyle = C.text;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.globalAlpha = 0.7;
    for (const t of s.targets) {
      const x = X(t.x), y = Y(t.y), rr = t.r * k;
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.stroke();
      if (t.label) {
        ctx.font = `12px ${ui}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(t.label, x, y - rr - 4);
      }
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Trajectories: fading tail, arrowhead at the latest point.
    ctx.lineCap = 'round';
    ctx.strokeStyle = C.text;
    ctx.lineWidth = 1.5;
    for (const tr of s.trajectories) {
      const n = tr.length;
      if (n < 2) continue;
      for (let q = 1; q < n; q++) {
        ctx.globalAlpha = 0.15 + 0.75 * (q / (n - 1));
        ctx.beginPath();
        ctx.moveTo(X(tr[q - 1].x), Y(tr[q - 1].y));
        ctx.lineTo(X(tr[q].x), Y(tr[q].y));
        ctx.stroke();
      }
      const a = tr[n - 2], b = tr[n - 1];
      const hx = X(b.x), hy = Y(b.y);
      const ang = Math.atan2(Y(b.y) - Y(a.y), X(b.x) - X(a.x));
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = C.text;
      ctx.beginPath();
      ctx.moveTo(hx + 7 * Math.cos(ang), hy + 7 * Math.sin(ang));
      ctx.lineTo(hx + 7 * Math.cos(ang + 2.5), hy + 7 * Math.sin(ang + 2.5));
      ctx.lineTo(hx + 7 * Math.cos(ang - 2.5), hy + 7 * Math.sin(ang - 2.5));
      ctx.closePath();
      ctx.fill();
    }
    ctx.lineCap = 'butt';
    ctx.globalAlpha = 1;

    // Ghost markers: hollow dashed rings.
    if (s.ghost.length) {
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = C.muted;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const g of s.ghost) {
        ctx.moveTo(X(g.x) + 6, Y(g.y));
        ctx.arc(X(g.x), Y(g.y), 6, 0, Math.PI * 2);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Blobs: cached sprite glow, 1-sigma ring, centre dot, label.
    const sig = SIGMA * k;
    s.blobs.forEach((b, i) => {
      const p = d[i] ?? b;
      const x = X(p.x), y = Y(p.y);
      const col = C[b.tone];
      ctx.drawImage(sprite(b.tone, sig, dpr), x - 3 * sig, y - 3 * sig, 6 * sig, 6 * sig);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, sig, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      if (b.label) {
        ctx.font = `13px ${ui}`;
        ctx.fillStyle = C.text;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(b.label, x + sig + 4, y - 4);
      }
    });
    ctx.restore();
  };

  // One rAF loop, running only while blobs are still easing toward their targets.
  const tick = (now: number) => {
    const s = latest.current;
    const c = canvasRef.current;
    const dt = last.current ? Math.min((now - last.current) / 1000, 0.05) : 0;
    last.current = now;
    const d = disp.current;
    for (let i = 0; i < s.blobs.length; i++) if (!d[i]) d[i] = { x: s.blobs[i].x, y: s.blobs[i].y };
    d.length = s.blobs.length;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const e = 1 - Math.exp(-dt * EASE);
    let moving = false;
    s.blobs.forEach((b, i) => {
      const p = d[i];
      if (reduce) {
        p.x = b.x;
        p.y = b.y;
        return;
      }
      p.x += (b.x - p.x) * e;
      p.y += (b.y - p.y) * e;
      if (Math.abs(b.x - p.x) + Math.abs(b.y - p.y) > 1e-3) moving = true;
    });
    if (c) draw(c, s, d);
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

  // Every render may change blobs, targets, trajectories or flow: schedule one redraw.
  useEffect(() => {
    kick();
  });

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const toWorld = (e: PointerEvent<HTMLCanvasElement>): Pt | null => {
    const r = e.currentTarget.getBoundingClientRect();
    const S = latest.current.size;
    if (!S || !r.width) return null;
    const k = S / r.width;
    const P = S - FRAME;
    const R = latest.current.range;
    const x = (e.clientX - r.left) * k;
    const y = (e.clientY - r.top) * k;
    return {
      x: clamp(((x - M.l) / P) * 2 * R - R, R),
      y: clamp(R - ((y - M.t) / P) * 2 * R, R),
    };
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!draggable || !onDrag) return;
    const w = toWorld(e);
    if (!w) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    e.currentTarget.style.cursor = 'grabbing';
    onDrag(w.x, w.y);
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!dragging.current || !onDrag) return;
    const w = toWorld(e);
    if (w) onDrag(w.x, w.y);
  };

  const onPointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    dragging.current = false;
    e.currentTarget.style.cursor = draggable ? 'grab' : 'default';
  };

  const onKeyDown = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const dir = DIRS[e.key];
    const first = blobs[0];
    if (!draggable || !onDrag || !dir || !first) return;
    e.preventDefault();
    const st = e.shiftKey ? 0.5 : 0.1;
    onDrag(clamp(first.x + dir[0] * st, range), clamp(first.y + dir[1] * st, range));
  };

  return (
    <div ref={wrapRef} style={{ width: '100%', maxWidth: 'min(100%, 64vh)', margin: '0 auto' }}>
      <canvas
        ref={canvasRef}
        role={draggable ? 'application' : 'img'}
        aria-label={
          draggable
            ? 'Phase-space plot. Arrow keys move the first point by 0.1, shift for 0.5.'
            : 'Phase-space plot of quadrature positions'
        }
        tabIndex={draggable ? 0 : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        style={{
          display: 'block',
          width: '100%',
          aspectRatio: '1',
          borderRadius: 6,
          touchAction: 'none',
          cursor: draggable ? 'grab' : 'default',
        }}
      />
    </div>
  );
}
