import { useCallback, useEffect, useRef, useState } from 'react';
import { PhaseSpace } from '../instruments/PhaseSpace';
import { PhotonHistogram } from '../instruments/PhotonHistogram';
import { WignerPlot } from '../instruments/WignerPlot';
import { Oscilloscope } from '../instruments/Oscilloscope';
import { Bench, Readout, Slider, useRaf } from './kit';
import { useGame } from '../store';

// Thin glue: a truncated-Fock density matrix evolved under the same Lindblad terms the levels use
// (kappa1 D[a], kappa2 D[a^2], dephasing D[n], resonant drive eps(a + a†)). hbar = 1.
export const N = 28;
export type Rho = { re: Float64Array; im: Float64Array };
export interface Params { k1: number; k2: number; dephase: number; drive: number }
export type Kind = 'fock' | 'coherent' | 'cat' | 'mixture' | 'thermal';

const SQ = Array.from({ length: N + 1 }, (_, i) => Math.sqrt(i));
const zero = (): Rho => ({ re: new Float64Array(N * N), im: new Float64Array(N * N) });

/** |alpha> amplitudes (ar + i ai) in the Fock basis. */
export function coherentVec(ar: number, ai: number): { re: number[]; im: number[] } {
  const re: number[] = [], im: number[] = [];
  const r = Math.hypot(ar, ai), phi = Math.atan2(ai, ar);
  let c = Math.exp(-r * r / 2);
  for (let n = 0; n < N; n++) {
    if (n) c *= r / SQ[n];
    re.push(c * Math.cos(n * phi)); im.push(c * Math.sin(n * phi));
  }
  return { re, im };
}

function pure(re: number[], im: number[]): Rho {
  const s = Math.hypot(...re, ...im), rho = zero();
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    rho.re[i * N + j] = (re[i] * re[j] + im[i] * im[j]) / (s * s);
    rho.im[i * N + j] = (im[i] * re[j] - re[i] * im[j]) / (s * s);
  }
  return rho;
}

/** `amp` is n (Fock), alpha (coherent/cat/mixture) or mean photon number (thermal). */
export function initialRho(kind: Kind, amp: number, parity: 1 | -1 = 1): Rho {
  if (kind === 'fock') { const v = Array(N).fill(0); v[Math.min(N - 1, Math.round(amp))] = 1; return pure(v, Array(N).fill(0)); }
  if (kind === 'coherent') { const c = coherentVec(amp, 0); return pure(c.re, c.im); }
  if (kind === 'cat') {
    const p = coherentVec(amp, 0), m = coherentVec(-amp, 0);
    return pure(p.re.map((v, n) => v + parity * m.re[n]), Array(N).fill(0));
  }
  const rho = zero();
  if (kind === 'mixture') {
    const p = pure(coherentVec(amp, 0).re, Array(N).fill(0)), m = pure(coherentVec(-amp, 0).re, Array(N).fill(0));
    rho.re.forEach((_, k) => { rho.re[k] = 0.5 * (p.re[k] + m.re[k]); });
    return rho;
  }
  const q = amp / (1 + amp); let z = 0;
  for (let n = 0; n < N; n++) z += q ** n;
  for (let n = 0; n < N; n++) rho.re[n * N + n] = q ** n / z;
  return rho;
}

function deriv(r: Rho, p: Params): Rho {
  const { re, im } = r, d = zero();
  const at = (a: Float64Array, i: number, j: number) => (i < 0 || j < 0 || i >= N || j >= N ? 0 : a[i * N + j]);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const k = i * N + j;
    const g = -p.k1 * (i + j) / 2 - p.k2 * (i * (i - 1) + j * (j - 1)) / 2 - p.dephase * (i - j) ** 2 / 2;
    const jump = p.k1 * SQ[i + 1] * SQ[j + 1];
    const jump2 = p.k2 * SQ[i + 1] * SQ[i + 2 > N ? N : i + 2] * SQ[j + 1] * SQ[j + 2 > N ? N : j + 2];
    let dr = g * re[k] + jump * at(re, i + 1, j + 1) + jump2 * at(re, i + 2, j + 2);
    let di = g * im[k] + jump * at(im, i + 1, j + 1) + jump2 * at(im, i + 2, j + 2);
    if (p.drive) { // -i eps [X, rho], X = a + a†
      const cr = SQ[i + 1] * at(re, i + 1, j) + SQ[i] * at(re, i - 1, j) - SQ[j] * at(re, i, j - 1) - SQ[j + 1] * at(re, i, j + 1);
      const ci = SQ[i + 1] * at(im, i + 1, j) + SQ[i] * at(im, i - 1, j) - SQ[j] * at(im, i, j - 1) - SQ[j + 1] * at(im, i, j + 1);
      dr += p.drive * ci; di -= p.drive * cr;
    }
    d.re[k] = dr; d.im[k] = di;
  }
  return d;
}

