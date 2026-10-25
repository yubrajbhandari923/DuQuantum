import { useEffect, useState } from 'react';
import type { LevelProps } from '../types';
import { PhaseSpace } from '../instruments/PhaseSpace';
import { PhotonHistogram } from '../instruments/PhotonHistogram';
import { Bench, Checklist, Feedback, Readout, Slider, useOnce } from './kit';
import { coherentPn, oppositeOverlap } from '../physics/quantum';
import { play } from '../audio/sfx';
import type { Tone } from '../styles/colors';

const TARGET = { x: 2, y: 1 }; // task A marker, alpha = 2 + i
const TOL_A = 0.2;
const TARGET_N = 6.25; // task B mean photon number
const TOL_N = 0.3;
const TARGETS = [{ x: TARGET.x, y: TARGET.y, r: 0.25, label: 'target' }];

type Pt = { x: number; y: number };
type Marker = Pt & { tone: Tone; label: string };

const fmtPt = (p: Pt) => `${p.x.toFixed(2)} ${p.y < 0 ? '−' : '+'} ${Math.abs(p.y).toFixed(2)}i`;

export default function Level4({ onComplete, onReport }: LevelProps) {
  const [eps, setEps] = useState(0.8);
  const [t, setT] = useState(1);
  const [theta, setTheta] = useState(0);
  const [plus, setPlus] = useState<Pt | null>(null);
  const [minus, setMinus] = useState<Pt | null>(null);
  const [hitA, setHitA] = useState(false);
  const [note, setNote] = useState('');

  // alpha = eps * t * e^{i theta}; the pulse duration t is the scale, so |alpha| = eps * t
  const amp = eps * t;
  const rad = (theta * Math.PI) / 180;
  const alpha: Pt = { x: amp * Math.cos(rad), y: amp * Math.sin(rad) };
  const n = amp * amp;
  const dTarget = Math.hypot(alpha.x - TARGET.x, alpha.y - TARGET.y);
  const inTarget = dTarget <= TOL_A;
  const inBand = Math.abs(n - TARGET_N) <= TOL_N;
  const aDone = hitA;
  const bDone = plus !== null;
  const cDone = minus !== null;
  const overlap = plus ? oppositeOverlap(Math.hypot(plus.x, plus.y)) : null;

  useEffect(() => { if (inTarget) setHitA(true); }, [inTarget]); // sticky: once reached, stays checked

  const steps = [
    { label: 'Prepare the coherent state at the target marker', done: aDone },
    { label: 'Match the mean photon number', done: bDone },
    { label: 'Prepare the opposite state', done: cDone },
  ];
  const next = steps.find((s) => !s.done);
  useEffect(() => onReport(next ? next.label : 'Experiment complete'), [next?.label, onReport]);
  useOnce(!next, () => onComplete({ score: 100, detail: `<n> = ${n.toFixed(2)} · |⟨+α|−α⟩| = ${overlap?.toExponential(2) ?? '—'}` }));

  const lockPlus = () => {
    if (!inBand) { setNote(`The mean photon number is ${n.toFixed(1)}, the target is ${TARGET_N}.`); return; }
    play('success');
    setNote('');
    setPlus(alpha);
  };

  const lockMinus = () => {
    if (!plus) return;
    const gap = Math.hypot(alpha.x + plus.x, alpha.y + plus.y);
    if (gap > 0.25) { setNote(`The new state is ${gap.toFixed(2)} from −α. Move it to ${fmtPt({ x: -plus.x, y: -plus.y })}.`); return; }
    if (amp < 2) { setNote(`The new state has |α| = ${amp.toFixed(2)}. The opposite state needs |α| of at least 2.`); return; }
    play('success');
    setNote('');
    setMinus(alpha);
  };

  // Dragging sets alpha directly: keep t, back-solve eps = |alpha| / t, clamped to eps <= 2.
  const drag = (x: number, y: number) => {
    const tt = t > 0 ? t : 1; // a zero pulse cannot carry any amplitude, so restore a unit pulse
    setT(tt);
    setEps(Math.min(2, Math.hypot(x, y) / tt));
    setTheta((((Math.atan2(y, x) * 180) / Math.PI) % 360 + 360) % 360);
  };

  const hint = !aDone
    ? `Distance to the target marker: ${dTarget.toFixed(2)}. Drag the state onto it or use the sliders.`
    : !bDone
      ? (inBand ? 'In the target band. Lock this state as |+α⟩.' : 'Change the drive amplitude or pulse duration to reach the target photon number.')
      : !cDone
        ? `Move the state to the mirror point ${plus ? fmtPt({ x: -plus.x, y: -plus.y }) : ''} and lock it as |−α⟩.`
        : 'Both states are locked.';

  const blobs: Marker[] = [
    ...(cDone ? [] : [{ x: alpha.x, y: alpha.y, tone: 'cyan' as const, label: '|α⟩' }]), // hide the live blob once it would sit on the locked |−α⟩ label
    ...(plus ? [{ ...plus, tone: 'violet' as const, label: '|+α⟩' }] : []),
    ...(minus ? [{ ...minus, tone: 'amber' as const, label: '|−α⟩' }] : []),
  ];
  const probs = Array.from({ length: 15 }, (_, k) => coherentPn(k, n));

  return (
    <Bench
      left={<>
        <Checklist items={steps} />
        <Slider label="Drive amplitude ε" value={eps} min={0} max={2} step={0.01} unit="/µs" onChange={setEps} />
        <Slider label="Pulse duration t" value={t} min={0} max={2} step={0.01} unit="µs" onChange={setT} />
        <Slider label="Drive phase θ" value={theta} min={0} max={360} step={1} unit="°" onChange={setTheta} digits={0} />
      </>}
      center={<>
        <PhaseSpace blobs={blobs} targets={TARGETS} range={4} draggable onDrag={drag} />
        <Feedback kind={note ? 'warn' : 'info'}>{note || hint}</Feedback>
      </>}
      right={<>
        <Readout label="Re α" value={alpha.x.toFixed(2)} />
        <Readout label="Im α" value={alpha.y.toFixed(2)} />
        <Readout label="Mean photon number <n>" value={n.toFixed(2)} tone={inBand ? 'amber' : 'cyan'} />
        <Readout label={`Target <n> = ${TARGET_N} (±${TOL_N})`} value={inBand ? 'In band' : 'Outside'} tone={inBand ? 'amber' : 'red'} />
        <PhotonHistogram probs={probs} label="P(n) for the live state" height={170} />
        <button className="btn primary" disabled={bDone} onClick={lockPlus}>Lock this state</button>
        <button className="btn" disabled={!plus || cDone} onClick={lockMinus}>Lock as |−α⟩</button>
        {overlap !== null && <>
          <Readout label="Overlap |⟨+α|−α⟩|" value={overlap.toExponential(2)} tone="violet" />
          <Feedback>Opposite coherent states are not exactly orthogonal at finite alpha.</Feedback>
        </>}
      </>}
    />
  );
}
