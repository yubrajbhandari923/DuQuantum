import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import { C } from '../styles/colors';

type Props = {
  probs: number[];
  compare?: number[];
  highlight?: number[];
  label?: string;
  height?: number;
};

const M = { l: 48, r: 12, t: 30, b: 40 };
const MONO = 'var(--font-mono)';
const UI = 'var(--font-ui)';
const EASE = 'var(--ease-out)';

/** Round-number ticks covering [0, max]. */
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

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export function PhotonHistogram({ probs, compare, highlight = [], label, height = 220 }: Props) {
  const [wrapRef, W] = useWidth<HTMLDivElement>();
  const reduced = usePrefersReducedMotion();
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const H = height;
  const pw = Math.max(20, W - M.l - M.r);
  const ph = Math.max(20, H - M.t - M.b);

  const hasCompare = compare !== undefined && compare.length > 0;
  const N = Math.max(probs.length, compare?.length ?? 0);
  const val = (arr: number[] | undefined, i: number) => {
    const v = arr?.[i];
    return v !== undefined && Number.isFinite(v) && v > 0 ? v : 0;
  };
  const p = (i: number) => val(probs, i);
  const q = (i: number) => val(compare, i);

  let ymax = 0;
  let norm = 0;
  let weighted = 0;
  for (let i = 0; i < N; i++) {
    ymax = Math.max(ymax, p(i), q(i));
    norm += p(i);
    weighted += i * p(i);
  }
  const top = ymax > 0 ? ymax * 1.08 : 1;
  const yt = niceTicks(0, top, 4);
  const yDec = decimalsFor(yt.length > 1 ? yt[1] - yt[0] : 1);
  const Y = (v: number) => M.t + ph - (v / top) * ph;
  const base = M.t + ph;
  const slot = N > 0 ? pw / N : pw;
  const barW = Math.min(48, slot * (hasCompare ? 0.4 : 0.7));
  const cxOf = (i: number) => M.l + (i + 0.5) * slot;
  const barX = (i: number, second: boolean) => {
    if (!hasCompare) return cxOf(i) - barW / 2;
    return second ? cxOf(i) + 1 : cxOf(i) - barW - 1;
  };
  // Each bar is drawn extended below the baseline by its corner radius and clipped at the
  // baseline, so only the top ends are rounded.
  const geom = (v: number) => ({ y: Y(v), height: base - Y(v) + Math.min(4, barW / 2) });
  const barTransition = reduced ? 'none' : `y 350ms ${EASE}, height 350ms ${EASE}`;

  const mean = norm > 0 ? weighted / norm : NaN;
  const tickStep = N <= 16 ? 1 : Math.ceil(N / 12);

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) * W) / r.width;
    if (px < M.l || px > M.l + pw || N === 0) { setHover(null); return; }
    setHover(Math.min(N - 1, Math.floor((px - M.l) / slot)));
  };

  const swatch = { display: 'inline-block', width: 10, height: 10, borderRadius: 2 } as const;
  const legend: { key: string; node: ReactNode }[] = [];
  if (hasCompare || highlight.length > 0) {
    legend.push({ key: 'p', node: <><span style={{ ...swatch, background: C.cyan, opacity: 0.85 }} />P(n)</> });
    if (hasCompare) {
      legend.push({ key: 'c', node: <><span style={{ ...swatch, border: `2px dashed ${C.violet}` }} />compare</> });
    }
    if (highlight.length > 0) {
      legend.push({ key: 'h', node: <><span style={{ ...swatch, background: C.amber }} />highlight</> });
    }
  }

  const hoverFrac = hover === null ? 0 : cxOf(hover) / W;

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', fontFamily: UI }}>
      {legend.length >= 2 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', alignItems: 'center', fontSize: 12, color: C.muted, marginBottom: 6 }}>
          {legend.map((item) => (
            <span key={item.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {item.node}
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
        aria-label={label ?? 'Photon number distribution'}
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

        {yt.map((v) => (
          <g key={`gy${v}`}>
            <line x1={M.l} x2={M.l + pw} y1={Y(v)} y2={Y(v)} stroke={C.edge} strokeOpacity="0.45" />
            <text x={M.l - 8} y={Y(v) + 4} textAnchor="end" fill={C.muted} fontSize={12} style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
              {v.toFixed(yDec)}
            </text>
          </g>
        ))}
        <line x1={M.l} x2={M.l} y1={M.t} y2={base} stroke={C.muted} strokeOpacity="0.6" />
        <line x1={M.l} x2={M.l + pw} y1={base} y2={base} stroke={C.muted} strokeOpacity="0.6" />

        {hover !== null && (
          <rect x={M.l + hover * slot} y={M.t} width={slot} height={ph} fill={C.text} fillOpacity="0.06" />
        )}

        <g clipPath={`url(#${uid}-clip)`}>
          {Array.from({ length: N }, (_, i) => {
            const rx = Math.min(4, barW / 2);
            const isHi = highlight.includes(i);
            const pg = geom(p(i));
            return (
              <g key={`b${i}`}>
                {hasCompare && (
                  <rect
                    x={barX(i, true)}
                    width={barW}
                    rx={rx}
                    fill="none"
                    stroke={C.violet}
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    style={{ y: geom(q(i)).y, height: geom(q(i)).height, transition: barTransition }}
                  />
                )}
                <rect
                  x={barX(i, false)}
                  width={barW}
                  rx={rx}
                  fill={isHi ? C.amber : C.cyan}
                  fillOpacity={isHi ? 1 : 0.85}
                  style={{ y: pg.y, height: pg.height, transition: barTransition }}
                />
              </g>
            );
          })}
        </g>

        {Array.from({ length: N }, (_, i) =>
          i % tickStep === 0 ? (
            <text key={`tx${i}`} x={cxOf(i)} y={base + 18} textAnchor="middle" fill={C.muted} fontSize={12} style={{ fontFamily: MONO }}>
              {i}
            </text>
          ) : null,
        )}
        <text x={M.l + pw / 2} y={H - 8} textAnchor="middle" fill={C.muted} fontSize={12} style={{ fontFamily: UI }}>
          photon number n
        </text>
        <text x={14} y={M.t + ph / 2} textAnchor="middle" fill={C.muted} fontSize={12} style={{ fontFamily: UI }} transform={`rotate(-90 14 ${M.t + ph / 2})`}>
          P(n)
        </text>

        {label && (
          <text x={M.l} y={16} fill={C.muted} fontSize={12} style={{ fontFamily: UI }}>
            {label}
          </text>
        )}
        <text x={W - M.r} y={18} textAnchor="end" fill={C.text} fontSize={12} style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
          {`<n> = ${Number.isFinite(mean) ? mean.toFixed(3) : '—'}`}
        </text>
      </svg>

      {hover !== null && (
        <div
          role="status"
          style={{
            position: 'absolute',
            top: 4,
            left: `${hoverFrac * 100}%`,
            transform: hoverFrac < 0.2 ? 'none' : hoverFrac > 0.8 ? 'translateX(-100%)' : 'translateX(-50%)',
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
          <div>{`P(${hover}) = ${p(hover).toFixed(3)}`}</div>
          {hasCompare && <div style={{ color: C.violet }}>{`compare = ${q(hover).toFixed(3)}`}</div>}
        </div>
      )}
    </div>
  );
}
