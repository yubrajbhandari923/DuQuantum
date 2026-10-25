import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import type { LevelProps } from '../types';
import { Oscilloscope } from '../instruments/Oscilloscope';
import { Bench, Checklist, Feedback, Readout, Slider, useOnce } from './kit';
import { BASE, gammaX, gammaZ } from '../physics/errors';
import { rng } from '../physics/readout';
import { play } from '../audio/sfx';
import { C } from '../styles/colors';

type Series = ComponentProps<typeof Oscilloscope>['series'];
type Env = 'Square' | 'Sine squared';

const ALPHA_T = BASE.alpha; // target cat amplitude, 2.1
const FACTOR: Record<Env, number> = { Square: 1, 'Sine squared': 0.5 }; // pulse area relative to a square pulse
const TX_TRUE = 1 / gammaX(ALPHA_T); // s, about 2.6
const GZ_US = gammaZ(BASE.kappaA, ALPHA_T) * 1e-6; // 1/us
const TZ_TRUE = 1 / GZ_US; // us, about 1.94
const TOL = 0.15;
const N = 60;

const within = (fit: number, truth: number) => Math.abs(fit - truth) / truth <= TOL;
const sci = (x: number) => { const [m, e] = x.toExponential(2).split('e'); return `${m} × 10^${Number(e)}`; };
const fmtTX = (s: number) => (s >= 1 ? `${s.toFixed(2)} s` : `${(s * 1e3).toFixed(1)} ms`);
const grid = (max: number) => Array.from({ length: N }, (_, i) => (i / (N - 1)) * max);
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

/** Noisy bit-flip decay Re<a>(t) over 0..3 T_X (about 0-8 s). Fixed seed, so every run is the same data. */
function bitTrace() {
  const r = rng(42);
  const x = grid(3 * TX_TRUE);
  return { x, y: x.map((t) => ALPHA_T * Math.exp(-t / TX_TRUE) + 0.04 * ALPHA_T * gauss(r)) };
}

/** Noisy parity decay <Pi>(t) over 0..5 us. */
function parityTrace() {
  const r = rng(7);
  const x = grid(5);
  return { x, y: x.map((t) => Math.exp(-GZ_US * t) + 0.03 * gauss(r)) };
}

const BIT = bitTrace();
const PAR = parityTrace();

/** Stage D map: each lifetime over its mission target, in decades, across the slider's alpha range (same rates as the readouts). */
const AL = Array.from({ length: 81 }, (_, i) => 1 + i * 0.025);
const MX = AL.map((a) => Math.log10(1 / gammaX(a) / 0.05)), MZ = AL.map((a) => Math.log10(1e6 / gammaZ(BASE.kappaA, a) / 2));
const OKA = AL.filter((_, i) => MX[i] >= 0 && MZ[i] >= 0);
const WINDOW: Series = [
  { label: 'T_X / 50 ms', tone: 'cyan', x: AL, y: MX },
  { label: 'T_Z / 2 µs', tone: 'amber', x: AL, y: MZ },
];

