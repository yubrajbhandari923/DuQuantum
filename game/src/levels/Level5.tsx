import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LevelProps } from '../types';
import { WignerPlot } from '../instruments/WignerPlot';
import { Bench, Checklist, Feedback, Readout, Slider, useOnce } from './kit';
import { wignerCat, wignerCoherent, wignerMixture } from '../physics/quantum';
import { play } from '../audio/sfx';

const A_T = 2; // target cat size
const gauss = (x: number, y: number) => (2 / Math.PI) * Math.exp(-2 * (x * x + y * y));

/** Wigner function of psi = sqrt(w)|+a> + e^{i phi} sqrt(1-w)|-a>, interference scaled by coherence c (c = 0: statistical mixture). */
export function wignerState(x: number, y: number, a: number, w: number, phi: number, c: number) {
  const s = Math.exp(-2 * a * a);
  const cross = 2 * Math.sqrt(w * (1 - w));
  const norm = 1 + cross * s * Math.cos(phi) * c; // mixture has no overlap term
  const diag = w * wignerCoherent(x, y, a) + (1 - w) * wignerCoherent(x, y, -a);
  return (diag + cross * c * gauss(x, y) * Math.cos(4 * a * y - phi)) / (c ? norm : 1);
}
export const parityOf = (a: number, w: number, phi: number, c: number) => (Math.PI / 2) * wignerState(0, 0, a, w, phi, c);

/** Fidelity with the ideal even cat of size A_T for a state of this family (real amplitudes). */
export function evenCatFidelity(a: number, w: number, phi: number, c: number) {
  const ov = (x: number, y: number) => Math.exp(-((x - y) ** 2) / 2); // <x|y>, real coherent amplitudes
  const sT = Math.exp(-2 * A_T * A_T), nT = 2 * (1 + sT); // |T> = |+At> + |-At>, norm^2
  const tp = ov(A_T, a) + ov(-A_T, a), tm = ov(A_T, -a) + ov(-A_T, -a); // <T|+a>, <T|-a> (unnormalized T)
  const A = Math.sqrt(w), B = Math.sqrt(1 - w) * Math.cos(phi), Bi = Math.sqrt(1 - w) * Math.sin(phi);
  const s = Math.exp(-2 * a * a);
  const re = A * tp + B * tm, im = Bi * tm; // <T|psi>
  const nPsi = 1 + 2 * A * B * s; // |a|^2 + |b|^2 + 2 Re(a* b) s with |a|^2+|b|^2 = 1
  const pure = (re * re + im * im) / (nT * Math.max(nPsi, 1e-9));
  const mix = (w * tp * tp + (1 - w) * tm * tm) / nT;
  return c * pure + (1 - c) * mix;
}

type Kind = 'odd' | 'coherent' | 'even' | 'mixture';
const CANDIDATES: Kind[] = ['odd', 'coherent', 'even', 'mixture'];
const fnOf = (k: Kind) => (x: number, y: number) =>
  k === 'even' ? wignerCat(x, y, A_T, 'even') : k === 'odd' ? wignerCat(x, y, A_T, 'odd') : k === 'mixture' ? wignerMixture(x, y, A_T) : wignerCoherent(x, y, A_T);
const WHY: Record<Kind, string> = {
  coherent: 'One lobe only: that is a single coherent state, not a superposition of two.',
  mixture: 'This state has two lobes but no interference signature, and its parity reads about zero. Two blobs alone prove nothing.',
  odd: 'Fringes are there, but the parity is negative: this is the odd cat.',
  even: 'Fringes with positive parity: coherent superposition verified.',
};
const LABEL: Record<Kind, string> = { even: 'Even cat', odd: 'Odd cat', coherent: 'Coherent state', mixture: 'Statistical mixture' };

