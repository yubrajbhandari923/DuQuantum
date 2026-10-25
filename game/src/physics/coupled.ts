// Memory (a) + lossy buffer (b) mean-field model. H = g2 (a^2 b† + a†^2 b) - eps_d (b + b†), rates in rad/us.

export interface CoupledParams { g2: number; kappaA: number; kappaB: number; epsD: number }
/** State vector [Re a, Im a, Re b, Im b]. */
export type CoupledState = [number, number, number, number];

/** Benchmark in rad/us (0.763 MHz, 2.6 MHz, 9.3 kHz). */
export const DEFAULTS: CoupledParams = {
  g2: 0.763 * 2 * Math.PI, kappaB: 2.6 * 2 * Math.PI, kappaA: 0.0093 * 2 * Math.PI,
  epsD: 0.763 * 2 * Math.PI * 4.41,
};

/** Effective stabilization rate and amplitude after adiabatically eliminating the buffer. */
export const kappa2 = (p: CoupledParams) => (4 * p.g2 * p.g2) / p.kappaB;
export const alphaSq = (p: CoupledParams) => p.epsD / p.g2;

/** Pump condition: omega_p = 2 omega_a - omega_b. */
export const pumpFrequency = (omegaA: number, omegaB: number) => 2 * omegaA - omegaB;

function deriv(s: CoupledState, p: CoupledParams, delta: number, t: number): CoupledState {
  const [ar, ai, br, bi] = s;
  // Detuned pump: coupling g(t) = g2 e^{i delta t} rotates and averages out. a' = -kA/2 a - 2i g a* b ; b' = -kB/2 b - i (g* a^2 - eps)
  const gr = p.g2 * Math.cos(delta * t), gi = p.g2 * Math.sin(delta * t);
  const abR = ar * br + ai * bi, abI = ar * bi - ai * br;
  const a2R = ar * ar - ai * ai, a2I = 2 * ar * ai;
  const pR = gr * abR - gi * abI, pI = gr * abI + gi * abR;
  const qR = gr * a2R + gi * a2I, qI = gr * a2I - gi * a2R;
  return [
    -0.5 * p.kappaA * ar + 2 * pI,
    -0.5 * p.kappaA * ai - 2 * pR,
    -0.5 * p.kappaB * br + qI,
    -0.5 * p.kappaB * bi + p.epsD - qR,
  ];
}

/** RK4 integration; returns |a|^2 and Re b samples every `every` steps. `pumpDetuning` in rad/us. */
export function simulate(p: CoupledParams, a0: number, tEnd: number, dt = 0.002, every = 25, pumpDetuning = 0) {
  let s: CoupledState = [a0, 0, 0, 0];
  const t: number[] = [], n: number[] = [], bre: number[] = [];
  const steps = Math.ceil(tEnd / dt);
  for (let i = 0; i <= steps; i++) {
    const now = i * dt;
    if (i % every === 0) { t.push(now); n.push(s[0] ** 2 + s[1] ** 2); bre.push(s[2]); }
    const k1 = deriv(s, p, pumpDetuning, now);
    const k2 = deriv(add(s, k1, dt / 2), p, pumpDetuning, now + dt / 2);
    const k3 = deriv(add(s, k2, dt / 2), p, pumpDetuning, now + dt / 2);
    const k4 = deriv(add(s, k3, dt), p, pumpDetuning, now + dt);
    s = s.map((x, j) => x + (dt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j])) as CoupledState;
  }
  return { t, n, bre };
}
const add = (s: CoupledState, k: CoupledState, h: number) => s.map((x, j) => x + h * k[j]) as CoupledState;

/** Reduced single-mode model: d alpha/dt = kappa2 alpha (alpha_inf^2 - alpha^2) for real alpha, ignoring kappa_a. */
export function reduced(p: CoupledParams, a0: number, tEnd: number, dt = 0.002, every = 25) {
  const k2 = kappa2(p), A2 = alphaSq(p);
  let x = a0;
  const t: number[] = [], n: number[] = [];
  for (let i = 0; i <= Math.ceil(tEnd / dt); i++) {
    if (i % every === 0) { t.push(i * dt); n.push(x * x); }
    const f = (y: number) => k2 * y * (A2 - y * y);
    const k1 = f(x), kk2 = f(x + 0.5 * dt * k1), k3 = f(x + 0.5 * dt * kk2), k4 = f(x + dt * k3);
    x += (dt / 6) * (k1 + 2 * kk2 + 2 * k3 + k4);
  }
  return { t, n };
}

/** First time after which |a|^2 stays within `tol` (fraction) of its final value; Infinity if never. */
export function settlingTime(t: number[], n: number[], tol = 0.05): number {
  const final = n[n.length - 1];
  for (let i = n.length - 1; i >= 0; i--) if (Math.abs(n[i] - final) > tol * final) return i === n.length - 1 ? Infinity : t[i + 1];
  return t[0];
}

export const overshoot = (n: number[]) => { const f = n[n.length - 1]; return Math.max(0, (Math.max(...n) - f) / f); };
