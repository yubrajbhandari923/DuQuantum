import { useEffect, useMemo, useRef, useState } from 'react';
import type { LevelProps } from '../types';
import { CircuitBench, type Part, type Slot } from '../instruments/CircuitBench';
import { EnergyLadder } from '../instruments/EnergyLadder';
import { BlochSphere } from '../instruments/BlochSphere';
import { Oscilloscope } from '../instruments/Oscilloscope';
import { Bench, Checklist, Feedback, Readout, Slider, useOnce } from './kit';
import { GROUND, drive, p1, rabiPeak, transitionFreq, type Vec3 } from '../physics/twoLevel';
import { play } from '../audio/sfx';

const PARTS: Part[] = [
  { type: 'inductor', label: 'Inductor', tone: 'amber', glyph: 'inductor' },
  { type: 'capacitor', label: 'Capacitor', tone: 'cyan', glyph: 'capacitor' },
  { type: 'junction', label: 'Josephson junction', tone: 'violet', glyph: 'junction' },
  { type: 'resistor', label: 'Resistor', tone: 'red', glyph: 'line' },
];
const SLOTS: Slot[] = [
  { id: 'L', x: 130, y: 120, accepts: ['inductor'], label: 'Inductor' },
  { id: 'C', x: 320, y: 120, accepts: ['capacitor'], label: 'Capacitor' },
  { id: 'J', x: 510, y: 120, accepts: ['junction'], label: 'Junction' },
];
const WIRES: [string, string][] = [['L', 'C'], ['C', 'J']];
const PRELOADED = { L: 'inductor', C: 'capacitor' };
const F01 = 5; // GHz
const RAMSEY_DELTA = 0.5; // rad/us, free precession about z during the wait
const detuning = (fd: number) => 2 * Math.PI * (fd - F01) * 10; // rad/us for fd in GHz

interface Cal { omega: number; t: number; delta: number }

/** Ramsey fringe: pulse 1 (phase 0), free wait, pulse 2 at each swept phase. Returns phases (deg) and P(|1>). */
export function ramseySweep(cal: Cal, wait: number, n = 24) {
  const xs: number[] = [], ys: number[] = [];
  const v1 = drive(GROUND, cal.omega, cal.delta, 0, cal.t);
  const v2 = drive(v1, 0, RAMSEY_DELTA, 0, wait);
  for (let i = 0; i < n; i++) {
    const phi = (2 * Math.PI * i) / (n - 1);
    xs.push((phi * 180) / Math.PI);
    ys.push(p1(drive(v2, cal.omega, cal.delta, phi, cal.t)));
  }
  return { xs, ys, visibility: Math.max(...ys) - Math.min(...ys) };
}

