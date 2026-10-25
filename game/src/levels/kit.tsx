import { useEffect, useRef, type ReactNode } from 'react';
import { C } from '../styles/colors';

/** Three-region bench: parts and controls, the main instrument, and readouts. Collapses to one column on narrow screens. */
export function Bench({ left, center, right }: { left?: ReactNode; center: ReactNode; right?: ReactNode }) {
  const cols = `${left ? 'minmax(220px, 270px) ' : ''}minmax(0, 1fr)${right ? ' minmax(230px, 310px)' : ''}`;
  return (
    <div className="bench" style={{ gridTemplateColumns: cols }}>
      {left && <section className="bench-col">{left}</section>}
      <section className="bench-col" style={{ minWidth: 0 }}>{center}</section>
      {right && <section className="bench-col">{right}</section>}
    </div>
  );
}

export function Slider({ label, value, min, max, step = 0.01, unit = '', onChange, digits = 2 }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void; digits?: number }) {
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 14 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between' }}><span>{label}</span><span className="num" style={{ color: C.cyan }}>{value.toFixed(digits)}{unit && ` ${unit}`}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} style={{ accentColor: C.amber, width: '100%' }} />
    </label>
  );
}

export function Readout({ label, value, tone = 'cyan', note }: { label: string; value: string; tone?: 'cyan' | 'amber' | 'violet' | 'red'; note?: string }) {
  return (
    <div style={{ display: 'grid', gap: 2, padding: '8px 12px', border: `1px solid ${C.edge}`, borderRadius: 8, background: 'rgba(11,16,32,.55)' }}>
      <span className="muted" style={{ fontSize: 13 }}>{label}</span>
      <span className="num" style={{ fontSize: 22, color: C[tone] }}>{value}</span>
      {note && <span className="muted" style={{ fontSize: 12 }}>{note}</span>}
    </div>
  );
}

/** Objective list with a drawn check, so progress never depends on color alone. */
export function Checklist({ items }: { items: { label: string; done: boolean }[] }) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }} aria-label="Objectives">
      {items.map((it) => (
        <li key={it.label} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, color: it.done ? C.text : C.muted }}>
          <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden>
            <circle cx={9} cy={9} r={7.5} fill="none" stroke={it.done ? C.amber : C.edge} strokeWidth={1.5} />
            {it.done && <path d="M5 9.5l2.8 2.8L13 6.5" fill="none" stroke={C.amber} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
          </svg>
          <span style={{ textDecoration: it.done ? 'none' : undefined }}>{it.label}</span>
          <span className="sr-only" style={{ position: 'absolute', left: -9999 }}>{it.done ? 'done' : 'not done'}</span>
        </li>
      ))}
    </ul>
  );
}

/** Experimental-language feedback line. */
export function Feedback({ kind = 'info', children }: { kind?: 'ok' | 'warn' | 'info'; children: ReactNode }) {
  const color = kind === 'ok' ? C.cyan : kind === 'warn' ? C.red : C.muted;
  return <div role="status" style={{ fontSize: 14, padding: '8px 12px', borderRadius: 8, border: `1px solid ${color}55`, background: `${color}12`, color: C.text }}>{children}</div>;
}

/** Fire `fn` exactly once, the first time `cond` becomes true. */
export function useOnce(cond: boolean, fn: () => void) {
  const fired = useRef(false);
  useEffect(() => { if (cond && !fired.current) { fired.current = true; fn(); } });
}

/** Run a requestAnimationFrame loop with dt (s); stops on unmount. */
export function useRaf(cb: (dt: number, t: number) => void) {
  const ref = useRef(cb); ref.current = cb;
  useEffect(() => {
    let id = 0, last = performance.now(); const t0 = last;
    const loop = (now: number) => { ref.current(Math.min(0.05, (now - last) / 1000), (now - t0) / 1000); last = now; id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);
}
