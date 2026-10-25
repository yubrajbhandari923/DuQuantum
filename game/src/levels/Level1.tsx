import { useEffect, useMemo, useState } from 'react';
import type { LevelProps } from '../types';
import { CircuitBench, type Part, type Slot } from '../instruments/CircuitBench';
import { EnergyLadder } from '../instruments/EnergyLadder';
import { PhotonHistogram } from '../instruments/PhotonHistogram';
import { Bench, Checklist, Feedback, Readout, Slider, useOnce } from './kit';
import { coherentPn, lcFrequency } from '../physics/quantum';
import { play } from '../audio/sfx';

const PARTS: Part[] = [
  { type: 'inductor', label: 'Inductor', tone: 'amber', glyph: 'inductor' },
  { type: 'capacitor', label: 'Capacitor', tone: 'cyan', glyph: 'capacitor' },
  { type: 'junction', label: 'Josephson junction', tone: 'violet', glyph: 'junction' },
];
const SLOTS: Slot[] = [
  { id: 'L', x: 170, y: 120, accepts: ['inductor'], label: 'Inductor' },
  { id: 'C', x: 470, y: 120, accepts: ['capacitor'], label: 'Capacitor' },
];
const WIRES: [string, string][] = [['L', 'C']];
const TARGET = [4, 6]; // GHz band the resonator must sit in

export default function Level1({ onComplete, onReport }: LevelProps) {
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [Lnh, setL] = useState(10);
  const [Cpf, setC] = useState(1);
  const [quantized, setQuantized] = useState(false);
  const [sel, setSel] = useState<number[]>([]);
  const [prepared, setPrepared] = useState<number[]>([]);
  const [occupied, setOccupied] = useState(0);
  const [amp, setAmp] = useState(0.5);
  const [dur, setDur] = useState(0);
  const [note, setNote] = useState('');

  const built = !!placed.L && !!placed.C;
  const f = useMemo(() => lcFrequency(Lnh * 1e-9, Cpf * 1e-12) / (2 * Math.PI) / 1e9, [Lnh, Cpf]); // GHz
  const tuned = built && f >= TARGET[0] && f <= TARGET[1];
  const encoded = sel[0] === 0 && sel[1] === 1;
  const alpha = 0.6 * amp * dur; // resonant drive displaces the oscillator: alpha grows with amplitude x time
  const probs = useMemo(() => Array.from({ length: 10 }, (_, n) => coherentPn(n, alpha * alpha)), [alpha]);
  const leak = 1 - probs[0] - probs[1];
  const nonselective = dur > 0 && leak > 0.15;
  const preparedBoth = prepared.includes(0) && prepared.includes(1);

  const steps = [
    { label: 'Assemble the LC circuit', done: built },
    { label: `Tune it into the ${TARGET[0]}–${TARGET[1]} GHz band`, done: tuned },
    { label: 'Quantize the oscillator', done: quantized && tuned },
    { label: 'Assign logical 0 and 1', done: quantized && encoded },
    { label: 'Prepare both logical states', done: encoded && preparedBoth },
    { label: 'Drive it and watch the leakage', done: encoded && nonselective },
  ];
  const next = steps.find((s) => !s.done);
  useEffect(() => onReport(next ? next.label : 'Experiment complete'), [next?.label, onReport]);
  useOnce(!next, () => onComplete({ score: 100, detail: `f = ${f.toFixed(2)} GHz · P(n≥2) = ${(leak * 100).toFixed(0)}% after a resonant drive` }));

  const place = (slot: string, type: string | null) => {
    setPlaced((p) => { const n = { ...p }; type ? (n[slot] = type) : delete n[slot]; return n; });
    if (!type) { setQuantized(false); setSel([]); setPrepared([]); setDur(0); }
  };
  const pick = (n: number) => {
    play('click');
    setSel((s) => (s.includes(n) ? s.filter((x) => x !== n) : s.length >= 2 ? [n] : [...s, n]));
  };

  return (
    <Bench
      left={<>
        <Checklist items={steps} />
        {built && <>
          <Slider label="Inductance L" value={Lnh} min={1} max={20} step={0.5} unit="nH" onChange={setL} digits={1} />
          <Slider label="Capacitance C" value={Cpf} min={0.05} max={2} step={0.05} unit="pF" onChange={setC} />
        </>}
      </>}
      center={!quantized
        ? <CircuitBench parts={PARTS} slots={SLOTS} wires={WIRES} placed={placed} onPlace={place}
            notice={built ? (tuned ? 'Resonance established. Quantize the oscillator when ready.' : `The circuit rings at ${f.toFixed(2)} GHz. The target band is ${TARGET[0]}–${TARGET[1]} GHz: change L or C.`) : undefined} />
        : <>
            <EnergyLadder levels={6} omega={f} occupied={occupied} selected={sel} onSelect={pick} showSpacing
              transition={dur > 0 ? { from: 0, to: Math.min(2, 1 + (dur > 2 ? 1 : 0)), valid: true } : null} />
            {!encoded && <Feedback>{sel.length < 2 ? 'Click two levels: first your logical 0, then your logical 1.' : 'Any two levels would work in principle, but the cheapest code uses the two lowest: |0⟩ and |1⟩.'}</Feedback>}
          </>}
      right={<>
        <Readout label="Resonant frequency" value={built ? `${f.toFixed(2)} GHz` : '—'} note="f = 1 / (2π√(LC))" />
        {!quantized && <button className="btn primary" disabled={!tuned} onClick={() => { play('success'); setQuantized(true); }}>Quantize oscillator</button>}
        {quantized && <>
          <Feedback>Level spacing is ħω everywhere: E_n = ħω(n + ½).</Feedback>
          <div style={{ display: 'flex', gap: 8 }}>
            {[0, 1].map((n) => (
              <button key={n} className="btn" disabled={!encoded} onClick={() => { play('photon'); setOccupied(n); setPrepared((p) => (p.includes(n) ? p : [...p, n])); setDur(0); }}>Prepare |{n}⟩</button>
            ))}
          </div>
          {encoded && preparedBoth && <>
            <Slider label="Drive amplitude" value={amp} min={0.1} max={1} step={0.05} onChange={setAmp} />
            <Slider label="Drive time" value={dur} min={0} max={4} step={0.1} unit="µs" onChange={(v) => { if (dur === 0 && v > 0) play('pulse'); setDur(v); }} />
            <PhotonHistogram probs={probs} highlight={[0, 1]} label="Photon number after a resonant drive" height={170} />
            <Readout label="Population outside {|0⟩, |1⟩}" value={`${(leak * 100).toFixed(1)}%`} tone={nonselective ? 'amber' : 'cyan'} note={nonselective ? 'Equal spacing: the drive climbs the whole ladder.' : 'Drive longer.'} />
          </>}
          {note && <Feedback>{note}</Feedback>}
        </>}
      </>}
    />
  );
}
