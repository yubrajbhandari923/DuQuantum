import { useEffect, useState } from 'react';
import type { LevelProps } from '../types';
import { EnergyLadder } from '../instruments/EnergyLadder';
import { PhotonHistogram } from '../instruments/PhotonHistogram';
import { Bench, Checklist, Feedback, Readout, Slider, useOnce } from './kit';
import { play } from '../audio/sfx';

type Enc = 'adjacent' | 'distant';
const ENCS: Enc[] = ['adjacent', 'distant'];
const CODE: Record<Enc, [number, number]> = { adjacent: [0, 1], distant: [0, 4] };
const NAME: Record<Enc, string> = { adjacent: 'Adjacent: |0>,|1>', distant: 'Distant: |0>,|4>' };
const MAX_PULSES = 8;
const STEP_MS = 400;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/** Pure photon loss on |n>: P(m) = C(n,m) p^m (1-p)^(n-m), m survivors, p = exp(-kappa*t). Log-free, fine for n <= 6. */
function lossDistribution(n: number, p: number): number[] {
  const out: number[] = [];
  for (let m = 0; m <= n; m++) {
    let c = 1; // C(n,m) built multiplicatively
    for (let i = 1; i <= m; i++) c = (c * (n - m + i)) / i;
    out.push(c * p ** m * (1 - p) ** (n - m));
  }
  return out;
}

const leakedOut = (dist: number[], code: [number, number]) =>
  dist.reduce((s, v, m) => (m === code[0] || m === code[1] ? s : s + v), 0);

