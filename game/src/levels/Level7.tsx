import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LevelProps } from '../types';
import { PhaseSpace } from '../instruments/PhaseSpace';
import { WignerPlot } from '../instruments/WignerPlot';
import { Oscilloscope } from '../instruments/Oscilloscope';
import { Bench, Checklist, Feedback, Readout, Slider, useOnce, useRaf } from './kit';
import { wignerCat } from '../physics/quantum';
import { darkResidual } from '../physics/stabilizer';
import { play } from '../audio/sfx';

const MISSION_ALPHA = 2.0;
const KICK: [number, number] = [1.3, 0.6];
const KAPPA_A = 0.4; // bare single-photon loss, 1/us
const T_RUN = 6; // us simulated per perturbation
const DT = 0.005;
const PLAYBACK = 0.4; // simulated us per real second, slow enough to watch the tail form

/** Mean-field two-photon flow, d(beta)/dt = -k conj(beta)(beta^2 - alpha^2), as two reals. */
const flow = (k: number, a: number, x: number, y: number): [number, number] => {
  const r2 = x * x + y * y;
  return [-k * x * (r2 - a * a), -k * y * (r2 + a * a)];
};

/** RK4 trajectory from (x0, y0) as [t, x, y] samples. */
function simulate(k: number, a: number, x0: number, y0: number, T = T_RUN, dt = DT) {
  const out: [number, number, number][] = [[0, x0, y0]];
  let x = x0, y = y0;
  for (let i = 1; i * dt <= T; i++) {
    const [a1, b1] = flow(k, a, x, y);
    const [a2, b2] = flow(k, a, x + 0.5 * dt * a1, y + 0.5 * dt * b1);
    const [a3, b3] = flow(k, a, x + 0.5 * dt * a2, y + 0.5 * dt * b2);
    const [a4, b4] = flow(k, a, x + dt * a3, y + dt * b3);
    x += (dt / 6) * (a1 + 2 * a2 + 2 * a3 + a4); y += (dt / 6) * (b1 + 2 * b2 + 2 * b3 + b4);
    out.push([i * dt, x, y]);
  }
  return out;
}

const dist = (a: number, p: [number, number, number]) => Math.hypot(p[1] - a, p[2]);

/** Time (us) to settle within 2% of alpha after kicking (alpha, 0) by (dx, dy); Infinity if never. */
export function recoverTime(kappa2: number, alpha: number, dx: number, dy = 0): number {
  const tr = simulate(kappa2, alpha, alpha + dx, dy);
  let last = -1; // last sample outside the tolerance, so a settling time means "stays inside"
  tr.forEach((p, i) => { if (dist(alpha, p) > 0.02 * alpha) last = i; });
  return last === tr.length - 1 ? Infinity : tr[last + 1][0];
}

