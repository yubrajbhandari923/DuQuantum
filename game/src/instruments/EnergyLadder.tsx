import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { C } from '../styles/colors';

type Props = {
  levels: number;
  omega: number;
  anharmonicity?: number;
  occupied?: number;
  transition?: { from: number; to: number; valid: boolean } | null;
  selected?: number[];
  onSelect?: (n: number) => void;
  showSpacing?: boolean;
  height?: number;
};

const MONO = 'var(--font-mono)';
const UI = 'var(--font-ui)';
const PERIOD = 1400; // one full transition loop, ms
const TOP = 18;
const BOTTOM = 14;
const X0 = 58; // left edge of the level lines

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

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

export function EnergyLadder({
  levels,
  omega,
  anharmonicity = 0,
  occupied,
  transition = null,
  selected = [],
  onSelect,
  showSpacing = false,
  height = 320,
}: Props) {
  const [wrapRef, W] = useWidth<HTMLDivElement>();
  const reduced = usePrefersReducedMotion();
  const H = height;
  const L = Math.max(1, Math.floor(levels));
  const w0 = Number.isFinite(omega) ? omega : 0;
  const A = Number.isFinite(anharmonicity) ? anharmonicity : 0;

  // Real energies E_n = omega*n - A*n(n-1)/2, relative to E_0.
  const E = (n: number) => w0 * n - (A * n * (n - 1)) / 2;
  const energies = Array.from({ length: L }, (_, n) => E(n));
  let Emax = 0;
  let Emin = 0;
  for (const e of energies) { if (e > Emax) Emax = e; if (e < Emin) Emin = e; }
  const plotH = Math.max(40, H - TOP - BOTTOM);
  const span = Emax - Emin || 1;
  const Y = (e: number) => TOP + plotH - ((e - Emin) / span) * plotH;

  const x1 = Math.max(X0 + 40, W - (showSpacing ? 112 : 24));
  const xc = (X0 + x1) / 2;

  // Photon dot: moved imperatively each frame, so React never re-renders during the loop.
  const dotRef = useRef<SVGGElement>(null);
  const coreRef = useRef<SVGCircleElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const from = transition?.from;
  const to = transition?.to;
  const valid = transition?.valid ?? true;

  useLayoutEffect(() => {
    const g = dotRef.current;
    const core = coreRef.current;
    const ring = ringRef.current;
    if (!g || !core || !ring) return;
    const place = (x: number, y: number) => g.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
    const yOf = (n: number) => Y(E(n));
    ring.setAttribute('opacity', '0');
    core.setAttribute('fill', C.amber);

    if (from === undefined || to === undefined) {
      if (occupied !== undefined) place(xc, yOf(occupied));
      return;
    }
    const yf = yOf(from);
    const yt = yOf(to);
    if (reduced) {
      place(xc, valid ? yt : yf);
      return;
    }

    const t0 = performance.now();
    let raf = 0;
    const frame = () => {
      const u = ((performance.now() - t0) % PERIOD) / PERIOD;
      if (valid) {
        // Hop up to the target and back, each half a smooth arc.
        const half = u < 0.5;
        const v = half ? u * 2 : (u - 0.5) * 2;
        const p = easeInOut(v);
        const a = half ? yf : yt;
        const b = half ? yt : yf;
        place(xc + 26 * Math.sin(Math.PI * v) * (half ? 1 : -1), lerp(a, b, p));
      } else {
        // Jump partway, flash red, bounce back.
        const mid = lerp(yf, yt, 0.45);
        let y: number;
        if (u < 0.45) y = lerp(yf, mid, easeOut(u / 0.45));
        else if (u < 0.6) y = mid;
        else y = lerp(mid, yf, easeInOut((u - 0.6) / 0.4));
        place(xc, y);
        const flashing = u >= 0.45 && u < 0.6;
        const k = flashing ? (u - 0.45) / 0.15 : 0;
        ring.setAttribute('r', (8 + 14 * k).toFixed(1));
        ring.setAttribute('opacity', flashing ? (1 - k).toFixed(2) : '0');
        core.setAttribute('fill', flashing ? C.red : C.amber);
      }
    };
    const loop = () => {
      frame();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  },[W, H, L, w0, A, occupied, from, to, valid, reduced]);

  const hasDot = occupied !== undefined || transition != null;
  const nrY = from !== undefined && to !== undefined ? (Y(E(from)) + Y(E(to))) / 2 : 0;
  const showLabel = transition != null && !transition.valid;

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', fontFamily: UI }}>
      <style>{'@keyframes ladderIn{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}'}</style>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        style={{ display: 'block', width: '100%', height: 'auto' }}
        role="img"
        aria-label={`Energy ladder with ${L} levels`}
      >
        {energies.map((e, n) => {
          const y = Y(e);
          const isSel = selected.includes(n);
          return (
            <g
              key={n}
              style={{
                animation: reduced ? undefined : 'ladderIn 480ms var(--ease-out) both',
                animationDelay: reduced ? undefined : `${n * 70}ms`,
              }}
            >
              {isSel && <rect x={2} y={y - 11} width={46} height={22} rx={4} fill="none" stroke={C.cyan} strokeWidth={1.5} />}
              <line x1={X0} x2={x1} y1={y} y2={y} stroke={isSel ? C.cyan : C.text} strokeOpacity={isSel ? 1 : 0.75} strokeWidth={2} />
              <text x={10} y={y + 4} fill={isSel ? C.cyan : C.text} fontSize={12} style={{ fontFamily: MONO }}>
                {`|${n}⟩`}
              </text>
            </g>
          );
        })}

        {showSpacing &&
          energies.slice(0, -1).map((e, n) => {
            const ya = Y(e);
            const yb = Y(energies[n + 1]);
            const top = Math.min(ya, yb);
            const bot = Math.max(ya, yb);
            const dx = x1 + 16;
            const s = w0 - A * n;
            return (
              <g key={`d${n}`}>
                <line x1={dx} x2={dx} y1={top} y2={bot} stroke={C.muted} strokeWidth={1.5} />
                <line x1={dx - 4} x2={dx + 4} y1={top} y2={top} stroke={C.muted} strokeWidth={1.5} />
                <line x1={dx - 4} x2={dx + 4} y1={bot} y2={bot} stroke={C.muted} strokeWidth={1.5} />
                <text x={dx + 8} y={(top + bot) / 2 + 4} fill={C.muted} fontSize={12} style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
                  {`Δ ${s.toFixed(2)}`}
                </text>
              </g>
            );
          })}

        {showLabel && (
          <text x={xc + 34} y={nrY + 4} fill={C.red} fontSize={12} style={{ fontFamily: UI }}>
            not resonant
          </text>
        )}

        {hasDot && (
          <g ref={dotRef} style={{ pointerEvents: 'none' }}>
            <circle r={12} fill={C.amber} fillOpacity={0.18} />
            <circle r={6.5} fill={C.amber} fillOpacity={0.35} />
            <circle ref={ringRef} r={8} fill="none" stroke={C.red} strokeWidth={2} opacity={0} />
            <circle ref={coreRef} r={4.5} fill={C.amber} />
          </g>
        )}
      </svg>

      {onSelect &&
        energies.map((e, n) => (
          <button
            key={n}
            type="button"
            aria-label={`Level ${n}`}
            aria-pressed={selected.includes(n)}
            onClick={() => onSelect(n)}
            style={{
              position: 'absolute',
              left: 0,
              top: Y(e) - 12,
              width: x1 + 4,
              height: 24,
              margin: 0,
              padding: 0,
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
            }}
          />
        ))}
    </div>
  );
}