export default function Level3({ onComplete, onReport }: LevelProps) {
  const [enc, setEnc] = useState<Enc | null>(null);
  const [pulses, setPulses] = useState(0); // each pulse is one n -> n+1 step
  const [shown, setShown] = useState(0); // occupied level on the ladder
  const [running, setRunning] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [done, setDone] = useState<Partial<Record<Enc, number>>>({}); // encoding -> pulses used
  const [kappa, setKappa] = useState(0.4);
  const [seen, setSeen] = useState(false); // loss slider reached 0.3 at least once
  const [compared, setCompared] = useState(false);

  const preparedBoth = !!done.adjacent && !!done.distant;
  const top = enc ? CODE[enc][1] : 0;

  // Climb the ladder one pulse per step; cleared on unmount by the timeout cleanup.
  useEffect(() => {
    if (!running) return;
    if (shown >= pulses) {
      setRunning(false);
      if (enc && shown === CODE[enc][1]) setDone((d) => ({ ...d, [enc]: pulses }));
      return;
    }
    const id = window.setTimeout(() => setShown((s) => s + 1), STEP_MS);
    return () => window.clearTimeout(id);
  }, [running, shown, pulses, enc]);

  // Loss model for the two encodings, both starting from |1_L>.
  const p = Math.exp(-kappa);
  const adj = lossDistribution(1, p);
  const dis = lossDistribution(4, p);
  const adjPadded = [...adj, 0, 0, 0]; // align with the distant histogram's 5 bins
  const leakA = leakedOut(adj, CODE.adjacent);
  const leakD = leakedOut(dis, CODE.distant);
  const wrongA = adj[0];
  const wrongD = dis[0];

  const blocked = !enc ? 'Choose an encoding first.' : running ? 'Sequence running. Controls unlock when it lands.' : null;
  const full = pulses >= MAX_PULSES ? 'The sequence holds 8 pulses at most. Clear it to start over.' : null;
  const hint = blocked ?? full ?? (pulses === 0 && enc ? 'Add at least one pulse before running.' : null);

  const steps = [
    { label: 'Prepare |1_L> with the adjacent code', done: !!done.adjacent },
    { label: 'Prepare |1_L> with the distant code', done: !!done.distant },
    { label: 'Set the loss slider to kappa*t of 0.3 or more', done: seen },
    { label: 'Press Compare with over 20% of the distant code leaked', done: compared && leakD > 0.2 },
  ];
  const next = steps.find((s) => !s.done);
  useEffect(() => onReport(next ? next.label : 'Experiment complete'), [next?.label, onReport]);
  useOnce(!next, () => onComplete({ score: 100, detail: `${pct(leakD)} of the distant code leaked at kappa*t = ${kappa.toFixed(2)}` }));

  const pick = (e: Enc) => {
    if (running) return;
    setEnc(e); setPulses(0); setShown(0); setRejected(false);
  };
  const addPulse = () => {
    if (!enc || running || pulses >= MAX_PULSES) return;
    play('click'); setRejected(false); setPulses((n) => n + 1);
  };
  const direct = () => {
    if (!enc || running) return;
    play('click'); setRejected(true);
  };
  const clear = () => {
    if (running) return;
    play('click'); setPulses(0); setShown(0); setRejected(false);
  };
  const run = () => {
    if (!enc || running || pulses === 0) return;
    play('pulse'); setRejected(false);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    if (reduced) {
      setShown(pulses);
      if (pulses === CODE[enc][1]) setDone((d) => ({ ...d, [enc]: pulses }));
      return;
    }
    setShown(0);
    setRunning(true);
  };

  const status = rejected
    ? <Feedback kind="warn">This transition is not accessible with the selected control: a single-photon drive changes n by one.</Feedback>
    : !enc
      ? <Feedback>Pick an encoding. Its two code states are the levels the logical bit may occupy.</Feedback>
      : done[enc] !== undefined
        ? <Feedback kind="ok">{`${NAME[enc]} prepared with ${done[enc]} pulse${done[enc] === 1 ? '' : 's'}.`}</Feedback>
        : <Feedback>{`Target |${top}> is ${top} pulse${top > 1 ? 's' : ''} above |0>. Add pulses, then run.`}</Feedback>;

  return (
    <Bench
      left={<>
        <Checklist items={steps} />
        <div style={{ display: 'grid', gap: 8 }}>
          <span className="muted" style={{ fontSize: 13 }}>Encoding</span>
          {ENCS.map((e) => (
            <button key={e} className={`btn${enc === e ? ' primary' : ''}`} aria-pressed={enc === e} disabled={running} onClick={() => pick(e)}>
              {NAME[e]}
              {done[e] !== undefined && <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>prepared</span>}
            </button>
          ))}
        </div>
      </>}
      center={<>
        <EnergyLadder levels={7} omega={5} occupied={shown} selected={enc ? CODE[enc] : []}
          transition={rejected ? { from: 0, to: 4, valid: false } : null} />
        {status}
        {preparedBoth && <>
          <PhotonHistogram probs={adjPadded} compare={dis} highlight={[0, 1, 4]} height={200}
            label="Adjacent (solid) vs distant (dashed), after loss" />
          <Feedback>{'The separation did not protect it: a lost photon moves |4> to |3>, outside the code space, and the |0>,|1> code just flips.'}</Feedback>
        </>}
      </>}
      right={<>
        <Readout label="Control cost" value={`${pulses} pulse${pulses === 1 ? '' : 's'}`} note="Adjacent needs 1 pulse, distant needs 4." />
        <div style={{ display: 'grid', gap: 8 }}>
          <button className="btn" disabled={!enc || running || pulses >= MAX_PULSES} onClick={addPulse}>{'Add pulse n -> n+1'}</button>
          <button className="btn" disabled={!enc || running} onClick={direct}>{'Direct 0 -> 4 pulse'}</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" disabled={running || pulses === 0} onClick={clear}>Clear</button>
            <button className="btn primary" disabled={!enc || running || pulses === 0} onClick={run}>Run sequence</button>
          </div>
          {hint && <span className="muted" style={{ fontSize: 13 }}>{hint}</span>}
        </div>
        {pulses > 0 && (
          <ol aria-label="Pulse sequence" style={{ margin: 0, paddingLeft: 20, fontFamily: 'var(--font-mono)', fontSize: 13, display: 'grid', gap: 2 }}>
            {Array.from({ length: pulses }, (_, k) => <li key={k}>{`Pulse ${k + 1}: |${k}> -> |${k + 1}>`}</li>)}
          </ol>
        )}

        {preparedBoth ? <>
          <Slider label="Loss kappa*t" value={kappa} min={0} max={1.5} step={0.01} onChange={(v) => { setKappa(v); if (v >= 0.3) setSeen(true); }} />
          <Readout label="Population leaked out of the code space" value={pct(leakA)} note="Adjacent |0>,|1>" />
          <Readout label="Population leaked out of the code space" value={pct(leakD)} tone={leakD > 0.2 ? 'amber' : 'cyan'} note="Distant |0>,|4>" />
          <Readout label="Landed on the wrong logical state" value={pct(wrongA)} tone="red" note="Adjacent: photon number 0 is |0_L>" />
          <Readout label="Landed on the wrong logical state" value={pct(wrongD)} tone="red" note="Distant: photon number 0 is |0_L>" />
          <button className="btn" onClick={() => { play('click'); setCompared(true); }}>Compare</button>
        </> : <span className="muted" style={{ fontSize: 13 }}>Loss controls unlock once both encodings are prepared.</span>}
      </>}
    />
  );
}
