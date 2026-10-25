import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { C, type Tone } from '../styles/colors';

type Series = { label: string; tone: Tone; x: number[]; y: number[]; dashed?: boolean };

type Props = {
  series: Series[];
  xLabel: string;
  yLabel: string;
  yRange?: [number, number];
  thresholds?: { y: number; label: string }[];
  markers?: { x: number; label: string }[];
  height?: number;
};

const TONE: Record<Tone, string> = { cyan: C.cyan, violet: C.violet, amber: C.amber, red: C.red };
const M = { l: 64, r: 128, t: 14, b: 46 };
const MONO = 'var(--font-mono)';
const UI = 'var(--font-ui)';

/** Round-number ticks covering [min, max]. */
function niceTicks(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (max <= min) max = min + 1;
  const raw = (max - min) / Math.max(1, count);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * pow;
  const out: number[] = [];
  for (let k = Math.ceil(min / step - 1e-9); k * step <= max + step * 1e-9 && out.length < 50; k++) {
    out.push(Number((k * step).toPrecision(12)));
  }
  return out;
}

/** Number of decimals needed to show a tick step exactly. */
function decimalsFor(step: number): number {
  for (let d = 0; d < 6; d++) {
    if (Math.abs(step * 10 ** d - Math.round(step * 10 ** d)) < 1e-9) return d;
  }
  return 6;
}

/** Linear interpolation of y at x; null outside the series' x range. */
function interp(p: [number, number][], x: number): number | null {
  if (!p.length || x < p[0][0] || x > p[p.length - 1][0]) return null;
  for (let i = 1; i < p.length; i++) {
    const [xa, ya] = p[i - 1];
    const [xb, yb] = p[i];
    if (x <= xb) return xb === xa ? yb : ya + ((yb - ya) * (x - xa)) / (xb - xa);
  }
  return p[p.length - 1][1];
}

