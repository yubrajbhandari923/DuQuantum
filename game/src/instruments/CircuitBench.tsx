import { Component, useRef, useState, type ReactNode } from 'react';
import { C, type Tone } from '../styles/colors';
import { play } from '../audio/sfx';
import { CircuitBench3D } from './CircuitBench3D';

export type Glyph = 'inductor' | 'capacitor' | 'junction' | 'resonator' | 'drive' | 'squid' | 'detector' | 'pump' | 'line' | 'buffer';
export interface Part { type: string; label: string; tone: Tone; glyph: Glyph }
export interface Slot { id: string; x: number; y: number; accepts: string[]; label: string }

const W = 640, H = 300;

/** Small schematic symbols, one consistent 2px stroke, drawn around (0,0) in a 44x28 box. */
export function GlyphMark({ g, color }: { g: Glyph; color: string }) {
  const p = { fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  switch (g) {
    case 'inductor': return <path {...p} d="M-22 6 q0-14 7 0 q0-14 7 0 q0-14 7 0 q0-14 7 0 q0-14 7 0 M-22 6 h-0" />;
    case 'capacitor': return <g {...p}><path d="M-22 0h18M4 0h18" /><path d="M-4 -12v24M4 -12v24" /></g>;
    case 'junction': return <g {...p}><path d="M-22 0h12M10 0h12" /><rect x={-10} y={-10} width={20} height={20} /><path d="M-6 -6l12 12M6 -6l-12 12" /></g>;
    case 'squid': return <g {...p}><rect x={-16} y={-12} width={32} height={24} rx={2} /><path d="M-22 0h6M16 0h6M-16 -3l0 6M16 -3l0 6" /><path d="M-19 -3l6 6M-13 -3l-6 6M13 -3l6 6M19 -3l-6 6" /></g>;
    case 'resonator': return <g {...p}><rect x={-22} y={-12} width={44} height={24} rx={4} /><path d="M-16 0 q4-9 8 0 t8 0 t8 0 t8 0" /></g>;
    case 'buffer': return <g {...p}><rect x={-22} y={-12} width={44} height={24} rx={4} strokeDasharray="4 3" /><path d="M-14 0 q3-8 6 0 t6 0 t6 0 t6 0" /></g>;
    case 'drive': return <g {...p}><circle r={13} /><path d="M-8 0 q4-8 8 0 t8 0" /><path d="M13 0h9" /></g>;
    case 'pump': return <g {...p}><circle r={13} /><path d="M-6 6 L0 -8 L6 6 M-3 1h6" /><path d="M13 0h9" /></g>;
    case 'detector': return <g {...p}><rect x={-22} y={-12} width={44} height={24} rx={3} /><path d="M-12 7 a12 12 0 0 1 24 0" /><path d="M0 7 L7 -2" /></g>;
    default: return <path {...p} d="M-22 0h44" />;
  }
}

interface Props {
  parts: Part[]; slots: Slot[]; wires: [string, string][];
  placed: Record<string, string>; onPlace: (slot: string, type: string | null) => void;
  notice?: string;
}

let gl: boolean | undefined;
const hasWebGL = () => (gl ??= (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })());

/** Falls back to the flat SVG bench if the 3D bench throws (lost context, shader failure). */
class Fallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** The circuit bench: a 3D workbench when WebGL works, the SVG bench otherwise. Same props either way. */
export function CircuitBench(props: Props) {
  const flat = <CircuitBenchSVG {...props} />;
  return hasWebGL() ? <Fallback fallback={flat}><CircuitBench3D {...props} /></Fallback> : flat;
}