export default function Level7({ onComplete, onReport }: LevelProps) {
  const [k2, setK2] = useState(1);
  const [alpha, setAlpha] = useState(1.2);
  const [run, setRun] = useState<{ k: number; a: number; traj: [number, number, number][]; tSettle: number } | null>(null);
  const [t, setT] = useState(0);
  const [on, setOn] = useState(true);
  const [tq, setTq] = useState(0);
  const [seen, setSeen] = useState({ on: false, off: false });
  const [marked, setMarked] = useState(false);

  const perturb = () => {
    play('pulse');
    const traj = simulate(k2, alpha, alpha + KICK[0], KICK[1]);
    setRun({ k: k2, a: alpha, traj, tSettle: recoverTime(k2, alpha, KICK[0], KICK[1]) });
    setT(0);
  };
  useRaf((dt) => { if (run && t < T_RUN) setT((v) => Math.min(T_RUN, v + dt * PLAYBACK)); });
  useEffect(() => { // viewing t >= 2 us in each mode unlocks the coherence mission
    if (tq >= 2) setSeen((s) => (on ? (s.on ? s : { ...s, on: true }) : s.off ? s : { ...s, off: true }));
  }, [tq, on]);

  const nT = run ? Math.min(run.traj.length - 1, Math.floor(t / DT)) : 0;
  const cur = run ? run.traj[nT] : null;
  const path = useMemo(() => (run ? run.traj.slice(0, nT + 1).map((p) => ({ x: p[1], y: p[2] })) : []), [run, nT]);
  const scope = useMemo(() => {
    if (!run) return { x: [] as number[], y: [] as number[] };
    const s = run.traj.slice(0, nT + 1).filter((_, i) => i % 4 === 0);
    return { x: s.map((p) => p[0]), y: s.map((p) => dist(run.a, p)) };
  }, [run, nT]);
  const flowFn = useCallback((x: number, y: number) => flow(k2, alpha, x, y), [k2, alpha]);

  const setA = Math.abs(alpha - MISSION_ALPHA) <= 0.1;
  const finished = !!run && Number.isFinite(run.tSettle);
  const fast = finished && run!.tSettle <= 1.5;
  const stable = k2 <= 3;
  const coherent = seen.on && seen.off && marked;
  const steps = [
    { label: 'Set the stable amplitude to alpha = 2.0 ± 0.1', done: setA },
    { label: 'Recover from the displacement: settle within 2% in under 1.5 µs', done: fast },
    { label: 'Keep the manifold stable (kappa2 ≤ 3.0 per µs)', done: stable },
    { label: 'Preserve superposition coherence', done: coherent },
  ];
  const next = steps.find((s) => !s.done);
  useEffect(() => onReport(next ? next.label : 'Experiment complete'), [next?.label, onReport]);
  useOnce(!next, () => onComplete({ score: 100, detail: `alpha = ${alpha.toFixed(1)} · kappa2 = ${k2.toFixed(1)}/µs · settled in ${run!.tSettle.toFixed(2)} µs` }));

  const aQ = on ? alpha : alpha * Math.exp((-KAPPA_A * tq) / 2);
  const c = on ? 1 : Math.exp(-2 * KAPPA_A * alpha * alpha * tq);
  const wfn = useCallback((x: number, y: number) => wignerCat(x, y, aQ, 'even', c), [aQ, c]);
  const resid = darkResidual(alpha, 'even');

  return (
    <Bench
      left={<>
        <Checklist items={steps} />
        <Slider label="Stabilization rate kappa2" value={k2} min={0.2} max={4} step={0.1} unit="1/µs" onChange={setK2} digits={1} />
        <Slider label="Target amplitude alpha" value={alpha} min={1} max={3} step={0.05} onChange={setAlpha} />
        <button className="btn primary" onClick={perturb}>Perturb</button>
        {k2 > 3 && <Feedback kind="warn">The effective model assumes a lossy buffer: kappa2 this large breaks the adiabatic approximation (see level 8).</Feedback>}
      </>}
      center={<>
        <PhaseSpace
          range={4}
          blobs={[{ x: cur ? cur[1] : alpha, y: cur ? cur[2] : 0, tone: 'cyan', label: 'state' }, ...(cur ? [] : [{ x: -alpha, y: 0, tone: 'violet' as const }])]}
          targets={[{ x: alpha, y: 0, r: 0.3, label: '+alpha' }, { x: -alpha, y: 0, r: 0.3, label: '-alpha' }]}
          trajectories={path.length > 1 ? [path] : undefined}
          flow={flowFn}
        />
        <Oscilloscope
          series={[{ label: '|beta - alpha|', tone: 'cyan', x: scope.x, y: scope.y }]}
          xLabel="Time (µs)" yLabel="|beta - alpha|" height={190}
          thresholds={[{ y: 0.02 * (run ? run.a : alpha), label: '2% of alpha' }]}
          markers={finished && t >= run!.tSettle ? [{ x: run!.tSettle, label: 'settled' }] : []}
        />
        <Feedback>Mean field: d(beta)/dt = -kappa2 conj(beta)(beta² - alpha²). On the real axis this is dx/dt = kappa2 x (alpha² - x²), which attracts to ±alpha.</Feedback>
      </>}
      right={<>
        <Readout label="Settling time (2%)" value={run ? (finished ? `${run.tSettle.toFixed(2)} µs` : 'not settled') : '—'} tone={fast ? 'cyan' : 'amber'} note="Kick of +1.3 in x, +0.6 in y" />
        {run && !finished && <Feedback kind="warn">Your stabilizer has not reached the target amplitude.</Feedback>}
        {run && finished && !fast && <Feedback>Settling takes longer than 1.5 µs. Raise kappa2 and perturb again.</Feedback>}
        <h3 style={{ margin: '6px 0 0', fontSize: 15 }}>Quantum-state demonstration</h3>
        <button className="btn" aria-pressed={on} onClick={() => setOn((v) => !v)}>Engineered stabilizer {on ? 'ON' : 'OFF'}</button>
        <Slider label="Time" value={tq} min={0} max={3} step={0.05} unit="µs" onChange={setTq} />
        <WignerPlot fn={wfn} range={4} label={`Even cat, ${on ? 'stabilized' : 'bare loss'}`} />
        <Readout label="Interference contrast" value={c.toFixed(3)} tone={on ? 'cyan' : 'red'} note={on ? `Dark-state residual ${resid.toExponential(1)}` : `Amplitude ${aQ.toFixed(2)}, kappa_a = ${KAPPA_A}/µs`} />
        <button className="btn" disabled={!(seen.on && seen.off) || marked} onClick={() => { play('success'); setMarked(true); }}>Mark coherence preserved</button>
        {!(seen.on && seen.off) && <Feedback>View t ≥ 2 µs with the stabilizer ON and OFF to compare.</Feedback>}
        {marked && <Feedback kind="ok">The stabilizer pulls both lobes toward ±alpha without learning which lobe the state is in.</Feedback>}
      </>}
    />
  );
}