const axpy = (r: Rho, d: Rho, h: number): Rho => ({ re: r.re.map((v, k) => v + h * d.re[k]), im: r.im.map((v, k) => v + h * d.im[k]) });

export function step(r: Rho, p: Params, dt: number): Rho {
  const k1 = deriv(r, p), k2 = deriv(axpy(r, k1, dt / 2), p), k3 = deriv(axpy(r, k2, dt / 2), p), k4 = deriv(axpy(r, k3, dt), p);
  const out = axpy(r, k1, dt / 6);
  for (const [k, w] of [[k2, dt / 3], [k3, dt / 3], [k4, dt / 6]] as const) for (let i = 0; i < N * N; i++) { out.re[i] += w * k.re[i]; out.im[i] += w * k.im[i]; }
  return out;
}

export function observables(r: Rho) {
  let n = 0, parity = 0, trace = 0, ar = 0, ai = 0;
  for (let i = 0; i < N; i++) {
    const p = r.re[i * N + i]; trace += p; n += i * p; parity += (i % 2 ? -1 : 1) * p;
    if (i + 1 < N) { ar += SQ[i + 1] * r.re[(i + 1) * N + i]; ai += SQ[i + 1] * r.im[(i + 1) * N + i]; } // <a> = sum sqrt(i+1) rho_{i+1,i}
  }
  return { n, parity, trace, ar, ai, a2: ar * ar + ai * ai };
}

const LOG_FACT = [0]; for (let i = 1; i < 2 * N; i++) LOG_FACT.push(LOG_FACT[i - 1] + Math.log(i));

/** W(x + iy) = (2/pi) e^{-2|b|^2} sum_{m,n} (-1)^n sqrt(n!/m!) (2 conj b)^{m-n} L_n^{(m-n)}(4|b|^2) rho_mn (m >= n, off-diagonals doubled). */
export function wignerOf(r: Rho, x: number, y: number): number {
  const r2 = x * x + y * y, X = 4 * r2, rad = Math.sqrt(r2), phi = Math.atan2(-y, x); // arg of conj(b)
  let sum = 0;
  for (let d = 0; d < N; d++) {
    const mag = (2 * rad) ** d, cr = mag * Math.cos(d * phi), ci = mag * Math.sin(d * phi);
    let l0 = 1, l1 = 1 + d - X; // L_0, L_1 of order d
    for (let n = 0; n + d < N; n++) {
      const L = n === 0 ? l0 : n === 1 ? l1 : (l0 = ((2 * n - 1 + d - X) * l1 - (n - 1 + d) * l0) / n, [l0, l1] = [l1, l0], l1);
      const k = (n + d) * N + n;
      const c = d ? 2 * (r.re[k] * cr - r.im[k] * ci) : r.re[k];
      sum += (n % 2 ? -1 : 1) * Math.exp(0.5 * (LOG_FACT[n] - LOG_FACT[n + d])) * c * L;
    }
  }
  return (2 / Math.PI) * Math.exp(-2 * r2) * sum;
}

const SPEED = 1, DT = 0.01, KEEP = 400;
const KINDS: [Kind, string][] = [['fock', 'Fock |n>'], ['coherent', 'Coherent |alpha>'], ['cat', 'Cat |alpha> ± |-alpha>'], ['mixture', 'Mixture of ±alpha'], ['thermal', 'Thermal']];