export default function Level5({ onComplete, onReport }: LevelProps) {
  const [probe, setProbe] = useState<Kind[]>([]);
  const [picked, setPicked] = useState<Kind | null>(null);
  const [a, setA] = useState(1.2);
  const [w, setW] = useState(0.8);
  const [phi, setPhi] = useState(1.2);
  const [cTarget, setCTarget] = useState(0);
  const [c, setC] = useState(0); // displayed coherence: eases toward the slider so fringes emerge instead of snapping
  const [locked, setLocked] = useState(false);
  const cRef = useRef(0); cRef.current = c;

  useEffect(() => {
    let id = 0;
    const tick = () => {
      const d = cTarget - cRef.current;
      if (Math.abs(d) > 0.002) { setC(cRef.current + d * 0.12); id = requestAnimationFrame(tick); } else setC(cTarget);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [cTarget]);

  const fn = useCallback((x: number, y: number) => wignerState(x, y, a, w, phi, c), [a, w, phi, c]);
  const fid = evenCatFidelity(a, w, phi, c);
  const par = parityOf(a, w, phi, c);
  const minW = useMemo(() => { let m = 0; for (let x = -3; x <= 3; x += 0.1) for (let y = -3; y <= 3; y += 0.05) m = Math.min(m, wignerState(x, y, a, w, phi, c)); return m; }, [a, w, phi, c]);
  const fringes = minW < -0.04;

  const identified = picked === 'even';
  const prepared = fid >= 0.97 && c >= 0.95 && a >= 1.5;
  const steps = [
    { label: 'Identify the even cat among four candidates', done: identified },
    { label: 'Prepare an even cat (fidelity ≥ 97%, a ≥ 1.5)', done: prepared },
    { label: 'Show the interference signature (negative Wigner regions)', done: prepared && fringes },
    { label: 'Confirm even parity', done: prepared && par > 0.95 },
  ];
  const next = steps.find((s) => !s.done);
  useEffect(() => onReport(next ? next.label : locked ? 'Experiment complete' : 'Press “Verify even cat” to lock it in'), [next?.label, locked, onReport]);
  useOnce(!next && locked, () => onComplete({ score: Math.round(fid * 100), detail: `fidelity ${(fid * 100).toFixed(1)}% · parity ${par.toFixed(2)} · min W ${minW.toFixed(2)}` }));

  const cands = useMemo(() => CANDIDATES.map((k) => ({ k, f: fnOf(k) })), []);
  const hint = identified ? null : picked ? WHY[picked] : null;

  return (
    <Bench
      left={<>
        <Checklist items={steps} />
        <b style={{ fontSize: 14 }}>Four unlabeled candidates</b>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {cands.map(({ k, f }, i) => (
            <div key={k} style={{ display: 'grid', gap: 4 }}>
              <button className="btn" style={{ padding: 4, borderColor: picked === k ? (k === 'even' ? 'var(--cyan)' : 'var(--red)') : undefined }} aria-label={`Candidate ${i + 1}`} onClick={() => { setPicked(k); play(k === 'even' ? 'success' : 'fail'); }}>
                <WignerPlot fn={f} resolution={56} range={3.6} />
              </button>
              <button className="btn small ghost" onClick={() => { setProbe((p) => (p.includes(k) ? p : [...p, k])); play('measure'); }}>
                {probe.includes(k) ? `<Π> = ${(((Math.PI / 2) * f(0, 0))).toFixed(2)}` : `Measure parity ${i + 1}`}
              </button>
            </div>
          ))}
        </div>
        {picked && <Feedback kind={identified ? 'ok' : 'warn'}>{identified ? WHY.even : `Candidate: ${LABEL[picked]}. ${hint}`}</Feedback>}
      </>}
      center={<>
        <WignerPlot fn={fn} range={4} resolution={140} showLegend label="Your state" />
        <Feedback>{c < 0.2 ? 'Two lobes, no fringes: this is a mixture, whatever the lobe positions suggest.' : fringes ? 'Interference fringes with negative regions: genuine coherence.' : 'Coherence is partial. Raise it to bring the fringes up.'}</Feedback>
      </>}
      right={<>
        <Slider label="Cat size α" value={a} min={1} max={3} step={0.05} onChange={setA} />
        <Slider label="Weight on |+α⟩" value={w} min={0} max={1} step={0.01} onChange={setW} />
        <Slider label="Relative phase φ" value={(phi * 180) / Math.PI} min={0} max={360} step={1} unit="°" digits={0} onChange={(v) => setPhi((v * Math.PI) / 180)} />
        <Slider label="Coherence" value={cTarget} min={0} max={1} step={0.01} onChange={(v) => { if (cTarget < 0.5 && v >= 0.5) play('reveal'); setCTarget(v); }} />
        <Readout label="Photon parity ⟨Π⟩" value={par.toFixed(2)} tone={par > 0.95 ? 'cyan' : par < -0.5 ? 'violet' : 'amber'} note="+1 even cat · −1 odd cat" />
        <Readout label="Fidelity with the even cat" value={`${(fid * 100).toFixed(1)}%`} tone={fid >= 0.97 ? 'cyan' : 'amber'} />
        <button className="btn primary" disabled={!(prepared && identified && fringes && par > 0.95)} onClick={() => { play('success'); setLocked(true); }}>Verify even cat</button>
      </>}
    />
  );
}
