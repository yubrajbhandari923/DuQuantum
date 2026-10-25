import { useEffect, useMemo, useState } from 'react';
import type { LevelProps } from '../types';
import { CircuitBench, type Part, type Slot } from '../instruments/CircuitBench';
import { Oscilloscope } from '../instruments/Oscilloscope';
import { Bench, Checklist, Feedback, Readout, Slider, useOnce } from './kit';
import { assignmentError, contrast, noiseSigma, rng, shot, switchError, totalError, type Pulse } from '../physics/readout';
import { play } from '../audio/sfx';

const MIN_READOUTS = 3; // one shot is already decisive at a good setting; repeat to rule out a mid-window flip
export const BUDGET = { total: 0.005, switching: 0.0025, confidence: 0.95 } as const;

const PARTS: Part[] = [
  { type: 'memory', label: 'Stabilized memory', tone: 'cyan', glyph: 'resonator' },
  { type: 'buffer', label: 'Buffer resonator', tone: 'amber', glyph: 'buffer' },
  { type: 'squid', label: 'Threaded SQUID', tone: 'violet', glyph: 'squid' },
  { type: 'drive', label: 'Readout drive', tone: 'cyan', glyph: 'drive' },
  { type: 'line', label: 'Output line', tone: 'amber', glyph: 'line' },
  { type: 'detector', label: 'Homodyne detector', tone: 'violet', glyph: 'detector' },
  { type: 'pump', label: 'Pump (not needed here)', tone: 'amber', glyph: 'pump' },
];
const SLOTS: Slot[] = [
  { id: 'drive', x: 80, y: 80, accepts: ['drive'], label: 'Readout drive' },
  { id: 'memory', x: 80, y: 215, accepts: ['memory'], label: 'Memory' },
  { id: 'squid', x: 235, y: 215, accepts: ['squid'], label: 'Coupler' },
  { id: 'buffer', x: 390, y: 215, accepts: ['buffer'], label: 'Buffer' },
  { id: 'line', x: 390, y: 80, accepts: ['line'], label: 'Output line' },
  { id: 'detector', x: 555, y: 80, accepts: ['detector'], label: 'Detector' },
];
const WIRES: [string, string][] = [['drive', 'memory'], ['memory', 'squid'], ['squid', 'buffer'], ['buffer', 'line'], ['line', 'detector']];
const gaussian = (x: number, m: number, s: number) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
const pct = (x: number) => `${(x * 100).toFixed(x < 0.01 ? 3 : 2)}%`;

