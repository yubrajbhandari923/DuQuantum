// Analytic building blocks for levels 1-7. Units: hbar = 1, angular frequencies in rad/s.

export const lcFrequency = (L: number, C: number) => 1 / Math.sqrt(L * C);

/** E_n = omega (n + 1/2) */
export const fockEnergy = (n: number, omega: number) => omega * (n + 0.5);

/** Poisson photon statistics of a coherent state, computed in log space to avoid overflow. */
export function coherentPn(n: number, absAlphaSq: number): number {
  if (absAlphaSq === 0) return n === 0 ? 1 : 0;
  let logFact = 0;
  for (let k = 2; k <= n; k++) logFact += Math.log(k);
  return Math.exp(-absAlphaSq + n * Math.log(absAlphaSq) - logFact);
}

/** |<alpha|-alpha>|^2 = exp(-4|alpha|^2); the amplitude overlap is exp(-2|alpha|^2). */
export const oppositeOverlap = (alpha: number) => Math.exp(-2 * alpha * alpha);

export type CatParity = 'even' | 'odd';

/** Photon distribution of |alpha> +/- |-alpha>: support only on matching parity. */
export function catPn(n: number, alpha: number, parity: CatParity): number {
  const a2 = alpha * alpha;
  if ((n % 2 === 0) !== (parity === 'even')) return 0;
  if (a2 === 0) return n === (parity === 'even' ? 0 : 1) ? 1 : 0; // odd cat -> |1> as alpha -> 0
  const norm = parity === 'even' ? Math.cosh(a2) : Math.sinh(a2);
  return (coherentPn(n, a2) * Math.exp(a2)) / norm; // = alpha^(2n)/n!/cosh|sinh(alpha^2)
}

export const catParity = (parity: CatParity) => (parity === 'even' ? 1 : -1);

const W_COH = (x: number, y: number, ax: number) => (2 / Math.PI) * Math.exp(-2 * ((x - ax) ** 2 + y * y));

/** Wigner function at beta = x + iy for real alpha. */
export const wignerCoherent = (x: number, y: number, alpha: number) => W_COH(x, y, alpha);

export const wignerMixture = (x: number, y: number, alpha: number) =>
  0.5 * (W_COH(x, y, alpha) + W_COH(x, y, -alpha));

/** Cat Wigner function; `coherence` in [0,1] scales the interference term (0 = classical mixture limit). */
export function wignerCat(x: number, y: number, alpha: number, parity: CatParity, coherence = 1): number {
  const s = catParity(parity);
  const n2 = 1 / (2 * (1 + s * Math.exp(-2 * alpha * alpha)));
  const interference = 2 * (2 / Math.PI) * Math.exp(-2 * (x * x + y * y)) * Math.cos(4 * alpha * y);
  return n2 * (W_COH(x, y, alpha) + W_COH(x, y, -alpha) + s * coherence * interference);
}

/** Ordinary single-photon loss: alpha(t) = alpha0 exp(-kappa t / 2). */
export const alphaUnderLoss = (alpha0: number, kappa: number, t: number) => alpha0 * Math.exp((-kappa * t) / 2);

export function rk4(f: (x: number) => number, x0: number, dt: number, steps: number): number {
  let x = x0;
  for (let i = 0; i < steps; i++) {
    const k1 = f(x), k2 = f(x + 0.5 * dt * k1), k3 = f(x + 0.5 * dt * k2), k4 = f(x + dt * k3);
    x += (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
  }
  return x;
}

/** Mean-field two-photon stabilizer: dx/dt = kappa2 x (alpha^2 - x^2). */
export const stabilizerRate = (kappa2: number, alpha: number) => (x: number) => kappa2 * x * (alpha * alpha - x * x);