export default function Sandbox() {
  const go = useGame((s) => s.go);
  const [kind, setKind] = useState<Kind>('cat');
  const [amp, setAmp] = useState(2);
  const [parity, setParity] = useState<1 | -1>(1);
  const [par, setPar] = useState<Params>({ k1: 0, k2: 0, dephase: 0, drive: 0 });
  const [playing, setPlaying] = useState(true);
  const [, tick] = useState(0);
  const sim = useRef({ rho: initialRho('cat', 2), t: 0, hist: [] as ReturnType<typeof observables>[], ts: [] as number[], trail: [] as { x: number; y: number }[], next: 0 });

  const reset = useCallback(() => {
    const s = sim.current;
    s.rho = initialRho(kind, amp, parity); s.t = 0; s.hist = []; s.ts = []; s.trail = []; s.next = 0;
    tick((v) => v + 1);
  }, [kind, amp, parity]);
  useEffect(reset, [reset]);
  const setP = (k: keyof Params) => (v: number) => setPar((p) => ({ ...p, [k]: v }));

  useRaf((dt) => {
    if (!playing) return;
    const s = sim.current;
    for (let n = Math.max(1, Math.round((dt * SPEED) / DT)); n > 0; n--) { s.rho = step(s.rho, par, DT); s.t += DT; }
    if (s.t >= s.next) {
      const o = observables(s.rho);
      s.hist.push(o); s.ts.push(s.t); s.trail.push({ x: o.ar, y: o.ai }); s.next = s.t + 0.1;
      if (s.hist.length > KEEP) { s.hist.shift(); s.ts.shift(); s.trail.shift(); }
    }
    tick((v) => v + 1);
  });

  const { rho, t, hist, ts, trail } = sim.current;
  const o = observables(rho);
  const wfn = useCallback((x: number, y: number) => wignerOf(rho, x, y), [rho]);
  const probs = Array.from({ length: 20 }, (_, n) => rho.re[n * N + n]);
  const ampLabel = kind === 'fock' ? ['Photon number n', 0, 8, 1, 0] : kind === 'thermal' ? ['Mean photon number', 0, 6, 0.1, 1] : ['Amplitude alpha', 0, 3, 0.05, 2];

  return (
    <div className="sle lvl">
      <header className="lvl-head panel">
        <button className="btn small" onClick={() => go('hub')}>Back to lab</button>
        <h2>Free laboratory</h2>
        <div className="obj">Prepare a state, switch on loss, dephasing or a drive, and watch it evolve. Nothing here is scored.</div>
        <button className="btn small" onClick={() => setPlaying((v) => !v)} aria-pressed={playing}>{playing ? 'Pause' : 'Play'}</button>
        <button className="btn small" onClick={reset}>Reset</button>
      </header>
      <main className="lvl-body panel">
        <Bench
          left={<>
            <label style={{ display: 'grid', gap: 4, fontSize: 14 }}>State
              <select value={kind} onChange={(e) => { const k = e.target.value as Kind; setKind(k); setAmp(k === 'fock' ? 1 : k === 'thermal' ? 1 : 2); }}
                style={{ padding: 6, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--edge)', borderRadius: 6 }}>
                {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            <Slider label={ampLabel[0] as string} value={amp} min={ampLabel[1] as number} max={ampLabel[2] as number} step={ampLabel[3] as number} digits={ampLabel[4] as number} onChange={setAmp} />
            {kind === 'cat' && <button className="btn small" aria-pressed={parity === 1} onClick={() => setParity((p) => (p === 1 ? -1 : 1))}>{parity === 1 ? 'Even cat (+)' : 'Odd cat (-)'}</button>}
            <Slider label="Single-photon loss kappa1" value={par.k1} min={0} max={1} onChange={setP('k1')} />
            <Slider label="Two-photon loss kappa2" value={par.k2} min={0} max={0.5} onChange={setP('k2')} />
            <Slider label="Dephasing" value={par.dephase} min={0} max={1} onChange={setP('dephase')} />
            <Slider label="Drive epsilon" value={par.drive} min={0} max={1} onChange={setP('drive')} />
          </>}
          center={<>
            <WignerPlot fn={wfn} range={4} resolution={64} label="Wigner function" />
            <PhotonHistogram probs={probs} label="Photon number distribution" height={190} />
          </>}
          right={<>
            <PhaseSpace range={4} blobs={[{ x: o.ar, y: o.ai, tone: 'cyan', label: '<a>' }]} trajectories={trail.length > 1 ? [trail] : undefined} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              <Readout label="Mean photons" value={o.n.toFixed(2)} />
              <Readout label="Parity" value={o.parity.toFixed(2)} tone="violet" />
              <Readout label="alpha² = |<a>|²" value={o.a2.toFixed(2)} tone="amber" />
              <Readout label="Time" value={t.toFixed(1)} />
            </div>
            <Oscilloscope
              series={[{ label: '<n>', tone: 'cyan', x: ts, y: hist.map((h) => h.n) }, { label: 'parity', tone: 'violet', x: ts, y: hist.map((h) => h.parity) }, { label: 'alpha²', tone: 'amber', x: ts, y: hist.map((h) => h.a2) }]}
              xLabel="Time" yLabel="value" height={170}
            />
          </>}
        />
      </main>
    </div>
  );
}