function useWidth<T extends HTMLElement>(): [RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function Oscilloscope(props: Props) {
  const { series, xLabel, yLabel, yRange, thresholds = [], markers = [], height = 240 } = props;
  const [wrapRef, W] = useWidth<HTMLDivElement>();
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<{ px: number; x: number } | null>(null);
  const H = height;
  const pw = Math.max(20, W - M.l - M.r);
  const ph = Math.max(20, H - M.t - M.b);

  // Sorted, finite-only points per series.
  const pts = useMemo(
    () =>
      series.map((s) => {
        const out: [number, number][] = [];
        const n = Math.min(s.x.length, s.y.length);
        for (let i = 0; i < n; i++) {
          const x = s.x[i];
          const y = s.y[i];
          if (Number.isFinite(x) && Number.isFinite(y)) out.push([x, y]);
        }
        return out.sort((a, b) => a[0] - b[0]);
      }),
    [series],
  );

  // Domain.
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const s of pts) for (const [x, y] of s) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const hasData = Number.isFinite(x0);
  if (!hasData) { x0 = 0; x1 = 1; y0 = 0; y1 = 1; }
  if (x1 <= x0) { x0 -= 0.5; x1 += 0.5; }
  if (yRange && Number.isFinite(yRange[0]) && Number.isFinite(yRange[1]) && yRange[1] > yRange[0]) {
    y0 = yRange[0];
    y1 = yRange[1];
  } else {
    for (const t of thresholds) if (Number.isFinite(t.y)) { y0 = Math.min(y0, t.y); y1 = Math.max(y1, t.y); }
    const pad = (y1 - y0) * 0.08 || Math.max(Math.abs(y0) * 0.1, 1);
    y0 -= pad;
    y1 += pad;
  }

  const X = (v: number) => M.l + ((v - x0) / (x1 - x0)) * pw;
  const Y = (v: number) => M.t + ph - ((v - y0) / (y1 - y0)) * ph;
  const xt = niceTicks(x0, x1, Math.max(2, Math.floor(pw / 90)));
  const yt = niceTicks(y0, y1, Math.max(2, Math.floor(ph / 50)));
  const xDec = decimalsFor(xt.length > 1 ? xt[1] - xt[0] : 1);
  const yDec = decimalsFor(yt.length > 1 ? yt[1] - yt[0] : 1);

  // Direct labels at each line's end, nudged apart so they never overlap.
  const labelY = pts.map((p) => (p.length ? Y(p[p.length - 1][1]) + 4 : NaN));
  const order = labelY.map((_, i) => i).filter((i) => Number.isFinite(labelY[i])).sort((a, b) => labelY[a] - labelY[b]);
  let prevLabel = -Infinity;
  for (const i of order) {
    labelY[i] = Math.max(labelY[i], prevLabel + 14);
    prevLabel = labelY[i];
  }

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) * W) / r.width;
    if (px < M.l || px > M.l + pw) { setHover(null); return; }
    setHover({ px, x: x0 + ((px - M.l) / pw) * (x1 - x0) });
  };

  const hoverRows = hover
    ? series.map((s, i) => ({ s, y: interp(pts[i], hover.x) }))
    : [];

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', fontFamily: UI }}>
      {series.length >= 2 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 12, color: C.muted, marginBottom: 6 }}>
          {series.map((s) => (
            <span key={s.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <svg width="22" height="8" aria-hidden="true">
                <line x1="0" y1="4" x2="22" y2="4" stroke={TONE[s.tone]} strokeWidth="2" strokeDasharray={s.dashed ? '6 4' : undefined} />
              </svg>
              {s.label}
            </span>
          ))}
        </div>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        style={{ display: 'block', width: '100%', height: 'auto' }}
        role="img"
        aria-label={`${yLabel} against ${xLabel}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <pattern id={`${uid}-scan`} width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="1" fill="#ffffff" opacity="0.025" />
          </pattern>
          <clipPath id={`${uid}-clip`}>
            <rect x={M.l} y={M.t} width={pw} height={ph} />
          </clipPath>
        </defs>
        <rect width={W} height={H} fill={C.bg} />
        <rect x={M.l} y={M.t} width={pw} height={ph} fill={`url(#${uid}-scan)`} />

        {/* Recessive grid */}
        {xt.map((v) => (
          <line key={`gx${v}`} x1={X(v)} x2={X(v)} y1={M.t} y2={M.t + ph} stroke={C.edge} strokeOpacity="0.45" />
        ))}
        {yt.map((v) => (
          <line key={`gy${v}`} x1={M.l} x2={M.l + pw} y1={Y(v)} y2={Y(v)} stroke={C.edge} strokeOpacity="0.45" />
        ))}
        {/* Axes */}
        <line x1={M.l} x2={M.l} y1={M.t} y2={M.t + ph} stroke={C.muted} strokeOpacity="0.6" />
        <line x1={M.l} x2={M.l + pw} y1={M.t + ph} y2={M.t + ph} stroke={C.muted} strokeOpacity="0.6" />
        {yt.map((v) => (
          <text key={`ty${v}`} x={M.l - 8} y={Y(v) + 4} textAnchor="end" fill={C.muted} fontSize={12} style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
            {v.toFixed(yDec)}
          </text>
        ))}
        {xt.map((v) => (
          <text key={`tx${v}`} x={X(v)} y={M.t + ph + 18} textAnchor="middle" fill={C.muted} fontSize={12} style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
            {v.toFixed(xDec)}
          </text>
        ))}
        <text x={M.l + pw / 2} y={H - 8} textAnchor="middle" fill={C.muted} fontSize={12} style={{ fontFamily: UI }}>
          {xLabel}
        </text>
        <text x={14} y={M.t + ph / 2} textAnchor="middle" fill={C.muted} fontSize={12} style={{ fontFamily: UI }} transform={`rotate(-90 14 ${M.t + ph / 2})`}>
          {yLabel}
        </text>

        <g clipPath={`url(#${uid}-clip)`}>
          {/* Thresholds */}
          {thresholds.filter((t) => Number.isFinite(t.y)).map((t) => (
            <g key={`th${t.label}${t.y}`}>
              <line x1={M.l} x2={M.l + pw} y1={Y(t.y)} y2={Y(t.y)} stroke={C.muted} strokeWidth="1.5" strokeDasharray="6 4" />
            </g>
          ))}
          {/* Vertical markers */}
          {markers.filter((m) => Number.isFinite(m.x) && m.x >= x0 && m.x <= x1).map((m) => (
            <line key={`mk${m.label}${m.x}`} x1={X(m.x)} x2={X(m.x)} y1={M.t} y2={M.t + ph} stroke={C.text} strokeOpacity="0.5" strokeWidth="2" />
          ))}
          {/* Series */}
          {pts.map((p, i) =>
            p.length === 0 ? null : (
              <path
                key={`s${series[i].label}`}
                fill="none"
                stroke={TONE[series[i].tone]}
                strokeWidth="2"
                strokeDasharray={series[i].dashed ? '6 4' : undefined}
                strokeLinejoin="round"
                d={p.map(([x, y], j) => `${j ? 'L' : 'M'}${X(x).toFixed(2)} ${Y(y).toFixed(2)}`).join(' ')}
              />
            ),
          )}
          {/* Crosshair */}
          {hover && (
            <g>
              <line x1={hover.px} x2={hover.px} y1={M.t} y2={M.t + ph} stroke={C.text} strokeOpacity="0.35" />
              {hoverRows.map(({ s, y }, i) =>
                y === null ? null : (
                  <circle key={`hd${s.label}`} cx={X(hover.x)} cy={Y(y)} r="3.5" fill={TONE[s.tone]} stroke={C.bg} strokeWidth="1.5" />
                ),
              )}
            </g>
          )}
        </g>

        {/* Threshold and marker labels */}
        {thresholds.filter((t) => Number.isFinite(t.y)).map((t) => (
          <text key={`thl${t.label}${t.y}`} x={M.l + 8} y={Y(t.y) - 6} fill={C.muted} fontSize={12} style={{ fontFamily: MONO }}>
            {t.label}
          </text>
        ))}
        {markers.filter((m) => Number.isFinite(m.x) && m.x >= x0 && m.x <= x1).map((m) => (
          <text key={`mkl${m.label}${m.x}`} x={X(m.x) + 4} y={M.t + 12} fill={C.text} fillOpacity="0.8" fontSize={12} style={{ fontFamily: MONO }}>
            {m.label}
          </text>
        ))}
        {/* Series direct labels */}
        {series.map((s, i) =>
          labelY[i] === undefined || !Number.isFinite(labelY[i]) ? null : (
            <text key={`sl${s.label}`} x={M.l + pw + 6} y={labelY[i]} fill={TONE[s.tone]} fontSize={12} style={{ fontFamily: UI }}>
              {s.label}
            </text>
          ),
        )}
        {!hasData && (
          <text x={M.l + pw / 2} y={M.t + ph / 2} textAnchor="middle" fill={C.muted} fontSize={12} style={{ fontFamily: UI }}>
            No data
          </text>
        )}
      </svg>

      {hover && (
        <div
          role="status"
          style={{
            position: 'absolute',
            top: 8,
            left: `${(hover.px / W) * 100}%`,
            transform: hover.px > W * 0.6 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
            pointerEvents: 'none',
            background: C.surface,
            border: `1px solid ${C.edge}`,
            borderRadius: 6,
            padding: '6px 8px',
            fontFamily: MONO,
            fontSize: 12,
            fontVariantNumeric: 'tabular-nums',
            color: C.text,
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ color: C.muted }}>
            {xLabel} = {hover.x.toFixed(xDec + 1)}
          </div>
          {hoverRows.map(({ s, y }) => (
            <div key={s.label} style={{ color: TONE[s.tone] }}>
              {s.label}: {y === null ? '—' : y.toFixed(yDec + 1)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