export default function Level10({ onComplete, onReport }: LevelProps) {
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [eps, setEps] = useState(20);
  const [T, setT] = useState(8);
  const [alpha, setAlpha] = useState(2.1);
  const [pulse, setPulse] = useState<Pulse>('step');
  const [attempt, setAttempt] = useState(0);
  const [values, setValues] = useState<number[]>([]);
  const [verdict, setVerdict] = useState<'none' | 'wrong' | 'right'>('none');

  const wired = SLOTS.every((s) => placed[s.id] === s.accepts[0]);
  const c = contrast(eps, alpha), sigma = noiseSigma(T, pulse);
  const pa = assignmentError(eps, alpha, T, pulse), ps = switchError(eps, alpha, T), pt = totalError(eps, alpha, T, pulse);
  const configOk = wired && pt <= BUDGET.total && ps <= BUDGET.switching;
  const bit = useMemo(() => (rng(1000 + attempt)() < 0.5 ? 0 : 1) as 0 | 1, [attempt]); // hidden disarming bit, seeded
  const llr0 = (-c * values.reduce((a, b) => a + b, 0)) / (sigma * sigma); // log-likelihood ratio for logical 0
  const p0 = 1 / (1 + Math.exp(-llr0));
  const conf = values.length >= MIN_READOUTS ? Math.min(Math.max(p0, 1 - p0), 1 - ps) : 0;

  const sweep = useMemo(() => {
    const x = Array.from({ length: 100 }, (_, i) => 0.3 + 29.7 * (i / 99) ** 2); // dense at low drive, where the optimum lives
    return { x, tot: x.map((e) => totalError(e, alpha, T, pulse) * 100), asg: x.map((e) => assignmentError(e, alpha, T, pulse) * 100), sw: x.map((e) => switchError(e, alpha, T) * 100) };
  }, [alpha, T, pulse]);
  const X = Math.max(c, 4 * sigma, 1);
  const dist = useMemo(() => {
    const x = Array.from({ length: 120 }, (_, i) => -X + (2 * X * i) / 119);
    return { x, y0: x.map((v) => gaussian(v, -c / 2, sigma)), y1: x.map((v) => gaussian(v, c / 2, sigma)) };
  }, [c, sigma, X]);

  const steps = [
    { label: 'Assemble the measurement chain', done: wired },
    { label: 'Fit the error budget (total ≤ 0.5%, switching ≤ 0.25%)', done: configOk },
    { label: 'Take at least 3 readouts, confidence ≥ 95%', done: configOk && conf >= BUDGET.confidence },
    { label: 'Commit the logical bit', done: verdict === 'right' },
  ];
  const next = steps.find((s) => !s.done);
  useEffect(() => onReport(next ? next.label : 'Bomb disarmed'), [next?.label, onReport]);
  useOnce(verdict === 'right', () => onComplete({ score: Math.max(1, Math.round(100 * (1 - pt / 0.05))), detail: `P_total = ${pct(pt)} · P_switch = ${pct(ps)} · confidence ${(conf * 100).toFixed(1)}%` }));

  const measure = () => {
    play('measure');
    const r = rng(5000 + attempt * 100 + values.length);
    setValues((v) => [...v, shot(bit, eps, alpha, T, pulse, r).value]);
  };
  const commit = (b: 0 | 1) => {
    if (b === bit) { play('stabilize'); setVerdict('right'); } else { play('fail'); setVerdict('wrong'); setAttempt((a) => a + 1); setValues([]); }
  };

  const budgetNote = !wired ? null
    : ps > BUDGET.switching ? <Feedback kind="warn">Readout-induced switching is {pct(ps)}, over the 0.25% budget. {eps > 12 ? 'You’re not interrogating a suspect. Turn the power down.' : 'Shorten the window, or enlarge the cat.'}</Feedback>
    : pa > BUDGET.total - ps ? <Feedback kind="warn">Measurement noise is too high: assignment error is {pct(pa)}. {T < 12 ? 'Integrate longer, ' : ''}or drive a little harder.</Feedback>
    : <Feedback kind="ok">Inside the error budget: assignment {pct(pa)} + switching {pct(ps)}.</Feedback>;

  return (
    <Bench
      left={<>
        <Checklist items={steps} />
        {wired && <>
          <Slider label="Readout drive εZ/2π" value={eps} min={0.3} max={30} step={0.1} unit="MHz" digits={1} onChange={setEps} />
          <Slider label="Integration time" value={T} min={1} max={40} step={0.5} unit="µs" digits={1} onChange={setT} />
          <Slider label="Readout cat size α" value={alpha} min={1.8} max={2.8} step={0.05} onChange={setAlpha} />
          <label style={{ display: 'grid', gap: 4, fontSize: 14 }}>Pulse shape
            <select value={pulse} onChange={(e) => setPulse(e.target.value as Pulse)}>
              <option value="step">Sudden step (rings for 1.5 µs)</option><option value="shaped">Shaped two-step (rings for 0.4 µs)</option>
            </select>
          </label>
        </>}
      </>}
      center={!wired
        ? <CircuitBench parts={PARTS} slots={SLOTS} wires={WIRES} placed={placed} onPlace={(s, t) => setPlaced((q) => { const n = { ...q }; t ? (n[s] = t) : delete n[s]; return n; })}
            notice="The pump is already running from level 8: the readout chain needs the drive, the output line and a homodyne detector." />
        : <>
            <Oscilloscope series={[
              { label: 'Logical 0 (Re⟨b⟩ < 0)', tone: 'cyan', x: dist.x, y: dist.y0 },
              { label: 'Logical 1 (Re⟨b⟩ > 0)', tone: 'violet', x: dist.x, y: dist.y1, dashed: true },
            ]} xLabel="Integrated signal Re⟨b⟩ (arb.)" yLabel="Probability density" thresholds={[]} markers={[{ x: 0, label: 'threshold' }, ...values.map((v, i) => ({ x: v, label: `#${i + 1}` }))]} height={200} />
            <Oscilloscope series={[
              { label: 'Total error', tone: 'amber', x: sweep.x, y: sweep.tot },
              { label: 'Assignment', tone: 'cyan', x: sweep.x, y: sweep.asg, dashed: true },
              { label: 'Switching', tone: 'red', x: sweep.x, y: sweep.sw, dashed: true },
            ]} xLabel="Readout drive εZ/2π (MHz)" yLabel="Error (%)" yRange={[0, 5]} thresholds={[{ y: BUDGET.total * 100, label: 'budget 0.5%' }]} markers={[{ x: eps, label: 'you' }]} height={200} />
            {budgetNote}
          </>}
      right={wired ? <>
        <Readout label="Output contrast" value={c.toFixed(2)} note="Re⟨b⟩± = ∓εZ / (2αg₂)" />
        <Readout label="Total error" value={pct(pt)} tone={configOk ? 'cyan' : 'amber'} note={`assign ${pct(pa)} · switch ${pct(ps)}`} />
        <Readout label="Confidence" value={conf ? `${(conf * 100).toFixed(1)}%` : '—'} tone={conf >= BUDGET.confidence ? 'cyan' : 'amber'} note={`${values.length} of ${MIN_READOUTS}+ readouts`} />
        <button className="btn" disabled={!configOk} onClick={measure}>Take a readout</button>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn primary" disabled={!(configOk && conf >= BUDGET.confidence)} onClick={() => commit(0)}>Disarm: logical 0</button>
          <button className="btn primary" disabled={!(configOk && conf >= BUDGET.confidence)} onClick={() => commit(1)}>Disarm: logical 1</button>
        </div>
        {verdict === 'wrong' && <Feedback kind="warn">Wrong bit. The timer slips and the box re-arms with a new hidden bit. Take fresh readouts.</Feedback>}
        {alpha >= 2.4 && <Feedback>Larger cat: switching is lower but the output contrast is weaker (∝ 1/α).</Feedback>}
      </> : undefined}
    />
  );
}
