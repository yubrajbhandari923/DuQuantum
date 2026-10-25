import { useEffect, useMemo, useState } from 'react';
import type { LevelProps } from '../types';
import { CircuitBench, type Part, type Slot } from '../instruments/CircuitBench';
import { Oscilloscope } from '../instruments/Oscilloscope';
import { Bench, Checklist, Feedback, Readout, Slider, useOnce } from './kit';
import { alphaSq, kappa2, overshoot, pumpFrequency, reduced, settlingTime, simulate, type CoupledParams } from '../physics/coupled';
import { play } from '../audio/sfx';

const TP = 2 * Math.PI;
const WA = 7.0, WB = 9.2; // GHz: memory and buffer frequencies
const PUMP = pumpFrequency(WA, WB); // 4.8 GHz
export const LIMITS = { alphaSq: [4.11, 4.71], settle: 1.0, overshoot: 0.3 } as const;

const PARTS: Part[] = [
  { type: 'memory', label: 'High-Q memory', tone: 'cyan', glyph: 'resonator' },
  { type: 'buffer', label: 'Lossy buffer', tone: 'amber', glyph: 'buffer' },
  { type: 'squid', label: 'Threaded SQUID', tone: 'violet', glyph: 'squid' },
  { type: 'junction', label: 'Single junction', tone: 'violet', glyph: 'junction' },
  { type: 'pump', label: 'Microwave pump', tone: 'amber', glyph: 'pump' },
  { type: 'drive', label: 'Buffer drive', tone: 'cyan', glyph: 'drive' },
  { type: 'line', label: 'Dissipative output', tone: 'amber', glyph: 'line' },
];
const SLOTS: Slot[] = [
  { id: 'memory', x: 90, y: 100, accepts: ['memory'], label: 'Memory' },
  { id: 'squid', x: 250, y: 100, accepts: ['squid'], label: 'Coupler' },
  { id: 'buffer', x: 410, y: 100, accepts: ['buffer'], label: 'Buffer' },
  { id: 'line', x: 560, y: 100, accepts: ['line'], label: 'Output' },
  { id: 'pump', x: 250, y: 225, accepts: ['pump'], label: 'Pump' },
  { id: 'drive', x: 410, y: 225, accepts: ['drive'], label: 'Drive' },
];
const WIRES: [string, string][] = [['memory', 'squid'], ['squid', 'buffer'], ['buffer', 'line'], ['pump', 'squid'], ['drive', 'buffer']];

