// Cat-qubit error model. Rates in 1/s, alpha real.
export const MHZ2PI = 2 * Math.PI * 1e6;
export const KHZ2PI = 2 * Math.PI * 1e3;

/** Benchmarks from the DuQuantum explainer. */
export const BASE = { g2: 0.763 * MHZ2PI, kappaB: 2.6 * MHZ2PI, kappaA: 9.3 * KHZ2PI, alpha: 2.1 };

/** Phase-flip (parity decay) rate: Gamma_Z ~= 2 kappa_a alpha^2. At the benchmark it gives ~1.94 us. */
export const gammaZ = (kappaA: number, alpha: number) => 2 * kappaA * alpha * alpha;

/** Calibrated bit-flip suppression exponent. It is regime dependent; this is a fit to 2.6 s at alpha^2 = 4.41. */
export const GAMMA_EXP = 2;
const GAMMA_X0 = Math.exp(GAMMA_EXP * 4.41) / 2.6;
export const gammaX = (alpha: number) => GAMMA_X0 * Math.exp(-GAMMA_EXP * alpha * alpha);

/** Parity of an even cat under single-photon loss: exp(-Gamma_Z t). */
export const parityDecay = (kappaA: number, alpha: number, t: number) => Math.exp(-gammaZ(kappaA, alpha) * t);

/** Pure two-photon loss conserves parity but is nonlinear: d(alpha^2)/dt = -2 kappa2 alpha^4, so alpha^2(t) = alpha0^2 / (1 + 2 kappa2 alpha0^2 t). Amplitude decays algebraically toward vacuum. */
export const alphaSqUnderPairLoss = (a2: number, kappa2: number, t: number) => a2 / (1 + 2 * kappa2 * a2 * t);

/** Logical error caused by single-photon loss in the coherent-state basis: a|+-alpha> = +-alpha|+-alpha> -> alpha Z_L. */
export const logicalErrorOfLoss = (): 'Z' => 'Z';