/** Drag-and-snap bench. Drop a part on a socket (or tap a part, then a socket). A wire lights once both ends are filled. */
export function CircuitBenchSVG({ parts, slots, wires, placed, onPlace, notice }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ type: string; x: number; y: number; sx: number; sy: number } | null>(null);
  const suppress = useRef(false);
  const [armed, setArmed] = useState<string | null>(null);
  const [bad, setBad] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const byType = (t: string) => parts.find((p) => p.type === t)!;
  const used = new Set(Object.values(placed));

  const toSvg = (cx: number, cy: number) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * W, y: ((cy - r.top) / r.height) * H };
  };
  const tryPlace = (slot: Slot, type: string) => {
    if (!slot.accepts.includes(type)) {
      play('fail'); setBad(slot.id); setTimeout(() => setBad(null), 450);
      setMsg(`${byType(type).label} does not fit the ${slot.label} socket.`); return;
    }
    play('connect'); setMsg(''); setArmed(null); onPlace(slot.id, type);
  };
  const drop = (cx: number, cy: number, type: string) => {
    const p = toSvg(cx, cy);
    const hit = slots.map((s) => ({ s, d: Math.hypot(s.x - p.x, s.y - p.y) })).sort((a, b) => a.d - b.d)[0];
    if (hit && hit.d < 60) tryPlace(hit.s, type);
  };

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div role="group" aria-label="Parts tray" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {parts.map((p) => {
          const gone = used.has(p.type);
          return (
            <button key={p.type} className="btn" aria-pressed={armed === p.type} disabled={gone}
              style={{ display: 'flex', alignItems: 'center', gap: 8, touchAction: 'none', borderColor: armed === p.type ? C.cyan : undefined }}
              onClick={() => { if (suppress.current) { suppress.current = false; return; } setArmed(armed === p.type ? null : p.type); }}
              onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setDrag({ type: p.type, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY }); }}
              onPointerMove={(e) => drag && setDrag({ ...drag, x: e.clientX, y: e.clientY })}
              onPointerUp={(e) => { if (drag && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 8) { suppress.current = true; drop(e.clientX, e.clientY, p.type); } setDrag(null); }}>
              <svg width={44} height={28} viewBox="-24 -14 48 28" aria-hidden><GlyphMark g={p.glyph} color={C[p.tone]} /></svg>
              {p.label}
            </button>
          );
        })}
      </div>
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxHeight: '48vh', background: '#0b1124', borderRadius: 8, border: `1px solid ${C.edge}` }} role="img" aria-label="Circuit workbench">
        <defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#16213b" strokeWidth="1" /></pattern></defs>
        <rect width={W} height={H} fill="url(#grid)" />
        {wires.map(([a, b], i) => {
          const sa = slots.find((s) => s.id === a)!, sb = slots.find((s) => s.id === b)!;
          const live = !!placed[a] && !!placed[b];
          return <line key={i} x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y} stroke={live ? C.cyan : C.edge} strokeWidth={live ? 3 : 2} strokeDasharray={live ? '8 8' : '3 6'}>
            {live && <animate attributeName="stroke-dashoffset" from="32" to="0" dur="0.9s" repeatCount="indefinite" />}
          </line>;
        })}
        {slots.map((s) => {
          const t = placed[s.id];
          const part = t ? byType(t) : null;
          const ok = armed && s.accepts.includes(armed);
          return (
            <g key={s.id} transform={`translate(${s.x} ${s.y})`} tabIndex={0} role="button" aria-label={`${s.label} socket${part ? `, holds ${part.label}` : ', empty'}`}
              style={{ cursor: 'pointer', outline: 'none', animation: bad === s.id ? 'shake .4s' : undefined }}
              onClick={() => (part ? (play('click'), onPlace(s.id, null)) : armed && tryPlace(s, armed))}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), part ? onPlace(s.id, null) : armed && tryPlace(s, armed))}>
              <rect x={-36} y={-26} width={72} height={52} rx={8} fill={part ? '#14203a' : 'rgba(0,0,0,0.001)'} stroke={bad === s.id ? C.red : ok ? C.cyan : part ? C[part.tone] : C.muted} strokeWidth={ok ? 2.5 : 1.5} strokeDasharray={part ? undefined : '5 4'} />
              {part ? <GlyphMark g={part.glyph} color={C[part.tone]} /> : <text y={4} textAnchor="middle" fill={C.muted} fontSize={12}>drop here</text>}
              <text y={42} textAnchor="middle" fill={C.text} fontSize={12}>{s.label}</text>
            </g>
          );
        })}
      </svg>
      <div className="muted" style={{ minHeight: '1.4em', fontSize: 14 }} role="status">{msg || notice || 'Drag a part onto a socket, or tap a part and then a socket. Tap a placed part to pick it up.'}</div>
      {drag && <div style={{ position: 'fixed', left: drag.x - 22, top: drag.y - 14, pointerEvents: 'none', zIndex: 99 }}><svg width={44} height={28} viewBox="-24 -14 48 28"><GlyphMark g={byType(drag.type).glyph} color={C.amber} /></svg></div>}
      <style>{'@keyframes shake{0%,100%{transform:translate(var(--x,0),var(--y,0))}25%{filter:drop-shadow(-3px 0 0 #F06B73)}75%{filter:drop-shadow(3px 0 0 #F06B73)}}'}</style>
    </div>
  );
}