export default function Level8({ onComplete, onReport }: LevelProps) {
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [fCoarse, setCoarse] = useState(4.2); // GHz
  const [fFine, setFine] = useState(0); // MHz
  const [g2, setG2] = useState(0.3);
  const [kb, setKb] = useState(1);
  const [ka, setKa] = useState(0.0093);
  const [eps, setEps] = useState(0.9); // MHz (eps_d / 2pi)
  const [trunc, setTrunc] = useState(false);
  const [ran, setRan] = useState(false);

  const wired = SLOTS.every((s) => placed[s.id] === s.accepts[0]);
  const detMHz = Math.round(((fCoarse - PUMP) * 1000 + fFine) * 10) / 10 + 0; // +0 normalizes -0
  const p: CoupledParams = { g2: g2 * TP, kappaB: kb * TP, kappaA: ka * TP, epsD: eps * TP };
  const eff = 1 / (1 + ((detMHz * TP) / p.kappaB) ** 2); // Lorentzian of the conversion
  const tuned = wired && eff >= 0.9;
  const a2 = alphaSq(p);
  const sim = useMemo(() => simulate(p, 0.3, 4, 0.002, 10, tuned ? 0 : detMHz * TP), [g2, kb, ka, eps, tuned, detMHz]); // eslint-disable-line react-hooks/exhaustive-deps
  const red = useMemo(() => reduced(p, 0.3, 4, 0.002, 10), [g2, kb, ka, eps]); // eslint-disable-line react-hooks/exhaustive-deps
  const settle = settlingTime(sim.t, sim.n, 0.05);
  const os = overshoot(sim.n);
  const final = sim.n[sim.n.length - 1];
  const ampOk = tuned && a2 >= LIMITS.alphaSq[0] && a2 <= LIMITS.alphaSq[1] && Math.abs(final - a2) < 0.15 * a2;
  const dynOk = ampOk && settle <= LIMITS.settle && os <= LIMITS.overshoot;

  const steps = [
    { label: 'Wire the memory, SQUID, buffer, pump and drive', done: wired },
    { label: `Tune the pump to 2ωa − ωb (${PUMP.toFixed(2)} GHz)`, done: tuned },
    { label: 'Stabilize near α² = 4.41', done: ampOk },
    { label: 'Settle within 1 µs, overshoot under 30%', done: dynOk && ran },
  ];
  const next = steps.find((s) => !s.done);
  useEffect(() => onReport(next ? next.label : 'Experiment complete'), [next?.label, onReport]);
  useOnce(!next, () => onComplete({ score: 100, detail: `κ₂ = ${(kappa2(p) / TP).toFixed(2)} MHz·2π · settle ${settle.toFixed(2)} µs · overshoot ${(os * 100).toFixed(0)}%` }));

  const clip = (n: number[], N: number) => n.map((v) => Math.min(v, N - 1));
  const series = [
    { label: 'Full memory + buffer', tone: 'cyan' as const, x: sim.t, y: sim.n },
    { label: 'Reduced single-mode', tone: 'violet' as const, x: red.t, y: red.n, dashed: true },
    ...(trunc ? [{ label: 'Truncated at N = 6', tone: 'amber' as const, x: sim.t, y: clip(sim.n, 6), dashed: true }] : []),
  ];
  const status = !wired ? null
    : !tuned ? <Feedback kind="warn">Pump is {Math.abs(detMHz).toFixed(1)} MHz too {detMHz > 0 ? 'high' : 'low'}: only {(eff * 100).toFixed(0)}% of the two-photon conversion survives, so the memory amplitude cannot grow. Try {detMHz > 0 ? 'lowering' : 'raising'} the pump toward {PUMP.toFixed(2)} GHz{Math.abs(detMHz) > 30 ? ' with the coarse slider, then trim with the fine one' : ''}.</Feedback>
    : !ampOk ? <Feedback kind="warn">{a2 < LIMITS.alphaSq[0] || a2 > LIMITS.alphaSq[1] ? `Your stabilizer settles at α² = ${a2.toFixed(2)}; the mission needs 4.41 (ε_d / g₂).` : 'The memory has not reached its target amplitude yet.'}</Feedback>
    : !dynOk ? <Feedback kind="warn">{settle > LIMITS.settle ? `Settling takes ${Number.isFinite(settle) ? settle.toFixed(2) : 'too long'} µs: the buffer is responding too slowly.` : `Overshoot is ${(os * 100).toFixed(0)}%: the reduced model hides this ringing.`}</Feedback>
    : <Feedback kind="ok">Dark-state stabilization achieved. Press “Characterize transient” to log it.</Feedback>;

  return (
    <Bench
      left={<>
        <Checklist items={steps} />
        {wired && <>
          <Slider label="Pump frequency (coarse)" value={fCoarse} min={4} max={5.6} step={0.01} unit="GHz" onChange={setCoarse} />
          <Slider label="Pump frequency (fine)" value={fFine} min={-30} max={30} step={0.1} unit="MHz" digits={1} onChange={setFine} />
          <Readout label="Conversion efficiency" value={`${(eff * 100).toFixed(0)}%`} tone={eff >= 0.9 ? 'cyan' : 'amber'} note={`detuning ${detMHz.toFixed(1)} MHz`} />
        </>}
      </>}
      center={!wired
        ? <CircuitBench parts={PARTS} slots={SLOTS} wires={WIRES} placed={placed} onPlace={(s, t) => setPlaced((q) => { const n = { ...q }; t ? (n[s] = t) : delete n[s]; return n; })}
            notice="A single junction has no two-photon term: the memory needs the threaded SQUID." />
        : <>
            <Oscilloscope series={series} xLabel="Time (µs)" yLabel="Memory photons ⟨n⟩" thresholds={[{ y: 4.41, label: 'target 4.41' }]} yRange={[0, Math.max(6, ...sim.n) * 1.05]} height={280} />
            {status}
            <label style={{ fontSize: 14 }}><input type="checkbox" checked={trunc} onChange={(e) => setTrunc(e.target.checked)} /> Compare a small Fock truncation (illustrative: a cutoff clips the transient peak)</label>
          </>}
      right={wired ? <>
        <Slider label="Nonlinear coupling g₂/2π" value={g2} min={0.2} max={1.5} step={0.01} unit="MHz" onChange={setG2} />
        <Slider label="Buffer loss κb/2π" value={kb} min={0.6} max={6} step={0.1} unit="MHz" digits={1} onChange={setKb} />
        <Slider label="Memory loss κa/2π" value={ka} min={0.005} max={0.1} step={0.001} unit="MHz" digits={3} onChange={setKa} />
        <Slider label="Buffer drive εd/2π" value={eps} min={0.2} max={8} step={0.05} unit="MHz" onChange={setEps} />
        <Readout label="κ₂ = 4g₂²/κb" value={`${(kappa2(p) / TP).toFixed(2)} MHz`} />
        <Readout label="α² = εd/g₂" value={a2.toFixed(2)} tone={a2 >= LIMITS.alphaSq[0] && a2 <= LIMITS.alphaSq[1] ? 'cyan' : 'amber'} note="valid when the buffer is adiabatically eliminated" />
        <Readout label="Settling · overshoot" value={tuned && Number.isFinite(settle) ? `${settle.toFixed(2)} µs · ${(os * 100).toFixed(0)}%` : '—'} tone={dynOk ? 'cyan' : 'amber'} />
        <button className="btn primary" disabled={!dynOk} onClick={() => { play('stabilize'); setRan(true); }}>Characterize transient</button>
      </> : undefined}
    />
  );
}
