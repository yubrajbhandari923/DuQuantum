import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LevelProps } from '../types';
import { Oscilloscope } from '../instruments/Oscilloscope';
import { PhaseSpace } from '../instruments/PhaseSpace';
import { WignerPlot } from '../instruments/WignerPlot';
import { Bench, Checklist, Feedback, Readout, Slider, useOnce, useRaf } from './kit';
import { alphaUnderLoss, wignerCat } from '../physics/quantum';
import { alphaSqUnderPairLoss } from '../physics/errors';
import { play } from '../audio/sfx';

type Tab = 'A' | 'B' | 'C' | 'D';
const TABS: { id: Tab; label: string }[] = [
  { id: 'A', label: 'Watch a coherent state shrink' },
  { id: 'B', label: 'Expose an even cat' },
  { id: 'C', label: 'Compare single- and two-photon loss' },
  { id: 'D', label: 'Classify the error' },
];
const KAPPA2 = 0.5;
const TMAX = 3;
// Square instruments fill the column width, so pair them side by side to keep the scope above the fold.
const PAIR: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, alignItems: 'start' };
const ts = Array.from({ length: 61 }, (_, i) => (i / 60) * TMAX);

export default function Level6({ onComplete, onReport }: LevelProps) {
  const [tab, setTab] = useState<Tab>('A');
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [alpha0, setAlpha0] = useState(2);
  const [loss, setLoss] = useState(false);
  const [channel, setChannel] = useState<'single' | 'pair'>('single');
  const [seen, setSeen] = useState({ single: false, pair: false });
  const [doneA, setDoneA] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [wrong, setWrong] = useState<string | null>(null);
  const [doneD, setDoneD] = useState(false);

  useRaf((dt) => {
    if (playing) setT((v) => { const n = Math.min(TMAX, v + dt * 0.5); if (n >= TMAX) setPlaying(false); return n; });
  });

  const parity = (tt: number) => Math.exp(-2 * alpha0 * alpha0 * (1 - Math.exp(-tt)));
  const pairAlpha = (tt: number) => Math.sqrt(alphaSqUnderPairLoss(alpha0 * alpha0, KAPPA2, tt));
  const alphaT = loss ? alphaUnderLoss(alpha0, 1, t) : alpha0;
  const pT = parity(t);

  useEffect(() => {
    if (tab === 'A' && loss && t >= 1.5) setDoneA(true);
    if (tab === 'C' && t >= 1.5) setSeen((s) => (s[channel] ? s : { ...s, [channel]: true }));
  }, [tab, loss, t, channel]);

  const doneB = recorded;
  const doneC = seen.single && seen.pair;
  const steps = [
    { label: 'Watch a coherent state shrink under photon loss', done: doneA },
    { label: 'Expose an even cat: parity at or below 0.2', done: doneB },
    { label: 'View both loss channels at t of 1.5 or later', done: doneC },
    { label: 'Classify the error a photon loss applies', done: doneD },
  ];
  const next = steps.find((s) => !s.done);
  useEffect(() => onReport(next ? next.label : 'Experiment complete'), [next?.label, onReport]);
  useOnce(!next, () => onComplete({ score: 100, detail: `parity ${pT.toFixed(2)} at t = ${t.toFixed(1)}/κ · single-photon loss acts as Z_L` }));

  const cat = useCallback(
    (x: number, y: number) => wignerCat(x, y, alpha0 * Math.exp(-t / 2), 'even', parity(t)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [alpha0, t],
  );
  const traj = useMemo(() => ts.filter((x) => x <= t).map((x) => ({ x: alphaUnderLoss(alpha0, 1, x), y: 0 })), [alpha0, t]);
  const pairTraj = useMemo(() => ts.filter((x) => x <= t).map((x) => ({ x: pairAlpha(x), y: 0 })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [alpha0, t]);

  const go = (id: Tab) => {
    play('click'); setTab(id); setT(0); setPlaying(false);
  };

  const left = (
    <>
      <Checklist items={steps} />
      <div style={{ display: 'grid', gap: 6 }}>
        {TABS.map((x) => (
          <button key={x.id} className={`btn${tab === x.id ? ' primary' : ''}`} onClick={() => go(x.id)} aria-pressed={tab === x.id}>{x.id}. {x.label}</button>
        ))}
      </div>
      {tab !== 'D' && <>
        <Slider label="Time" value={t} min={0} max={TMAX} step={0.05} unit="/κ" onChange={(v) => { setPlaying(false); setT(v); }} />
        <button className="btn" onClick={() => { play('click'); if (t >= TMAX) setT(0); setPlaying((p) => !p); }}>{playing ? 'Pause' : 'Play'}</button>
        <Slider label="Initial amplitude α₀" value={alpha0} min={1} max={3} step={0.1} onChange={(v) => { setAlpha0(v); }} />
      </>}
    </>
  );

  let center: React.ReactNode, right: React.ReactNode;
  if (tab === 'A') {
    center = <PhaseSpace blobs={[{ x: alphaT, y: 0, tone: 'cyan', label: 'α(t)' }]} ghost={[{ x: alpha0, y: 0 }]} trajectories={loss ? [traj] : []} range={3.5} />;
    right = <>
      <button className={`btn${loss ? ' primary' : ''}`} onClick={() => { play('click'); setLoss((v) => !v); }} aria-pressed={loss}>Single-photon loss: {loss ? 'on' : 'off'}</button>
      <Readout label="Amplitude α(t)" value={alphaT.toFixed(2)} note="α(t) = α₀ exp(−κt/2)" />
      <Readout label="Mean photon number ⟨n⟩" value={(alphaT * alphaT).toFixed(2)} tone="amber" />
      <Feedback kind={doneA ? 'ok' : 'info'}>{doneA ? 'The blob slid toward the origin: each lost photon removes energy, so |α| shrinks.' : loss ? 'Advance the clock to t of 1.5 or later.' : 'Switch the loss on, then advance the clock.'}</Feedback>
    </>;
  } else if (tab === 'B') {
    center = <div style={PAIR}>
      <WignerPlot fn={cat} range={4} resolution={110} label="Even cat under single-photon loss" />
      <Oscilloscope series={[
        { label: 'Parity ⟨Π⟩', tone: 'cyan', x: ts, y: ts.map(parity) },
        { label: 'Fringe contrast', tone: 'violet', x: ts, y: ts.map(parity), dashed: true },
      ]} xLabel="Time (1/κ)" yLabel="Parity" yRange={[0, 1]} thresholds={[{ y: 0.2, label: '0.2' }]} markers={[{ x: t, label: 'now' }]} height={190} />
    </div>;
    right = <>
      <Readout label="Parity ⟨Π⟩" value={pT.toFixed(3)} tone={pT <= 0.2 ? 'amber' : 'cyan'} note="exp(−2α₀²(1 − e^−t))" />
      <Readout label="Amplitude α(t)" value={(alpha0 * Math.exp(-t / 2)).toFixed(2)} />
      <button className="btn primary" disabled={pT > 0.2 || recorded} onClick={() => { play('success'); setRecorded(true); }}>{recorded ? 'Parity recorded' : 'Record parity'}</button>
      <Feedback kind={recorded ? 'ok' : 'info'}>{recorded ? 'The interference fringes washed out: one lost photon flips the cat parity, and the average over random loss times erases it.' : pT > 0.2 ? 'The fringes are still visible. Advance the clock until parity drops to 0.2.' : 'Parity is below 0.2. Record it.'}</Feedback>
    </>;
  } else if (tab === 'C') {
    const pair = channel === 'pair';
    const a = pair ? pairAlpha(t) : alphaUnderLoss(alpha0, 1, t);
    center = <div style={PAIR}>
      <PhaseSpace blobs={[{ x: a, y: 0, tone: pair ? 'violet' : 'cyan', label: 'α(t)' }]} ghost={[{ x: alpha0, y: 0 }]} trajectories={[pair ? pairTraj : traj]} range={3.5} />
      <Oscilloscope series={[{ label: 'Parity', tone: pair ? 'violet' : 'cyan', x: ts, y: ts.map((x) => (pair ? 1 : parity(x))) }]}
        xLabel="Time (1/κ)" yLabel="Parity" yRange={[0, 1.1]} markers={[{ x: t, label: 'now' }]} height={170} />
    </div>;
    right = <>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className={`btn${!pair ? ' primary' : ''}`} onClick={() => { play('click'); setChannel('single'); }}>Single-photon loss</button>
        <button className={`btn${pair ? ' primary' : ''}`} onClick={() => { play('click'); setChannel('pair'); }}>Two-photon loss</button>
      </div>
      <Readout label="Amplitude α(t)" value={a.toFixed(2)} tone={pair ? 'violet' : 'cyan'} />
      <Readout label="Parity" value={(pair ? 1 : pT).toFixed(2)} note={pair ? 'conserved exactly' : 'decays'} />
      <Feedback kind={seen.single && seen.pair ? 'ok' : 'info'}>{pair ? 'Pair loss preserves parity but, without a drive, does not hold a nonzero amplitude.' : 'Single-photon loss shrinks the amplitude and scrambles the parity.'} Viewed at t of 1.5 or later: <span className="num">{seen.single ? 'single' : '-'} / {seen.pair ? 'pair' : '-'}</span></Feedback>
    </>;
  } else {
    const pick = (id: string, ok: boolean) => { play('click'); if (ok) { play('success'); setDoneD(true); setWrong(null); } else setWrong(id); };
    center = <div style={{ display: 'grid', gap: 10, padding: 16 }}>
      <div className="num" style={{ fontSize: 20 }}>a|+α⟩ = +α|+α⟩</div>
      <div className="num" style={{ fontSize: 20 }}>a|−α⟩ = −α|−α⟩</div>
      <span className="muted">Both coherent states are eigenstates of the loss operator a. Which logical error does one photon-loss event apply?</span>
    </div>;
    right = <>
      <button className="btn" onClick={() => pick('X', false)}>Bit flip (X_L)</button>
      <button className="btn" onClick={() => pick('Z', true)}>Phase flip (Z_L)</button>
      <button className="btn" onClick={() => pick('Y', false)}>Both (Y_L)</button>
      {doneD && <Feedback kind="ok">Acting on α(c₊|+α⟩ + c₋|−α⟩) gives α(c₊|+α⟩ − c₋|−α⟩), so a ≈ α Z_L. The relative sign flips and nothing else.</Feedback>}
      {wrong && !doneD && <Feedback kind="warn">{wrong === 'X' ? 'The eigenvalues keep |+α⟩ and |−α⟩ in place, so the logical basis states are not exchanged.' : 'There is no bit-flip component, so Y_L = iX_LZ_L does not arise. Look at the sign of each eigenvalue.'}</Feedback>}
    </>;
  }

  return <Bench left={left} center={center} right={right} />;
}