export default function Level2({ onComplete, onReport }: LevelProps) {
  const [placed, setPlaced] = useState<Record<string, string>>(PRELOADED);
  const [A, setA] = useState(100); // MHz
  const [fd, setFd] = useState(4.6);
  const [omega, setOmega] = useState(1);
  const [dur, setDur] = useState(0);
  const [phi, setPhi] = useState(0);
  const [vec, setVec] = useState<Vec3>(GROUND);
  const [trail, setTrail] = useState<Vec3[]>([GROUND]);
  const [pulses, setPulses] = useState(0);
  const [busy, setBusy] = useState(false);
  const [gotOne, setGotOne] = useState(false);
  const [cal, setCal] = useState<Cal | null>(null);
  const [wait, setWait] = useState(0.5);
  const [sweep, setSweep] = useState<ReturnType<typeof ramseySweep> | null>(null);
  const timer = useRef(0);
  useEffect(() => () => clearInterval(timer.current), []);

  const hasJ = placed.J === 'junction';
  const anharmOk = hasJ && A >= 200;
  const delta = detuning(fd);
  const peak = rabiPeak(omega, delta);
  const tuned = anharmOk && Math.abs(fd - F01) <= 0.01;
  const ready = tuned;
  const equatorWrong = pulses === 1 && Math.abs(vec[2]) < 0.1 && vec[0] < 0.9;
  const coherent = !!sweep && sweep.visibility >= 0.9;

  const steps = [
    { label: 'Insert a Josephson junction', done: hasJ },
    { label: 'Make the ladder anharmonic (A ≥ 200 MHz)', done: anharmOk },
    { label: 'Tune the drive to the 0–1 transition', done: tuned },
    { label: 'Prepare |1⟩ with a single pulse', done: gotOne },
    { label: 'Prepare |+⟩ on the equator', done: !!cal },
    { label: 'Verify coherence with a Ramsey fringe', done: coherent },
  ];
  const next = steps.find((s) => !s.done);
  useEffect(() => onReport(next ? next.label : 'Experiment complete'), [next?.label, onReport]);
  useOnce(!next, () => onComplete({ score: 100, detail: `A = ${A} MHz · fringe visibility ${(sweep!.visibility * 100).toFixed(0)}%` }));

  const resetState = () => { clearInterval(timer.current); setBusy(false); setVec(GROUND); setTrail([GROUND]); setPulses(0); };
  const place = (slot: string, type: string | null) => {
    setPlaced((p) => { const n = { ...p }; type ? (n[slot] = type) : delete n[slot]; return n; });
  };

  const apply = () => {
    const start = vec, n = pulses, k0 = 20;
    let k = 0;
    play('pulse'); setBusy(true);
    clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      k++;
      const v = drive(start, omega, delta, phi, (dur * k) / k0);
      setVec(v); setTrail((t) => [...t, v]);
      if (k < k0) return;
      clearInterval(timer.current); setBusy(false); setPulses(n + 1);
      if (n === 0 && p1(v) >= 0.98) { setGotOne(true); play('success'); }
      if (n === 0 && v[0] >= 0.98) { setCal({ omega, t: dur, delta }); play('success'); }
    }, 30);
  };

  const pulseNote = useMemo(() => {
    if (!ready) return 'Pulses are disabled until the junction is in, A ≥ 200 MHz and the drive sits at 5.00 GHz.';
    if (pulses > 1) return 'Several pulses have been applied. Reset to |0⟩ to run a clean preparation.';
    return '';
  }, [ready, pulses]);

  const sw = sweep;
  return (
    <Bench
      left={<>
        <Checklist items={steps} />
        {hasJ && <Slider label="Junction nonlinearity A" value={A} min={100} max={400} step={10} unit="MHz" digits={0} onChange={setA} />}
        {anharmOk && <Slider label="Drive frequency" value={fd} min={4} max={5.5} step={0.005} unit="GHz" digits={3} onChange={setFd} />}
        {ready && <>
          <Slider label="Rabi rate Ω" value={omega} min={0.5} max={4} step={0.05} unit="rad/µs" onChange={setOmega} />
          <Slider label="Pulse duration t" value={dur} min={0} max={3} step={0.01} unit="µs" onChange={setDur} />
          <Slider label="Drive phase φ" value={phi} min={0} max={2 * Math.PI} step={0.05} unit="rad" onChange={setPhi} />
        </>}
      </>}
      center={<>
        {!hasJ
          ? <CircuitBench parts={PARTS} slots={SLOTS} wires={WIRES} placed={placed} onPlace={place}
              notice="The LC pair is a harmonic oscillator. Add a nonlinear element to the open socket." />
          : <EnergyLadder levels={5} omega={F01} anharmonicity={A / 1000} occupied={0} showSpacing
              transition={tuned ? { from: 0, to: 1, valid: true } : null} height={anharmOk ? 200 : 300} />}
        {!hasJ && <Feedback>A resistor would only dissipate energy: it cannot make the levels unequal.</Feedback>}
        {hasJ && !anharmOk && <Feedback>The spacings are still nearly equal. Raise A until the 1–2 gap is clearly smaller than the 0–1 gap.</Feedback>}
        {sw && <Oscilloscope series={[{ label: 'P(|1⟩)', tone: 'cyan', x: sw.xs, y: sw.ys }]} xLabel="Second-pulse phase (deg)" yLabel="P(|1⟩)"
          yRange={[0, 1]} thresholds={[{ y: 0.5, label: '50/50' }]} height={200} />}
        {ready && <BlochSphere vector={vec} trail={trail} label="Qubit state" axis={null} />}
      </>}
      right={<>
        <Readout label="0–1 transition" value={`${transitionFreq(0, F01, A / 1000).toFixed(3)} GHz`} note={hasJ ? `1–2 transition at ${transitionFreq(1, F01, A / 1000).toFixed(3)} GHz` : 'Harmonic: every gap is equal.'} />
        {anharmOk && <>
          <Readout label="Rabi peak population" value={`${(peak * 100).toFixed(0)}%`} tone={peak < 0.9 ? 'amber' : 'cyan'} note={`Detuning ${((fd - F01) * 1000).toFixed(0)} MHz = ${delta.toFixed(2)} rad/µs`} />
          {!tuned && <Feedback>{peak < 0.9 ? 'Drive frequency is off resonance.' : 'Close. Trim the frequency to within 10 MHz of the 0–1 line.'}</Feedback>}
        </>}
        {ready && <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn primary" disabled={busy || dur === 0 || pulses > 1} onClick={apply}>Apply pulse</button>
            <button className="btn" disabled={busy} onClick={resetState}>Reset to |0⟩</button>
          </div>
          {dur === 0 && <Feedback>Set a pulse duration above zero to enable Apply pulse.</Feedback>}
          {pulseNote && <Feedback>{pulseNote}</Feedback>}
          <Readout label="P(|1⟩)" value={`${(p1(vec) * 100).toFixed(1)}%`} note={`Pulse area Ω·t = ${(omega * dur).toFixed(2)} rad`} />
          {equatorWrong && <Feedback>The state is on the equator but at the wrong phase.</Feedback>}
          {!gotOne && pulses === 1 && p1(vec) < 0.98 && !equatorWrong && <Feedback>The population did not fully transfer. Adjust the pulse area.</Feedback>}
        </>}
        {cal && <>
          <Slider label="Wait between pulses" value={wait} min={0} max={1} step={0.05} unit="µs" onChange={(v) => { setWait(v); setSweep(null); }} />
          <button className="btn primary" onClick={() => { play('click'); setSweep(ramseySweep(cal, wait)); }}>Sweep second-pulse phase</button>
          <Feedback kind={coherent ? 'ok' : 'info'}>{sw ? (coherent ? `Fringe visibility ${(sw.visibility * 100).toFixed(0)}%. A 50/50 result alone proves nothing: the fringe does.` : 'The fringe is washed out. Recalibrate the π/2 pulse.') : 'A 50/50 result alone proves nothing: the fringe does. Sweep the phase of the second pulse.'}</Feedback>
        </>}
      </>}
    />
  );
}