export default function Level9({ onComplete, onReport }: LevelProps) {
  // A: initialization
  const [amp, setAmp] = useState(1);
  const [dur, setDur] = useState(1);
  const [phase, setPhase] = useState(0);
  const [shape, setShape] = useState<Env>('Square');
  const [locked, setLocked] = useState(false);
  const [lockedFid, setLockedFid] = useState(0);
  // B: bit flips
  const [ranX, setRanX] = useState(false);
  const [tx, setTx] = useState(1);
  const [bitOk, setBitOk] = useState(false);
  // C: phase flips
  const [ranZ, setRanZ] = useState(false);
  const [tz, setTz] = useState(1);
  const [phaseOk, setPhaseOk] = useState(false);
  // D: operating point
  const [alphaD, setAlphaD] = useState(1);
  const [committed, setCommitted] = useState(false);

  const mag = amp * dur * FACTOR[shape];
  const ang = (phase * Math.PI) / 180;
  const re = mag * Math.cos(ang);
  const im = mag * Math.sin(ang);
  const fid = Math.exp(-((re - ALPHA_T) ** 2 + im * im));
  const envSeries = useMemo<Series>(() => {
    const u = grid(1);
    return [{ label: 'Envelope', tone: 'cyan', x: u.map((v) => v * dur), y: u.map((v) => amp * (shape === 'Square' ? 1 : Math.sin(Math.PI * v) ** 2)) }];
  }, [amp, dur, shape]);
  const bitSeries = useMemo<Series>(() => [
    { label: 'Re⟨a⟩ data', tone: 'cyan', x: BIT.x, y: BIT.y },
    { label: 'Fit', tone: 'violet', dashed: true, x: BIT.x, y: BIT.x.map((t) => ALPHA_T * Math.exp(-t / tx)) },
  ], [tx]);
  const paritySeries = useMemo<Series>(() => [
    { label: '⟨Π⟩ data', tone: 'cyan', x: PAR.x, y: PAR.y },
    { label: 'Fit', tone: 'violet', dashed: true, x: PAR.x, y: PAR.x.map((t) => Math.exp(-t / tz)) },
  ], [tz]);

  // D: live operating point
  const txD = 1 / gammaX(alphaD); // s
  const tzD = 1e6 / gammaZ(BASE.kappaA, alphaD); // us
  const txOk = txD >= 0.05;
  const tzOk = tzD >= 2;

  const steps = [
    { label: 'Initialize |0_L⟩ as |+α_t⟩', done: locked },
    { label: 'Fit the bit-flip time T_X', done: bitOk },
    { label: 'Fit the phase-flip time T_Z', done: phaseOk },
    { label: 'Commit an operating point', done: committed },
  ];
  const stage = steps.findIndex((s) => !s.done); // -1 when all four stages are done
  const next = stage >= 0 ? steps[stage] : undefined;
  useEffect(() => onReport(next ? next.label : 'Operating point committed'), [next?.label, onReport]);
  useOnce(stage < 0, () => onComplete({
    score: 100,
    detail: `α = ${alphaD.toFixed(2)} · T_X = ${fmtTX(txD)} · T_Z = ${tzD.toFixed(2)} µs`,
  }));

  const lock = () => { play('success'); setLocked(true); setLockedFid(fid); };
  const acceptX = () => { play('success'); setBitOk(true); };
  const acceptZ = () => { play('success'); setPhaseOk(true); };
  const commit = () => { play('success'); setCommitted(true); };

  const record = (
    <>
      {locked && <Feedback kind="ok">Initialization locked at <span className="num">{(lockedFid * 100).toFixed(1)}%</span> fidelity.</Feedback>}
      {bitOk && <Feedback kind="ok">Bit-flip time confirmed: T_X = <span className="num">{TX_TRUE.toFixed(2)} s</span>.</Feedback>}
      {phaseOk && <Feedback kind="ok">Phase-flip time confirmed: T_Z = <span className="num">{TZ_TRUE.toFixed(2)} µs</span>.</Feedback>}
    </>
  );

  return (
    <Bench
      left={<>
        <Checklist items={steps} />
        {stage === 0 && <>
          <Slider label="Pulse amplitude" value={amp} min={0} max={2} step={0.01} onChange={setAmp} />
          <Slider label="Duration" value={dur} min={0} max={3} step={0.01} unit="µs" onChange={setDur} />
          <Slider label="Phase" value={phase} min={0} max={360} step={1} unit="°" onChange={setPhase} digits={0} />
          <label style={{ display: 'grid', gap: 4, fontSize: 14 }}>
            <span>Envelope</span>
            <select value={shape} onChange={(e) => setShape(e.target.value as Env)} style={{ padding: '6px 8px', background: C.surface, color: C.text, border: `1px solid ${C.edge}`, borderRadius: 6 }}>
              <option>Square</option>
              <option>Sine squared</option>
            </select>
          </label>
        </>}
        {stage === 1 && ranX && !bitOk && <Slider label="Fitted bit-flip time T_X" value={tx} min={0.2} max={10} step={0.05} unit="s" onChange={setTx} />}
        {stage === 2 && ranZ && !phaseOk && <Slider label="Fitted phase-flip time T_Z" value={tz} min={0.2} max={6} step={0.02} unit="µs" onChange={setTz} />}
        {stage === 3 && <Slider label="Cat amplitude α" value={alphaD} min={1} max={3} step={0.01} onChange={setAlphaD} />}
      </>}
      center={<>
        {stage === 0 && <>
          <Oscilloscope series={envSeries} xLabel="Time (µs)" yLabel="Amplitude" yRange={[0, 2.2]} />
          <Feedback>{shape === 'Square' ? 'Square pulse: α = amplitude × duration.' : 'Sine squared pulse: α = 0.5 × amplitude × duration.'} Phase sets the direction of α in the complex plane.</Feedback>
        </>}
        {stage === 1 && (ranX
          ? <Oscilloscope series={bitSeries} xLabel="Time (s)" yLabel="Re⟨a⟩" yRange={[0, 2.4]} />
          : <Feedback>Run the bit-flip experiment to record the decay of the logical amplitude.</Feedback>)}
        {stage === 2 && (ranZ
          ? <Oscilloscope series={paritySeries} xLabel="Time (µs)" yLabel="⟨Π⟩" yRange={[-0.1, 1.1]} />
          : <Feedback>Run the parity experiment to record how fast the cat loses its phase.</Feedback>)}
        {stage === 3 && <>
        <Oscilloscope series={WINDOW} xLabel="Cat amplitude α" yLabel="log10 (lifetime / target)" yRange={[-1.5, 6]}
          thresholds={[{ y: 0, label: 'mission line' }]} markers={[{ x: alphaD, label: `α = ${alphaD.toFixed(2)}` }]} />
        <Feedback>Both curves must sit above the mission line. They do only for α between <span className="num">{OKA[0].toFixed(2)}</span> and <span className="num">{OKA[OKA.length - 1].toFixed(2)}</span>: T_X grows like exp(2α²), T_Z shrinks like 1/α².</Feedback>
        <Checklist items={[
          { label: `Bit-flip time T_X ≥ 50 ms (now ${fmtTX(txD)})`, done: txOk },
          { label: `Phase-flip time T_Z ≥ 2 µs (now ${tzD.toFixed(2)} µs)`, done: tzOk },
        ]} />
        <Feedback>Bit flips are suppressed but phase flips are not: a larger cat does not protect arbitrary quantum information.</Feedback>
        {!tzOk && <Feedback kind="warn">Phase-flip time is too short: reduce α.</Feedback>}
        {!txOk && <Feedback kind="warn">Bit-flip time is too short: increase α.</Feedback>}
        </>}
        {stage < 0 && <Feedback kind="ok">Operating point committed at α = <span className="num">{alphaD.toFixed(2)}</span>.</Feedback>}
      </>}
      right={<>
        {stage === 0 && <>
          <Readout label="Fidelity with |+α_t⟩" value={`${(fid * 100).toFixed(1)}%`} tone={fid >= 0.97 ? 'cyan' : 'amber'} note={`Prepared α = ${re.toFixed(2)} ${im >= 0 ? '+' : '−'} ${Math.abs(im).toFixed(2)} i · target α_t = ${ALPHA_T}`} />
          <button className="btn primary" disabled={fid < 0.97} onClick={lock}>Lock initialization</button>
          {fid < 0.97 && <Feedback kind="warn">Fidelity must reach 97% before the initialization can be locked.</Feedback>}
        </>}
        {stage === 1 && <>
          {!ranX
            ? <button className="btn primary" onClick={() => { play('pulse'); setRanX(true); }}>Run bit-flip experiment</button>
            : <>
                <Readout label="Fitted T_X" value={fmtTX(tx)} note="Fit curve: α exp(−t / T_X)" />
                <button className="btn primary" disabled={!within(tx, TX_TRUE)} onClick={acceptX}>Accept fit</button>
                {within(tx, TX_TRUE)
                  ? <Feedback>Fit is within tolerance. Accept it to record the bit-flip time.</Feedback>
                  : <Feedback kind="warn">{tx < TX_TRUE ? 'Fit decays too fast: increase T_X.' : 'Fit decays too slowly: decrease T_X.'}</Feedback>}
              </>}
        </>}
        {stage === 2 && <>
          {!ranZ
            ? <button className="btn primary" onClick={() => { play('pulse'); setRanZ(true); }}>Run parity experiment</button>
            : <>
                <Readout label="Fitted T_Z" value={`${tz.toFixed(2)} µs`} note="Fit curve: exp(−t / T_Z)" />
                <button className="btn primary" disabled={!within(tz, TZ_TRUE)} onClick={acceptZ}>Accept fit</button>
                {within(tz, TZ_TRUE)
                  ? <Feedback>Fit is within tolerance. Accept it to record the phase-flip time.</Feedback>
                  : <Feedback kind="warn">{tz < TZ_TRUE ? 'Fit decays too fast: increase T_Z.' : 'Fit decays too slowly: decrease T_Z.'}</Feedback>}
              </>}
        </>}
        {stage === 3 && <>
          <Readout label="Bit-flip time T_X = 1 / Γ_X" value={fmtTX(txD)} tone={txOk ? 'cyan' : 'red'} note="Mission: at least 50 ms" />
          <Readout label="Phase-flip time T_Z = 1 / Γ_Z" value={`${tzD.toFixed(2)} µs`} tone={tzOk ? 'cyan' : 'red'} note="Mission: at least 2 µs" />
          <Readout label="Bias ratio T_X / T_Z" value={sci(txD / (tzD * 1e-6))} tone="violet" />
          <button className="btn primary" disabled={!txOk || !tzOk} onClick={commit}>Commit operating point</button>
        </>}
        {record}
      </>}
    />
  );
}
