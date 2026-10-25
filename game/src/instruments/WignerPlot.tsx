import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { C } from '../styles/colors';

type Rgb = [number, number, number];
type Stop = [number, Rgb];

// Plot margins for tick labels; l+r == t+b keeps the plot square.
const M_FULL = { l: 40, r: 22, t: 22, b: 40 };
// Thumbnails (< 220px) drop ticks and axis titles so the plot fills the tile.
const marg = (size: number) => (size < 220 ? { l: 3, r: 3, t: 3, b: 3 } : M_FULL);

function hex(h: string): Rgb {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const lin = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const gam = (v: number) => {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, c * 255));
};

// OKLab blending so the ramps look evenly stepped to the eye.
function toLab([r, g, b]: Rgb): Rgb {
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function fromLab([L, a, b]: Rgb): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    gam(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}
function ramp(stops: Stop[], t: number): Rgb {
  let i = 0;
  while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
  const [t0, c0] = stops[i];
  const [t1, c1] = stops[i + 1];
  const u = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
  const a = toLab(c0), b = toLab(c1);
  return fromLab([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]);
}
function buildLut(stops: Stop[]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(256 * 3);
  for (let k = 0; k < 256; k++) out.set(ramp(stops, k / 255), k * 3);
  return out;
}
// Diverging: dark midpoint, cyan for positive, amber for negative, near-white at the extremes.
const LUT_POS = buildLut([[0, hex(C.bg)], [0.55, hex(C.cyan)], [1, hex('#F5FBFF')]]);
const LUT_NEG = buildLut([[0, hex(C.bg)], [0.55, hex(C.amber)], [1, hex('#FFF8EE')]]);

// Marching-squares style zero contour; segments stored as plot-normalised [0,1] coordinates.
function zeroContour(g: Float32Array, n: number): Float32Array {
  const out: number[] = [];
  const at = (i: number, j: number) => g[j * n + i];
  const cross = (i0: number, j0: number, v0: number, i1: number, j1: number, v1: number) => {
    const t = v0 / (v0 - v1);
    return [(i0 + (i1 - i0) * t + 0.5) / n, (j0 + (j1 - j0) * t + 0.5) / n];
  };
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
      const pts: number[][] = [];
      if (a < 0 !== b < 0) pts.push(cross(i, j, a, i + 1, j, b));
      if (b < 0 !== c < 0) pts.push(cross(i + 1, j, b, i + 1, j + 1, c));
      if (d < 0 !== c < 0) pts.push(cross(i, j + 1, d, i + 1, j + 1, c));
      if (a < 0 !== d < 0) pts.push(cross(i, j, a, i, j + 1, d));
      // shortcut: saddle cells (4 crossings) are paired in edge order, not disambiguated; fine for display.
      for (let k = 0; k + 1 < pts.length; k += 2) out.push(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]);
    }
  }
  return Float32Array.from(out);
}

interface Plot {
  image: HTMLCanvasElement;
  grid: Float32Array;
  res: number;
  range: number;
  min: number;
  max: number;
  segs: Float32Array;
}

function buildPlot(fn: (x: number, y: number) => number, range: number, res: number): Plot {
  const grid = new Float32Array(res * res);
  const step = (2 * range) / res;
  let min = Infinity, max = -Infinity;
  for (let j = 0; j < res; j++) {
    const y = range - (j + 0.5) * step;
    for (let i = 0; i < res; i++) {
      const w = fn(-range + (i + 0.5) * step, y);
      grid[j * res + i] = w;
      if (w < min) min = w;
      if (w > max) max = w;
    }
  }
  const maxAbs = Math.max(Math.abs(min), Math.abs(max)) || 1;

  const image = document.createElement('canvas');
  image.width = image.height = res;
  const ctx = image.getContext('2d')!;
  const px = ctx.createImageData(res, res);
  for (let k = 0; k < grid.length; k++) {
    const v = grid[k] / maxAbs;
    const t = Math.min(255, Math.round(Math.abs(v) * 255)) * 3;
    const table = v >= 0 ? LUT_POS : LUT_NEG;
    px.data[k * 4] = table[t];
    px.data[k * 4 + 1] = table[t + 1];
    px.data[k * 4 + 2] = table[t + 2];
    px.data[k * 4 + 3] = 255;
  }
  ctx.putImageData(px, 0, 0);
  return { image, grid, res, range, min, max, segs: zeroContour(grid, res) };
}

function paint(c: HTMLCanvasElement, p: Plot, size: number, hover: { x: number; y: number } | null) {
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const dpr = c.width / size;
  const M = marg(size);
  const P = size - M.l - M.r;
  const R = p.range;
  const X = (x: number) => M.l + ((x + R) / (2 * R)) * P;
  const Y = (y: number) => M.t + ((R - y) / (2 * R)) * P;
  const mono = getComputedStyle(c).getPropertyValue('--font-mono').trim() || 'monospace';
  const ui = getComputedStyle(c).getPropertyValue('--font-ui').trim() || 'sans-serif';

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, size, size);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(p.image, M.l, M.t, P, P);

  // Dashed violet zero-contour: negativity shows as a line, not only as colour.
  ctx.save();
  ctx.beginPath();
  ctx.rect(M.l, M.t, P, P);
  ctx.clip();
  ctx.strokeStyle = 'rgba(167, 139, 250, 0.7)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  for (let k = 0; k < p.segs.length; k += 4) {
    ctx.moveTo(M.l + p.segs[k] * P, M.t + p.segs[k + 1] * P);
    ctx.lineTo(M.l + p.segs[k + 2] * P, M.t + p.segs[k + 3] * P);
  }
  ctx.stroke();
  ctx.restore();

  // Faint crosshair at the origin.
  ctx.save();
  ctx.strokeStyle = 'rgba(232, 236, 244, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(X(0), M.t);
  ctx.lineTo(X(0), M.t + P);
  ctx.moveTo(M.l, Y(0));
  ctx.lineTo(M.l + P, Y(0));
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = C.edge;
  ctx.lineWidth = 1;
  ctx.strokeRect(M.l + 0.5, M.t + 0.5, P - 1, P - 1);

  // Integer ticks and labels on the edges.
  if (size >= 220) {
  const n0 = Math.floor(R);
  ctx.font = `12px ${mono}`;
  ctx.fillStyle = C.muted;
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
  ctx.fillText('Im(β)', M.l, M.t - 6);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Re(β)', M.l + P, size - 6);
  }

  if (hover) {
    ctx.strokeStyle = C.text;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(hover.x, hover.y, 5, 0, Math.PI * 2);
    ctx.stroke();
  }
}

interface Props {
  fn: (x: number, y: number) => number;
  range?: number;
  resolution?: number;
  showLegend?: boolean;
  label?: string;
}

export function WignerPlot({ fn, range = 4, resolution = 120, showLegend = false, label }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const legendRef = useRef<HTMLCanvasElement>(null);
  const readRef = useRef<HTMLSpanElement>(null);
  const hover = useRef<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState(0);

  const plot = useMemo(() => buildPlot(fn, range, resolution), [fn, range, resolution]);

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
    paint(c, plot, size, hover.current);
  }, [plot, size]);

  useEffect(() => {
    const c = legendRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    c.width = 256;
    c.height = 1;
    const img = ctx.createImageData(256, 1);
    for (let x = 0; x < 256; x++) {
      const v = (x / 255) * 2 - 1;
      const t = Math.round(Math.abs(v) * 255) * 3;
      const table = v >= 0 ? LUT_POS : LUT_NEG;
      img.data.set([table[t], table[t + 1], table[t + 2], 255], x * 4);
    }
    ctx.putImageData(img, 0, 0);
  }, [showLegend]);

  const onLeave = () => {
    hover.current = null;
    if (readRef.current) readRef.current.textContent = '';
    if (canvasRef.current && size) paint(canvasRef.current, plot, size, null);
  };

  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    if (!size || !r.width) return;
    const k = size / r.width;
    const x = (e.clientX - r.left) * k;
    const y = (e.clientY - r.top) * k;
    const M = marg(size);
    const P = size - M.l - M.r;
    const u = (x - M.l) / P;
    const v = (y - M.t) / P;
    if (u < 0 || u > 1 || v < 0 || v > 1) {
      onLeave();
      return;
    }
    hover.current = { x, y };
    const i = Math.min(plot.res - 1, Math.floor(u * plot.res));
    const j = Math.min(plot.res - 1, Math.floor(v * plot.res));
    const wx = -range + u * 2 * range;
    const wy = range - v * 2 * range;
    if (readRef.current && size >= 220) {
      readRef.current.textContent = `x ${wx.toFixed(2)}, y ${wy.toFixed(2)}, W ${plot.grid[j * plot.res + i].toFixed(3)}`;
    }
    paint(c, plot, size, hover.current);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8, width: '100%', maxWidth: 560, margin: '0 auto' }}>
      {label && <div style={{ font: '500 13px var(--font-ui)', color: C.text }}>{label}</div>}
      <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`${label ?? 'Wigner function'}. Hover the plot to read W at a point.`}
          onPointerMove={onMove}
          onPointerLeave={onLeave}
          style={{ display: 'block', width: '100%', aspectRatio: '1', borderRadius: 6 }}
        />
        <span
          ref={readRef}
          className="wr"
          style={{
            position: 'absolute', left: marg(size).l + 6, top: marg(size).t + 6, padding: '2px 6px', borderRadius: 4,
            background: 'rgba(11, 16, 32, 0.85)', color: C.text, font: '12px var(--font-mono)',
            fontVariantNumeric: 'tabular-nums', pointerEvents: 'none',
          }}
        />
        <style>{'.wr:empty{display:none}'}</style>
      </div>
      {showLegend && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            font: '12px var(--font-mono)',
            fontVariantNumeric: 'tabular-nums',
            color: C.muted,
          }}
        >
          <span>{`- min ${plot.min.toFixed(2)}`}</span>
          <canvas
            ref={legendRef}
            aria-hidden="true"
            style={{ flex: 1, height: 10, minWidth: 60, borderRadius: 2, border: `1px solid ${C.edge}` }}
          />
          <span>{`+ max ${plot.max.toFixed(2)}`}</span>
        </div>
      )}
    </div>
  );
}
